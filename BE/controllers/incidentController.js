const service = require("../services/incidentService");
const respond = require("../utils/response");
const realtime = require("../realtime");
exports.list = async (req, res) => respond(res, await service.list(req));
exports.get = async (req, res) => respond(res, await service.get(req));
exports.create = async (req, res) => {
  const incident = await service.create(req);
  realtime.incidentEvent("incident:created", incident);
  respond(res, incident, 201);
};
exports.updateStatus = async (req, res) => {
  const incident = await service.updateStatus(req);
  realtime.incidentEvent("incident:updated", incident);
  respond(res, incident);
};
exports.updateCost = async (req, res) =>
  respond(res, await service.updateCost(req));
