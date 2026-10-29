// Locks tenant accounts that no longer have a contract: no contract still running (or ended less
// than TENANT_LOCK_AFTER_DAYS ago) and no unpaid invoice. A new contract with the same CCCD
// reopens the account with the password the tenant already chose (accountService.tenantForContract).
const User = require("../models/User");
const AuthSession = require("../models/AuthSession");
const { Contract, Invoice } = require("../models");
const audit = require("../services/auditService");
const { systemActor } = require("../utils/systemActor");
const { LIVE_CONTRACT_STATUSES, OWING_INVOICE_STATUSES } = require("../utils/statuses");
const { DAY_MS } = require("../utils/vnTime");

const INTERVAL_MS = 6 * 3600000;
const REASON = "NO_ACTIVE_CONTRACT";

const graceDays = () => {
  const days = Number(process.env.TENANT_LOCK_AFTER_DAYS);
  return Number.isFinite(days) && days >= 0 ? days : 30;
};
const enabled = () => process.env.TENANT_AUTO_LOCK !== "false";

async function lockTenantsWithoutContract(now = new Date()) {
  const cutoff = new Date(now.getTime() - graceDays() * DAY_MS);
  const [withContract, stillRenting, stillOwing] = await Promise.all([
    Contract.distinct("tenantId", { isDeleted: false }),
    // Running, expired less than the grace period ago, or handed back less than it ago.
    Contract.distinct("tenantId", {
      isDeleted: false,
      $or: [
        { status: { $in: LIVE_CONTRACT_STATUSES }, endDate: { $gte: cutoff } },
        { status: "DRAFT" },
        { status: "TERMINATED", actualEndDate: { $gte: cutoff } },
      ],
    }),
    // Keep access while something is left to pay.
    Invoice.distinct("tenantId", {
      isDeleted: false,
      status: { $in: OWING_INVOICE_STATUSES },
      remainingAmount: { $gt: 0 },
    }),
  ]);
  const keep = new Set([...stillRenting, ...stillOwing].map(String));
  const targets = await User.find({
    role: "TENANT",
    isDeleted: false,
    status: { $in: ["ACTIVE", "PENDING_ACTIVATION"] },
    _id: { $in: withContract.filter((id) => id && !keep.has(String(id))) },
  })
    .select("landlordId status")
    .lean();

  let locked = 0;
  for (const tenant of targets) {
    const result = await User.updateOne(
      { _id: tenant._id, status: tenant.status },
      {
        $set: {
          status: "INACTIVE",
          deactivatedAt: now,
          deactivationReason: REASON,
          statusBeforeDeactivation: tenant.status,
        },
        $inc: { authVersion: 1 }, // signs out every open session
      },
    );
    if (!result.modifiedCount) continue;
    locked += 1;
    await AuthSession.deleteMany({ userId: tenant._id });
    await audit.record({
      actor: systemActor(tenant.landlordId),
      landlordId: tenant.landlordId,
      action: "DEACTIVATE_TENANT",
      entityType: "USER",
      entityId: tenant._id,
      before: { status: tenant.status },
      after: { status: "INACTIVE", reason: REASON, graceDays: graceDays() },
    });
  }
  return { checked: targets.length, locked };
}

function start() {
  if (!enabled()) return;
  const run = () =>
    lockTenantsWithoutContract()
      .then(({ locked }) => locked && console.log(`Đã khóa ${locked} tài khoản khách thuê không còn hợp đồng`))
      .catch((error) => console.error("Khóa tài khoản khách thuê thất bại:", error.message));
  run();
  setInterval(run, INTERVAL_MS).unref();
}

module.exports = { start, lockTenantsWithoutContract, REASON };
