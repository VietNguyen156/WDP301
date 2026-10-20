const service = require("../services/adminService");
const plans = require("../services/saasPlanService");
const analytics = require("../services/analyticsService");
const upgrades = require("../services/upgradeRequestService");
const respond = require("../utils/response");

exports.listPlans = async (req, res) => respond(res, await plans.list(req));
exports.createPlan = async (req, res) => respond(res, await plans.create(req), 201);
exports.updatePlan = async (req, res) => respond(res, await plans.update(req));
exports.deletePlan = async (req, res) => respond(res, await plans.update(req, true));
exports.listLandlords = async (req, res) => respond(res, await service.listLandlords(req));
exports.setLandlordStatus = async (req, res) => respond(res, await service.setLandlordStatus(req));
exports.listSubscriptions = async (req, res) => respond(res, await service.listSubscriptions(req));
exports.createSubscription = async (req, res) => respond(res, await service.saveSubscription(req, true), 201);
exports.updateSubscription = async (req, res) => respond(res, await service.saveSubscription(req));
exports.listInvoices = async (req, res) => respond(res, await service.listInvoices(req));
exports.confirmInvoice = async (req, res) => respond(res, await service.confirmInvoice(req));
exports.analytics = async (req, res) => respond(res, await analytics.stats(req));
exports.listUpgradeRequests = async (req, res) => respond(res, await upgrades.list(req));
exports.approveUpgradeRequest = async (req, res) =>
  respond(res, await upgrades.approve(req), 200, "Đã duyệt yêu cầu và xuất hóa đơn SaaS chờ thanh toán");
exports.rejectUpgradeRequest = async (req, res) => respond(res, await upgrades.reject(req));
exports.listAuditLogs = async (req, res) => respond(res, await service.listAuditLogs(req));
