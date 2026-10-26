const router = require("express").Router();
const { authenticate, authorize } = require("../middlewares/auth");
const c = require("../controllers/dashboardController");
// Total revenue is landlord-only; PROPERTY_MANAGER gets 403 by contract.
router.use(authenticate, authorize("LANDLORD"));
router.get("/stats", c.stats);
router.get("/debts", c.debts);
module.exports = router;
