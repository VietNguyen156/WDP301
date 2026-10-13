const authService = require("../services/authService");
const { AppError, ForbiddenError } = require("../utils/errors");
async function authenticate(req, res, next) {
  if (!req.headers.authorization?.startsWith("Bearer "))
    throw new AppError("Vui lòng đăng nhập", 401, "AUTH_REQUIRED");
  req.user = await authService.authenticate(req.headers.authorization.slice(7));
  next();
}
const authorize =
  (...roles) =>
  (req, res, next) => {
    if (!roles.includes(req.user?.role)) throw new ForbiddenError();
    next();
  };
module.exports = { authenticate, authorize };
