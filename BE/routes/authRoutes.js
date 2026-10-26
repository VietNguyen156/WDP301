const router = require("express").Router();
const { limiter, accountLimit } = require("../middlewares/rateLimit");
const service = require("../services/authService");
const { authenticateAccount } = require("../middlewares/auth");
const { AppError, ForbiddenError } = require("../utils/errors");
const respond = require("../utils/response");
const { clientUrl } = require("../utils/appUrls");
// FE and API on different domains (e.g. Vercel + Render) need SameSite=None, which browsers
// only accept together with Secure: so Secure follows SameSite, not NODE_ENV. This lets a
// deployed "development" build (sandbox payments, simulator on) keep users signed in.
const cookieOptions = () => {
  const sameSite =
    process.env.COOKIE_SAME_SITE ||
    (process.env.NODE_ENV === "production" ? "none" : "lax");
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production" || sameSite === "none",
    sameSite,
    path: "/api",
    maxAge: 7 * 86400000,
  };
};
router.use((req, res, next) => {
  res.set("Cache-Control", "no-store");
  if (
    req.method === "POST" &&
    req.headers.origin &&
    req.headers.origin !== clientUrl()
  )
    throw new ForbiddenError("Nguồn yêu cầu không hợp lệ");
  next();
});
router.post(
  "/login",
  limiter({
    windowMs: 15 * 60000,
    limit: 20,
    message: "Bạn đăng nhập quá nhiều lần. Vui lòng thử lại sau.",
  }),
  async (req, res) => {
    const { refreshToken, ...data } = await service.login(req.body);
    const legacyCookie = cookieOptions();
    delete legacyCookie.maxAge;
    res.clearCookie("refreshToken", { ...legacyCookie, path: "/api/v1/auth" });
    res.cookie("refreshToken", refreshToken, cookieOptions());
    respond(res, data);
  },
);
router.post("/refresh", async (req, res) =>
  respond(res, await service.refresh(req.cookies.refreshToken)),
);
router.post("/register", accountLimit(), async (req, res) =>
  respond(
    res,
    await service.register(req),
    201,
    "Đăng ký thành công. Bạn có thể đăng nhập ngay.",
  ),
);
router.post(
  "/change-password",
  accountLimit(),
  authenticateAccount,
  async (req, res) => {
    const data = await service.changePassword(req);
    clearRefreshCookie(res);
    respond(res, data, 200, "Đã đổi mật khẩu. Vui lòng đăng nhập lại.");
  },
);
router.post(["/otp/request", "/otp/verify"], accountLimit(), () => {
  throw new AppError(
    "Tài khoản do chủ trọ cấp mật khẩu tạm. Vui lòng đăng nhập và đổi mật khẩu.",
    410,
    "OTP_ACTIVATION_RETIRED",
  );
});
function clearRefreshCookie(res) {
  const options = cookieOptions();
  delete options.maxAge;
  res.clearCookie("refreshToken", options);
  res.clearCookie("refreshToken", { ...options, path: "/api/v1/auth" });
}
router.post("/logout", async (req, res) => {
  await service.logout(req.cookies.refreshToken);
  clearRefreshCookie(res);
  respond(res, null);
});
router.get("/me", authenticateAccount, async (req, res) =>
  respond(res, await service.accountView(req.user)),
);
module.exports = router;
