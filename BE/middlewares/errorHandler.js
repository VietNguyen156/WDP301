const errorHandler = (err, req, res, next) => {
  if (res.headersSent) return next(err);
  let status = err.statusCode || 500;
  let code = err.errorCode || "INTERNAL_SERVER_ERROR";
  let message = err.statusCode
    ? err.message
    : "Không thể xử lý yêu cầu. Vui lòng thử lại.";

  if (err.name === "ValidationError" && err.errors) {
    status = 400;
    code = "VALIDATION_ERROR";
    message = Object.values(err.errors)
      .map((e) => e.message)
      .join("; ");
  } else if (err.name === "CastError") {
    status = 400;
    code = "INVALID_ID";
    message = "Mã định danh hoặc dữ liệu không hợp lệ";
  } else if (err.code === 11000) {
    status = 409;
    code = "CONFLICT";
    message = "Dữ liệu đã tồn tại (email, số phòng hoặc mã hợp đồng)";
  } else if (err.type === "entity.parse.failed") {
    status = 400;
    code = "VALIDATION_ERROR";
    message = "JSON không hợp lệ";
  } else if (err.type === "entity.too.large") {
    status = 413;
    code = "PAYLOAD_TOO_LARGE";
    message = "Dung lượng yêu cầu quá lớn";
  } else if (err.code === 20 || err.codeName === "IllegalOperation") {
    status = 503;
    code = "TRANSACTIONS_REQUIRED";
    message = "Hệ thống yêu cầu MongoDB replica set hoặc Atlas để chạy transaction";
  }

  if (status >= 500 && !err.errorCode && code === "INTERNAL_SERVER_ERROR") {
    console.error("Backend error:", err.name, err.message, err.code || "");
    message = "Lỗi máy chủ nội bộ. Vui lòng thử lại.";
  } else if (status >= 500) {
    console.error("Request failed:", err.name, err.message);
  }

  res.status(status).json({
    success: false,
    errorCode: code,
    message,
    data: null,
  });
};

module.exports = errorHandler;
