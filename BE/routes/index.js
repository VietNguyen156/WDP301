const express = require("express");
const router = express.Router();

router.use("/auth", require("./authRoutes"));
router.use("/branches", require("./branchRoutes"));
router.use("/rooms", require("./roomRoutes"));
router.use("/contracts", require("./contractRoutes"));

module.exports = router;
