const router = require("express").Router();
const { limiter, accountLimit } = require("../middlewares/rateLimit");
const service = require("../services/authService");
const { authenticateAccount } = require("../middlewares/auth");
const { AppError, ForbiddenError } = require("../utils/errors");
const respond = require("../utils/response");
const { isAllowedOrigin } = require("../utils/appUrls");
// FE and API on different domains (e.g. Vercel + Render) need SameSite=None, which browsers
// only accept together with Secure: so Secure follows SameSite, not NODE_ENV. On local HTTP
// development (not HTTPS), fall back to Lax so browsers don't reject the refresh cookie.
const cookieOptions = (req) => {
  const isHttps =
    process.env.NODE_ENV === "production" ||
    Boolean(req?.secure) ||
    req?.headers?.["x-forwarded-proto"] === "https";
  const configured = process.env.COOKIE_SAME_SITE;
  const sameSite =
    configured === "none" && !isHttps
      ? "lax"
      : configured || (process.env.NODE_ENV === "production" ? "none" : "lax");
  return {
    httpOnly: true,
    secure: isHttps || sameSite === "none",
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
    !isAllowedOrigin(req.headers.origin)
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
    // Several accounts matched: no session yet, the client shows the account chooser.
    if (data.selectionRequired)
      return respond(res, data, 200, "Chọn tài khoản để tiếp tục");
    const legacyCookie = cookieOptions(req);
    delete legacyCookie.maxAge;
    res.clearCookie("refreshToken", { ...legacyCookie, path: "/api/v1/auth" });
    res.cookie("refreshToken", refreshToken, cookieOptions(req));
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
    clearRefreshCookie(req, res);
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
function clearRefreshCookie(req, res) {
  const options = cookieOptions(req);
  delete options.maxAge;
  res.clearCookie("refreshToken", options);
  res.clearCookie("refreshToken", { ...options, path: "/api/v1/auth" });
}
router.post("/logout", async (req, res) => {
  await service.logout(req.cookies.refreshToken);
  clearRefreshCookie(req, res);
  respond(res, null);
});
router.get("/me", authenticateAccount, async (req, res) =>
  respond(res, await service.accountView(req.user)),
);
module.exports = router;
