const express = require("express");
const router = express.Router();
const userRoutes = require("./userRoutes");

// Health check route
router.get("/health", (req, res) => {
  res.status(200).json({ status: "ok", message: "Server is running smoothly" });
});

// Resource routes
router.use("/users", userRoutes);

module.exports = router;
