const router = require("express").Router();
const { authenticate, authorize } = require("../middlewares/auth");
const c = require("../controllers/planController");
const {
  webhookLimiter,
  verifyPayOsWebhook,
} = require("../middlewares/financeSecurity");
// Webhook of the payOS payment gateway, before landlord authentication.
router.post("/payments/ipn", webhookLimiter, verifyPayOsWebhook, c.gatewayIpn);
router.use(authenticate, authorize("LANDLORD"));
router.get("/", c.catalog);
router.route("/upgrade-requests").get(c.listRequests).post(c.requestUpgrade);
router.post("/upgrade-requests/:requestId/cancel", c.cancelRequest);
router.get("/invoices", c.listInvoices);
router.post("/invoices/:invoiceId/checkout", c.checkout);
router.post("/invoices/:invoiceId/verify-payment", c.verifyPayment);
module.exports = router;
