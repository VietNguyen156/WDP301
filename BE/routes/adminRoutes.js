const express = require("express");
const router = express.Router();
const { protect, authorize } = require("../middlewares/authMiddleware");

/**
 * 👤 PHỤ TRÁCH: DEV 4 (GIAI ĐOẠN 8 - SAAS PLATFORM SUPER ADMIN)
 * Nhiệm vụ:
 * - GET /api/v1/admin/plans             : Danh sách gói cước SaaS (Starter, Pro...)
 * - POST /api/v1/admin/plans            : Tạo/cập nhật gói dịch vụ SaaS
 * - GET /api/v1/admin/landlords         : Quản lý danh sách các Chủ trọ (Tenant Landlords)
 * - PUT /api/v1/admin/landlords/:id/status : Khóa/mở khóa tài khoản chủ trọ (SUSPENDED / ACTIVE)
 * - GET /api/v1/admin/analytics         : Thống kê doanh thu toàn sàn SaaS (MRR, tổng số phòng, số chủ trọ)
 */

// Tất cả route trong admin bắt buộc phải có protect và authorize("ADMIN")
router.use(protect);
router.use(authorize("ADMIN"));

router.get("/ping", (req, res) => {
  res.json({ success: true, message: "Admin route is ready for Dev 4!" });
});

module.exports = router;
