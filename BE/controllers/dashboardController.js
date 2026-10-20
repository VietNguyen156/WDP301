const service = require("../services/dashboardService");
const respond = require("../utils/response");
exports.stats = async (req, res) => respond(res, await service.stats(req));
exports.debts = async (req, res) => respond(res, await service.debts(req));
