const service = require("../services/contractService");
const respond = require("../utils/response");
const realtime = require("../realtime");
exports.list = async (req, res) => respond(res, await service.list(req));
exports.get = async (req, res) =>
  respond(res, await service.get(req, req.params.contractId));
exports.create = async (req, res) => {
  res.set("Cache-Control", "no-store");
  respond(res, await service.create(req), 201);
};
exports.terminate = async (req, res) =>
  respond(res, await service.terminate(req));
exports.prepareSettlement = async (req, res) =>
  respond(res, await service.prepareSettlement(req));
exports.confirmByLandlord = async (req, res) =>
  respond(res, await service.confirmByLandlord(req, req.params.contractId));
exports.confirmByTenant = async (req, res) =>
  respond(res, await service.confirmByTenant(req, req.params.contractId));
exports.markDepositReceived = async (req, res) =>
  respond(res, await service.markDepositReceived(req, req.params.contractId));
exports.simulateDeposit = async (req, res) => {
  const { result, contract } = await service.simulateDeposit(req, req.params.contractId);
  realtime.paymentEvent(result); // after commit
  respond(res, {
    received: !!result.depositReceived,
    unmatched: !!result.unmatched,
    reason: result.reason,
    contract,
  });
};
exports.renew = async (req, res) =>
  respond(res, await service.renew(req, req.params.contractId), 200, "Đã gia hạn hợp đồng");
