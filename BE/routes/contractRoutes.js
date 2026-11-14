const router = require("express").Router();
const { authenticate, authorize, permit } = require("../middlewares/auth");
const c = require("../controllers/contractController");
// Quản lý cơ sở chỉ xem (danh sách + chi tiết, trong các cơ sở được giao); mọi thao tác ghi
// do chủ trọ hoặc khách thuê thực hiện.
router.use(authenticate, authorize("LANDLORD", "PROPERTY_MANAGER", "TENANT"));
const read = permit("VIEW_CONTRACTS");
router.route("/").get(read, c.list).post(authorize("LANDLORD"), c.create);
// Kiểm tra CCCD đang có hợp đồng còn hiệu lực (form lập hợp đồng báo trùng khi đang nhập)
router.get("/citizen-check", authorize("LANDLORD"), c.citizenCheck);
router.get("/:contractId", read, c.get);
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
router.post("/:contractId/deposit/simulate", authorize("LANDLORD", "TENANT"), c.simulateDeposit);
// Hủy hợp đồng nháp (chưa đủ chữ ký 2 bên), trả phòng về trống
router.post("/:contractId/cancel", authorize("LANDLORD"), c.cancelDraft);
// Gia hạn hợp đồng (phụ lục gia hạn)
router.post("/:contractId/renew", authorize("LANDLORD"), c.renew);
module.exports = router;
