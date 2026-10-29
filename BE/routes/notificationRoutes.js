const router = require("express").Router();
const { authenticate } = require("../middlewares/auth");
const respond = require("../utils/response");
const service = require("../services/notificationService");

// Work waiting for the signed-in user (every role), shown under the top bar bell.
router.get("/", authenticate, async (req, res) => respond(res, await service.list(req)));
// Recent activity in the user's scope, read from the audit log (fills the feed on page load).
router.get("/activity", authenticate, async (req, res) => respond(res, await service.recentActivity(req)));
module.exports = router;
