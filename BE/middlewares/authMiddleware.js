const jwt = require("jsonwebtoken");
const User = require("../models/User");
const AppError = require("../utils/AppError");

async function authenticate(req, res, next) {
  try {
    if (req.headers["x-landlord-id"] || req.headers["x-user-id"]) {
      throw new AppError(
        403,
        "FORBIDDEN",
        "Không hỗ trợ bypass xác thực bằng header",
      );
    }
    const authorization = req.get("Authorization") || "";
    if (!authorization.startsWith("Bearer "))
      throw new AppError(401, "AUTH_REQUIRED", "Vui lòng đăng nhập");
    if (!process.env.JWT_SECRET)
      throw new AppError(503, "AUTH_NOT_CONFIGURED", "Chưa cấu hình xác thực");
    let payload;
    try {
      payload = jwt.verify(authorization.slice(7), process.env.JWT_SECRET, {
        algorithms: ["HS256"],
        maxAge: "15m",
      });
    } catch {
      throw new AppError(
        401,
        "AUTH_REQUIRED",
        "Token không hợp lệ hoặc đã hết hạn",
      );
    }
    const id = payload.sub || payload.id || payload._id;
    if (
      typeof id !== "string" ||
      !/^[a-f\d]{24}$/i.test(id) ||
      !Number.isFinite(payload.exp) || (payload.type && payload.type !== "access")
    ) {
      throw new AppError(401, "AUTH_REQUIRED", "Token không hợp lệ");
    }
    req.user = await User.findOne({
      _id: id,
      isDeleted: false,
      status: "ACTIVE",
    });
    if (!req.user)
      throw new AppError(401, "AUTH_REQUIRED", "Tài khoản không hoạt động");
    next();
  } catch (error) {
    next(error);
  }
}

const authorize =
  (...roles) =>
  (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return next(
        new AppError(403, "FORBIDDEN", "Không có quyền thực hiện thao tác này"),
      );
    }
    next();
  };

module.exports = { authenticate, authorize };
