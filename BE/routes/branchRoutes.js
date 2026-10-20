const router = require("express").Router();
const { authenticate, authorize } = require("../middlewares/auth");
const c = require("../controllers/branchController");
const room = require("../controllers/roomController");
const reading = require("../controllers/utilityReadingController");
router.use(authenticate, authorize("LANDLORD", "PROPERTY_MANAGER"));
router.route("/").get(c.list).post(authorize("LANDLORD"), c.create);
router
  .route("/:branchId")
  .get(c.get)
  .put(authorize("LANDLORD"), c.update)
  .delete(authorize("LANDLORD"), c.remove);
router
  .route("/:branchId/rooms")
  .get(room.list)
  .post(authorize("LANDLORD"), room.create);
router.post("/:branchId/rooms/bulk", authorize("LANDLORD"), room.bulk);
router.get("/:branchId/utility-readings", reading.list);
module.exports = router;
