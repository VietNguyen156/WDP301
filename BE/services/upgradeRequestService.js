const mongoose = require("mongoose");
const PlanUpgradeRequest = require("../models/PlanUpgradeRequest");
const SaaSPlan = require("../models/SaaSPlan");
const Subscription = require("../models/Subscription");
const audit = require("./auditService");
const quota = require("./quotaService");
const admin = require("./adminService");
const { validId } = require("../utils/scope");
const {
  BusinessRuleError,
  NotFoundError,
  ValidationError,
} = require("../utils/errors");
const v = require("../utils/validation");

const QUOTAS = {
  branches: "maxBranches",
  rooms: "maxRooms",
  managers: "maxManagers",
};
const STATUSES = ["PENDING", "APPROVED", "REJECTED", "CANCELLED"];

const populate = (query) =>
  query
    .populate({
      path: "planId",
      select: "code name price billingCycle maxBranches maxRooms maxManagers",
    })
    .populate({ path: "currentPlanId", select: "code name price" });

function note(value, label) {
  if (value === undefined) return undefined;
  v.text(value, label);
  if (value.trim().length > 1000)
    throw new ValidationError(`${label} tối đa 1000 ký tự`);
  return value.trim();
}

const pendingRequest = (landlordId) =>
  populate(
    PlanUpgradeRequest.findOne({
      landlordId,
      status: "PENDING",
      isDeleted: false,
    }),
  ).lean();

// ---- Landlord ----

async function create(req) {
  v.fields(req.body, ["planId", "note"]);
  const text = note(req.body.note, "Ghi chú");
  const plan = await SaaSPlan.findOne({
    _id: validId(req.body.planId),
    isDeleted: false,
    isActive: true,
  }).lean();
  if (!plan) throw new NotFoundError("Gói không tồn tại hoặc đã ngừng bán");
  if (plan.code === "FREE_TRIAL")
    throw new BusinessRuleError(
      "Gói dùng thử chỉ được cấp khi đăng ký",
      "PLAN_NOT_SELECTABLE",
    );
  const used = await quota.usage(req.user._id);
  const blockedBy = Object.entries(QUOTAS)
    .filter(([name, key]) => used[name] > plan[key])
    .map(([, key]) => key);
  if (blockedBy.length)
    throw new BusinessRuleError(
      `Tài nguyên đang dùng vượt giới hạn của gói ${plan.name} (${blockedBy.join(", ")})`,
      "PLAN_QUOTA_BELOW_USAGE",
    );
  return mongoose.connection.transaction(async (session) => {
    if (
      await Subscription.exists({
        landlordId: req.user._id,
        status: "PENDING_PAYMENT",
        isDeleted: false,
      }).session(session)
    )
      throw new BusinessRuleError(
        "Bạn đang có thuê bao chờ thanh toán, vui lòng thanh toán hóa đơn SaaS trước",
        "SUBSCRIPTION_PENDING_EXISTS",
      );
    if (
      await PlanUpgradeRequest.exists({
        landlordId: req.user._id,
        status: "PENDING",
        isDeleted: false,
      }).session(session)
    )
      throw new BusinessRuleError(
        "Bạn đã có một yêu cầu đổi gói đang chờ xử lý",
        "UPGRADE_REQUEST_PENDING",
      );
    const current = await quota.currentSubscription(req.user._id, session);
    const [request] = await PlanUpgradeRequest.create(
      [
        {
          landlordId: req.user._id,
          planId: plan._id,
          currentPlanId: current?.planId?._id,
          note: text,
        },
      ],
      { session },
    );
    await audit.log({
      req,
      action: "REQUEST_PLAN_UPGRADE",
      entityType: "PLAN_UPGRADE_REQUEST",
      entityId: request._id,
      after: request.toObject(),
      session,
    });
    return request;
  });
}

async function listMine(req) {
  const { page, limit, skip } = v.pagination(req.query);
  const filter = { landlordId: req.user._id, isDeleted: false };
  const [items, total] = await Promise.all([
    populate(
      PlanUpgradeRequest.find(filter)
        .sort({ createdAt: -1, _id: -1 })
        .skip(skip)
        .limit(limit),
    )
      .select("-handledBy")
      .lean(),
    PlanUpgradeRequest.countDocuments(filter),
  ]);
  return { items, total, page, limit };
}

async function cancel(req) {
  return mongoose.connection.transaction(async (session) => {
    const request = await PlanUpgradeRequest.findOne({
      _id: validId(req.params.requestId),
      landlordId: req.user._id,
      isDeleted: false,
    }).session(session);
    if (!request) throw new NotFoundError("Không tìm thấy yêu cầu đổi gói");
    if (request.status !== "PENDING")
      throw new BusinessRuleError(
        "Chỉ hủy được yêu cầu đang chờ xử lý",
        "UPGRADE_REQUEST_CLOSED",
      );
    request.status = "CANCELLED";
    request.handledAt = new Date();
    await request.save({ session });
    await audit.log({
      req,
      action: "CANCEL_PLAN_UPGRADE",
      entityType: "PLAN_UPGRADE_REQUEST",
      entityId: request._id,
      after: { status: request.status },
      session,
    });
    return request;
  });
}

// ---- SUPER_ADMIN ----

async function list(req) {
  const { page, limit, skip } = v.pagination(req.query);
  const status = req.query.status || "PENDING";
  v.choice(status, STATUSES, "Trạng thái");
  const filter = { status, isDeleted: false };
  const [items, total] = await Promise.all([
    populate(
      PlanUpgradeRequest.find(filter)
        .sort({ createdAt: status === "PENDING" ? 1 : -1, _id: 1 })
        .skip(skip)
        .limit(limit),
    )
      .populate({ path: "landlordId", select: "name email phoneNumber status" })
      .lean(),
    PlanUpgradeRequest.countDocuments(filter),
  ]);
  return { items, total, page, limit };
}

async function openRequest(req, session) {
  const request = await PlanUpgradeRequest.findOne({
    _id: validId(req.params.requestId),
    isDeleted: false,
  }).session(session);
  if (!request) throw new NotFoundError("Không tìm thấy yêu cầu đổi gói");
  if (request.status !== "PENDING")
    throw new BusinessRuleError(
      "Yêu cầu đã được xử lý",
      "UPGRADE_REQUEST_CLOSED",
    );
  return request;
}

// Default period: from now for one billing cycle of the requested plan.
async function approve(req) {
  v.fields(req.body || {}, ["startDate", "endDate"]);
  return mongoose.connection.transaction(async (session) => {
    const request = await openRequest(req, session);
    const plan = await SaaSPlan.findById(request.planId)
      .session(session)
      .lean();
    const start = req.body?.startDate
      ? v.date(req.body.startDate, "Ngày bắt đầu")
      : new Date();
    const end = req.body?.endDate
      ? v.date(req.body.endDate, "Ngày kết thúc")
      : new Date(start);
    if (!req.body?.endDate) {
      if (plan?.billingCycle === "YEARLY")
        end.setUTCFullYear(end.getUTCFullYear() + 1);
      else end.setUTCMonth(end.getUTCMonth() + 1);
    }
    const body = admin.subscriptionInput(
      {
        landlordId: String(request.landlordId),
        planId: String(request.planId),
        startDate: start.toISOString(),
        endDate: end.toISOString(),
      },
      true,
    );
    const { subscription, invoice } = await admin.applySubscription(
      req,
      body,
      true,
      session,
    );
    request.status = "APPROVED";
    request.handledBy = req.user._id;
    request.handledAt = new Date();
    request.subscriptionId = subscription._id;
    request.platformInvoiceId = invoice._id;
    await request.save({ session });
    await audit.log({
      req,
      landlordId: request.landlordId,
      action: "APPROVE_PLAN_UPGRADE",
      entityType: "PLAN_UPGRADE_REQUEST",
      entityId: request._id,
      after: {
        status: request.status,
        subscriptionId: subscription._id,
        invoiceId: invoice._id,
      },
      session,
    });
    return { request, subscription, invoice };
  });
}

async function reject(req) {
  v.fields(req.body || {}, ["reason"]);
  const reason = note(req.body?.reason, "Lý do từ chối");
  if (!reason) throw new ValidationError("Vui lòng nhập lý do từ chối");
  return mongoose.connection.transaction(async (session) => {
    const request = await openRequest(req, session);
    request.status = "REJECTED";
    request.rejectReason = reason;
    request.handledBy = req.user._id;
    request.handledAt = new Date();
    await request.save({ session });
    await audit.log({
      req,
      landlordId: request.landlordId,
      action: "REJECT_PLAN_UPGRADE",
      entityType: "PLAN_UPGRADE_REQUEST",
      entityId: request._id,
      after: { status: request.status, reason },
      session,
    });
    return request;
  });
}

module.exports = {
  create,
  listMine,
  cancel,
  list,
  approve,
  reject,
  pendingRequest,
};
