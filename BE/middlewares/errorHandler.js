const errorHandler = (err, req, res, next) => {
  if (res.headersSent) return next(err);
  let status = err.statusCode || 500;
  let errorCode = err.errorCode || "INTERNAL_SERVER_ERROR";
  let message = err.message;
  if (err.name === "ValidationError") {
    status = 400;
    errorCode = "VALIDATION_ERROR";
    message = Object.values(err.errors).map((value) => value.message).join(", ");
  } else if (err.code === 11000) {
    status = 409;
    errorCode = "RESOURCE_DUPLICATED";
    message = "Dữ liệu đã tồn tại";
  } else if (err.name === "CastError") {
    status = 400;
    errorCode = "INVALID_ID";
    message = "ID không hợp lệ";
  } else if (err.type === "entity.parse.failed") {
    status = 400;
    errorCode = "VALIDATION_ERROR";
    message = "JSON không hợp lệ";
  } else if (err.type === "entity.too.large") {
    status = 413;
    errorCode = "PAYLOAD_TOO_LARGE";
    message = "Request quá lớn";
  } else if (err.code === 20 || err.codeName === "IllegalOperation") {
    status = 503;
    errorCode = "TRANSACTIONS_REQUIRED";
    message = "Finance yêu cầu MongoDB replica set hoặc Atlas để chạy transaction";
  }
  if (status >= 500 && !err.errorCode && errorCode === "INTERNAL_SERVER_ERROR") {
    console.error("Backend error:", err.name, err.code || "");
    message = "Lỗi máy chủ nội bộ";
  }
  res.status(status).json({ success: false, errorCode, message, data: null });
};

module.exports = errorHandler;
