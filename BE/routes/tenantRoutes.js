const router = require("express").Router();
const { authenticate, authorize } = require("../middlewares/auth");
const controller = require("../controllers/accountController");
router.use(authenticate, authorize("LANDLORD"));
router.use((req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
});
router.get("/", controller.listTenants);
router.post("/:tenantId/reset-password", controller.resetTenantPassword);
module.exports = router;
