// Payment ledger queries; the money-in flows live in ./payments and are re-exported here.
const { Invoice, Payment } = require("../models");
const { AppError } = require("../utils/errors");
const validate = require("../utils/financeValidation");
const { getTenantScope } = require("../utils/scope");
const { getInvoice, invoiceScope } = require("./invoiceService");
const cash = require("./payments/cashPaymentService");
const bankTransfer = require("./payments/bankTransferService");
const unmatched = require("./payments/unmatchedPaymentService");

async function paymentFilter(req) {
  const scope = { ...getTenantScope(req), isDeleted: false };
  if (req.user.role === "TENANT") {
    const invoiceIds = await Invoice.distinct("_id", invoiceScope(req));
    delete scope.tenantId;
    scope.invoiceId = { $in: invoiceIds };
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
    if (!["CASH", "BANK_TRANSFER", "VIETQR", "DEPOSIT"].includes(paymentMethod))
      throw new AppError("paymentMethod không hợp lệ", 400, "VALIDATION_ERROR");
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
      .limit(limit)
      .lean(),
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
  })
    .select(paymentProjection(req))
    .lean();
  if (!payment)
    throw new AppError("Không tìm thấy thanh toán", 404, "RESOURCE_NOT_FOUND");
  return payment;
}

module.exports = {
  confirmCash: cash.confirmCash,
  confirmCashReport: cash.confirmCashReport,
  rejectCashReport: cash.rejectCashReport,
  processWebhook: bankTransfer.processWebhook,
  receiveTransfer: bankTransfer.receiveTransfer,
  simulatePublicPayment: bankTransfer.simulatePublicPayment,
  resolveUnmatched: unmatched.resolveUnmatched,
  listUnmatched: unmatched.listUnmatched,
  listPayments,
  getPayment,
};
