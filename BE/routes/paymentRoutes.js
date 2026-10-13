const router = require("express").Router();
const controller = require("../controllers/paymentController");
const { authenticate, authorize } = require("../middlewares/authMiddleware");
const {
  webhookLimiter,
  verifyWebhook,
} = require("../middlewares/financeSecurity");
router.post("/webhook", webhookLimiter, verifyWebhook, controller.webhook);
router.use(authenticate);
router.post("/cash", authorize("LANDLORD"), controller.confirmCash);
router.get("/unmatched", authorize("LANDLORD"), controller.listUnmatched);
router.post(
  "/unmatched/:unmatchedPaymentId/resolve",
  authorize("LANDLORD"),
  controller.resolveUnmatched,
);
router.get("/", authorize("LANDLORD", "TENANT"), controller.listPayments);
router.get(
  "/:paymentId",
  authorize("LANDLORD", "TENANT"),
  controller.getPayment,
);
module.exports = router;
