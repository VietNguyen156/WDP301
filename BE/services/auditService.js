const AuditLog = require("../models/AuditLog");
const { changedFields, expiresAt } = require("../utils/auditPolicy");

// Every audit entry stores only the fields that changed and an expiry date
// (finance entries live longer; see utils/auditPolicy.js).
function entry({ actorId, actorRole, landlordId, action, entityType, entityId, before, after, ipAddress, userAgent }) {
  const diff = changedFields(before, after);
  return {
    actorId,
    actorRole,
    landlordId,
    action,
    entityType,
    entityId,
    before: diff.before,
    after: diff.after,
    ipAddress,
    userAgent,
    expiresAt: expiresAt(entityType, action),
  };
}

async function log({ req, action, entityType, entityId, before, after, session, landlordId }) {
  const [record] = await AuditLog.create(
    [
      entry({
        actorId: req.user._id,
        actorRole: req.user.role,
        landlordId: landlordId ?? (req.user.role === "LANDLORD" ? req.user._id : req.user.landlordId),
        action,
        entityType,
        entityId,
        before,
        after,
        ipAddress: req.ip,
        userAgent: req.get?.("user-agent"),
      }),
    ],
    { session },
  );
  return record;
}

// Entry for an actor without a request (bank callbacks, system jobs).
async function record({ actor, landlordId, action, entityType, entityId, before, after, metadata = {} }, session) {
  const [created] = await AuditLog.create(
    [
      entry({
        actorId: actor._id,
        actorRole: actor.role,
        landlordId,
        action,
        entityType,
        entityId,
        before,
        after,
        ipAddress: metadata.ipAddress,
        userAgent: metadata.userAgent,
      }),
    ],
    { session },
  );
  return created;
}

async function recordAudit({ actor, invoice, action, before, after, metadata = {} }, session) {
  return record(
    {
      actor,
      landlordId: invoice.landlordId,
      action,
      entityType: "INVOICE",
      entityId: invoice._id,
      before,
      after,
      metadata,
    },
    session,
  );
}

module.exports = {
  log,
  record,
  recordAudit,
};
