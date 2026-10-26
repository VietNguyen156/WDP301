const service = require("../services/bankHubService");
const respond = require("../utils/response");
const realtime = require("../realtime");
exports.status = async (req, res) => respond(res, await service.status(req));
exports.createLinkToken = async (req, res) =>
  respond(res, await service.createLinkToken(req), 201);
exports.sync = async (req, res) => respond(res, await service.sync(req));
// SePay expects {"success": true}; extra fields are ignored by it and help debugging.
exports.event = async (req, res) =>
  res.json({ success: true, ...(await service.handleEvent(req.body)) });
exports.ipn = async (req, res) => {
  const result = await service.receiveIpn(req.body);
  realtime.paymentEvent(result);
  res.json({
    success: true,
    duplicate: !!result.duplicate,
    unmatched: !!result.unmatched,
    ignored: !!result.ignored,
  });
};
