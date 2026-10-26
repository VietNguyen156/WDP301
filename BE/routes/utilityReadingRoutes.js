const router = require("express").Router();
const { authenticate, authorize } = require("../middlewares/auth");
const c = require("../controllers/utilityReadingController");
router.use(authenticate, authorize("LANDLORD", "PROPERTY_MANAGER"));
router.post("/", c.create);
router.route("/:readingId").get(c.get).put(c.update);
module.exports = router;
