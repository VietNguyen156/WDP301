const express = require("express");
const router = express.Router();
const { protect, authorize } = require("../middlewares/authMiddleware");

/**
 * 👤 PHỤ TRÁCH: DEV 1 (GIAI ĐOẠN 1 - QUẢN LÝ PHÒNG)
 * Nhiệm vụ:
 * - GET /api/v1/rooms              : Lấy danh sách phòng theo cơ sở (lọc EMPTY, RENTED...)
 * - POST /api/v1/rooms             : Tạo 1 phòng đơn lẻ
 * - POST /api/v1/rooms/bulk        : Thêm nhanh hàng loạt phòng (vd: Tầng 1 -> 4, phòng 101 -> 405)
 * - GET /api/v1/rooms/:id          : Xem chi tiết phòng
 * - PUT /api/v1/rooms/:id          : Cập nhật thông tin phòng
 * - DELETE /api/v1/rooms/:id       : Xóa phòng
 */

router.get("/ping", protect, (req, res) => {
  res.json({ success: true, message: "Room route is ready for Dev 1!" });
});

module.exports = router;
