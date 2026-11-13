const router = require("express").Router();
const { authenticate, authorize, permit } = require("../middlewares/auth");
const c = require("../controllers/utilityReadingController");
router.use(authenticate, authorize("LANDLORD", "PROPERTY_MANAGER"));
router.post("/", permit("UTILITY_READINGS"), c.create);
router.route("/:readingId").get(c.get).put(permit("UTILITY_READINGS"), c.update);
module.exports = router;
