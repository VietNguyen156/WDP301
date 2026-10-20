const { rateLimit } = require("express-rate-limit");
const { AppError } = require("../utils/errors");

// Every limiter answers through the central error handler, so a 429 has the same shape as
// any other API error: { success: false, errorCode, message, data: null }.
function limiter({
  windowMs,
  limit,
  message = "Vui lòng thử lại sau",
  errorCode = "TOO_MANY_REQUESTS",
  keyGenerator,
}) {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    ...(keyGenerator && { keyGenerator }),
    handler: (req, res, next) => next(new AppError(message, 429, errorCode)),
  });
}

// Account endpoints (register, password change, bank account): a fresh counter per route.
const accountLimit = (options = {}) =>
  limiter({
    windowMs: 15 * 60000,
    limit: 10,
    message: "Bạn gửi quá nhiều yêu cầu tài khoản. Vui lòng thử lại sau.",
    ...options,
  });

module.exports = { limiter, accountLimit };
