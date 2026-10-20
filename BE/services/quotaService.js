const User = require("../models/User");
const Branch = require("../models/Branch");
const Room = require("../models/Room");
const Subscription = require("../models/Subscription");
require("../models/SaaSPlan");
const { BusinessRuleError, ForbiddenError } = require("../utils/errors");
const { number } = require("../utils/validation");
const resources = {
  branch: [Branch, "maxBranches"],
  room: [Room, "maxRooms"],
  manager: [User, "maxManagers"],
};
// The entitlement in force now: the newest ACTIVE subscription whose period has begun.
// A paid upgrade replaces the old one immediately; a PENDING_PAYMENT one never counts.
function currentSubscription(landlordId, session = null) {
  const now = new Date();
  return Subscription.findOne({
    landlordId,
    status: "ACTIVE",
    isDeleted: false,
    startDate: { $lte: now },
    endDate: { $gt: now },
  })
    .sort({ startDate: -1, createdAt: -1, _id: -1 })
    .populate({ path: "planId", match: { isDeleted: false } })
    .session(session)
    .lean();
}
// Counts exactly what guard() limits, so displayed usage matches enforcement.
function countUsed(landlordId, resource, session = null) {
  const [Model] = resources[resource];
  return Model.countDocuments({
    landlordId,
    isDeleted: false,
    ...(resource === "manager" ? { role: "PROPERTY_MANAGER" } : {}),
  }).session(session);
}
async function usage(landlordId) {
  const [branches, rooms, managers] = await Promise.all(
    ["branch", "room", "manager"].map((resource) => countUsed(landlordId, resource)),
  );
  return { branches, rooms, managers };
}
// The landlord write serializes quota checks. Insert the resource in this session.
async function guard({ landlordId, resource, count = 1, session }) {
  if (!session?.inTransaction())
    throw new BusinessRuleError("Quota guard yêu cầu transaction");
  number(count, "Số lượng", 1, 500);
  if (!resources[resource])
    throw new BusinessRuleError("Loại tài nguyên quota không hợp lệ");
  const owner = await User.findOneAndUpdate(
    { _id: landlordId, role: "LANDLORD", isDeleted: false, status: "ACTIVE" },
    { $inc: { quotaVersion: 1 } },
    { session, returnDocument: "after" },
  );
  if (!owner) throw new ForbiddenError();
  const subscription = await currentSubscription(landlordId, session);
  const [, key] = resources[resource];
  const plan = subscription?.planId;
  if (subscription && String(owner.subscriptionId) !== String(subscription._id)) {
    owner.subscriptionId = subscription._id;
    await owner.save({ session });
  }
  if (!plan || !plan.isActive)
    throw new BusinessRuleError(
      "Vui lòng kích hoạt hoặc gia hạn gói SaaS để thêm tài nguyên",
      "QUOTA_EXCEEDED",
    );
  const used = await countUsed(landlordId, resource, session);
  if (!Number.isSafeInteger(plan[key]) || used + count > plan[key])
    throw new BusinessRuleError(
      "Vui lòng nâng cấp gói SaaS để thêm tài nguyên",
      "QUOTA_EXCEEDED",
    );
  return {
    resource,
    used,
    limit: plan[key],
    remaining: plan[key] - used - count,
  };
}
module.exports = { guard, currentSubscription, usage };
