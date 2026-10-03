const mongoose = require("mongoose");
const AppError = require("./AppError");

function objectId(value, field = "id") {
  if (typeof value !== "string" || !/^[a-f\d]{24}$/i.test(value)) {
    throw new AppError(400, "INVALID_ID", `${field} không hợp lệ`);
  }
  return new mongoose.Types.ObjectId(value);
}

function money(value, field, positive = false) {
  if (!Number.isSafeInteger(value) || value < (positive ? 1 : 0)) {
    throw new AppError(400, "PAYMENT_AMOUNT_INVALID", `${field} phải là số nguyên VND ${positive ? "dương" : "không âm"}`);
  }
  return value;
}

function text(value, field, max = 250) {
  if (typeof value !== "string" || !value.trim() || value.trim().length > max) {
    throw new AppError(400, "VALIDATION_ERROR", `${field} là bắt buộc và tối đa ${max} ký tự`);
  }
  return value.trim();
}

function date(value, field) {
  // Require an ISO date or ISO timestamp with timezone; never depend on server timezone.
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2}))?$/.test(value)) {
    throw new AppError(400, "VALIDATION_ERROR", `${field} phải là ngày ISO hợp lệ`);
  }
  const parsed = new Date(value);
  const calendar = new Date(`${value.slice(0, 10)}T00:00:00Z`);
  if (!Number.isFinite(parsed.getTime()) || calendar.toISOString().slice(0, 10) !== value.slice(0, 10)) {
    throw new AppError(400, "VALIDATION_ERROR", `${field} không hợp lệ`);
  }
  return parsed;
}

function period(value) {
  if (typeof value !== "string" || !/^20\d{2}-(0[1-9]|1[0-2])$/.test(value)) {
    throw new AppError(400, "VALIDATION_ERROR", "billingPeriod phải có dạng YYYY-MM");
  }
  return value;
}

function pagination(query) {
  const page = Number(query.page ?? 1);
  const limit = Number(query.limit ?? 20);
  if (!Number.isSafeInteger(page) || page < 1 || !Number.isSafeInteger(limit) || limit < 1 || limit > 100 || !Number.isSafeInteger((page - 1) * limit)) {
    throw new AppError(400, "VALIDATION_ERROR", "page >= 1, limit từ 1 đến 100");
  }
  return { page, limit, skip: (page - 1) * limit };
}

module.exports = { objectId, money, text, date, period, pagination };
