const router = require("express").Router();
const { authenticate, authorize } = require("../middlewares/auth");
const c = require("../controllers/searchController");
// Staff-only: tenants have nothing to search across the chain.
router.get("/", authenticate, authorize("LANDLORD", "PROPERTY_MANAGER"), c.search);
module.exports = router;
