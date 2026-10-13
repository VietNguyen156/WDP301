const service = require("../services/branchService");
const respond = require("../utils/response");
exports.list = async (req, res) => respond(res, await service.list(req));
exports.get = async (req, res) =>
  respond(res, await service.get(req, req.params.branchId));
exports.create = async (req, res) =>
  respond(res, await service.create(req), 201);
exports.update = async (req, res) => respond(res, await service.update(req));
exports.remove = async (req, res) => respond(res, await service.remove(req));
