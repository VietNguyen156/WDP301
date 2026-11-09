const router = require("express").Router();
const { authenticate, authorize } = require("../middlewares/auth");
const c = require("../controllers/expenseController");
// Phiếu chi (trả thợ / đơn vị sửa chữa): nội bộ, người thuê không truy cập.
router.use(authenticate, authorize("LANDLORD", "PROPERTY_MANAGER"));
router.route("/").get(c.list).post(c.create);
router.post("/:expenseId/void", authorize("LANDLORD"), c.void);
module.exports = router;
