const { AppError } = require("../utils/errors");
// Adapter contract: POST { to, message }, Bearer SMS_API_KEY, success = HTTP 2xx.
async function sendOtp(phoneNumber, code) {
  if (!process.env.SMS_API_URL || !process.env.SMS_API_KEY) {
    if (process.env.NODE_ENV === "development") {
      console.log(
        `[OTP development] ${phoneNumber}: ${code} (hiệu lực 5 phút)`,
      );
      return;
    }
    throw new AppError(
      "Dịch vụ gửi OTP chưa được cấu hình. Vui lòng liên hệ quản trị viên.",
      503,
      "SMS_CONFIGURATION_ERROR",
    );
  }
  try {
    const response = await fetch(process.env.SMS_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.SMS_API_KEY}`,
      },
      body: JSON.stringify({
        to: phoneNumber,
        message: `Ma kich hoat TroFlow: ${code}. Hieu luc 5 phut. Khong chia se ma nay.`,
      }),
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) throw new Error("SMS provider rejected request");
  } catch {
    throw new AppError(
      "Không thể gửi OTP lúc này. Vui lòng thử lại sau.",
      503,
      "SMS_DELIVERY_FAILED",
    );
  }
}
module.exports = { sendOtp };
