const { verifyAccessToken } = require("../utils/tokenUtils");
const User = require("../models/User");

const protect = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    token = req.headers.authorization.split(" ")[1];
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      message: "Bạn chưa đăng nhập hoặc phiên làm việc không hợp lệ",
    });
  }

  try {
    const decoded = verifyAccessToken(token);

    const user = await User.findById(decoded.id).select("-password");
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Người dùng không tồn tại trong hệ thống",
      });
    }

    if (user.status === "SUSPENDED" || user.status === "REJECTED") {
      return res.status(403).json({
        success: false,
        message: "Tài khoản của bạn đang bị tạm khóa hoặc từ chối",
      });
    }

    req.user = user;
    // Đảm bảo req.landlordId luôn nhất quán phục vụ Multi-tenancy
    req.landlordId = user.role === "LANDLORD" ? user._id : user.landlordId;

    next();
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        success: false,
        code: "TOKEN_EXPIRED",
        message: "Phiên đăng nhập đã hết hạn, vui lòng làm mới token",
      });
    }

    return res.status(401).json({
      success: false,
      message: "Token không hợp lệ",
    });
  }
};

const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Vai trò [${req.user ? req.user.role : "GUEST"}] không có quyền thực hiện thao tác này`,
      });
    }
    next();
  };
};

module.exports = {
  protect,
  authorize,
};
