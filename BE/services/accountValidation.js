const crypto = require("node:crypto");
const v = require("../utils/validation");
const { ValidationError } = require("../utils/errors");

function email(value, required = false) {
  if (!required && (value === undefined || value === "")) return undefined;
  v.text(value, "Email");
  const normalized = value.trim().toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(normalized) || normalized.length > 254)
    throw new ValidationError("Email không hợp lệ");
  return normalized;
}

function phone(value, required = false) {
  if (!required && (value === undefined || value === "")) return undefined;
  v.text(value, "Số điện thoại");
  const normalized = value
    .trim()
    .replace(/[\s.-]/g, "")
    .replace(/^\+84/, "0");
  if (!/^0\d{9}$/.test(normalized))
    throw new ValidationError(
      "Số điện thoại phải có 10 chữ số, bắt đầu bằng 0",
    );
  return normalized;
}

function citizenId(value) {
  v.text(value, "CCCD");
  if (!/^\d{12}$/.test(value.trim()))
    throw new ValidationError("CCCD phải là chuỗi gồm 12 chữ số");
  return value.trim();
}

function password(value) {
  v.text(value, "Mật khẩu");
  if (value.length < 8 || Buffer.byteLength(value, "utf8") > 72)
    throw new ValidationError(
      "Mật khẩu phải từ 8 ký tự và không vượt quá 72 byte UTF-8",
    );
  return value;
}

const temporaryPassword = () => crypto.randomBytes(15).toString("base64url");
module.exports = { email, phone, citizenId, password, temporaryPassword };
