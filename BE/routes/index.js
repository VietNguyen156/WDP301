const express = require("express");
const router = express.Router();

const userRoutes = require("./userRoutes");
const invoiceRoutes = require("./invoiceRoutes");
const paymentRoutes = require("./paymentRoutes");
const { authenticate, authorize } = require("../middlewares/authMiddleware");

// The starter CRUD must not let anonymous clients change roles used by Finance.
router.use("/users", authenticate, authorize("SUPER_ADMIN"), userRoutes);
router.use("/v1/invoices", invoiceRoutes);
router.use("/v1/payments", paymentRoutes);

module.exports = router;
