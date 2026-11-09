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
    const tenantId = scope.tenantId;
    delete scope.tenantId;
    // Their invoices' payments, plus the deposit receipts of contracts in their name.
    scope.$or = [
      { invoiceId: { $in: invoiceIds } },
      { purpose: "CONTRACT_DEPOSIT", tenantId },
    ];
  }
  return scope;
}

function paymentProjection(req) {
  return req.user.role === "TENANT"
    ? "purpose branchId invoiceId invoiceCode contractId contractCode amount paymentMethod referenceCode transactionDate status createdAt"
    : "-rawWebhookData -senderAccountNumber -senderBank";
}

// Populate branch, invoice->room/branch, contract->room/branch, and (for non-tenants) staff names.
function staffPopulate(req) {
  const base = [
    { path: "branchId", select: "name" },
    // tenantId: who the money is owed by, so the ledger names the payer, not "Khách thuê".
    {
      path: "invoiceId",
      select: "invoiceCode invoiceType billingPeriod roomId branchId tenantId",
      populate: [
        { path: "roomId", select: "roomNumber" },
        { path: "branchId", select: "name" },
        { path: "tenantId", select: "name phoneNumber" },
      ],
    },
    {
      path: "contractId",
      select: "contractCode roomId branchId tenantId",
      populate: [
        { path: "roomId", select: "roomNumber" },
        { path: "branchId", select: "name" },
        { path: "tenantId", select: "name phoneNumber" },
      ],
    },
  ];
  if (req.user.role === "TENANT") return base;
  return [
    ...base,
    ...["reportedBy", "confirmedBy", "reviewedBy"].map((path) => ({
      path,
      select: "name role",
    })),
  ];
}

async function listPayments(req) {
  const filters = [await paymentFilter(req)];
  const { branchId, paymentMethod, purpose } = req.query;
  if (branchId)
    filters.push({ branchId: validate.objectId(branchId, "branchId") });
  if (paymentMethod) {
    if (!["CASH", "BANK_TRANSFER", "VIETQR", "DEPOSIT"].includes(paymentMethod))
      throw new AppError("Hình thức thanh toán không hợp lệ", 400, "VALIDATION_ERROR");
    filters.push({ paymentMethod });
  }
  // Three histories: rent & services (INVOICE), repair charges (INCIDENT: payments of
  // invoiceType INCIDENT invoices) and contract deposits. Payments saved before "purpose" are invoices.
  if (purpose === "CONTRACT_DEPOSIT") filters.push({ purpose });
  else if (purpose === "INVOICE" || purpose === "INCIDENT") {
    const incidentInvoices = await Invoice.distinct("_id", {
      landlordId: getTenantScope(req).landlordId,
      invoiceType: "INCIDENT",
    });
    filters.push(
      purpose === "INCIDENT"
        ? { invoiceId: { $in: incidentInvoices } }
        : { purpose: { $ne: "CONTRACT_DEPOSIT" }, invoiceId: { $nin: incidentInvoices } },
    );
  }
  else if (purpose)
    throw new AppError("Loại giao dịch không hợp lệ", 400, "VALIDATION_ERROR");
  if (req.query.contractId)
    filters.push({ contractId: validate.objectId(req.query.contractId, "contractId") });
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
      .populate(staffPopulate(req))
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
    .populate(staffPopulate(req))
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
