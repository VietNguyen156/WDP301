// Who may hear about an activity. Every action is classified once; realtime "activity" events
// and the "Hoạt động gần đây" list both apply the same rule.
//
//   OWNER  — the landlord only (chain setup, staff, plan / bank matters, unmatched transfers)
//   STAFF  — the landlord + managers assigned to the entity's branch (internal work: rooms,
//            readings, draft invoices, repair costs, triage, pending cash reports)
//   TENANT — STAFF + the tenant concerned (their contract, issued invoices, payments, incidents)
//   ADMIN  — platform admins + the landlord concerned (SaaS plans and platform invoices)
const AUDIENCE = { OWNER: "OWNER", STAFF: "STAFF", TENANT: "TENANT", ADMIN: "ADMIN" };

// Socket rooms for one event. A tenant never gets their own action pushed back as news.
function rooms(entity, audience, actorId) {
  const list = [];
  if (entity.landlordId) list.push(`landlord:${entity.landlordId}`);
  if ((audience === AUDIENCE.STAFF || audience === AUDIENCE.TENANT) && entity.branchId)
    list.push(`branch:${entity.branchId}`);
  if (audience === AUDIENCE.TENANT && entity.tenantId && String(entity.tenantId) !== String(actorId))
    list.push(`user:${entity.tenantId}`);
  if (audience === AUDIENCE.ADMIN) list.push("admins");
  return list;
}

// Same rule for a stored entry read back by one user.
function canSee(user, entity, audience) {
  switch (user.role) {
    case "LANDLORD":
      return String(entity.landlordId) === String(user._id);
    case "PROPERTY_MANAGER":
      return (
        (audience === AUDIENCE.STAFF || audience === AUDIENCE.TENANT) &&
        !!entity.branchId &&
        (user.assignedBranches || []).map(String).includes(String(entity.branchId))
      );
    case "TENANT":
      return audience === AUDIENCE.TENANT && String(entity.tenantId) === String(user._id);
    case "SUPER_ADMIN":
      return audience === AUDIENCE.ADMIN;
    default:
      return false;
  }
}

module.exports = { AUDIENCE, rooms, canSee };
