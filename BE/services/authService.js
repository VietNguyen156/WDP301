const crypto = require("node:crypto");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const AuthSession = require("../models/AuthSession");
const SaaSPlan = require("../models/SaaSPlan");
const Subscription = require("../models/Subscription");
const { AppError, ForbiddenError, ValidationError } = require("../utils/errors");
const v = require("../utils/validation");
const account = require("./accountValidation");
const audit = require("./auditService");
const { currentSubscription } = require("./quotaService");
const { FEATURE_KEYS } = require("../utils/planFeatures");
const { planHas } = require("./planFeatures");
const hash = (token) => crypto.createHash("sha256").update(token).digest("hex");
const authError = () => new AppError("Phiên đăng nhập không hợp lệ hoặc đã hết hạn", 401, "AUTH_REQUIRED");

function secret() {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32)
    throw new AppError("Máy chủ chưa cấu hình JWT_SECRET (tối thiểu 32 ký tự)", 503, "AUTH_CONFIGURATION_ERROR");
  return process.env.JWT_SECRET;
}

function publicUser(user) {
  return {
    id: user._id,
    username: user.username || user.email,
    name: user.name,
    email: user.email,
    phoneNumber: user.phoneNumber,
    citizenId: user.citizenId,
    role: user.role,
    status: user.status,
    landlordId: user.role === "LANDLORD" ? user._id : user.landlordId,
    assignedBranches: user.assignedBranches || [],
    mustChangePassword: !!user.mustChangePassword,
  };
}

const planView = (plan) => plan && {
  id: plan._id, code: plan.code, name: plan.name,
  maxBranches: plan.maxBranches, maxRooms: plan.maxRooms, maxManagers: plan.maxManagers,
  featureFlags: FEATURE_KEYS.filter((key) => planHas(plan, key)),
};
const subscriptionView = (sub) => sub && {
  id: sub._id, status: sub.status, startDate: sub.startDate, endDate: sub.endDate, plan: planView(sub.planId),
};

// Session payload for the UI: landlords also get the plan in force and any upgrade awaiting payment.
async function accountView(user) {
  const data = publicUser(user);
  if (user.role !== "LANDLORD") return data;
  const [current, pending] = await Promise.all([
    currentSubscription(user._id),
    Subscription.findOne({ landlordId: user._id, status: "PENDING_PAYMENT", isDeleted: false })
      .sort({ createdAt: -1 }).populate({ path: "planId", match: { isDeleted: false } }).lean(),
  ]);
  data.subscription = current?.planId ? subscriptionView(current) : null;
  data.subscriptionPlan = data.subscription?.plan.code || null;
  data.pendingSubscription = pending?.planId ? subscriptionView(pending) : null;
  return data;
}

async function activeUser(id) {
  const user = await User.findOne({ _id: id, isDeleted: false, status: "ACTIVE" })
    .select("+authVersion").lean();
  if (!user) throw authError();
  if (["TENANT", "PROPERTY_MANAGER"].includes(user.role)) {
    if (!user.landlordId || !(await User.exists({
      _id: user.landlordId, role: "LANDLORD", status: "ACTIVE", isDeleted: false,
    }))) throw new ForbiddenError("Tài khoản chủ cơ sở đã bị khóa");
  }
  return user;
}

function tokenFor(user, session) {
  return jwt.sign({ sid: String(session._id), version: user.authVersion || 0 }, secret(), {
    subject: String(user._id), expiresIn: "15m", issuer: "wdp301", audience: "wdp301-web", algorithm: "HS256",
  });
}

async function login(body) {
  v.fields(body, ["username", "email", "password"]);
  if ((body.username !== undefined) === (body.email !== undefined))
    throw new ValidationError("Cung cấp username hoặc email");
  v.text(body.username ?? body.email, "Tài khoản");
  v.text(body.password, "Mật khẩu");
  let username = (body.username ?? body.email).trim().toLowerCase();
  if (username.startsWith("+84")) username = account.phone(username, true);
  // Email remains accepted for existing clients; phone/CCCD are the new account names.
  const filter = username.includes("@") ? { email: username } : { username };
  const user = await User.findOne({ ...filter, isDeleted: false }).select("+password +authVersion");
  if (!user || !(await user.comparePassword(body.password)))
    throw new AppError("Tài khoản hoặc mật khẩu không đúng", 401, "AUTH_REQUIRED");
  const active = await activeUser(user._id);
  if ((user.authVersion || 0) !== (active.authVersion || 0)) throw authError();
  const refreshToken = crypto.randomBytes(48).toString("hex");
  const session = new AuthSession({
    userId: user._id, tokenHash: hash(refreshToken), authVersion: active.authVersion || 0,
    expiresAt: new Date(Date.now() + 7 * 86400000),
  });
  const token = tokenFor(active, session);
  await session.save();
  return { token, user: await accountView(active), refreshToken };
}

async function register(req) {
  const body = v.fields(req.body, ["name", "email", "phoneNumber", "password", "role"]);
  if (body.role !== undefined && body.role !== "LANDLORD")
    throw new ForbiddenError("Chỉ chủ trọ được tự đăng ký tài khoản");
  v.text(body.name, "Họ và tên");
  const input = {
    name: body.name.trim(), email: account.email(body.email, true),
    phoneNumber: account.phone(body.phoneNumber), password: account.password(body.password),
    role: "LANDLORD", status: "ACTIVE", mustChangePassword: false,
  };
  return mongoose.connection.transaction(async (session) => {
    const [user] = await User.create([input], { session });
    const plan = await SaaSPlan.findOneAndUpdate({ code: "FREE_TRIAL" }, { $setOnInsert: {
      name: "Gói Dùng Thử", code: "FREE_TRIAL", price: 0,
      maxBranches: 1, maxRooms: 5, maxManagers: 1, isActive: true, featureFlags: [],
    } }, { upsert: true, returnDocument: "after", runValidators: true, session });
    if (plan.isActive && !plan.isDeleted && plan.price === 0) {
      const [subscription] = await Subscription.create([{
        landlordId: user._id, planId: plan._id, startDate: new Date(),
        endDate: new Date(Date.now() + (plan.trialDays || 30) * 86400000), pricePaid: 0,
        quotedPrice: 0, billingCycle: plan.billingCycle, status: "ACTIVE",
      }], { session });
      user.subscriptionId = subscription._id;
      await user.save({ session });
    }
    await audit.log({
      req: { user, ip: req.ip, get: (name) => req.get?.(name) },
      action: "REGISTER_LANDLORD", entityType: "USER",
      entityId: user._id, after: publicUser(user), session,
    });
    return { user: await accountView(user) };
  });
}

async function refresh(refreshToken) {
  if (typeof refreshToken !== "string" || !/^[a-f\d]{96}$/.test(refreshToken)) throw authError();
  const session = await AuthSession.findOne({ tokenHash: hash(refreshToken), expiresAt: { $gt: new Date() } }).lean();
  if (!session) throw authError();
  const user = await activeUser(session.userId);
  if (session.authVersion !== (user.authVersion || 0)) throw authError();
  return { token: tokenFor(user, session), user: await accountView(user) };
}

async function logout(token) {
  if (typeof token === "string") await AuthSession.deleteOne({ tokenHash: hash(token) });
}

async function authenticate(token) {
  let payload;
  try {
    payload = jwt.verify(token, secret(), { algorithms: ["HS256"], issuer: "wdp301", audience: "wdp301-web", maxAge: "15m" });
  } catch (error) {
    if (error.statusCode) throw error;
    throw authError();
  }
  if (!mongoose.isObjectIdOrHexString(payload.sub) || !mongoose.isObjectIdOrHexString(payload.sid)
    || !Number.isFinite(payload.exp) || !Number.isSafeInteger(payload.version)) throw authError();
  const user = await activeUser(payload.sub);
  if (payload.version !== (user.authVersion || 0) || !(await AuthSession.exists({
    _id: payload.sid, userId: user._id, authVersion: payload.version, expiresAt: { $gt: new Date() },
  }))) throw authError();
  return user;
}

async function changePassword(req) {
  const body = v.fields(req.body, ["currentPassword", "newPassword"]);
  v.text(body.currentPassword, "Mật khẩu hiện tại");
  account.password(body.newPassword);
  return mongoose.connection.transaction(async (session) => {
    const user = await User.findOne({ _id: req.user._id, isDeleted: false, status: "ACTIVE" })
      .select("+password +authVersion").session(session);
    if (!user || (user.authVersion || 0) !== (req.user.authVersion || 0)) throw authError();
    if (!(await user.comparePassword(body.currentPassword)))
      throw new AppError("Mật khẩu hiện tại không đúng", 400, "CURRENT_PASSWORD_INVALID");
    if (await user.comparePassword(body.newPassword))
      throw new ValidationError("Mật khẩu mới phải khác mật khẩu hiện tại", "PASSWORD_UNCHANGED");
    user.password = body.newPassword;
    user.mustChangePassword = false;
    user.authVersion = (user.authVersion || 0) + 1;
    await user.save({ session });
    await AuthSession.deleteMany({ userId: user._id }, { session });
    await audit.log({ req, action: "CHANGE_PASSWORD", entityType: "USER", entityId: user._id,
      after: { mustChangePassword: false }, session });
    return { user: publicUser(user), requiresLogin: true };
  });
}

module.exports = { login, register, refresh, logout, authenticate, publicUser, accountView, changePassword };
