const AuditLog = require("../models/AuditLog");

async function recordAudit(
  { actor, invoice, action, before, after, metadata = {} },
  session,
) {
  await AuditLog.create(
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
}

module.exports = { recordAudit };
