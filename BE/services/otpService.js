const crypto = require("crypto");
const mongoose = require("mongoose");
const User = require("../models/User");
const OtpChallenge = require("../models/OtpChallenge");
const sms = require("./smsService");
const v = require("../utils/validation");
const { validId } = require("../utils/scope");
const { AppError } = require("../utils/errors");
const invalid = () =>
  new AppError("Mã OTP không đúng, đã dùng hoặc hết hạn", 400, "OTP_INVALID");
function codeHash(id, code) {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32)
    throw new AppError(
      "Máy chủ chưa cấu hình xác thực",
      503,
      "AUTH_CONFIGURATION_ERROR",
    );
  return crypto
    .createHmac("sha256", process.env.JWT_SECRET)
    .update(`${id}:${code}`)
    .digest("hex");
}
async function requestOtp(body) {
  v.fields(body, ["email", "phoneNumber"]);
  v.text(body.email, "Email");
  v.text(body.phoneNumber, "Số điện thoại");
  const user = await User.findOne({
    email: body.email.trim().toLowerCase(),
    phoneNumber: body.phoneNumber.trim(),
    role: "TENANT",
    status: "PENDING_ACTIVATION",
    isDeleted: false,
  }).lean();
  const id = new mongoose.Types.ObjectId();
  if (user) {
    const code = String(crypto.randomInt(100000, 1000000));
    const challenge = await OtpChallenge.create({
      _id: id,
      userId: user._id,
      codeHash: codeHash(id, code),
      expiresAt: new Date(Date.now() + 5 * 60000),
    });
    try {
      await sms.sendOtp(user.phoneNumber, code);
    } catch (error) {
      await OtpChallenge.deleteOne({ _id: challenge._id });
      throw error;
    }
  }
  return {
    challengeId: String(id),
    message:
      "Nếu thông tin khớp tài khoản chờ kích hoạt, mã OTP đã được gửi tới số điện thoại đã đăng ký.",
  };
}
async function verifyOtp(body) {
  v.fields(body, ["challengeId", "code", "password"]);
  validId(body.challengeId);
  v.text(body.code, "Mã OTP");
  v.text(body.password, "Mật khẩu");
  if (
    !/^\d{6}$/.test(body.code) ||
    body.password.length < 8 ||
    body.password.length > 72
  )
    throw invalid();
  // Increment attempts outside the transaction so failed attempts persist.
  const challenge = await OtpChallenge.findOneAndUpdate(
    {
      _id: body.challengeId,
      expiresAt: { $gt: new Date() },
      attempts: { $lt: 5 },
    },
    { $inc: { attempts: 1 } },
    { returnDocument: "after" },
  ).lean();
  if (
    !challenge ||
    !crypto.timingSafeEqual(
      Buffer.from(challenge.codeHash, "hex"),
      Buffer.from(codeHash(body.challengeId, body.code), "hex"),
    )
  )
    throw invalid();
  await mongoose.connection.transaction(async (session) => {
    const consumed = await OtpChallenge.deleteOne(
      { _id: challenge._id, expiresAt: { $gt: new Date() } },
      { session },
    );
    if (!consumed.deletedCount) throw invalid();
    const user = await User.findOne({
      _id: challenge.userId,
      role: "TENANT",
      status: "PENDING_ACTIVATION",
      isDeleted: false,
    }).session(session);
    if (!user) throw invalid();
    user.password = body.password;
    user.status = "ACTIVE";
    await user.save({ session });
  });
  return {
    message:
      "Đã kích hoạt tài khoản. Bạn có thể đăng nhập bằng mật khẩu vừa tạo.",
  };
}
module.exports = { requestOtp, verifyOtp };
