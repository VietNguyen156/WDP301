const service = require("../services/contractService");
const respond = require("../utils/response");
exports.list = async (req, res) => respond(res, await service.list(req));
exports.get = async (req, res) =>
  respond(res, await service.get(req, req.params.contractId));
exports.create = async (req, res) =>
  respond(res, await service.create(req), 201);
exports.terminate = async (req, res) =>
  respond(res, await service.terminate(req));
