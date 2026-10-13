const errorHandler = (error, req, res, next) => {
  if (res.headersSent) return next(error);
  let status = error.statusCode || 500;
  let code = error.errorCode || "INTERNAL_SERVER_ERROR";
  let message = error.statusCode
    ? error.message
    : "Không thể xử lý yêu cầu. Vui lòng thử lại.";
  if (error.name === "ValidationError" && error.errors) {
    status = 400;
    code = "VALIDATION_ERROR";
    message = Object.values(error.errors)
      .map((e) => e.message)
      .join("; ");
  } else if (error.name === "CastError") {
    status = 400;
    code = "INVALID_ID";
    message = "Mã định danh hoặc dữ liệu không hợp lệ";
  } else if (error.code === 11000) {
    status = 409;
    code = "CONFLICT";
    message = "Dữ liệu đã tồn tại (email, số phòng hoặc mã hợp đồng)";
  } else if (error.type === "entity.parse.failed") {
    status = 400;
    code = "VALIDATION_ERROR";
    message = "JSON không hợp lệ";
  }
  if (status >= 500)
    console.error("Request failed:", error.name, error.message);
  res
    .status(status)
    .json({ success: false, errorCode: code, message, data: null });
};
module.exports = errorHandler;
