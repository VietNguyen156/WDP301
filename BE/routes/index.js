const express = require("express");
const router = express.Router();
const { authenticate, authorize } = require("../middlewares/auth");

// Property Core routes
router.use("/auth", require("./authRoutes"));
router.use("/branches", require("./branchRoutes"));
router.use("/rooms", require("./roomRoutes"));
router.use("/contracts", require("./contractRoutes"));
router.use("/staff", require("./staffRoutes"));
router.use("/tenants", require("./tenantRoutes"));
router.use("/profile", require("./profileRoutes"));
router.use("/plans", require("./planRoutes"));

// Operations routes
router.use("/utility-readings", require("./utilityReadingRoutes"));
router.use("/incidents", require("./incidentRoutes"));

// Finance routes
router.use("/invoices", require("./invoiceRoutes"));
router.use("/payments", require("./paymentRoutes"));
router.use("/bank-hub", require("./bankHubRoutes"));

// Dashboard
router.use("/dashboard", require("./dashboardRoutes"));

// Admin User Management
router.use("/admin", require("./adminRoutes"));
router.use("/users", authenticate, authorize("SUPER_ADMIN"), require("./userRoutes"));

module.exports = router;
