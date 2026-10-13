const express = require("express");
const router = express.Router();
const { authenticate, authorize } = require("../middlewares/authMiddleware");

// Property Core routes
router.use("/auth", require("./authRoutes"));
router.use("/branches", require("./branchRoutes"));
router.use("/rooms", require("./roomRoutes"));
router.use("/contracts", require("./contractRoutes"));

// Finance routes
router.use("/invoices", require("./invoiceRoutes"));
router.use("/payments", require("./paymentRoutes"));

// Direct /v1 prefix compatibility aliases
router.use("/v1/invoices", require("./invoiceRoutes"));
router.use("/v1/payments", require("./paymentRoutes"));

// Admin User Management
try {
  router.use("/users", authenticate, authorize("SUPER_ADMIN"), require("./userRoutes"));
} catch {
  // Optional user routes
}

module.exports = router;
