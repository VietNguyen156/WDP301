const service = require("../services/paymentService");

function publishPayment(req, result) {
  if (!result.payment || !result.invoice) return;
  const io = req.app.get("io");
  if (!io) return;
  const { invoice, payment } = result;
  const payload = {
    invoiceId: invoice.id,
    paymentId: payment.id,
    paidAmount: invoice.paidAmount,
    remainingAmount: invoice.remainingAmount,
    status: invoice.status,
  };
  try {
    const rooms = [
      `landlord:${invoice.landlordId}`,
      `branch:${invoice.branchId}`,
      `invoice:${invoice.id}`,
    ];
    io.to(rooms).emit("payment:success", payload);
    if (["PAID", "OVERPAID"].includes(invoice.status))
      io.to(rooms).emit("invoice_paid", payload);
  } catch {
    console.error("Không phát được sự kiện thanh toán sau commit");
  }
}

const confirmCash = async (req, res) => {
  req.auditMetadata = { ipAddress: req.ip, userAgent: req.get("User-Agent") };
  const result = await service.confirmCash(req);
  publishPayment(req, result);
  res
    .status(201)
    .json({ success: true, message: "Đã xác nhận thu tiền mặt", data: result });
};
const webhook = async (req, res) => {
  const result = await service.processWebhook(req.body);
  publishPayment(req, result);
  res.json({
    success: true,
    data: {
      duplicate: !!result.duplicate,
      unmatched: !!result.unmatched,
      ignored: !!result.ignored,
      paymentId: result.payment?.id || result.paymentId,
      unmatchedPaymentId: result.unmatchedPaymentId,
    },
  });
};
const resolveUnmatched = async (req, res) => {
  req.auditMetadata = { ipAddress: req.ip, userAgent: req.get("User-Agent") };
  const result = await service.resolveUnmatched(req);
  publishPayment(req, result);
  res.json({ success: true, data: result });
};
const listPayments = async (req, res) =>
  res.json({ success: true, ...(await service.listPayments(req)) });
const getPayment = async (req, res) =>
  res.json({ success: true, data: await service.getPayment(req) });
const listUnmatched = async (req, res) =>
  res.json({ success: true, ...(await service.listUnmatched(req)) });
module.exports = {
  confirmCash,
  webhook,
  resolveUnmatched,
  listPayments,
  getPayment,
  listUnmatched,
};
