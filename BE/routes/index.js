const express = require("express");
const router = express.Router();
const authRoutes = require("./authRoutes");
const userRoutes = require("./userRoutes");

// Health check route
router.get("/health", (req, res) => {
  res.status(200).json({ status: "ok", message: "Server is running smoothly" });
});

// Resource routes
router.use("/auth", authRoutes);
router.use("/users", userRoutes);

module.exports = router;
