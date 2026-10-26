const crypto = require("node:crypto");
const mongoose = require("mongoose");
const PlatformInvoice = require("../models/PlatformInvoice");
const Subscription = require("../models/Subscription");
const audit = require("./auditService");
const { settlePlatformInvoice } = require("./adminService");
const { validId } = require("../utils/scope");
const {
  AppError,
  BusinessRuleError,
  NotFoundError,
  ValidationError,
} = require("../utils/errors");
const v = require("../utils/validation");
const { systemReq } = require("../utils/systemActor");
const { requestJson, basicAuth } = require("../utils/httpJson");
const { parseVnDateTime } = require("../utils/vnTime");
const { clientUrl } = require("../utils/appUrls");

// SePay payment gateway, used by the platform (SUPER_ADMIN) to collect SaaS plan fees.
const CHECKOUT_URLS = {
  sandbox: "https://pay-sandbox.sepay.vn/v1/checkout/init",
  production: "https://pay.sepay.vn/v1/checkout/init",
};
const API_URLS = {
  sandbox: "https://pgapi-sandbox.sepay.vn",
  production: "https://pgapi.sepay.vn",
};
const PAYMENT_METHODS = ["BANK_TRANSFER", "NAPAS_BANK_TRANSFER", "CARD"];
// Fields SePay signs, in the order sepay-pg-node 1.0.0 signs them (order matters).
const SIGNED_FIELDS = [
  "merchant",
  "env",
  "operation",
  "payment_method",
  "order_amount",
  "currency",
  "order_invoice_number",
  "order_description",
  "customer_id",
  "agreement_id",
  "agreement_name",
  "agreement_type",
  "agreement_payment_frequency",
  "agreement_amount_per_payment",
  "success_url",
  "error_url",
  "cancel_url",
  "order_id",
];
const PAYABLE = ["PENDING", "OVERDUE"];

function config() {
  const env = process.env.SEPAY_PG_ENV || "sandbox";
  return {
    env,
    checkoutUrl:
      process.env.SEPAY_PG_CHECKOUT_URL ||
      CHECKOUT_URLS[env] ||
      CHECKOUT_URLS.sandbox,
    apiUrl: (
      process.env.SEPAY_PG_API_URL ||
      API_URLS[env] ||
      API_URLS.sandbox
    ).replace(/\/$/, ""),
    merchantId: process.env.SEPAY_PG_MERCHANT_ID,
    secretKey: process.env.SEPAY_PG_SECRET_KEY,
    returnUrl:
      process.env.SEPAY_PG_RETURN_URL ||
      `${clientUrl()}/plans`,
  };
}

// HMAC-SHA256 over "field=value" pairs joined by ",", following the fields' own key order
// (as the SDK does), base64 encoded.
function sign(fields, secretKey) {
  const signed = Object.keys(fields)
    .filter((key) => SIGNED_FIELDS.includes(key) && fields[key] !== undefined)
    .map((key) => `${key}=${fields[key] ?? ""}`);
  return crypto
    .createHmac("sha256", secretKey)
    .update(signed.join(","))
    .digest("base64");
}

const invoiceView = (invoice) => ({
  id: invoice._id,
  invoiceCode: invoice.invoiceCode,
  amount: invoice.amount,
  billingCycle: invoice.billingCycle,
  dueDate: invoice.dueDate,
  status: invoice.status,
  paidAt: invoice.paidAt,
  paymentGateway: invoice.paymentGateway,
  plan: invoice.planId && {
    id: invoice.planId._id,
    code: invoice.planId.code,
    name: invoice.planId.name,
  },
  payable: PAYABLE.includes(invoice.status) && invoice.amount > 0,
  createdAt: invoice.createdAt,
});

async function listMine(req) {
  const { page, limit, skip } = v.pagination(req.query);
  const filter = { landlordId: req.user._id, isDeleted: false };
  if (req.query.status) {
    filter.status = req.query.status;
  }
  const [items, total] = await Promise.all([
    PlatformInvoice.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .skip(skip)
      .limit(limit)
      .populate({ path: "planId", select: "code name" })
      .lean(),
    PlatformInvoice.countDocuments(filter),
  ]);
  return { items: items.map(invoiceView), total, page, limit };
}

// Returns the signed form the browser must POST to SePay's checkout page.
async function checkout(req) {
  v.fields(req.body || {}, ["paymentMethod"]);
  const paymentMethod = req.body?.paymentMethod || "BANK_TRANSFER";
  v.choice(paymentMethod, PAYMENT_METHODS, "Phương thức thanh toán");
  const { env, checkoutUrl, merchantId, secretKey, returnUrl } = config();
  if (!merchantId || !secretKey)
    throw new AppError(
      "Máy chủ chưa cấu hình cổng thanh toán SePay",
      503,
      "PAYMENT_GATEWAY_NOT_CONFIGURED",
    );
  // A previous order may already be paid while its IPN was lost: never let the landlord pay twice.
  const previous = await PlatformInvoice.findOne({
    _id: validId(req.params.invoiceId),
    landlordId: req.user._id,
    isDeleted: false,
  }).lean();
  if (previous?.gatewayOrders?.length && PAYABLE.includes(previous.status)) {
    const { paid } = await reconcileOrders(previous);
    if (paid)
      throw new BusinessRuleError(
        "Hóa đơn đã được thanh toán qua SePay; gói mới đã được kích hoạt",
        "PLATFORM_INVOICE_ALREADY_PAID",
      );
  }
  return mongoose.connection.transaction(async (session) => {
    const invoice = await PlatformInvoice.findOne({
      _id: validId(req.params.invoiceId),
      landlordId: req.user._id,
      isDeleted: false,
    })
      .populate({ path: "planId", select: "code name" })
      .session(session);
    if (!invoice) throw new NotFoundError("Không tìm thấy hóa đơn SaaS");
    if (!PAYABLE.includes(invoice.status) || invoice.amount <= 0)
      throw new BusinessRuleError(
        "Hóa đơn không ở trạng thái chờ thanh toán",
        "PLATFORM_INVOICE_NOT_PAYABLE",
      );
    const sub = await Subscription.findOne({
      _id: invoice.subscriptionId,
      landlordId: req.user._id,
      isDeleted: false,
      status: "PENDING_PAYMENT",
    }).session(session);
    if (!sub || sub.endDate <= new Date())
      throw new BusinessRuleError(
        "Thuê bao không còn chờ thanh toán hoặc đã hết hạn",
        "PLATFORM_INVOICE_NOT_PAYABLE",
      );
    const orderInvoiceNumber = `${invoice.invoiceCode}-${Date.now().toString(36).toUpperCase()}`;
    invoice.gatewayOrders.push({ orderInvoiceNumber, paymentMethod });
    await invoice.save({ session });
    const back = (result) =>
      `${returnUrl}${returnUrl.includes("?") ? "&" : "?"}payment=${result}&invoice=${encodeURIComponent(invoice.invoiceCode)}`;
    const fields = {
      operation: "PURCHASE",
      payment_method: paymentMethod,
      order_invoice_number: orderInvoiceNumber,
      order_amount: invoice.amount,
      currency: "VND",
      order_description:
        `Thanh toan goi ${invoice.planId?.code || ""} ${invoice.invoiceCode}`
          .replace(/\s+/g, " ")
          .trim(),
      customer_id: String(req.user._id),
      success_url: back("success"),
      error_url: back("error"),
      cancel_url: back("cancel"),
      merchant: merchantId,
    };
    fields.signature = sign(fields, secretKey);
    return {
      environment: env,
      checkoutUrl,
      method: "POST",
      fields,
      orderInvoiceNumber,
    };
  });
}

// SePay dates are Vietnam time with second precision. A gateway payment always follows the
// invoice (its checkout order was created from it), so clock skew must not make it look earlier.
function paidAtOf(value, invoice) {
  const parsed = parseVnDateTime(value) || new Date();
  return new Date(
    Math.max(parsed.getTime(), new Date(invoice.createdAt).getTime()),
  );
}

// Money that reached the platform but could not activate the plan: record it for the admin.
async function recordUnapplied(invoice, reason, details) {
  await mongoose.connection.transaction(async (session) => {
    await PlatformInvoice.updateOne(
      { _id: invoice._id },
      { $set: { notes: `Thanh toán SePay chưa áp dụng: ${reason}` } },
      { session },
    );
    await audit.log({
      req: systemReq(invoice.landlordId),
      action: "UNAPPLIED_PLATFORM_PAYMENT",
      entityType: "PLATFORM_INVOICE",
      entityId: invoice._id,
      after: { reason, ...details },
      session,
    });
  });
  return { unapplied: true };
}

// Marks the invoice paid for one SePay order. IPN and the manual check use the same
// order-level reference, so whichever arrives second is recognised as a duplicate.
async function applyGatewayPayment(
  invoice,
  { orderId, method, paidAtValue, amount, currency },
) {
  if (amount !== invoice.amount || currency !== "VND")
    return recordUnapplied(
      invoice,
      `Số tiền ${amount} ${currency} không khớp hóa đơn ${invoice.amount} VND`,
      { orderId },
    );
  try {
    const result = await mongoose.connection.transaction((session) =>
      settlePlatformInvoice(
        systemReq(invoice.landlordId),
        { _id: invoice._id },
        {
          paymentReference: `SEPAY_PG:${orderId}`,
          paymentGateway: `SEPAY_PG_${method || "UNKNOWN"}`,
          paidAt: paidAtOf(paidAtValue, invoice),
        },
        session,
      ),
    );
    return { paid: !result.duplicate, duplicate: !!result.duplicate };
  } catch (error) {
    if (!(error instanceof AppError) || error.statusCode >= 500) throw error;
    return recordUnapplied(invoice, error.message, {
      orderId,
      errorCode: error.errorCode,
    });
  }
}

// IPN from the payment gateway (X-Secret-Key checked by middleware). Always answered with 200
// once authenticated, so SePay does not keep resending what only an admin can resolve.
async function handleIpn(body) {
  const orderNumber = body?.order?.order_invoice_number;
  if (typeof orderNumber !== "string" || !orderNumber)
    throw new ValidationError("Thiếu order_invoice_number");
  const invoice = await PlatformInvoice.findOne({
    "gatewayOrders.orderInvoiceNumber": orderNumber,
    isDeleted: false,
  }).lean();
  if (!invoice) return { ignored: true };
  const orderId = String(
    body.order?.id || body.transaction?.transaction_id || "",
  );
  if (!orderId) throw new ValidationError("Thiếu mã đơn hàng SePay");
  if (body.notification_type === "TRANSACTION_VOID") {
    // Card voids are not reversed automatically; the admin decides about the subscription.
    if (invoice.paymentReference === `SEPAY_PG:${orderId}`)
      return recordUnapplied(
        invoice,
        "Giao dịch thẻ đã bị hủy (void) sau khi thanh toán",
        { orderId },
      );
    return { ignored: true };
  }
  if (body.notification_type !== "ORDER_PAID") return { ignored: true };
  const approved =
    body.transaction?.transaction_status === "APPROVED" ||
    body.order?.order_status === "CAPTURED";
  if (!approved) return { ignored: true };
  const result = await applyGatewayPayment(invoice, {
    orderId,
    method: body.transaction?.payment_method,
    paidAtValue: body.transaction?.transaction_date,
    amount: Number(
      body.transaction?.transaction_amount ?? body.order?.order_amount,
    ),
    currency:
      body.order?.order_currency ||
      body.transaction?.transaction_currency ||
      "VND",
  });
  if (!result.duplicate)
    await markOrder(
      invoice._id,
      orderNumber,
      result.unapplied ? "UNAPPLIED" : "PAID",
    );
  return result;
}

// GET /v1/order/detail/{order_invoice_number} on the gateway REST API (Basic merchant_id:secret_key).
async function orderDetail(orderInvoiceNumber) {
  const { apiUrl, merchantId, secretKey } = config();
  const response = await requestJson(
    `${apiUrl}/v1/order/detail/${encodeURIComponent(orderInvoiceNumber)}`,
    {
      headers: {
        Authorization: basicAuth(merchantId, secretKey),
        "Content-Type": "application/json",
      },
      unavailable: {
        message: "Không kết nối được cổng thanh toán SePay",
        errorCode: "PAYMENT_GATEWAY_UNAVAILABLE",
      },
    },
  );
  if (response.status === 404) return null;
  if (!response.ok)
    throw new AppError(
      "Cổng thanh toán SePay từ chối tra cứu đơn hàng",
      502,
      "PAYMENT_GATEWAY_UNAVAILABLE",
    );
  return response.body?.data || null;
}

const markOrder = (invoiceId, orderInvoiceNumber, result) =>
  PlatformInvoice.updateOne(
    { _id: invoiceId, "gatewayOrders.orderInvoiceNumber": orderInvoiceNumber },
    { $set: { "gatewayOrders.$.result": result } },
  );

// Pull reconciliation: asks SePay about every unsettled checkout order of the invoice, oldest
// first. Needed whenever the IPN cannot reach us (local development without a tunnel, IPN
// secret missing, network failure). The first paid order activates the plan; any later paid
// order is a double payment and is kept as UNAPPLIED for the admin to refund.
async function reconcileOrders(invoice) {
  let paid = invoice.status === "PAID";
  let duplicateOrders = 0;
  for (const order of (invoice.gatewayOrders || []).slice(-10)) {
    if (order.result) continue;
    const detail = await orderDetail(order.orderInvoiceNumber);
    if (detail?.order_status !== "CAPTURED") continue;
    const orderId = detail.id || order.orderInvoiceNumber;
    const result = paid
      ? await recordUnapplied(
          invoice,
          `Thanh toán trùng: hóa đơn đã được thanh toán, đơn ${order.orderInvoiceNumber} cần hoàn tiền`,
          { orderId },
        )
      : await applyGatewayPayment(invoice, {
          orderId,
          method:
            detail.transactions?.[0]?.payment_method || order.paymentMethod,
          paidAtValue:
            detail.transactions?.[0]?.transaction_date || detail.updated_at,
          amount: Number(detail.order_amount),
          currency: detail.order_currency || "VND",
        });
    await markOrder(
      invoice._id,
      order.orderInvoiceNumber,
      result.unapplied ? "UNAPPLIED" : "PAID",
    );
    if (result.unapplied) duplicateOrders += paid ? 1 : 0;
    else paid = true;
  }
  return { paid, duplicateOrders };
}

async function verifyPayment(req) {
  const { merchantId, secretKey } = config();
  if (!merchantId || !secretKey)
    throw new AppError(
      "Máy chủ chưa cấu hình cổng thanh toán SePay",
      503,
      "PAYMENT_GATEWAY_NOT_CONFIGURED",
    );
  const invoice = await PlatformInvoice.findOne({
    _id: validId(req.params.invoiceId),
    landlordId: req.user._id,
    isDeleted: false,
  }).lean();
  if (!invoice) throw new NotFoundError("Không tìm thấy hóa đơn SaaS");
  const { paid, duplicateOrders } = await reconcileOrders(invoice);
  if (paid) return { status: "PAID", invoiceId: invoice._id, duplicateOrders };
  const fresh = await PlatformInvoice.findById(invoice._id)
    .select("status notes")
    .lean();
  const unapplied =
    (invoice.gatewayOrders || []).length &&
    fresh.notes?.startsWith("Thanh toán SePay chưa áp dụng");
  return {
    status: unapplied ? "UNAPPLIED" : fresh.status,
    invoiceId: invoice._id,
  };
}

module.exports = { config, sign, listMine, checkout, handleIpn, verifyPayment };
