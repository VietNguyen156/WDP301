const crypto = require("crypto");
const User = require("../models/User");
const {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  sendTokenResponse,
} = require("../utils/tokenUtils");
const { sendVerificationEmail } = require("../services/emailService");

// @desc    Đăng ký tài khoản Chủ trọ (Landlord) & Gửi email xác thực
// @route   POST /api/auth/register
// @access  Public
const register = async (req, res, next) => {
  try {
    const { name, email, password, phoneNumber } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "Vui lòng nhập đầy đủ họ tên, email và mật khẩu",
      });
    }

    // Kiểm tra email đã tồn tại chưa
    const existingUser = await User.findOne({ email: email.toLowerCase().trim() });
    if (existingUser) {
      if (!existingUser.isEmailVerified) {
        return res.status(400).json({
          success: false,
          code: "EMAIL_NOT_VERIFIED",
          message: "Email này đã được đăng ký nhưng chưa xác thực. Vui lòng kiểm tra email hoặc yêu cầu gửi lại link kích hoạt.",
        });
      }
      return res.status(400).json({
        success: false,
        message: "Email này đã được sử dụng trong hệ thống",
      });
    }

    // Tạo token xác thực ngẫu nhiên 32 bytes
    const rawToken = crypto.randomBytes(32).toString("hex");
    const hashedToken = crypto.createHash("sha256").update(rawToken).digest("hex");
    const tokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 giờ

    const newUser = await User.create({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password,
      phoneNumber: phoneNumber ? phoneNumber.trim() : undefined,
      role: "LANDLORD", // Chỉ Landlord được phép tự đăng ký tự do
      status: "ACTIVE",
      isEmailVerified: false,
      emailVerificationToken: hashedToken,
      emailVerificationExpires: tokenExpires,
    });

    // Gửi email xác thực
    await sendVerificationEmail({
      to: newUser.email,
      name: newUser.name,
      token: rawToken,
    });

    return res.status(201).json({
      success: true,
      message: "Đăng ký thành công! Hệ thống đã gửi email xác thực đến hòm thư của bạn. Vui lòng kiểm tra để kích hoạt tài khoản.",
      data: {
        email: newUser.email,
        name: newUser.name,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Xác thực tài khoản qua link email
// @route   GET /api/auth/verify-email/:token
// @access  Public
const verifyEmail = async (req, res, next) => {
  try {
    const rawToken = req.params.token || req.query.token;

    if (!rawToken) {
      return res.status(400).json({
        success: false,
        message: "Mã token xác thực không được để trống",
      });
    }

    const hashedToken = crypto.createHash("sha256").update(rawToken).digest("hex");

    const user = await User.findOne({
      emailVerificationToken: hashedToken,
      emailVerificationExpires: { $gt: new Date() },
    }).select("+refreshTokens");

    if (!user) {
      return res.status(400).json({
        success: false,
        message: "Liên kết xác thực không hợp lệ hoặc đã hết hạn (sau 24 giờ). Vui lòng yêu cầu gửi lại email mới.",
      });
    }

    // Kích hoạt tài khoản
    user.isEmailVerified = true;
    user.status = "ACTIVE";
    user.emailVerificationToken = undefined;
    user.emailVerificationExpires = undefined;
    await user.save({ validateBeforeSave: false });

    // Tự động đăng nhập và cấp token luôn cho trải nghiệm tốt nhất
    return sendTokenResponse(
      res,
      user,
      200,
      "Tài khoản của bạn đã được xác thực thành công!"
    );
  } catch (error) {
    next(error);
  }
};

// @desc    Gửi lại email xác thực
// @route   POST /api/auth/resend-verification
// @access  Public
const resendVerification = async (req, res, next) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Vui lòng cung cấp địa chỉ email",
      });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy người dùng với email này",
      });
    }

    if (user.isEmailVerified) {
      return res.status(400).json({
        success: false,
        message: "Tài khoản này đã được xác thực trước đó rồi, bạn có thể đăng nhập ngay",
      });
    }

    const rawToken = crypto.randomBytes(32).toString("hex");
    user.emailVerificationToken = crypto.createHash("sha256").update(rawToken).digest("hex");
    user.emailVerificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await user.save({ validateBeforeSave: false });

    await sendVerificationEmail({
      to: user.email,
      name: user.name,
      token: rawToken,
    });

    return res.status(200).json({
      success: true,
      message: "Đã gửi lại email xác thực thành công. Vui lòng kiểm tra hộp thư.",
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Đăng nhập hệ thống
// @route   POST /api/auth/login
// @access  Public
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Vui lòng nhập đầy đủ email và mật khẩu",
      });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() })
      .select("+password +refreshTokens");

    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({
        success: false,
        message: "Email hoặc mật khẩu không chính xác",
      });
    }

    // Bắt buộc xác thực email trước khi đăng nhập (Option B)
    if (!user.isEmailVerified) {
      return res.status(403).json({
        success: false,
        code: "EMAIL_NOT_VERIFIED",
        message: "Tài khoản của bạn chưa được kích hoạt qua email. Vui lòng kiểm tra hòm thư để kích hoạt.",
        email: user.email,
      });
    }

    if (user.status === "SUSPENDED" || user.status === "REJECTED") {
      return res.status(403).json({
        success: false,
        message: "Tài khoản của bạn đang bị khóa hoặc bị từ chối truy cập",
      });
    }

    return sendTokenResponse(res, user, 200, "Đăng nhập thành công");
  } catch (error) {
    next(error);
  }
};

// @desc    Làm mới access token bằng HttpOnly Refresh Token
// @route   POST /api/auth/refresh
// @access  Public (với HttpOnly Cookie)
const refreshToken = async (req, res, next) => {
  try {
    const oldRefreshToken = req.cookies.refreshToken;

    if (!oldRefreshToken) {
      return res.status(401).json({
        success: false,
        message: "Không tìm thấy phiên làm việc, vui lòng đăng nhập lại",
      });
    }

    let decoded;
    try {
      decoded = verifyRefreshToken(oldRefreshToken);
    } catch (err) {
      return res.status(401).json({
        success: false,
        message: "Refresh token đã hết hạn hoặc không hợp lệ",
      });
    }

    const user = await User.findById(decoded.id).select("+refreshTokens");
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Người dùng không còn tồn tại trong hệ thống",
      });
    }

    // Kiểm tra token rotation / thu hồi
    if (!user.refreshTokens || !user.refreshTokens.includes(oldRefreshToken)) {
      // Bị reuse hoặc token cũ đã bị thu hồi -> xóa sạch token để bảo vệ
      user.refreshTokens = [];
      await user.save({ validateBeforeSave: false });
      res.clearCookie("refreshToken");
      return res.status(403).json({
        success: false,
        message: "Phát hiện phiên đăng nhập bất thường, vui lòng đăng nhập lại",
      });
    }

    // Xoay vòng Refresh Token (Token Rotation)
    const newAccessToken = signAccessToken(user);
    const newRefreshToken = signRefreshToken(user);

    user.refreshTokens = user.refreshTokens.filter((t) => t !== oldRefreshToken);
    user.refreshTokens.push(newRefreshToken);
    await user.save({ validateBeforeSave: false });

    const isProduction = process.env.NODE_ENV === "production";
    res.cookie("refreshToken", newRefreshToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? "none" : "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: "/",
    });

    return res.status(200).json({
      success: true,
      accessToken: newAccessToken,
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
  } catch (error) {
    next(error);
  }
};

// @desc    Đăng xuất và hủy Cookie
// @route   POST /api/auth/logout
// @access  Public
const logout = async (req, res, next) => {
  try {
    const currentRefreshToken = req.cookies.refreshToken;

    if (currentRefreshToken) {
      try {
        const decoded = verifyRefreshToken(currentRefreshToken);
        const user = await User.findById(decoded.id).select("+refreshTokens");
        if (user && user.refreshTokens) {
          user.refreshTokens = user.refreshTokens.filter((t) => t !== currentRefreshToken);
          await user.save({ validateBeforeSave: false });
        }
      } catch (err) {
        // Token có thể đã hết hạn, vẫn tiếp tục xóa cookie
      }
    }

    res.clearCookie("refreshToken", {
      httpOnly: true,
      path: "/",
    });

    return res.status(200).json({
      success: true,
      message: "Đăng xuất thành công",
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Lấy thông tin người dùng đang đăng nhập
// @route   GET /api/auth/me
// @access  Private (Cần Access Token)
const getMe = async (req, res) => {
  return res.status(200).json({
    success: true,
    data: {
      _id: req.user._id,
      name: req.user.name,
      email: req.user.email,
      role: req.user.role,
      phoneNumber: req.user.phoneNumber,
      landlordId: req.landlordId,
      status: req.user.status,
      isEmailVerified: req.user.isEmailVerified,
      bankConfig: req.user.bankConfig,
      assignedBranches: req.user.assignedBranches,
    },
  });
};

module.exports = {
  register,
  verifyEmail,
  resendVerification,
  login,
  refreshToken,
  logout,
  getMe,
};
