const router = require("express").Router();
const { authenticate, authorize } = require("../middlewares/auth");
const c = require("../controllers/contractController");
router.use(authenticate, authorize("LANDLORD", "TENANT"));
router.route("/").get(c.list).post(authorize("LANDLORD"), c.create);
router.get("/:contractId", c.get);
router.post("/:contractId/terminate", authorize("LANDLORD"), c.terminate);
module.exports = router;
