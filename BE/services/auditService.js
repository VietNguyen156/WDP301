const AuditLog = require("../models/AuditLog");

async function log({
  req,
  action,
  entityType,
  entityId,
  before,
  after,
  session,
  landlordId,
}) {
  const [record] = await AuditLog.create(
    [
      {
        actorId: req.user._id,
        actorRole: req.user.role,
        landlordId: landlordId ?? (
          req.user.role === "LANDLORD" ? req.user._id : req.user.landlordId
        ),
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

async function recordAudit(
  { actor, invoice, action, before, after, metadata = {} },
  session,
) {
  const [record] = await AuditLog.create(
    [
      {
        actorId: actor._id,
        actorRole: actor.role,
        landlordId: invoice.landlordId,
        action,
        entityType: "INVOICE",
        entityId: invoice._id,
        before,
        after,
        ipAddress: metadata.ipAddress,
        userAgent: metadata.userAgent,
      },
    ],
    { session },
  );
  return record;
}

module.exports = {
  log,
  recordAudit,
};
