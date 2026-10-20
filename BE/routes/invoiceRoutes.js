const router = require("express").Router();
const controller = require("../controllers/invoiceController");
const { listPayments } = require("../controllers/paymentController");
const { authenticate, authorize } = require("../middlewares/auth");
const { publicInvoiceLimiter } = require("../middlewares/financeSecurity");
router.get(
  "/public/:publicAccessToken",
  publicInvoiceLimiter,
  controller.publicInvoice,
);
router.post(
  "/public/:publicAccessToken/simulate-payment",
  publicInvoiceLimiter,
  controller.simulatePublicPayment,
);
router.use(authenticate);
router.post("/generate", authorize("LANDLORD"), controller.generateInvoices);
router.get(
  "/",
  authorize("LANDLORD", "PROPERTY_MANAGER", "TENANT"),
  controller.listInvoices,
);
router.get(
  "/:invoiceId/payments",
  authorize("LANDLORD", "PROPERTY_MANAGER", "TENANT"),
  listPayments,
);
router.get(
  "/:invoiceId",
  authorize("LANDLORD", "PROPERTY_MANAGER", "TENANT"),
  controller.getInvoice,
);
router.post(
  "/:invoiceId/issue",
  authorize("LANDLORD"),
  controller.issueInvoice,
);
router.post(
  "/:invoiceId/cancel",
  authorize("LANDLORD"),
  controller.cancelInvoice,
);
module.exports = router;
