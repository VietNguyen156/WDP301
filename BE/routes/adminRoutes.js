const router = require("express").Router();
const { authenticate, authorize } = require("../middlewares/auth");
const c = require("../controllers/adminController");
router.use(authenticate, authorize("SUPER_ADMIN"));
router.use((req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
});
router.route("/plans").get(c.listPlans).post(c.createPlan);
router.route("/plans/:planId").put(c.updatePlan).delete(c.deletePlan);
router.get("/landlords", c.listLandlords);
router.put("/landlords/:landlordId/status", c.setLandlordStatus);
router
  .route("/subscriptions")
  .get(c.listSubscriptions)
  .post(c.createSubscription);
router.put("/subscriptions/:subscriptionId", c.updateSubscription);
router.get("/invoices", c.listInvoices);
router.post("/invoices/:invoiceId/paid", c.confirmInvoice);
router.get("/analytics", c.analytics);
router.get("/audit-logs", c.listAuditLogs);
router.get("/upgrade-requests", c.listUpgradeRequests);
router.post("/upgrade-requests/:requestId/approve", c.approveUpgradeRequest);
router.post("/upgrade-requests/:requestId/reject", c.rejectUpgradeRequest);
module.exports = router;
