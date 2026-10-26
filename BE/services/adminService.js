const mongoose = require("mongoose");
const crypto = require("node:crypto");
const User = require("../models/User");
const Branch = require("../models/Branch");
const Room = require("../models/Room");
const SaaSPlan = require("../models/SaaSPlan");
const Subscription = require("../models/Subscription");
const PlatformInvoice = require("../models/PlatformInvoice");
const AuthSession = require("../models/AuthSession");
const AuditLog = require("../models/AuditLog");
const { validId } = require("../utils/scope");
const {
  NotFoundError,
  ValidationError,
  BusinessRuleError,
} = require("../utils/errors");
const v = require("../utils/validation");
const audit = require("./auditService");
const landlordProjection =
  "name email username phoneNumber role status subscriptionId bankConfig createdAt";
const subscriptionStatuses = [
  "ACTIVE",
  "EXPIRED",
  "CANCELLED",
  "PENDING_PAYMENT",
];
const subscriptionView = (sub) => ({
  ...sub,
  displayStatus:
    sub.status === "ACTIVE" && sub.endDate <= new Date()
      ? "EXPIRED"
      : sub.status,
  startsInFuture: sub.startDate > new Date(),
});

async function listLandlords(req) {
  const { page, limit, skip } = v.pagination(req.query);
  const filter = { role: "LANDLORD", isDeleted: false };
  if (req.query.status) {
    v.choice(req.query.status, ["ACTIVE", "SUSPENDED"], "Trạng thái");
    filter.status = req.query.status;
  }
  if (req.query.search) {
    const search = v.search(req.query.search);
    filter.$or = [{ name: search }, { email: search }];
  }
  const [items, total] = await Promise.all([
    User.find(filter)
      .select(landlordProjection)
      .sort({ createdAt: -1, _id: -1 })
      .skip(skip)
      .limit(limit)
      .populate({
        path: "subscriptionId",
        match: { isDeleted: false },
        populate: {
          path: "planId",
          select: "name code maxBranches maxRooms maxManagers",
          match: { isDeleted: false },
        },
      })
      .lean(),
    User.countDocuments(filter),
  ]);
  return {
    items: items.map((u) => ({
      ...u,
      subscriptionId: u.subscriptionId
        ? subscriptionView(u.subscriptionId)
        : null,
    })),
    total,
    page,
    limit,
  };
}

async function setLandlordStatus(req) {
  v.fields(req.body, ["status", "reason"]);
  v.choice(req.body.status, ["ACTIVE", "SUSPENDED"], "Trạng thái");
  v.text(req.body.reason, "Lý do");
  return mongoose.connection.transaction(async (session) => {
    const owner = await User.findOne({
      _id: validId(req.params.landlordId),
      role: "LANDLORD",
      isDeleted: false,
    })
      .select(`${landlordProjection} +authVersion`)
      .session(session);
    if (!owner) throw new NotFoundError("Không tìm thấy chủ trọ");
    if (owner.status === req.body.status)
      return { id: owner._id, status: owner.status };
    const before = { status: owner.status };
    owner.status = req.body.status;
    owner.authVersion = (owner.authVersion || 0) + 1;
    await owner.save({ session });
    const children = await User.find({
      landlordId: owner._id,
      isDeleted: false,
      role: { $in: ["PROPERTY_MANAGER", "TENANT"] },
    })
      .select("_id")
      .session(session)
      .lean();
    await User.updateMany(
      {
        landlordId: owner._id,
        isDeleted: false,
        role: { $in: ["PROPERTY_MANAGER", "TENANT"] },
      },
      { $inc: { authVersion: 1 } },
      { session },
    );
    await AuthSession.deleteMany(
      { userId: { $in: [owner._id, ...children.map((u) => u._id)] } },
      { session },
    );
    await audit.log({
      req,
      landlordId: owner._id,
      action: "ADMIN_SET_LANDLORD_STATUS",
      entityType: "USER",
      entityId: owner._id,
      before,
      after: { status: owner.status, reason: req.body.reason },
      session,
    });
    return { id: owner._id, status: owner.status };
  });
}

async function lockOwner(id, session, requireActive = true) {
  const owner = await User.findOneAndUpdate(
    {
      _id: validId(id),
      role: "LANDLORD",
      isDeleted: false,
      ...(requireActive ? { status: "ACTIVE" } : {}),
    },
    { $inc: { quotaVersion: 1 } },
    { session, returnDocument: "after" },
  );
  if (!owner)
    throw new NotFoundError("Chủ trọ không tồn tại hoặc đang bị khóa");
  return owner;
}

async function lockPlan(id, session) {
  const plan = await SaaSPlan.findOneAndUpdate(
    { _id: validId(id), isActive: true, isDeleted: false },
    { $inc: { mutationVersion: 1 } },
    { session, returnDocument: "after" },
  );
  if (!plan) throw new NotFoundError("Gói không tồn tại hoặc ngừng hoạt động");
  return plan;
}

async function checkQuota(owner, plan, session) {
  for (const [Model, key, extra] of [
    [Branch, "maxBranches", {}],
    [Room, "maxRooms", {}],
    [User, "maxManagers", { role: "PROPERTY_MANAGER" }],
  ]) {
    const used = await Model.countDocuments({
      landlordId: owner._id,
      isDeleted: false,
      ...extra,
    }).session(session);
    if (used > plan[key])
      throw new BusinessRuleError(
        `Tài nguyên đang dùng vượt ${key} của gói đích`,
        "PLAN_QUOTA_BELOW_USAGE",
      );
  }
}

async function listSubscriptions(req) {
  const { page, limit, skip } = v.pagination(req.query);
  const filter = { isDeleted: false };
  if (req.query.landlordId) filter.landlordId = validId(req.query.landlordId);
  if (req.query.status) {
    v.choice(req.query.status, subscriptionStatuses, "Trạng thái");
    if (req.query.status === "EXPIRED")
      filter.$or = [
        { status: "EXPIRED" },
        { status: "ACTIVE", endDate: { $lte: new Date() } },
      ];
    else {
      filter.status = req.query.status;
      if (req.query.status === "ACTIVE") filter.endDate = { $gt: new Date() };
    }
  }
  if (req.query.expiringWithinDays !== undefined) {
    const days = Number(req.query.expiringWithinDays);
    v.number(days, "Số ngày cảnh báo", 1, 90);
    if (req.query.status && req.query.status !== "ACTIVE")
      throw new ValidationError("Cảnh báo hết hạn chỉ áp dụng thuê bao ACTIVE");
    const now = new Date();
    Object.assign(filter, {
      status: "ACTIVE",
      startDate: { $lte: now },
      endDate: { $gt: now, $lte: new Date(now.getTime() + days * 86400000) },
    });
  }
  const [items, total] = await Promise.all([
    Subscription.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .skip(skip)
      .limit(limit)
      .populate({
        path: "landlordId",
        select: landlordProjection,
        match: { role: "LANDLORD", isDeleted: false },
      })
      .populate({
        path: "planId",
        select: "name code",
        match: { isDeleted: false },
      })
      .lean(),
    Subscription.countDocuments(filter),
  ]);
  return { items: items.map(subscriptionView), total, page, limit };
}

function subscriptionInput(body, creating) {
  v.fields(body, [
    ...(creating ? ["landlordId"] : []),
    "planId",
    "startDate",
    "endDate",
    "status",
  ]);
  if (creating) validId(body.landlordId);
  if (creating || body.planId !== undefined) validId(body.planId);
  if (body.startDate !== undefined) v.date(body.startDate, "Ngày bắt đầu");
  if (creating || body.endDate !== undefined)
    v.date(body.endDate, "Ngày kết thúc");
  if (body.status !== undefined)
    v.choice(body.status, ["CANCELLED"], "Trạng thái do Admin đặt");
  return body;
}

async function createInvoice(req, sub, plan, session) {
  const [invoice] = await PlatformInvoice.create(
    [
      {
        landlordId: sub.landlordId,
        subscriptionId: sub._id,
        planId: plan._id,
        invoiceCode: `SAAS-${crypto.randomBytes(10).toString("hex").toUpperCase()}`,
        amount: plan.price,
        billingCycle: plan.billingCycle,
        dueDate: new Date(Date.now() + 7 * 86400000),
        status: "PENDING",
      },
    ],
    { session },
  );
  await audit.log({
    req,
    landlordId: sub.landlordId,
    action: "CREATE_PLATFORM_INVOICE",
    entityType: "PLATFORM_INVOICE",
    entityId: invoice._id,
    after: invoice.toObject(),
    session,
  });
  return invoice;
}

async function saveSubscription(req, creating = false) {
  const body = subscriptionInput(req.body, creating);
  return mongoose.connection.transaction((session) =>
    applySubscription(req, body, creating, session),
  );
}

// Body of saveSubscription, reusable inside another transaction (upgrade request approval).
async function applySubscription(req, body, creating, session) {
  let sub = creating
    ? null
    : await Subscription.findOne({
        _id: validId(req.params.subscriptionId),
        isDeleted: false,
      }).session(session);
  if (!creating && !sub) throw new NotFoundError("Không tìm thấy thuê bao");
  const owner = await lockOwner(
    String(creating ? body.landlordId : sub.landlordId),
    session,
    body.status !== "CANCELLED",
  );
  if (body.status === "CANCELLED") {
    if (creating || Object.keys(body).some((key) => key !== "status"))
      throw new ValidationError("Hủy thuê bao chỉ nhận status");
    const before = sub.toObject();
    sub.status = "CANCELLED";
    await sub.save({ session });
    await PlatformInvoice.updateMany(
      {
        subscriptionId: sub._id,
        landlordId: owner._id,
        isDeleted: false,
        status: { $in: ["PENDING", "OVERDUE"] },
      },
      { $set: { status: "CANCELLED" } },
      { session },
    );
    if (String(owner.subscriptionId) === String(sub._id)) {
      owner.subscriptionId = undefined;
      await owner.save({ session });
    }
    await audit.log({
      req,
      landlordId: owner._id,
      action: "CANCEL_SUBSCRIPTION",
      entityType: "SUBSCRIPTION",
      entityId: sub._id,
      before,
      after: sub.toObject(),
      session,
    });
    return { subscription: sub, invoice: null };
  }
  if (!creating && sub.status !== "PENDING_PAYMENT")
    throw new BusinessRuleError(
      "Thuê bao đã kích hoạt được giữ lịch sử; tạo thuê bao mới để gia hạn hoặc đổi gói",
      "SUBSCRIPTION_IMMUTABLE",
    );
  const plan = await lockPlan(String(body.planId || sub?.planId), session);
  await checkQuota(owner, plan, session);
  const startDate = body.startDate
    ? v.date(body.startDate, "Ngày bắt đầu")
    : sub?.startDate || new Date();
  const endDate = body.endDate
    ? v.date(body.endDate, "Ngày kết thúc")
    : sub.endDate;
  if (endDate <= startDate || endDate <= new Date())
    throw new ValidationError("Thời hạn thuê bao phải hợp lệ và chưa hết hạn");
  if (
    await Subscription.exists({
      landlordId: owner._id,
      isDeleted: false,
      status: "PENDING_PAYMENT",
      ...(sub ? { _id: { $ne: sub._id } } : {}),
    }).session(session)
  )
    throw new BusinessRuleError(
      "Chủ trọ đang có thuê bao chờ thanh toán",
      "SUBSCRIPTION_PENDING_EXISTS",
    );
  const before = sub?.toObject();
  if (!sub) sub = new Subscription({ landlordId: owner._id });
  Object.assign(sub, {
    planId: plan._id,
    startDate,
    endDate,
    billingCycle: plan.billingCycle,
    quotedPrice: plan.price,
    pricePaid: 0,
    status: "PENDING_PAYMENT",
  });
  await sub.save({ session });
  await PlatformInvoice.updateMany(
    {
      subscriptionId: sub._id,
      landlordId: owner._id,
      isDeleted: false,
      status: { $in: ["PENDING", "OVERDUE"] },
    },
    { $set: { status: "CANCELLED" } },
    { session },
  );
  const invoice = await createInvoice(req, sub, plan, session);
  await audit.log({
    req,
    landlordId: owner._id,
    action: creating ? "CREATE_SUBSCRIPTION" : "UPDATE_SUBSCRIPTION",
    entityType: "SUBSCRIPTION",
    entityId: sub._id,
    before,
    after: sub.toObject(),
    session,
  });
  return { subscription: sub, invoice };
}

async function listInvoices(req) {
  const { page, limit, skip } = v.pagination(req.query),
    filter = { isDeleted: false };
  if (req.query.landlordId) filter.landlordId = validId(req.query.landlordId);
  if (req.query.status) {
    v.choice(
      req.query.status,
      ["PENDING", "OVERDUE", "PAID", "CANCELLED"],
      "Trạng thái",
    );
    if (req.query.status === "OVERDUE")
      filter.$or = [
        { status: "OVERDUE" },
        { status: "PENDING", dueDate: { $lt: new Date() } },
      ];
    else {
      filter.status = req.query.status;
      if (req.query.status === "PENDING") filter.dueDate = { $gte: new Date() };
    }
  }
  const [items, total] = await Promise.all([
    PlatformInvoice.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    PlatformInvoice.countDocuments(filter),
  ]);
  return {
    items: items.map((i) => ({
      ...i,
      displayStatus:
        i.status === "PENDING" && i.dueDate < new Date() ? "OVERDUE" : i.status,
    })),
    total,
    page,
    limit,
  };
}

async function confirmInvoice(req) {
  const body = {
    ...v.fields(req.body, [
      "paymentReference",
      "paymentGateway",
      "paidAt",
      "paymentEvidence",
    ]),
  };
  for (const key of ["paymentReference", "paymentGateway", "paymentEvidence"])
    v.text(body[key], key);
  body.paymentReference = body.paymentReference.trim();
  body.paymentGateway = body.paymentGateway.trim();
  if (!/^https?:\/\//.test(body.paymentEvidence))
    throw new ValidationError("Chứng từ phải là URL http/https");
  const paidAt = v.date(body.paidAt, "Ngày thanh toán");
  if (paidAt > new Date())
    throw new ValidationError("Ngày thanh toán không được trong tương lai");
  return mongoose.connection.transaction((session) =>
    settlePlatformInvoice(
      req,
      { _id: validId(req.params.invoiceId) },
      { ...body, paidAt },
      session,
    ),
  );
}

// Marks a SaaS invoice paid and activates its subscription. Used by the admin's manual
// confirmation and by the SePay payment gateway IPN (req.user is then a SYSTEM actor).
async function settlePlatformInvoice(req, filter, payment, session) {
  const { paidAt } = payment;
  const body = payment;
  const invoice = await PlatformInvoice.findOne({
    ...filter,
    isDeleted: false,
  }).session(session);
  if (!invoice) throw new NotFoundError("Không tìm thấy hóa đơn SaaS");
  if (invoice.status === "PAID") {
    if (invoice.paymentReference === body.paymentReference)
      return { invoice, duplicate: true };
    throw new BusinessRuleError(
      "Hóa đơn đã được thanh toán",
      "PLATFORM_INVOICE_ALREADY_PAID",
    );
  }
  if (!["PENDING", "OVERDUE"].includes(invoice.status))
    throw new BusinessRuleError("Hóa đơn không thể thanh toán");
  if (paidAt < invoice.createdAt)
    throw new ValidationError("Ngày thanh toán phải sau ngày xuất hóa đơn");
  const sub = await Subscription.findOne({
    _id: invoice.subscriptionId,
    landlordId: invoice.landlordId,
    isDeleted: false,
    status: "PENDING_PAYMENT",
  }).session(session);
  if (!sub || sub.endDate <= new Date())
    throw new BusinessRuleError(
      "Thuê bao không còn chờ thanh toán hoặc đã hết hạn",
    );
  const owner = await lockOwner(String(invoice.landlordId), session);
  const plan = await lockPlan(String(sub.planId), session);
  await checkQuota(owner, plan, session);
  if (
    String(invoice.planId) !== String(sub.planId) ||
    invoice.amount !== sub.quotedPrice
  )
    throw new BusinessRuleError(
      "Hóa đơn không khớp thuê bao",
      "PLATFORM_INVOICE_CONFLICT",
    );
  const before = invoice.toObject();
  Object.assign(invoice, body, {
    status: "PAID",
    paidAt,
    // Gateway payments have no admin behind them.
    confirmedBy: req.user.role === "SUPER_ADMIN" ? req.user._id : undefined,
  });
  await invoice.save({ session });
  sub.pricePaid = invoice.amount;
  sub.status = "ACTIVE";
  await sub.save({ session });
  // Only replace the current entitlement when the new period has begun.
  if (sub.startDate <= new Date()) {
    if (
      owner.subscriptionId &&
      String(owner.subscriptionId) !== String(sub._id)
    )
      await Subscription.updateOne(
        {
          _id: owner.subscriptionId,
          landlordId: owner._id,
          isDeleted: false,
          status: "ACTIVE",
        },
        { $set: { status: "CANCELLED" } },
        { session },
      );
    owner.subscriptionId = sub._id;
    await owner.save({ session });
  }
  await audit.log({
    req,
    landlordId: owner._id,
    action: "CONFIRM_PLATFORM_PAYMENT",
    entityType: "PLATFORM_INVOICE",
    entityId: invoice._id,
    before,
    after: invoice.toObject(),
    session,
  });
  return { invoice, subscription: sub, duplicate: false };
}

async function listAuditLogs(req) {
  const { page, limit, skip } = v.pagination(req.query);
  const filter = {};
  if (req.query.action) filter.action = req.query.action;
  if (req.query.entityType) filter.entityType = req.query.entityType;
  if (req.query.landlordId) filter.landlordId = validId(req.query.landlordId);
  const [items, total] = await Promise.all([
    AuditLog.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("actorId", "name email role")
      .populate("landlordId", "name email")
      .lean(),
    AuditLog.countDocuments(filter),
  ]);
  return { items, total, page, limit };
}

module.exports = {
  listLandlords,
  setLandlordStatus,
  listSubscriptions,
  saveSubscription,
  applySubscription,
  subscriptionInput,
  listInvoices,
  confirmInvoice,
  settlePlatformInvoice,
  listAuditLogs,
};
