const router = require("express").Router();
const { rateLimit } = require("express-rate-limit");
const service = require("../services/authService");
const otp = require("../services/otpService");
const { authenticate } = require("../middlewares/auth");
const { ForbiddenError } = require("../utils/errors");
const respond = require("../utils/response");
const cookieOptions = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite:
    process.env.COOKIE_SAME_SITE ||
    (process.env.NODE_ENV === "production" ? "none" : "lax"),
  path: "/api/v1/auth",
  maxAge: 7 * 86400000,
});
router.use((req, res, next) => {
  res.set("Cache-Control", "no-store");
  if (
    req.method === "POST" &&
    req.headers.origin &&
    req.headers.origin !== (process.env.CLIENT_URL || "http://localhost:5173")
  )
    throw new ForbiddenError("Nguồn yêu cầu không hợp lệ");
  next();
});
router.post(
  "/login",
  rateLimit({
    windowMs: 15 * 60000,
    limit: 20,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: {
      success: false,
      errorCode: "TOO_MANY_REQUESTS",
      message: "Bạn đăng nhập quá nhiều lần. Vui lòng thử lại sau.",
      data: null,
    },
  }),
  async (req, res) => {
    const { refreshToken, ...data } = await service.login(req.body);
    res.cookie("refreshToken", refreshToken, cookieOptions());
    respond(res, data);
  },
);
router.post("/refresh", async (req, res) =>
  respond(res, await service.refresh(req.cookies.refreshToken)),
);
const otpLimit = rateLimit({
  windowMs: 15 * 60000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    success: false,
    data: null,
    errorCode: "TOO_MANY_REQUESTS",
    message: "Bạn yêu cầu OTP quá nhiều lần. Vui lòng thử lại sau.",
  },
});
router.post("/otp/request", otpLimit, async (req, res) =>
  respond(res, await otp.requestOtp(req.body)),
);
router.post("/otp/verify", otpLimit, async (req, res) =>
  respond(res, await otp.verifyOtp(req.body)),
);
router.post("/logout", async (req, res) => {
  await service.logout(req.cookies.refreshToken);
  const options = cookieOptions();
  delete options.maxAge;
  res.clearCookie("refreshToken", options);
  respond(res, null);
});
router.get("/me", authenticate, (req, res) =>
  respond(res, service.publicUser(req.user)),
);
module.exports = router;
