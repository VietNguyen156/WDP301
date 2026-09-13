const jwt = require("jsonwebtoken");

const getAccessSecret = () => process.env.JWT_ACCESS_SECRET || "fallback_access_secret_wdp301";
const getRefreshSecret = () => process.env.JWT_REFRESH_SECRET || "fallback_refresh_secret_wdp301";

const signAccessToken = (user) => {
  return jwt.sign(
    {
      id: user._id,
      role: user.role,
      landlordId: user.landlordId || (user.role === "LANDLORD" ? user._id : null),
    },
    getAccessSecret(),
    { expiresIn: process.env.JWT_ACCESS_EXPIRES_IN || "15m" }
  );
};

const signRefreshToken = (user) => {
  return jwt.sign(
    {
      id: user._id,
      role: user.role,
    },
    getRefreshSecret(),
    { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || "7d" }
  );
};

const verifyAccessToken = (token) => {
  return jwt.verify(token, getAccessSecret());
};

const verifyRefreshToken = (token) => {
  return jwt.verify(token, getRefreshSecret());
};

const sendTokenResponse = async (res, user, statusCode = 200, message = "Thành công") => {
  const accessToken = signAccessToken(user);
  const refreshToken = signRefreshToken(user);

  // Lưu refreshToken vào DB (hỗ trợ thu hồi token khi logout)
  if (!user.refreshTokens) {
    user.refreshTokens = [];
  }
  // Giữ tối đa 5 phiên đăng nhập gần nhất
  user.refreshTokens = [...user.refreshTokens.slice(-4), refreshToken];
  await user.save({ validateBeforeSave: false });

  const isProduction = process.env.NODE_ENV === "production";
  const cookieOptions = {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "none" : "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 ngày
    path: "/",
  };

  res.cookie("refreshToken", refreshToken, cookieOptions);

  return res.status(statusCode).json({
    success: true,
    message,
    accessToken,
    user: {
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      phoneNumber: user.phoneNumber,
      landlordId: user.landlordId || (user.role === "LANDLORD" ? user._id : null),
      status: user.status,
      isEmailVerified: user.isEmailVerified,
    },
  });
};

module.exports = {
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  sendTokenResponse,
};
