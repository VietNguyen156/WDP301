module.exports = (res, data, status = 200, message = "Xử lý thành công") =>
  res.status(status).json({ success: true, data, message });
