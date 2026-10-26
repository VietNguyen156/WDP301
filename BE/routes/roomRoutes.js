const router = require("express").Router();
const { authenticate, authorize } = require("../middlewares/auth");
const c = require("../controllers/roomController");
router.use(authenticate, authorize("LANDLORD", "PROPERTY_MANAGER"));
router
  .route("/:roomId")
  .get(c.get)
  .put(c.update)
  .delete(authorize("LANDLORD"), c.remove);
module.exports = router;
