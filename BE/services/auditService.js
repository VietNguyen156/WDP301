const AuditLog = require("../models/AuditLog");
async function log({
  req,
  action,
  entityType,
  entityId,
  before,
  after,
  session,
}) {
  const [record] = await AuditLog.create(
    [
      {
        actorId: req.user._id,
        actorRole: req.user.role,
        landlordId:
          req.user.role === "LANDLORD" ? req.user._id : req.user.landlordId,
        action,
        entityType,
        entityId,
        before,
        after,
        ipAddress: req.ip,
        userAgent: req.get?.("user-agent"),
      },
    ],
    { session },
  );
  return record;
}
module.exports = { log };
