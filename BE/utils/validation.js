const { ValidationError } = require("./errors");
function object(value, label = "Dữ liệu") {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new ValidationError(`${label} không hợp lệ`);
  return value;
}
function fields(body, allowed) {
  object(body);
  const unknown = Object.keys(body).filter((key) => !allowed.includes(key));
  if (unknown.length)
    throw new ValidationError(`Trường không được phép: ${unknown.join(", ")}`);
  return body;
}
function text(value, label, required = true) {
  if (!required && value === undefined) return;
  if (
    typeof value !== "string" ||
    (required && !value.trim()) ||
    value.length > 2000
  )
    throw new ValidationError(`${label} không hợp lệ`);
}
function number(value, label, min = 0, max = Number.MAX_SAFE_INTEGER) {
  if (!Number.isSafeInteger(value) || value < min || value > max)
    throw new ValidationError(
      `${label} phải là số nguyên từ ${min} đến ${max}`,
    );
}
function choice(value, values, label) {
  if (!values.includes(value))
    throw new ValidationError(`${label} không hợp lệ`);
}
function date(value, label) {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}(T.*)?$/.test(value) ||
    !Number.isFinite(Date.parse(value)) ||
    new Date(`${value.slice(0, 10)}T00:00:00Z`).toISOString().slice(0, 10) !==
      value.slice(0, 10)
  )
    throw new ValidationError(`${label} không hợp lệ`);
  return new Date(value);
}
function pagination(query) {
  const page = Number(query.page || 1),
    limit = Number(query.limit || 20);
  number(page, "Trang", 1, 100000);
  number(limit, "Số bản ghi", 1, 100);
  return { page, limit, skip: (page - 1) * limit };
}
function search(value) {
  if (!value) return undefined;
  text(value, "Tìm kiếm");
  return new RegExp(value.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
}
module.exports = {
  object,
  fields,
  text,
  number,
  choice,
  date,
  pagination,
  search,
};
