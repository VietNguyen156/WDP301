const router = require("express").Router();
const { authenticate, authorize } = require("../middlewares/auth");
const c = require("../controllers/contractController");
router.use(authenticate, authorize("LANDLORD", "TENANT"));
router.route("/").get(c.list).post(authorize("LANDLORD"), c.create);
router.get("/:contractId", c.get);
router.post(
  "/:contractId/settlement",
  authorize("LANDLORD"),
  c.prepareSettlement,
);
router.post("/:contractId/terminate", authorize("LANDLORD"), c.terminate);
// Xác nhận hợp đồng điện tử 2 chiều
router.post(
  "/:contractId/confirm/landlord",
  authorize("LANDLORD"),
  c.confirmByLandlord,
);
router.post(
  "/:contractId/confirm/tenant",
  authorize("TENANT"),
  c.confirmByTenant,
);
// Chủ trọ xác nhận đã nhận tiền cọc (UNPAID -> PAID)
router.post(
  "/:contractId/deposit/received",
  authorize("LANDLORD"),
  c.markDepositReceived,
);
// Sandbox: giả lập khách chuyển khoản tiền cọc qua luồng đối soát ngân hàng thật
router.post("/:contractId/deposit/simulate", c.simulateDeposit);
// Gia hạn hợp đồng (phụ lục gia hạn)
router.post("/:contractId/renew", authorize("LANDLORD"), c.renew);
module.exports = router;
