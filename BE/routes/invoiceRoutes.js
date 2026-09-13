const express = require("express");
const router = express.Router();
const { protect, authorize } = require("../middlewares/authMiddleware");

/**
 * 👤 PHỤ TRÁCH: DEV 3 (GIAI ĐOẠN 4 - TÍNH TOÁN HÓA ĐƠN & VIETQR)
 * Nhiệm vụ:
 * - POST /api/v1/invoices/generate-batch : Xuất hóa đơn hàng loạt sau khi chốt điện nước
 * - GET /api/v1/invoices                 : Danh sách hóa đơn (lọc PAID, UNPAID, OVERDUE)
 * - GET /api/v1/invoices/:id             : Chi tiết hóa đơn
 * - GET /api/v1/invoices/public/:token   : [PUBLIC NO-APP] Khách thuê mở link xem VietQR trực tiếp không cần đăng nhập
 */

// Route xem hóa đơn công khai (Không cần middleware protect)
router.get("/public/:token", (req, res) => {
  res.json({ success: true, message: "Public invoice view placeholder for Dev 3", token: req.params.token });
});

router.get("/ping", protect, (req, res) => {
  res.json({ success: true, message: "Invoice route is ready for Dev 3!" });
});

module.exports = router;
