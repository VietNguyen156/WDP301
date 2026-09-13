const express = require("express");
const router = express.Router();
const { protect, authorize } = require("../middlewares/authMiddleware");

/**
 * 👤 PHỤ TRÁCH: DEV 2 (GIAI ĐOẠN 3 - CHỐT SỐ ĐIỆN NƯỚC MOBILE-FIRST)
 * Nhiệm vụ:
 * - GET /api/v1/utilities/previous : Lấy danh sách phòng kèm chỉ số cũ tháng trước để đối chiếu
 * - POST /api/v1/utilities/record  : Lưu chỉ số mới (Validation Guard: Mới >= Cũ, cảnh báo vọt > 2.5 lần)
 * - GET /api/v1/utilities/history  : Lịch sử ghi chỉ số theo phòng/tháng
 */

router.get("/ping", protect, (req, res) => {
  res.json({ success: true, message: "Utility route is ready for Dev 2!" });
});

module.exports = router;
