const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const AuthSession = require("../models/AuthSession");
const { AppError, ForbiddenError } = require("../utils/errors");
const v = require("../utils/validation");
const hash = (token) => crypto.createHash("sha256").update(token).digest("hex");
const authError = () =>
  new AppError(
    "Phiên đăng nhập không hợp lệ hoặc đã hết hạn",
    401,
    "AUTH_REQUIRED",
  );
function secret() {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32)
    throw new AppError(
      "Máy chủ chưa cấu hình JWT_SECRET (tối thiểu 32 ký tự)",
      503,
      "AUTH_CONFIGURATION_ERROR",
    );
  return process.env.JWT_SECRET;
}
function publicUser(user) {
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    landlordId: user.role === "LANDLORD" ? user._id : user.landlordId,
    assignedBranches: user.assignedBranches || [],
  };
}
async function activeUser(id) {
  const user = await User.findOne({
    _id: id,
    isDeleted: false,
    status: "ACTIVE",
  }).lean();
  if (!user) throw authError();
  if (["TENANT", "PROPERTY_MANAGER"].includes(user.role)) {
    if (
      !user.landlordId ||
      !(await User.exists({
        _id: user.landlordId,
        role: "LANDLORD",
        status: "ACTIVE",
        isDeleted: false,
      }))
    )
      throw new ForbiddenError("Tài khoản chủ cơ sở đã bị khóa");
  }
  return user;
}
function tokenFor(user) {
  return jwt.sign({}, secret(), {
    subject: String(user._id),
    expiresIn: "15m",
    issuer: "wdp301",
    audience: "wdp301-web",
    algorithm: "HS256",
  });
}
async function login(body) {
  v.fields(body, ["email", "password"]);
  v.text(body.email, "Email");
  v.text(body.password, "Mật khẩu");
  const user = await User.findOne({
    email: body.email.trim().toLowerCase(),
    isDeleted: false,
  }).select("+password");
  if (!user || !(await user.comparePassword(body.password)))
    throw new AppError("Email hoặc mật khẩu không đúng", 401, "AUTH_REQUIRED");
  await activeUser(user._id);
  const token = tokenFor(user),
    refreshToken = crypto.randomBytes(48).toString("hex");
  await AuthSession.create({
    userId: user._id,
    tokenHash: hash(refreshToken),
    expiresAt: new Date(Date.now() + 7 * 86400000),
  });
  return { token, user: publicUser(user), refreshToken };
}
async function refresh(refreshToken) {
  if (typeof refreshToken !== "string") throw authError();
  const session = await AuthSession.findOne({
    tokenHash: hash(refreshToken),
    expiresAt: { $gt: new Date() },
  }).lean();
  if (!session) throw authError();
  const user = await activeUser(session.userId);
  return { token: tokenFor(user), user: publicUser(user) };
}
async function logout(token) {
  if (typeof token === "string")
    await AuthSession.deleteOne({ tokenHash: hash(token) });
}
async function authenticate(token) {
  let payload;
  try {
    payload = jwt.verify(token, secret(), {
      algorithms: ["HS256"],
      issuer: "wdp301",
      audience: "wdp301-web",
    });
  } catch (error) {
    if (error.statusCode) throw error;
    throw authError();
  }
  return activeUser(payload.sub);
}
module.exports = { login, refresh, logout, authenticate, publicUser };
