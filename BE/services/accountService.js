const mongoose = require("mongoose");
const User = require("../models/User");
const Branch = require("../models/Branch");
const AuthSession = require("../models/AuthSession");
const { getTenantScope, scoped, validId } = require("../utils/scope");
const { BusinessRuleError, NotFoundError, ValidationError } = require("../utils/errors");
const v = require("../utils/validation");
const account = require("./accountValidation");
const { publicUser } = require("./authService");
const quota = require("./quotaService");
const audit = require("./auditService");

function profile(body, role) {
  v.fields(body, role === "PROPERTY_MANAGER"
    ? ["name", "phoneNumber", "email", "assignedBranches"]
    : ["name", "citizenId", "phoneNumber", "email", "hometown"]);
  v.text(body.name, "Họ và tên");
  const data = {
    name: body.name.trim(), email: account.email(body.email),
    phoneNumber: account.phone(body.phoneNumber, role === "PROPERTY_MANAGER"),
  };
  if (role === "TENANT") {
    data.citizenId = account.citizenId(body.citizenId);
    if (body.hometown !== undefined) {
      v.text(body.hometown, "Quê quán", false);
      data.hometown = body.hometown;
    }
  }
  return data;
}

async function assignedBranches(req, ids = [], session) {
  if (!Array.isArray(ids) || ids.length > 100)
    throw new ValidationError("Danh sách cơ sở không hợp lệ");
  const unique = [...new Set(ids.map(validId))];
  const count = await Branch.countDocuments({
    _id: { $in: unique }, landlordId: req.user._id, isDeleted: false, status: "ACTIVE",
  }).session(session);
  if (count !== unique.length)
    throw new ValidationError("Cơ sở không hoạt động hoặc không thuộc quyền quản lý", "BRANCH_SCOPE_FORBIDDEN");
  return unique;
}

async function createAccount(req, role, body, session) {
  const data = profile(body, role);
  if (role === "PROPERTY_MANAGER") {
    data.assignedBranches = await assignedBranches(req, body.assignedBranches, session);
    await quota.guard({ landlordId: req.user._id, resource: "manager", session });
  }
  const temporaryPassword = account.temporaryPassword();
  const [user] = await User.create([{
    ...data, role, landlordId: req.user._id, status: "ACTIVE",
    password: temporaryPassword, mustChangePassword: true,
  }], { session });
  await audit.log({ req, action: "PROVISION_ACCOUNT", entityType: "USER", entityId: user._id,
    after: publicUser(user), session });
  return { user, credentials: { username: user.username, temporaryPassword, mustChangePassword: true } };
}

async function createStaff(req) {
  return mongoose.connection.transaction(async (session) => {
    const result = await createAccount(req, "PROPERTY_MANAGER", req.body, session);
    return { user: publicUser(result.user), credentials: result.credentials };
  });
}

async function tenantForContract(req, body, session) {
  const data = profile(body, "TENANT");
  const user = await User.findOne(scoped(getTenantScope(req), {
    citizenId: data.citizenId, role: "TENANT",
  })).session(session);
  if (!user) return createAccount(req, "TENANT", body, session);
  if (!["ACTIVE", "PENDING_ACTIVATION"].includes(user.status)
    || (data.email && data.email !== user.email)
    || (data.phoneNumber && data.phoneNumber !== user.phoneNumber))
    throw new BusinessRuleError("Thông tin khách thuê không khớp tài khoản đã cấp", "TENANT_IDENTITY_CONFLICT");
  return { user };
}

async function list(req, role) {
  const { page, limit, skip } = v.pagination(req.query);
  const filter = scoped(getTenantScope(req), { role });
  const [users, total] = await Promise.all([
    User.find(filter).select("username name email phoneNumber citizenId role status landlordId assignedBranches mustChangePassword")
      .sort({ createdAt: -1, _id: -1 }).skip(skip).limit(limit).lean(),
    User.countDocuments(filter),
  ]);
  return { items: users.map(publicUser), total, page, limit };
}

async function resetPassword(req, role, id) {
  v.fields(req.body || {}, []);
  return mongoose.connection.transaction(async (session) => {
    const user = await User.findOne(scoped(getTenantScope(req), { _id: validId(id), role }))
      .select("+authVersion").session(session);
    if (!user) throw new NotFoundError("Không tìm thấy tài khoản được cấp");
    if (!["ACTIVE", "PENDING_ACTIVATION"].includes(user.status))
      throw new BusinessRuleError("Không thể cấp mật khẩu cho tài khoản đang bị khóa");
    const temporaryPassword = account.temporaryPassword();
    user.password = temporaryPassword;
    user.status = "ACTIVE";
    user.mustChangePassword = true;
    user.authVersion = (user.authVersion || 0) + 1;
    await user.save({ session });
    await AuthSession.deleteMany({ userId: user._id }, { session });
    await audit.log({ req, action: "RESET_ACCOUNT_PASSWORD", entityType: "USER", entityId: user._id,
      after: { mustChangePassword: true }, session });
    return { user: publicUser(user), credentials: { username: user.username, temporaryPassword, mustChangePassword: true } };
  });
}

module.exports = { createStaff, list, resetPassword, tenantForContract, profile };
