const service = require("../services/expenseService");
const respond = require("../utils/response");
exports.list = async (req, res) => {
  const { data, pagination, totals } = await service.list(req);
  res.json({ success: true, data, pagination, totals });
};
exports.create = async (req, res) =>
  respond(res, await service.create(req), 201, "Đã ghi phiếu chi");
exports.void = async (req, res) =>
  respond(res, await service.voidExpense(req), 200, "Đã hủy phiếu chi");
