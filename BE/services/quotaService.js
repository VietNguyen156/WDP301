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
  const subscription = await Subscription.findOne({
    _id: owner.subscriptionId,
    landlordId,
    status: "ACTIVE",
    startDate: { $lte: new Date() },
    endDate: { $gt: new Date() },
  })
    .populate("planId")
    .session(session)
    .lean();
  const [Model, key] = resources[resource];
  const plan = subscription?.planId;
  if (!plan || !plan.isActive)
    throw new BusinessRuleError(
      "Vui lòng kích hoạt hoặc gia hạn gói SaaS để thêm tài nguyên",
      "QUOTA_EXCEEDED",
    );
  const used = await Model.countDocuments({
    landlordId,
    isDeleted: false,
    ...(resource === "manager" ? { role: "PROPERTY_MANAGER" } : {}),
  }).session(session);
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
module.exports = { guard };
