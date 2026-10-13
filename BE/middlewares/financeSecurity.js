const crypto = require("node:crypto");
const { rateLimit } = require("express-rate-limit");
const AppError = require("../utils/AppError");

const limiter = (limit) =>
  rateLimit({
    windowMs: 60_000,
    limit,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    handler: (req, res, next) =>
      next(new AppError(429, "RATE_LIMITED", "Vui lòng thử lại sau")),
  });

function equalSecret(actual, expected) {
  const a = Buffer.from(actual);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function verifyWebhook(req, res, next) {
  const mode = process.env.SEPAY_AUTH_MODE || "apikey";
  if (mode === "apikey" && process.env.SEPAY_API_KEY) {
    if (
      equalSecret(
        req.get("Authorization") || "",
        `Apikey ${process.env.SEPAY_API_KEY}`,
      )
    )
      return next();
  } else if (mode === "hmac" && process.env.SEPAY_WEBHOOK_SECRET) {
    const timestamp = req.get("X-SePay-Timestamp") || "";
    if (
      /^\d+$/.test(timestamp) &&
      Math.abs(Date.now() / 1000 - Number(timestamp)) <= 300 &&
      req.rawBody
    ) {
      const hash = crypto
        .createHmac("sha256", process.env.SEPAY_WEBHOOK_SECRET)
        .update(`${timestamp}.`)
        .update(req.rawBody)
        .digest("hex");
      if (equalSecret(req.get("X-SePay-Signature") || "", `sha256=${hash}`))
        return next();
    }
  } else {
    return next(
      new AppError(
        503,
        "WEBHOOK_NOT_CONFIGURED",
        "Chưa cấu hình xác thực webhook",
      ),
    );
  }
  next(
    new AppError(401, "WEBHOOK_UNAUTHORIZED", "Xác thực webhook không hợp lệ"),
  );
}

module.exports = {
  publicInvoiceLimiter: limiter(60),
  webhookLimiter: limiter(120),
  verifyWebhook,
};
