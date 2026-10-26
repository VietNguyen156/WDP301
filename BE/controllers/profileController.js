const service = require("../services/profileService");
const respond = require("../utils/response");
exports.get = async (req, res) => respond(res, await service.get(req));
exports.update = async (req, res) => respond(res, await service.update(req));
exports.updateBankAccount = async (req, res) =>
  respond(res, await service.updateBankAccount(req), 200, "Đã cập nhật tài khoản nhận tiền");
