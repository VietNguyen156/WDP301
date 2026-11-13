const router = require("express").Router();
const controller = require("../controllers/invoiceController");
const { listPayments } = require("../controllers/paymentController");
const { authenticate, authorize, permit } = require("../middlewares/auth");
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
  permit("VIEW_FINANCE"),
  controller.listInvoices,
);
router.get(
  "/:invoiceId/payments",
  authorize("LANDLORD", "PROPERTY_MANAGER", "TENANT"),
  permit("VIEW_FINANCE"),
  listPayments,
);
router.get(
  "/:invoiceId",
  authorize("LANDLORD", "PROPERTY_MANAGER", "TENANT"),
  permit("VIEW_FINANCE"),
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
router.post(
  "/:invoiceId/reminders",
  authorize("LANDLORD", "PROPERTY_MANAGER"),
  permit("SEND_REMINDERS"),
  controller.sendReminder,
);
module.exports = router;
