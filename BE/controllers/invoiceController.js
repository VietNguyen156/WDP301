const service = require("../services/invoiceService");
const payments = require("../services/paymentService");
const realtime = require("../realtime");
const reminders = require("../services/debtReminderService");
const metadata = (req) => ({
  ipAddress: req.ip,
  userAgent: req.get("User-Agent"),
});
const listInvoices = async (req, res) =>
  res.json({ success: true, ...(await service.listInvoices(req)) });
const getInvoice = async (req, res) =>
  res.json({
    success: true,
    data: await service.getInvoice(req, req.params.invoiceId),
  });
const generateInvoices = async (req, res) => {
  req.auditMetadata = metadata(req);
  res
    .status(201)
    .json({ success: true, data: await service.generateInvoices(req) });
};
const issueInvoice = async (req, res) => {
  req.auditMetadata = metadata(req);
  res.json({ success: true, data: await service.issueInvoice(req) });
};
const cancelInvoice = async (req, res) => {
  req.auditMetadata = metadata(req);
  res.json({ success: true, data: await service.cancelInvoice(req) });
};
const publicInvoice = async (req, res) => {
  res.set("Cache-Control", "no-store");
  res.set("Referrer-Policy", "no-referrer");
  res.json({
    success: true,
    data: await service.publicInvoice(req.params.publicAccessToken),
  });
};
const simulatePublicPayment = async (req, res) => {
  const result = await payments.simulatePublicPayment(req.params.publicAccessToken);
  realtime.paymentEvent(result); // after commit
  res.json({
    success: true,
    data: {
      paid: !!result.payment,
      duplicate: !!result.duplicate,
      unmatched: !!result.unmatched,
      reason: result.reason,
      status: result.invoice?.status,
      remainingAmount: result.invoice?.remainingAmount,
    },
  });
};
// Email the tenant a debt reminder now, on behalf of the landlord.
const sendReminder = async (req, res) =>
  res.json({ success: true, data: await reminders.sendForInvoice(req, req.params.invoiceId) });
module.exports = {
  sendReminder,
  simulatePublicPayment,
  listInvoices,
  getInvoice,
  generateInvoices,
  issueInvoice,
  cancelInvoice,
  publicInvoice,
};
