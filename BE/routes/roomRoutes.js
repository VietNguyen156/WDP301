const router = require("express").Router();
const { authenticate, authorize, permit } = require("../middlewares/auth");
const c = require("../controllers/roomController");
router.use(authenticate, authorize("LANDLORD", "PROPERTY_MANAGER"));
router
  .route("/:roomId")
  .get(c.get)
  .put(permit("UPDATE_ROOMS"), c.update)
  .delete(authorize("LANDLORD"), c.remove);
module.exports = router;
