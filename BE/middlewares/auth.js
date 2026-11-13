const authService = require("../services/authService");
const { AppError, ForbiddenError } = require("../utils/errors");
async function authenticateAccount(req, res, next) {
  if (!req.headers.authorization?.startsWith("Bearer "))
    throw new AppError("Vui lòng đăng nhập", 401, "AUTH_REQUIRED");
  req.user = await authService.authenticate(req.headers.authorization.slice(7));
  next();
}
async function authenticate(req, res, next) {
  await authenticateAccount(req, res, () => {});
  if (req.user.mustChangePassword)
    throw new ForbiddenError(
      "Bạn phải đổi mật khẩu trước khi sử dụng hệ thống",
      "PASSWORD_CHANGE_REQUIRED",
    );
  next();
}
const authorize =
  (...roles) =>
  (req, res, next) => {
    if (!roles.includes(req.user?.role)) throw new ForbiddenError();
    next();
  };
// Blocks a branch manager whose landlord switched this permission off (utils/managerPermissions.js).
// Other roles pass: their access is decided by authorize().
const permit = (key) => (req, res, next) => {
  if (req.user?.role === "PROPERTY_MANAGER" && req.user.deniedPermissions?.includes(key))
    throw new ForbiddenError("Chủ trọ đã tắt quyền này của bạn", "PERMISSION_DISABLED");
  next();
};
module.exports = { authenticate, authenticateAccount, authorize, permit };
