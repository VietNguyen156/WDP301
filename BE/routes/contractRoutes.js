const express = require("express");
const router = express.Router();
const { protect, authorize } = require("../middlewares/authMiddleware");

/**
 * 👤 PHỤ TRÁCH: DEV 1 (GIAI ĐOẠN 2 - QUẢN LÝ KHÁCH THUÊ & HỢP ĐỒNG)
 * Nhiệm vụ:
 * - GET /api/v1/contracts          : Lấy danh sách hợp đồng (lọc ACTIVE, TERMINATED...)
 * - POST /api/v1/contracts         : Lập hợp đồng mới (tạo TENANT, đổi trạng thái phòng sang RENTED, lưu chỉ số ban đầu)
 * - GET /api/v1/contracts/:id      : Chi tiết hợp đồng & hồ sơ người thuê
 * - PUT /api/v1/contracts/:id      : Cập nhật hợp đồng / danh sách người ở cùng
 * - POST /api/v1/contracts/:id/terminate : Kết thúc hợp đồng, thanh lý cọc, đưa phòng về OVERDUE_CLEANUP hoặc EMPTY
 */

router.get("/ping", protect, (req, res) => {
  res.json({ success: true, message: "Contract route is ready for Dev 1!" });
});

module.exports = router;
