const express = require("express");
const router = express.Router();
const { protect, authorize } = require("../middlewares/authMiddleware");

/**
 * 👤 PHỤ TRÁCH: DEV 3 (GIAI ĐOẠN 5 - GẠCH NỢ TỰ ĐỘNG & WEBHOOK SEPAY)
 * Nhiệm vụ:
 * - POST /api/v1/payments/webhook       : [PUBLIC] Nhận biến động số dư SePay (Idempotency, Regex /HD\d+/, so khớp & gạch nợ)
 * - POST /api/v1/payments/cash-confirm  : Chủ trọ xác nhận thu tiền mặt thủ công
 * - GET /api/v1/payments/history        : Lịch sử các giao dịch thanh toán
 */

// Webhook nhận biến động số dư (Không dùng protect JWT, xác thực qua API Key hoặc IP nếu cần)
router.post("/webhook", (req, res) => {
  res.status(200).json({ success: true, message: "Webhook endpoint ready for Dev 3" });
});

router.get("/ping", protect, (req, res) => {
  res.json({ success: true, message: "Payment route is ready for Dev 3!" });
});

module.exports = router;
