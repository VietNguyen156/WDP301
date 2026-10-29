const service = require("../services/saasPlanService");
const { chainChanged } = require("../realtime/liveUpdates");
const activity = require("../realtime/activity");
const respond = require("../utils/response");
const requests = require("../services/upgradeRequestService");
const payments = require("../services/saasPaymentService");
exports.catalog = async (req, res) => respond(res, await service.catalog(req));
exports.requestUpgrade = async (req, res) =>
  respond(res, await requests.create(req), 201, "Đã gửi yêu cầu đổi gói tới quản trị viên");
exports.listRequests = async (req, res) => respond(res, await requests.listMine(req));
exports.cancelRequest = async (req, res) => respond(res, await requests.cancel(req));
exports.listInvoices = async (req, res) => respond(res, await payments.listMine(req));
exports.checkout = async (req, res) => respond(res, await payments.checkout(req), 201);
exports.verifyPayment = async (req, res) => respond(res, await payments.verifyPayment(req));
// SePay only needs HTTP 200 with {"success": true}.
exports.gatewayIpn = async (req, res) => {
  const { invoiceId, landlordId, ...result } = await payments.handleIpn(req.body);
  res.json({ success: true, ...result });
  if (result.paid) {
    chainChanged(landlordId, ["plans", "subscription"], { admins: true });
    activity
      .system({ label: "thanh toán gói dịch vụ qua cổng SePay", kind: "platformInvoice", id: invoiceId })
      .catch(() => {});
  }
};
