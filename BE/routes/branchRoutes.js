const express = require("express");
const router = express.Router();
const { protect, authorize } = require("../middlewares/authMiddleware");

/**
 * 👤 PHỤ TRÁCH: DEV 1 (GIAI ĐOẠN 1 - QUẢN LÝ CƠ SỞ)
 * Nhiệm vụ:
 * - GET /api/v1/branches           : Lấy danh sách tòa nhà/cơ sở của landlord
 * - POST /api/v1/branches          : Tạo cơ sở mới (kèm giá điện/nước/dịch vụ mặc định)
 * - GET /api/v1/branches/:id       : Chi tiết cơ sở
 * - PUT /api/v1/branches/:id       : Cập nhật thông tin/đơn giá cơ sở
 * - DELETE /api/v1/branches/:id    : Xóa cơ sở (kiểm tra không còn phòng hoạt động)
 */

// Route placeholder kiểm tra kết nối
router.get("/ping", protect, (req, res) => {
  res.json({ success: true, message: "Branch route is ready for Dev 1!" });
});

module.exports = router;
