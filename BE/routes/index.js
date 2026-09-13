const express = require("express");
const router = express.Router();

// 1. Tuyến đường cốt lõi đã có
const authRoutes = require("./authRoutes");
const userRoutes = require("./userRoutes");

// 2. Tuyến đường phân chia cho 4 Dev làm việc độc lập
const branchRoutes = require("./branchRoutes");       // Dev 1: Cơ sở (Branch)
const roomRoutes = require("./roomRoutes");           // Dev 1: Phòng (Room)
const contractRoutes = require("./contractRoutes");   // Dev 1: Hợp đồng & Khách thuê (Contract & Tenant)

const utilityRoutes = require("./utilityRoutes");     // Dev 2: Chốt số điện nước Mobile (Utility)
const incidentRoutes = require("./incidentRoutes");   // Dev 2: Báo sự cố & Nhân viên (Incident & Staff)

const invoiceRoutes = require("./invoiceRoutes");     // Dev 3: Hóa đơn & VietQR (Invoice & Public View)
const paymentRoutes = require("./paymentRoutes");     // Dev 3: Webhook SePay & Gạch nợ (Payment)

const adminRoutes = require("./adminRoutes");         // Dev 4: SaaS Platform Super Admin (Plans & Landlords)
const dashboardRoutes = require("./dashboardRoutes"); // Dev 4: Dashboard Dòng tiền 3s (Dashboard)

// Health check route
router.get("/health", (req, res) => {
  res.status(200).json({ status: "ok", message: "Server is running smoothly" });
});

// Gắn các Resource Routes
router.use("/auth", authRoutes);
router.use("/users", userRoutes);

// ==========================================
// KHUNG ĐIỀU HƯỚNG DÀNH CHO 4 THÀNH VIÊN
// (Mỗi dev chỉ chỉnh sửa bên trong file route riêng của mình)
// ==========================================

// DEV 1: Không gian & Hợp đồng
router.use("/branches", branchRoutes);
router.use("/rooms", roomRoutes);
router.use("/contracts", contractRoutes);

// DEV 2: Vận hành Mobile & Sự cố
router.use("/utilities", utilityRoutes);
router.use("/incidents", incidentRoutes);

// DEV 3: Hóa đơn, VietQR & Cổng thanh toán
router.use("/invoices", invoiceRoutes);
router.use("/payments", paymentRoutes);

// DEV 4: SaaS Super Admin & Dashboard Chủ trọ
router.use("/admin", adminRoutes);
router.use("/dashboard", dashboardRoutes);

module.exports = router;

