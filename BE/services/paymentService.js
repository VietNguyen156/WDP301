const mongoose = require("mongoose");
const { Invoice, Payment, UnmatchedPayment, User } = require("../models");
const PaymentReceipt = require("../models/PaymentReceipt");
const AppError = require("../utils/AppError");
const validate = require("../utils/financeValidation");
const { getTenantScope } = require("../utils/tenantScope");
const { getInvoice, invoiceScope } = require("./invoiceService");
const { paymentBalance, makeVietQr } = require("./financeCalculation");
const { recordAudit } = require("./auditService");

function assertPayable(invoice) {
  if (invoice.status === "CANCELLED")
    throw new AppError(409, "INVOICE_CANCELLED", "Hóa đơn đã hủy");
  if (["PAID", "OVERPAID"].includes(invoice.status))
    throw new AppError(
      409,
      "INVOICE_ALREADY_PAID",
      "Hóa đơn đã được thanh toán đầy đủ",
    );
  if (!["ISSUED", "PARTIALLY_PAID", "UNPAID"].includes(invoice.status)) {
    throw new AppError(409, "INVOICE_NOT_ISSUED", "Hóa đơn chưa phát hành");
  }
}

async function applyPayment(
  { invoice, details, actor, action, metadata },
  session,
) {
  assertPayable(invoice);
  const before = {
    paidAmount: invoice.paidAmount,
    remainingAmount: invoice.remainingAmount,
    overpaidAmount: invoice.overpaidAmount,
    status: invoice.status,
  };
  Object.assign(invoice, paymentBalance(invoice, details.amount));
  if (!invoice.bankSnapshot?.bankCode) {
    const landlord = await User.findOne({ _id: invoice.landlordId, role: "LANDLORD", isDeleted: false }).session(session);
    if (landlord?.bankConfig.bankCode && landlord.bankConfig.accountNumber && landlord.bankConfig.accountName) {
      invoice.bankSnapshot = landlord.bankConfig;
    }
  }
  if (invoice.bankSnapshot?.bankCode) {
    invoice.vietQrUrl =
      invoice.remainingAmount > 0
        ? makeVietQr(
            invoice.bankSnapshot,
            invoice.remainingAmount,
            invoice.paymentSyntax,
          )
        : undefined;
  } else {
    invoice.vietQrUrl = undefined;
  }
  const [payment] = await Payment.create(
    [
      {
        ...details,
        landlordId: invoice.landlordId,
        branchId: invoice.branchId,
        invoiceId: invoice._id,
        invoiceCode: invoice.invoiceCode,
        status: "SUCCESS",
      },
    ],
    { session },
  );
  await invoice.save({ session });
  await recordAudit(
    {
      actor,
      invoice,
      action,
      before,
      after: {
        paymentId: payment._id,
        amount: payment.amount,
        paidAmount: invoice.paidAmount,
        remainingAmount: invoice.remainingAmount,
        overpaidAmount: invoice.overpaidAmount,
        status: invoice.status,
      },
      metadata,
    },
    session,
  );
  return { payment, invoice };
}

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
      400,
      "VALIDATION_ERROR",
      "Ngày thu tiền không được nằm trong tương lai",
    );
  const details = {
    amount,
    referenceCode,
    receiptNumber: referenceCode,
    transactionDate,
    paymentMethod: "CASH",
    gateway: "CASH",
    confirmedBy: req.user._id,
  };
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
      const legacy = await Payment.findOne({ referenceCode }).session(session);
      const unmatched = await UnmatchedPayment.findOne({
        referenceCode,
      }).session(session);
      if (legacy || unmatched)
        throw new AppError(
          409,
          "PAYMENT_REFERENCE_DUPLICATED",
          "Số biên lai đã tồn tại",
        );
      const [receipt] = await PaymentReceipt.create(
        [
          {
            _id: referenceCode,
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
        409,
        "PAYMENT_REFERENCE_DUPLICATED",
        "Số biên lai đã tồn tại",
      );
    throw error;
  }
}

function normalizeWebhook(body) {
  if (!body || !["in", "out"].includes(body.transferType))
    throw new AppError(400, "VALIDATION_ERROR", "transferType không hợp lệ");
  const accountNumber = validate.text(body.accountNumber, "accountNumber", 50);
  const referenceCode = validate.text(body.referenceCode, "referenceCode", 100);
  const amount = validate.money(body.transferAmount, "transferAmount", true);
  if (
    !(Number.isSafeInteger(body.id) && body.id > 0) &&
    !(typeof body.id === "string" && /^\d{1,30}$/.test(body.id))
  ) {
    throw new AppError(
      400,
      "VALIDATION_ERROR",
      "id giao dịch SePay không hợp lệ",
    );
  }
  const localDate =
    typeof body.transactionDate === "string" &&
    /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(body.transactionDate);
  const transactionDate = validate.date(
    localDate
      ? `${body.transactionDate.replace(" ", "T")}+07:00`
      : body.transactionDate,
    "transactionDate",
  );
  if (typeof body.content !== "string" || body.content.length > 2000)
    throw new AppError(400, "VALIDATION_ERROR", "content không hợp lệ");
  const gateway = validate.text(body.gateway, "gateway", 100);
  return {
    accountNumber,
    referenceCode,
    amount,
    transactionDate,
    gateway,
    content: body.content,
    gatewayTransactionId: `SEPAY:${body.id}`,
  };
}

function duplicateReceipt(receipt, landlord, incoming) {
  if (
    receipt.source !== "SEPAY" ||
    String(receipt.landlordId) !== String(landlord._id) ||
    receipt._id !== incoming.referenceCode ||
    receipt.amount !== incoming.amount
  ) {
    throw new AppError(
      409,
      "PAYMENT_REFERENCE_CONFLICT",
      "Mã giao dịch đã được dùng cho một khoản thu khác",
    );
  }
  return {
    duplicate: true,
    paymentId: receipt.paymentId,
    unmatchedPaymentId: receipt.unmatchedPaymentId,
  };
}

async function findDuplicate(incoming, landlord, session) {
  const receipt = await PaymentReceipt.findOne({
    $or: [
      { _id: incoming.referenceCode },
      { gatewayTransactionId: incoming.gatewayTransactionId },
    ],
  }).session(session || null);
  if (receipt) return duplicateReceipt(receipt, landlord, incoming);
  const legacy = await Payment.findOne({
    referenceCode: incoming.referenceCode,
  }).session(session || null);
  if (legacy) {
    if (
      String(legacy.landlordId) !== String(landlord._id) ||
      legacy.amount !== incoming.amount ||
      legacy.paymentMethod === "CASH"
    ) {
      throw new AppError(
        409,
        "PAYMENT_REFERENCE_CONFLICT",
        "Mã giao dịch đã tồn tại",
      );
    }
    return { duplicate: true, paymentId: legacy._id };
  }
  const unmatched = await UnmatchedPayment.findOne({
    referenceCode: incoming.referenceCode,
  }).session(session || null);
  if (unmatched) {
    if (
      String(unmatched.landlordId) !== String(landlord._id) ||
      unmatched.amount !== incoming.amount
    )
      throw new AppError(
        409,
        "PAYMENT_REFERENCE_CONFLICT",
        "Mã giao dịch đã tồn tại",
      );
    return { duplicate: true, unmatchedPaymentId: unmatched._id };
  }
  return null;
}

async function processWebhook(body) {
  const incoming = normalizeWebhook(body);
  if (body.transferType === "out") return { ignored: true };
  const landlords = await User.find({
    role: "LANDLORD",
    status: "ACTIVE",
    isDeleted: false,
    "bankConfig.accountNumber": incoming.accountNumber,
  }).limit(2);
  if (landlords.length !== 1)
    throw new AppError(
      400,
      "BANK_ACCOUNT_MISMATCH",
      "Không xác định được chủ trọ từ tài khoản nhận tiền",
    );
  const landlord = landlords[0];
  try {
    return await mongoose.connection.transaction(async (session) => {
      const duplicate = await findDuplicate(incoming, landlord, session);
      if (duplicate) return duplicate;
      const [receipt] = await PaymentReceipt.create(
        [
          {
            _id: incoming.referenceCode,
            landlordId: landlord._id,
            source: "SEPAY",
            gatewayTransactionId: incoming.gatewayTransactionId,
            amount: incoming.amount,
          },
        ],
        { session },
      );
      const codes = [
        ...new Set(
          incoming.content.toUpperCase().match(/\bHD[A-Z0-9]{4,32}\b/g) || [],
        ),
      ];
      const invoice =
        codes.length === 1
          ? await Invoice.findOne({
              landlordId: landlord._id,
              invoiceCode: codes[0],
              isDeleted: false,
            }).session(session)
          : null;
      if (
        !invoice ||
        !["ISSUED", "PARTIALLY_PAID", "UNPAID"].includes(invoice.status) ||
        (invoice.bankSnapshot?.accountNumber &&
          invoice.bankSnapshot.accountNumber !== incoming.accountNumber)
      ) {
        const [unmatched] = await UnmatchedPayment.create(
          [
            {
              landlordId: landlord._id,
              referenceCode: incoming.referenceCode,
              amount: incoming.amount,
              content: incoming.content,
              gateway: incoming.gateway,
              transactionDate: incoming.transactionDate,
              rawWebhookData: body,
              notes: invoice
                ? `Hóa đơn không thể nhận tiền: ${invoice.status}`
                : "Không xác định được hóa đơn",
            },
          ],
          { session },
        );
        receipt.unmatchedPaymentId = unmatched._id;
        await receipt.save({ session });
        return { unmatched: true, unmatchedPaymentId: unmatched._id };
      }
      const result = await applyPayment(
        {
          invoice,
          details: {
            referenceCode: incoming.referenceCode,
            amount: incoming.amount,
            gateway: incoming.gateway,
            transactionDate: incoming.transactionDate,
            content: incoming.content,
            paymentMethod: "BANK_TRANSFER",
            rawWebhookData: body,
          },
          actor: { _id: landlord._id, role: "SYSTEM" },
          action: "RECEIVE_BANK_PAYMENT",
        },
        session,
      );
      receipt.paymentId = result.payment._id;
      await receipt.save({ session });
      return result;
    });
  } catch (error) {
    if (error.code === 11000) {
      const duplicate = await findDuplicate(incoming, landlord);
      if (duplicate) return duplicate;
    }
    throw error;
  }
}

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
        404,
        "RESOURCE_NOT_FOUND",
        "Không tìm thấy giao dịch chưa đối soát",
      );
    const invoice = await getInvoice(req, req.body?.invoiceId, session);
    assertPayable(invoice);
    const existing = await Payment.findOne({
      referenceCode: unmatched.referenceCode,
    }).session(session);
    if (existing)
      throw new AppError(
        409,
        "PAYMENT_REFERENCE_DUPLICATED",
        "Giao dịch đã được đối soát",
      );
    let receipt = await PaymentReceipt.findById(
      unmatched.referenceCode,
    ).session(session);
    if (!receipt) {
      [receipt] = await PaymentReceipt.create(
        [
          {
            _id: unmatched.referenceCode,
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
        409,
        "PAYMENT_REFERENCE_CONFLICT",
        "Giao dịch đã được sử dụng",
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

async function paymentFilter(req) {
  const scope = { ...getTenantScope(req), isDeleted: false };
  if (req.user.role === "TENANT") {
    const invoices = await Invoice.find(invoiceScope(req)).select("_id");
    delete scope.tenantId;
    scope.invoiceId = { $in: invoices.map((invoice) => invoice._id) };
  }
  return scope;
}

function paymentProjection(req) {
  return req.user.role === "TENANT"
    ? "invoiceId invoiceCode amount paymentMethod referenceCode transactionDate status createdAt"
    : "-rawWebhookData -senderAccountNumber -senderBank";
}

async function listPayments(req) {
  const filters = [await paymentFilter(req)];
  const { branchId, paymentMethod } = req.query;
  if (branchId)
    filters.push({ branchId: validate.objectId(branchId, "branchId") });
  if (paymentMethod) {
    if (!["CASH", "BANK_TRANSFER", "VIETQR"].includes(paymentMethod))
      throw new AppError(400, "VALIDATION_ERROR", "paymentMethod không hợp lệ");
    filters.push({ paymentMethod });
  }
  if (req.params.invoiceId) {
    const invoice = await getInvoice(req, req.params.invoiceId);
    filters.push({ invoiceId: invoice._id });
  }
  const filter = { $and: filters };
  const { page, limit, skip } = validate.pagination(req.query);
  const [data, total] = await Promise.all([
    Payment.find(filter)
      .select(paymentProjection(req))
      .sort({ createdAt: -1, _id: -1 })
      .skip(skip)
      .limit(limit),
    Payment.countDocuments(filter),
  ]);
  return { data, pagination: { page, limit, total } };
}

async function getPayment(req) {
  const payment = await Payment.findOne({
    $and: [
      await paymentFilter(req),
      { _id: validate.objectId(req.params.paymentId, "paymentId") },
    ],
  }).select(paymentProjection(req));
  if (!payment)
    throw new AppError(404, "RESOURCE_NOT_FOUND", "Không tìm thấy thanh toán");
  return payment;
}

async function listUnmatched(req) {
  const filter = { ...getTenantScope(req), isDeleted: false };
  const status = req.query.status || "PENDING_REVIEW";
  if (!["PENDING_REVIEW", "RESOLVED", "IGNORED"].includes(status))
    throw new AppError(400, "VALIDATION_ERROR", "Trạng thái không hợp lệ");
  filter.status = status;
  const { page, limit, skip } = validate.pagination(req.query);
  const [data, total] = await Promise.all([
    UnmatchedPayment.find(filter)
      .select("-rawWebhookData -senderAccountNumber -senderBank")
      .sort({ createdAt: -1, _id: -1 })
      .skip(skip)
      .limit(limit),
    UnmatchedPayment.countDocuments(filter),
  ]);
  return { data, pagination: { page, limit, total } };
}

module.exports = {
  confirmCash,
  processWebhook,
  resolveUnmatched,
  listPayments,
  getPayment,
  listUnmatched,
};
