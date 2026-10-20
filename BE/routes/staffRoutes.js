const router = require("express").Router();
const { authenticate, authorize } = require("../middlewares/auth");
const controller = require("../controllers/accountController");
router.use(authenticate, authorize("LANDLORD"));
router.use((req, res, next) => { res.set("Cache-Control", "no-store"); next(); });
router.route("/").get(controller.listStaff).post(controller.createStaff);
router.post("/:staffId/reset-password", controller.resetStaffPassword);
module.exports = router;
