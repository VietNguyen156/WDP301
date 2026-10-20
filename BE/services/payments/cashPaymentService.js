// Cash collected in person: landlords confirm directly, managers report for the landlord to approve.
const mongoose = require("mongoose");
const { Payment } = require("../../models");
const PaymentReceipt = require("../../models/PaymentReceipt");
const { AppError } = require("../../utils/errors");
const validate = require("../../utils/financeValidation");
const { getTenantScope } = require("../../utils/scope");
const { getInvoice } = require("../invoiceService");
const { paymentBalance } = require("../financeCalculation");
const { recordAudit } = require("../auditService");
const { assertPayable, applyPayment } = require("./applyPayment");

async function confirmCash(req) {
  const body = req.body || {};
  const amount = validate.money(body.amount, "amount", true);
  const referenceCode = validate.text(body.receiptNumber, "receiptNumber", 100);
  const transactionDate = validate.date(
    body.transactionDate,
    "transactionDate",
  );
  if (transactionDate > new Date())
    throw new AppError(
      "Ngày thu tiền không được nằm trong tương lai",
      400,
      "VALIDATION_ERROR",
    );
  const details = {
    amount,
    referenceCode,
    receiptNumber: referenceCode,
    transactionDate,
    paymentMethod: "CASH",
    gateway: "CASH",
    reportedBy: req.user._id,
  };
  if (req.user.role === "LANDLORD") details.confirmedBy = req.user._id;
  for (const field of ["payerName", "cashCollectionPoint", "note"]) {
    if (body[field] !== undefined)
      details[field] = validate.text(
        body[field],
        field,
        field === "note" ? 1000 : 250,
      );
  }
  try {
    return await mongoose.connection.transaction(async (session) => {
      const invoice = await getInvoice(req, body.invoiceId, session);
      assertPayable(invoice);
      // Receipt numbers are the landlord's own series; bank references live in another namespace.
      const receiptKey = PaymentReceipt.receiptId(invoice.landlordId, "CASH", referenceCode);
      if (
        (await PaymentReceipt.exists({ _id: receiptKey }).session(session)) ||
        (await Payment.exists({
          landlordId: invoice.landlordId,
          paymentMethod: "CASH",
          referenceCode,
        }).session(session))
      )
        throw new AppError(
          "Số biên lai đã tồn tại",
          409,
          "PAYMENT_REFERENCE_DUPLICATED",
        );

      if (req.user.role === "PROPERTY_MANAGER") {
        const [payment] = await Payment.create(
          [
            {
              ...details,
              landlordId: invoice.landlordId,
              branchId: invoice.branchId,
              invoiceId: invoice._id,
              invoiceCode: invoice.invoiceCode,
              status: "PENDING_CONFIRMATION",
            },
          ],
          { session },
        );
        const [receipt] = await PaymentReceipt.create(
          [
            {
              _id: receiptKey,
              referenceCode,
              landlordId: invoice.landlordId,
              source: "CASH",
              amount,
              paymentId: payment._id,
            },
          ],
          { session },
        );
        await recordAudit(
          {
            actor: req.user,
            invoice,
            action: "REPORT_CASH_PAYMENT",
            before: {
              paidAmount: invoice.paidAmount,
              remainingAmount: invoice.remainingAmount,
              status: invoice.status,
            },
            after: {
              paymentId: payment._id,
              amount,
              status: payment.status,
              receiptId: receipt._id,
            },
            metadata: req.auditMetadata,
          },
          session,
        );
        return { payment, invoice, pendingConfirmation: true };
      }

      const [receipt] = await PaymentReceipt.create(
        [
          {
            _id: receiptKey,
            referenceCode,
            landlordId: invoice.landlordId,
            source: "CASH",
            amount,
          },
        ],
        { session },
      );
      const result = await applyPayment(
        {
          invoice,
          details,
          actor: req.user,
          action: "CONFIRM_CASH_PAYMENT",
          metadata: req.auditMetadata,
        },
        session,
      );
      receipt.paymentId = result.payment._id;
      await receipt.save({ session });
      return result;
    });
  } catch (error) {
    if (error.code === 11000)
      throw new AppError(
        "Số biên lai đã tồn tại",
        409,
        "PAYMENT_REFERENCE_DUPLICATED",
      );
    throw error;
  }
}

async function confirmCashReport(req) {
  const paymentId = validate.objectId(req.params.paymentId, "paymentId");
  return mongoose.connection.transaction(async (session) => {
    const payment = await Payment.findOne({
      _id: paymentId,
      ...getTenantScope(req),
      paymentMethod: "CASH",
      status: "PENDING_CONFIRMATION",
      isDeleted: false,
    }).session(session);
    if (!payment)
      throw new AppError(
        "Không tìm thấy báo cáo thu tiền mặt đang chờ duyệt",
        404,
        "CASH_REPORT_NOT_FOUND",
      );
    const invoice = await getInvoice(req, payment.invoiceId, session);
    assertPayable(invoice);
    const before = {
      paidAmount: invoice.paidAmount,
      remainingAmount: invoice.remainingAmount,
      status: invoice.status,
    };
    Object.assign(invoice, paymentBalance(invoice, payment.amount));
    payment.status = "SUCCESS";
    payment.confirmedBy = req.user._id;
    payment.reviewedBy = req.user._id;
    payment.reviewedAt = new Date();
    await payment.save({ session });
    await invoice.save({ session });
    await recordAudit(
      {
        actor: req.user,
        invoice,
        action: "CONFIRM_CASH_PAYMENT",
        before,
        after: {
          paymentId: payment._id,
          amount: payment.amount,
          paidAmount: invoice.paidAmount,
          remainingAmount: invoice.remainingAmount,
          status: invoice.status,
        },
        metadata: req.auditMetadata,
      },
      session,
    );
    return { payment, invoice };
  });
}

async function rejectCashReport(req) {
  const paymentId = validate.objectId(req.params.paymentId, "paymentId");
  const reason = validate.text(req.body?.reason, "reason", 1000);
  return mongoose.connection.transaction(async (session) => {
    const payment = await Payment.findOne({
      _id: paymentId,
      ...getTenantScope(req),
      paymentMethod: "CASH",
      status: "PENDING_CONFIRMATION",
      isDeleted: false,
    }).session(session);
    if (!payment)
      throw new AppError(
        "Không tìm thấy báo cáo thu tiền mặt đang chờ duyệt",
        404,
        "CASH_REPORT_NOT_FOUND",
      );
    payment.status = "FAILED";
    payment.reviewedBy = req.user._id;
    payment.reviewedAt = new Date();
    payment.reviewNote = reason;
    await payment.save({ session });
    await recordAudit(
      {
        actor: req.user,
        invoice: { _id: payment.invoiceId, landlordId: payment.landlordId },
        action: "REJECT_CASH_PAYMENT",
        before: { paymentId: payment._id, status: "PENDING_CONFIRMATION" },
        after: { paymentId: payment._id, status: payment.status, reason },
        metadata: req.auditMetadata,
      },
      session,
    );
    return { payment };
  });
}

module.exports = { confirmCash, confirmCashReport, rejectCashReport };
