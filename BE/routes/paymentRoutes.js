const router = require("express").Router();
const controller = require("../controllers/paymentController");
const { authenticate, authorize } = require("../middlewares/auth");
const {
  webhookLimiter,
  verifyWebhook,
} = require("../middlewares/financeSecurity");
router.post("/webhook", webhookLimiter, verifyWebhook, controller.webhook);
router.use(authenticate);
router.post(
  "/cash",
  authorize("LANDLORD", "PROPERTY_MANAGER"),
  controller.confirmCash,
);
router.post(
  "/cash/:paymentId/confirm",
  authorize("LANDLORD"),
  controller.confirmCashReport,
);
router.post(
  "/cash/:paymentId/reject",
  authorize("LANDLORD"),
  controller.rejectCashReport,
);
router.get("/unmatched", authorize("LANDLORD"), controller.listUnmatched);
router.post(
  "/unmatched/:unmatchedPaymentId/resolve",
  authorize("LANDLORD"),
  controller.resolveUnmatched,
);
router.get(
  "/",
  authorize("LANDLORD", "PROPERTY_MANAGER", "TENANT"),
  controller.listPayments,
);
router.get(
  "/:paymentId",
  authorize("LANDLORD", "PROPERTY_MANAGER", "TENANT"),
  controller.getPayment,
);
module.exports = router;
