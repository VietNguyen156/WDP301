const service = require("../services/accountService");
const respond = require("../utils/response");

exports.listStaff = async (req, res) => respond(res, await service.list(req, "PROPERTY_MANAGER"));
exports.createStaff = async (req, res) => respond(res, await service.createStaff(req), 201);
exports.resetStaffPassword = async (req, res) => respond(res, await service.resetPassword(req, "PROPERTY_MANAGER", req.params.staffId));
exports.listTenants = async (req, res) => respond(res, await service.list(req, "TENANT"));
exports.resetTenantPassword = async (req, res) => respond(res, await service.resetPassword(req, "TENANT", req.params.tenantId));
