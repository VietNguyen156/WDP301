const router = require("express").Router();
const { authenticate, authorize, permit } = require("../middlewares/auth");
const c = require("../controllers/expenseController");
// Phiếu chi (trả thợ / đơn vị sửa chữa): nội bộ, người thuê không truy cập.
router.use(authenticate, authorize("LANDLORD", "PROPERTY_MANAGER"));
router.route("/").get(permit("VIEW_FINANCE"), c.list).post(permit("RECORD_EXPENSES"), c.create);
router.post("/:expenseId/void", authorize("LANDLORD"), c.void);
module.exports = router;
