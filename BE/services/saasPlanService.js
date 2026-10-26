const mongoose = require("mongoose");
const SaaSPlan = require("../models/SaaSPlan");
const Subscription = require("../models/Subscription");
const { validId } = require("../utils/scope");
const {
  ValidationError,
  NotFoundError,
  BusinessRuleError,
} = require("../utils/errors");
const v = require("../utils/validation");
const audit = require("./auditService");
const quota = require("./quotaService");
const { accountView } = require("./authService");
const { FEATURE_KEYS, PLAN_FEATURES } = require("../utils/planFeatures");
const { planHas } = require("./planFeatures");
const upgradeRequests = require("./upgradeRequestService");
const quotas = ["maxBranches", "maxRooms", "maxManagers"];

function validate(body, creating = false) {
  v.fields(body, [
    "name",
    ...(creating ? ["code"] : []),
    "price",
    "billingCycle",
    ...quotas,
    "features",
    "featureFlags",
    "isActive",
    "trialDays",
  ]);
  if (creating || body.name !== undefined) v.text(body.name, "Tên gói");
  if (creating) {
    v.text(body.code, "Mã gói");
    if (!/^[A-Z][A-Z0-9_]{1,39}$/.test(body.code))
      throw new ValidationError(
        "Mã gói phải là chữ hoa, số hoặc dấu gạch dưới",
      );
  }
  if (creating || body.price !== undefined) v.number(body.price, "Giá gói");
  for (const key of quotas)
    if (body[key] !== undefined) v.number(body[key], key);
  if (body.trialDays !== undefined)
    v.number(body.trialDays, "Số ngày dùng thử", 1, 365);
  if (body.billingCycle !== undefined)
    v.choice(body.billingCycle, ["MONTHLY", "YEARLY"], "Chu kỳ");
  if (body.isActive !== undefined && typeof body.isActive !== "boolean")
    throw new ValidationError("isActive phải là boolean");
  if (body.features !== undefined) {
    if (!Array.isArray(body.features) || body.features.length > 50)
      throw new ValidationError("Danh sách tính năng không hợp lệ");
    body.features.forEach((feature) => v.text(feature, "Tính năng"));
  }
  if (body.featureFlags !== undefined) {
    if (
      !Array.isArray(body.featureFlags) ||
      body.featureFlags.some((flag) => !FEATURE_KEYS.includes(flag))
    )
      throw new ValidationError(
        `featureFlags chỉ nhận: ${FEATURE_KEYS.join(", ")}`,
      );
    body.featureFlags = [...new Set(body.featureFlags)];
  }
  return body;
}

async function list(req) {
  const { page, limit, skip } = v.pagination(req.query);
  const filter = { isDeleted: false };
  if (req.query.search) filter.name = v.search(req.query.search);
  if (req.query.isActive !== undefined) {
    v.choice(req.query.isActive, ["true", "false"], "isActive");
    filter.isActive = req.query.isActive === "true";
  }
  const [items, total] = await Promise.all([
    SaaSPlan.find(filter)
      .sort({ price: 1, _id: 1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    SaaSPlan.countDocuments(filter),
  ]);
  return { items, total, page, limit };
}

async function create(req) {
  const body = validate(req.body, true);
  if (body.code === "FREE_TRIAL" && body.price !== 0)
    throw new ValidationError("Gói dùng thử phải miễn phí");
  return mongoose.connection.transaction(async (session) => {
    const [plan] = await SaaSPlan.create([body], { session });
    await audit.log({
      req,
      action: "CREATE_SAAS_PLAN",
      entityType: "SAAS_PLAN",
      entityId: plan._id,
      after: plan.toObject(),
      session,
    });
    return plan;
  });
}

async function update(req, deleting = false) {
  const body = deleting ? {} : validate(req.body);
  return mongoose.connection.transaction(async (session) => {
    const plan = await SaaSPlan.findOne({
      _id: validId(req.params.planId),
      isDeleted: false,
    })
      .select("+mutationVersion")
      .session(session);
    if (!plan) throw new NotFoundError("Không tìm thấy gói SaaS");
    if (
      plan.code === "FREE_TRIAL" &&
      body.price !== undefined &&
      body.price !== 0
    )
      throw new ValidationError("Gói dùng thử phải miễn phí");
    const used = await Subscription.exists({
      planId: plan._id,
      isDeleted: false,
      $or: [
        { status: "ACTIVE", endDate: { $gt: new Date() } },
        { status: "PENDING_PAYMENT" },
      ],
    }).session(session);
    if (
      used &&
      (deleting ||
        body.isActive === false ||
        quotas.some((key) => body[key] !== undefined && body[key] < plan[key]))
    )
      throw new BusinessRuleError(
        "Gói còn thuê bao sử dụng; chuyển thuê bao trước khi xóa, ngừng hoặc giảm quota",
        "PLAN_IN_USE",
      );
    const before = plan.toObject();
    Object.assign(plan, deleting ? { isDeleted: true, isActive: false } : body);
    plan.mutationVersion = (plan.mutationVersion || 0) + 1;
    await plan.save({ session });
    await audit.log({
      req,
      action: deleting ? "DELETE_SAAS_PLAN" : "UPDATE_SAAS_PLAN",
      entityType: "SAAS_PLAN",
      entityId: plan._id,
      before,
      after: plan.toObject(),
      session,
    });
    return deleting ? null : plan;
  });
}

const USAGE_KEYS = {
  branches: "maxBranches",
  rooms: "maxRooms",
  managers: "maxManagers",
};

// Plans on sale for the signed-in landlord, with current usage so the UI can show
// "3/5 phòng" and which plans would be too small to switch to.
async function catalog(req) {
  const [plans, account, used, upgradeRequest] = await Promise.all([
    SaaSPlan.find({ isDeleted: false, isActive: true })
      .sort({ price: 1, _id: 1 })
      .lean(),
    accountView(req.user),
    quota.usage(req.user._id),
    upgradeRequests.pendingRequest(req.user._id),
  ]);
  const current = account.subscription;
  const pending = account.pendingSubscription;
  const usage = Object.fromEntries(
    Object.entries(USAGE_KEYS).map(([name, key]) => [
      name,
      { used: used[name], limit: current?.plan[key] ?? null },
    ]),
  );
  const items = plans.map((plan) => {
    const blockedBy = Object.entries(USAGE_KEYS)
      .filter(([name, key]) => used[name] > plan[key])
      .map(([, key]) => key);
    return {
      id: plan._id,
      code: plan.code,
      name: plan.name,
      price: plan.price,
      billingCycle: plan.billingCycle,
      trialDays: plan.code === "FREE_TRIAL" ? plan.trialDays : undefined,
      maxBranches: plan.maxBranches,
      maxRooms: plan.maxRooms,
      maxManagers: plan.maxManagers,
      features: plan.features || [],
      featureFlags: FEATURE_KEYS.filter((key) => planHas(plan, key)),
      isCurrent: String(plan._id) === String(current?.plan.id),
      isPending: String(plan._id) === String(pending?.plan.id),
      isRequested: String(plan._id) === String(upgradeRequest?.planId?._id),
      // The trial is granted at sign-up only; a plan smaller than current usage cannot be chosen.
      selectable: plan.code !== "FREE_TRIAL" && !blockedBy.length,
      blockedBy,
    };
  });
  return {
    current,
    pending,
    upgradeRequest,
    usage,
    items,
    featureCatalog: PLAN_FEATURES,
  };
}

module.exports = { list, create, update, catalog };
