const express = require("express");
const router = express.Router();
const { protect, authorize } = require("../middlewares/authMiddleware");

/**
 * 👤 PHỤ TRÁCH: DEV 4 (GIAI ĐOẠN 6 - DASHBOARD DÒNG TIỀN CHỦ TRỌ 3 GIÂY)
 * Nhiệm vụ:
 * - GET /api/v1/dashboard/stats      : Thống kê 3 giây (Doanh thu thực/dự thu, tỉ lệ lấp đầy %, phòng nợ)
 * - GET /api/v1/dashboard/debt-rooms : Danh sách các phòng đang nợ tiền + nội dung tin nhắn nhắc nợ Zalo
 */

router.use(protect);
router.use(authorize("LANDLORD", "PROPERTY_MANAGER"));

router.get("/ping", (req, res) => {
  res.json({ success: true, message: "Dashboard route is ready for Dev 4!" });
});

module.exports = router;
