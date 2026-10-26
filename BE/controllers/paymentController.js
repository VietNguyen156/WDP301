const service = require("../services/paymentService");
const realtime = require("../realtime");

const confirmCash = async (req, res) => {
  req.auditMetadata = { ipAddress: req.ip, userAgent: req.get("User-Agent") };
  const result = await service.confirmCash(req);
  realtime.paymentEvent(result); // after commit
  res
    .status(201)
    .json({ success: true, message: "Đã xác nhận thu tiền mặt", data: result });
};
const confirmCashReport = async (req, res) => {
  req.auditMetadata = { ipAddress: req.ip, userAgent: req.get("User-Agent") };
  const result = await service.confirmCashReport(req);
  realtime.paymentEvent(result); // after commit
  res.json({
    success: true,
    message: "Đã duyệt báo cáo thu tiền mặt",
    data: result,
  });
};
const rejectCashReport = async (req, res) => {
  req.auditMetadata = { ipAddress: req.ip, userAgent: req.get("User-Agent") };
  const result = await service.rejectCashReport(req);
  res.json({
    success: true,
    message: "Đã từ chối báo cáo thu tiền mặt",
    data: result,
  });
};
const webhook = async (req, res) => {
  const result = await service.processWebhook(req.body);
  realtime.paymentEvent(result); // after commit
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
  realtime.paymentEvent(result); // after commit
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
  confirmCashReport,
  rejectCashReport,
  webhook,
  resolveUnmatched,
  listPayments,
  getPayment,
  listUnmatched,
};
