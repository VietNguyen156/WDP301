// Transfers that could not be matched automatically, reviewed and assigned by the landlord.
const mongoose = require("mongoose");
const { Payment, UnmatchedPayment } = require("../../models");
const PaymentReceipt = require("../../models/PaymentReceipt");
const { AppError } = require("../../utils/errors");
const validate = require("../../utils/financeValidation");
const { getTenantScope } = require("../../utils/scope");
const { getInvoice } = require("../invoiceService");
const { assertPayable, applyPayment } = require("./applyPayment");

async function resolveUnmatched(req) {
  const id = validate.objectId(
    req.params.unmatchedPaymentId,
    "unmatchedPaymentId",
  );
  return mongoose.connection.transaction(async (session) => {
    const unmatched = await UnmatchedPayment.findOne({
      _id: id,
      ...getTenantScope(req),
      status: "PENDING_REVIEW",
      isDeleted: false,
    }).session(session);
    if (!unmatched)
      throw new AppError(
        "Không tìm thấy giao dịch chưa đối soát",
        404,
        "RESOURCE_NOT_FOUND",
      );
    const invoice = await getInvoice(req, req.body?.invoiceId, session);
    assertPayable(invoice);
    const existing = await Payment.findOne({
      landlordId: unmatched.landlordId,
      referenceCode: unmatched.referenceCode,
      paymentMethod: { $in: ["BANK_TRANSFER", "VIETQR"] },
    }).session(session);
    if (existing)
      throw new AppError(
        "Giao dịch đã được đối soát",
        409,
        "PAYMENT_REFERENCE_DUPLICATED",
      );
    let receipt = await PaymentReceipt.findOne({
      $or: [
        { _id: PaymentReceipt.receiptId(unmatched.landlordId, "SEPAY", unmatched.referenceCode) },
        { _id: unmatched.referenceCode, landlordId: unmatched.landlordId, source: "SEPAY" },
      ],
    }).session(session);
    if (!receipt) {
      [receipt] = await PaymentReceipt.create(
        [
          {
            _id: PaymentReceipt.receiptId(unmatched.landlordId, "SEPAY", unmatched.referenceCode),
            referenceCode: unmatched.referenceCode,
            landlordId: unmatched.landlordId,
            source: "SEPAY",
            amount: unmatched.amount,
            unmatchedPaymentId: unmatched._id,
          },
        ],
        { session },
      );
    }
    if (
      String(receipt.landlordId) !== String(invoice.landlordId) ||
      receipt.source !== "SEPAY" ||
      receipt.amount !== unmatched.amount ||
      receipt.paymentId
    )
      throw new AppError(
        "Giao dịch đã được sử dụng",
        409,
        "PAYMENT_REFERENCE_CONFLICT",
      );
    const result = await applyPayment(
      {
        invoice,
        details: {
          referenceCode: unmatched.referenceCode,
          amount: unmatched.amount,
          transactionDate: unmatched.transactionDate,
          gateway: unmatched.gateway,
          content: unmatched.content,
          rawWebhookData: unmatched.rawWebhookData,
          paymentMethod: "BANK_TRANSFER",
          confirmedBy: req.user._id,
        },
        actor: req.user,
        action: "RESOLVE_UNMATCHED_PAYMENT",
        metadata: req.auditMetadata,
      },
      session,
    );
    unmatched.status = "RESOLVED";
    unmatched.resolvedInvoiceId = invoice._id;
    unmatched.resolvedBy = req.user._id;
    unmatched.resolvedAt = new Date();
    await unmatched.save({ session });
    receipt.paymentId = result.payment._id;
    await receipt.save({ session });
    return result;
  });
}

async function listUnmatched(req) {
  const filter = { ...getTenantScope(req), isDeleted: false };
  const status = req.query.status || "PENDING_REVIEW";
  if (!["PENDING_REVIEW", "RESOLVED", "IGNORED"].includes(status))
    throw new AppError("Trạng thái không hợp lệ", 400, "VALIDATION_ERROR");
  filter.status = status;
  const { page, limit, skip } = validate.pagination(req.query);
  const [data, total] = await Promise.all([
    UnmatchedPayment.find(filter)
      .select("-rawWebhookData -senderAccountNumber -senderBank")
      .sort({ createdAt: -1, _id: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    UnmatchedPayment.countDocuments(filter),
  ]);
  return { data, pagination: { page, limit, total } };
}

module.exports = { resolveUnmatched, listUnmatched };
