const router = require("express").Router();
const { authenticate, authorize } = require("../middlewares/auth");
const {
  webhookLimiter,
  verifyBankHubIpn,
  verifyBankHubEvent,
} = require("../middlewares/financeSecurity");
const c = require("../controllers/bankHubController");
// Server-to-server endpoints called by SePay.
router.post("/ipn", webhookLimiter, verifyBankHubIpn, c.ipn);
router.post("/events", webhookLimiter, verifyBankHubEvent, c.event);
// Landlord endpoints.
router.use(authenticate, authorize("LANDLORD"));
router.use((req, res, next) => { res.set("Cache-Control", "no-store"); next(); });
router.get("/", c.status);
router.post("/link-token", c.createLinkToken);
router.post("/sync", c.sync);
module.exports = router;
