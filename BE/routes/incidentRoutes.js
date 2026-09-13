const express = require("express");
const router = express.Router();
const { protect, authorize } = require("../middlewares/authMiddleware");

/**
 * 👤 PHỤ TRÁCH: DEV 2 (GIAI ĐOẠN 7 - QUẢN LÝ SỰ CỐ & NHÂN VIÊN)
 * Nhiệm vụ:
 * - GET /api/v1/incidents          : Danh sách sự cố báo hỏng
 * - POST /api/v1/incidents         : Tenant hoặc Manager tạo báo hỏng kèm ảnh
 * - PUT /api/v1/incidents/:id/resolve : Chủ trọ duyệt chi phí sửa chữa & phân bổ người chịu tiền (Chủ / Trừ cọc)
 * - GET /api/v1/incidents/staffs   : Quản lý danh sách nhân viên cơ sở (PROPERTY_MANAGER)
 */

router.get("/ping", protect, (req, res) => {
  res.json({ success: true, message: "Incident route is ready for Dev 2!" });
});

module.exports = router;
