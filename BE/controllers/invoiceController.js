const service = require("../services/invoiceService");
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
module.exports = {
  listInvoices,
  getInvoice,
  generateInvoices,
  issueInvoice,
  cancelInvoice,
  publicInvoice,
};
