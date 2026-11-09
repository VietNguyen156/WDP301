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
} = require("../utils/errors");
const v = require("../utils/validation");
const { systemReq } = require("../utils/systemActor");
const { requestJson } = require("../utils/httpJson");
const { parseVnDateTime } = require("../utils/vnTime");
const { clientUrl } = require("../utils/appUrls");

// payOS payment gateway, used by the platform (SUPER_ADMIN) to collect SaaS plan fees.
// Flow: create a payment link (POST /v2/payment-requests) → the landlord pays on payOS'
// checkout page → payOS calls our webhook, and the landlord can also ask us to check
// (GET /v2/payment-requests/{orderCode}) when the webhook is late or cannot reach us.
const PAYABLE = ["PENDING", "OVERDUE"];
const GATEWAY = "PAYOS";

function config() {
  return {
    apiUrl: (process.env.PAYOS_API_URL || "https://api-merchant.payos.vn").replace(/\/$/, ""),
    clientId: process.env.PAYOS_CLIENT_ID,
    apiKey: process.env.PAYOS_API_KEY,
    checksumKey: process.env.PAYOS_CHECKSUM_KEY,
    returnUrl: process.env.PAYOS_RETURN_URL || `${clientUrl()}/plans`,
  };
}

function assertConfigured() {
  const settings = config();
  if (!settings.clientId || !settings.apiKey || !settings.checksumKey)
    throw new AppError(
      "Máy chủ chưa cấu hình cổng thanh toán payOS",
      503,
      "PAYMENT_GATEWAY_NOT_CONFIGURED",
    );
  return settings;
}

const hmacHex = (text, key) => crypto.createHmac("sha256", key).update(text).digest("hex");

// Signature of a payment-link request: the five fields in alphabetical order, HMAC-SHA256 hex.
function sign({ amount, cancelUrl, description, orderCode, returnUrl }, checksumKey) {
  return hmacHex(
    `amount=${amount}&cancelUrl=${cancelUrl}&description=${description}&orderCode=${orderCode}&returnUrl=${returnUrl}`,
    checksumKey,
  );
}

// Signature of webhook `data` (and of API responses): every key in alphabetical order as
// key=value joined by "&"; null / undefined become "", arrays are JSON of key-sorted items.
function dataSignature(data, checksumKey) {
  const sortKeys = (obj) =>
    Object.keys(obj)
      .sort()
      .reduce((acc, key) => ({ ...acc, [key]: obj[key] }), {});
  const text = Object.keys(data)
    .sort()
    .filter((key) => data[key] !== undefined)
    .map((key) => {
      let value = data[key];
      if (Array.isArray(value)) value = JSON.stringify(value.map(sortKeys));
      if ([null, undefined, "undefined", "null"].includes(value)) value = "";
      return `${key}=${value}`;
    })
    .join("&");
  return hmacHex(text, checksumKey);
}

function validWebhook(body) {
  const { checksumKey } = config();
  if (!checksumKey || !body?.data || typeof body.signature !== "string") return false;
  const expected = Buffer.from(dataSignature(body.data, checksumKey));
  const received = Buffer.from(body.signature);
  return expected.length === received.length && crypto.timingSafeEqual(expected, received);
}

function payosHeaders({ clientId, apiKey }) {
  return { "x-client-id": clientId, "x-api-key": apiKey, "Content-Type": "application/json" };
}

const unavailable = {
  message: "Không kết nối được cổng thanh toán payOS",
  errorCode: "PAYMENT_GATEWAY_UNAVAILABLE",
};

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

// payOS order codes are positive integers, unique per merchant: milliseconds + 3 random digits
// stays well inside Number.MAX_SAFE_INTEGER.
const newOrderCode = () => Date.now() * 1000 + crypto.randomInt(1000);

// Creates a payOS payment link for the invoice and returns where to send the landlord.
async function checkout(req) {
  v.fields(req.body || {}, ["paymentMethod"]);
  const settings = assertConfigured();
  // A previous order may already be paid while its webhook was lost: never let the landlord pay twice.
  const previous = await PlatformInvoice.findOne({
    _id: validId(req.params.invoiceId),
    landlordId: req.user._id,
    isDeleted: false,
  }).lean();
  if (previous?.gatewayOrders?.length && PAYABLE.includes(previous.status)) {
    const { paid } = await reconcileOrders(previous);
    if (paid)
      throw new BusinessRuleError(
        "Hóa đơn đã được thanh toán; gói mới đã được kích hoạt",
        "PLATFORM_INVOICE_ALREADY_PAID",
      );
  }
  const order = await mongoose.connection.transaction(async (session) => {
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
    const orderCode = newOrderCode();
    invoice.gatewayOrders.push({ orderInvoiceNumber: String(orderCode), paymentMethod: GATEWAY });
    await invoice.save({ session });
    return {
      orderCode,
      invoiceId: invoice._id,
      invoiceCode: invoice.invoiceCode,
      amount: invoice.amount,
      planName: invoice.planId?.name || invoice.planId?.code || "Gói dịch vụ",
    };
  });

  const back = (result) =>
    `${settings.returnUrl}${settings.returnUrl.includes("?") ? "&" : "?"}payment=${result}&invoice=${encodeURIComponent(order.invoiceCode)}`;
  // Shown as the bank transfer content: at most 9 characters when the receiving account is
  // not linked through payOS, so "GOI" + the last 6 characters of the invoice code.
  const payload = {
    orderCode: order.orderCode,
    amount: order.amount,
    description: `GOI${order.invoiceCode.replace(/[^A-Z0-9]/gi, "").slice(-6)}`.toUpperCase(),
    returnUrl: back("success"),
    cancelUrl: back("cancel"),
    items: [{ name: `Gói ${order.planName}`.slice(0, 100), quantity: 1, price: order.amount }],
  };
  payload.signature = sign(payload, settings.checksumKey);
  const response = await requestJson(`${settings.apiUrl}/v2/payment-requests`, {
    method: "POST",
    headers: payosHeaders(settings),
    body: JSON.stringify(payload),
    unavailable,
  });
  const data = response.body?.data;
  if (!response.ok || response.body?.code !== "00" || !data?.checkoutUrl) {
    console.error("payOS create payment link failed:", response.status, response.body?.code, response.body?.desc);
    // Nothing was created on payOS: drop the order so it is not reconciled later.
    await PlatformInvoice.updateOne(
      { _id: order.invoiceId },
      { $pull: { gatewayOrders: { orderInvoiceNumber: String(order.orderCode) } } },
    );
    throw new AppError(
      "Cổng thanh toán payOS chưa tạo được link thanh toán. Vui lòng thử lại sau.",
      502,
      "PAYMENT_GATEWAY_UNAVAILABLE",
    );
  }
  return {
    gateway: GATEWAY,
    checkoutUrl: data.checkoutUrl,
    method: "GET",
    orderCode: order.orderCode,
    paymentLinkId: data.paymentLinkId,
    qrCode: data.qrCode,
  };
}

// payOS dates are Vietnam time. A gateway payment always follows the invoice (its order was
// created from it), so clock skew must not make it look earlier.
function paidAtOf(value, invoice) {
  const parsed = parseVnDateTime(value) || (value && !Number.isNaN(Date.parse(value)) ? new Date(value) : new Date());
  return new Date(
    Math.max(parsed.getTime(), new Date(invoice.createdAt).getTime()),
  );
}

// Money that reached the platform but could not activate the plan: record it for the admin.
async function recordUnapplied(invoice, reason, details) {
  await mongoose.connection.transaction(async (session) => {
    await PlatformInvoice.updateOne(
      { _id: invoice._id },
      { $set: { notes: `Thanh toán payOS chưa áp dụng: ${reason}` } },
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

// Marks the invoice paid for one payOS order. The webhook and the manual check use the same
// order-level reference, so whichever arrives second is recognised as a duplicate.
async function applyGatewayPayment(invoice, { orderId, paidAtValue, amount, currency }) {
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
          paymentReference: `${GATEWAY}:${orderId}`,
          paymentGateway: GATEWAY,
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

const markOrder = (invoiceId, orderInvoiceNumber, result) =>
  PlatformInvoice.updateOne(
    { _id: invoiceId, "gatewayOrders.orderInvoiceNumber": orderInvoiceNumber },
    { $set: { "gatewayOrders.$.result": result } },
  );

// Webhook from payOS (signature over `data` checked by the controller). Answered with 200
// once authentic, so payOS does not keep resending what only an admin can resolve. payOS'
// own test call when the webhook URL is saved carries an unknown order code: ignored.
async function handleIpn(body) {
  const data = body.data || {};
  const orderNumber = String(data.orderCode ?? "");
  if (!orderNumber) return { ignored: true };
  const invoice = await PlatformInvoice.findOne({
    "gatewayOrders.orderInvoiceNumber": orderNumber,
    isDeleted: false,
  }).lean();
  if (!invoice) return { ignored: true };
  if (body.code !== "00" || data.code !== "00") return { ignored: true };
  const orderId = String(data.paymentLinkId || data.reference || orderNumber);
  const order = invoice.gatewayOrders.find((o) => o.orderInvoiceNumber === orderNumber);
  if (order?.result) return { duplicate: true, invoiceId: invoice._id, landlordId: invoice.landlordId };
  // Invoice already paid by an earlier order: this second payment needs a refund.
  const result =
    invoice.status === "PAID"
      ? await recordUnapplied(
          invoice,
          `Thanh toán trùng: hóa đơn đã được thanh toán, đơn ${orderNumber} cần hoàn tiền`,
          { orderId },
        )
      : await applyGatewayPayment(invoice, {
          orderId,
          paidAtValue: data.transactionDateTime,
          amount: Number(data.amount),
          currency: data.currency || "VND",
        });
  if (!result.duplicate)
    await markOrder(invoice._id, orderNumber, result.unapplied ? "UNAPPLIED" : "PAID");
  return { ...result, invoiceId: invoice._id, landlordId: invoice.landlordId };
}

// GET /v2/payment-requests/{orderCode}: null when payOS does not know the order.
async function orderDetail(orderCode) {
  const settings = config();
  const response = await requestJson(
    `${settings.apiUrl}/v2/payment-requests/${encodeURIComponent(orderCode)}`,
    { headers: payosHeaders(settings), unavailable },
  );
  if (response.status === 404) return null;
  if (!response.ok || response.body?.code !== "00") {
    console.error("payOS order lookup failed:", orderCode, response.status, response.body?.code, response.body?.desc);
    // Unknown order (link never created) is not a failure of the check.
    if (response.ok) return null;
    throw new AppError(
      "Cổng thanh toán payOS chưa tra cứu được đơn hàng. Vui lòng thử lại sau.",
      502,
      "PAYMENT_GATEWAY_UNAVAILABLE",
    );
  }
  return response.body.data || null;
}

// Pull reconciliation: asks payOS about every unsettled order of the invoice, oldest first.
// Needed whenever the webhook cannot reach us (local development, network failure). The first
// paid order activates the plan; any later paid order is a double payment kept as UNAPPLIED
// for the admin to refund. Orders of the former SePay gateway are left to the admin.
async function reconcileOrders(invoice) {
  let paid = invoice.status === "PAID";
  let duplicateOrders = 0;
  for (const order of (invoice.gatewayOrders || []).slice(-10)) {
    if (order.result || order.paymentMethod !== GATEWAY) continue;
    const detail = await orderDetail(order.orderInvoiceNumber);
    if (detail?.status !== "PAID") continue;
    const orderId = detail.id || order.orderInvoiceNumber;
    const result = paid
      ? await recordUnapplied(
          invoice,
          `Thanh toán trùng: hóa đơn đã được thanh toán, đơn ${order.orderInvoiceNumber} cần hoàn tiền`,
          { orderId },
        )
      : await applyGatewayPayment(invoice, {
          orderId,
          paidAtValue: detail.transactions?.[0]?.transactionDateTime || detail.createdAt,
          amount: Number(detail.amountPaid ?? detail.amount),
          currency: "VND",
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
  assertConfigured();
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
    fresh.notes?.startsWith("Thanh toán payOS chưa áp dụng");
  return {
    status: unapplied ? "UNAPPLIED" : fresh.status,
    invoiceId: invoice._id,
  };
}

module.exports = {
  config,
  sign,
  dataSignature,
  validWebhook,
  listMine,
  checkout,
  handleIpn,
  verifyPayment,
};
