const errorHandler = (err, req, res, next) => {
  console.error("Error:", err.stack || err.message);

  // Mongoose validation error
  if (err.name === "ValidationError") {
    const messages = Object.values(err.errors).map((val) => val.message);
    return res.status(400).json({
      success: false,
      message: messages.join(", "),
    });
  }

  // Mongoose duplicate key error (ví dụ trùng email)
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    return res.status(400).json({
      success: false,
      message: `${field} đã tồn tại trong hệ thống`,
    });
  }

  // Mongoose invalid ObjectId
  if (err.name === "CastError") {
    return res.status(400).json({
      success: false,
      message: `ID không hợp lệ: ${err.value}`,
    });
  }

  // Default error
  res.status(err.statusCode || 500).json({
    success: false,
    message: err.message || "Lỗi máy chủ nội bộ",
  });
};

module.exports = errorHandler;
