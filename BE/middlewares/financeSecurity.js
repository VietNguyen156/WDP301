const crypto = require("node:crypto");
const { AppError } = require("../utils/errors");
const { limiter } = require("./rateLimit");

const perMinute = (limit) =>
  limiter({ windowMs: 60_000, limit, errorCode: "RATE_LIMITED" });

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
        "Chưa cấu hình xác thực webhook",
        503,
        "WEBHOOK_NOT_CONFIGURED",
      ),
    );
  }
  next(
    new AppError("Xác thực webhook không hợp lệ", 401, "WEBHOOK_UNAUTHORIZED"),
  );
}

// SePay Bank Hub sends a fixed credential: "Authorization: Apikey <key>" for balance IPN,
// "X-Secret-Key: <secret>" for link/unlink events. Unset credential -> endpoint disabled.
const verifyHeader =
  (header, envName, prefix = "") =>
  (req, res, next) => {
    const secret = process.env[envName];
    if (!secret)
      return next(
        new AppError(
          "Chưa cấu hình xác thực SePay Bank Hub",
          503,
          "WEBHOOK_NOT_CONFIGURED",
        ),
      );
    if (equalSecret(req.get(header) || "", `${prefix}${secret}`)) return next();
    next(
      new AppError(
        "Xác thực webhook không hợp lệ",
        401,
        "WEBHOOK_UNAUTHORIZED",
      ),
    );
  };

module.exports = {
  publicInvoiceLimiter: perMinute(60),
  webhookLimiter: perMinute(120),
  verifyWebhook,
  verifyBankHubIpn: verifyHeader(
    "Authorization",
    "SEPAY_BANKHUB_IPN_API_KEY",
    "Apikey ",
  ),
  verifyBankHubEvent: verifyHeader(
    "X-Secret-Key",
    "SEPAY_BANKHUB_WEBHOOK_SECRET",
  ),
  // Payment gateway IPN with auth type SECRET_KEY configured in my.sepay.vn.
  verifySePayPgIpn: verifyHeader("X-Secret-Key", "SEPAY_PG_IPN_SECRET"),
};
