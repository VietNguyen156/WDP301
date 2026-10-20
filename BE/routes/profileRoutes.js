const router = require("express").Router();
const { accountLimit } = require("../middlewares/rateLimit");
const { authenticate, authorize } = require("../middlewares/auth");
const c = require("../controllers/profileController");
// Bank changes re-check the password, so cap guesses per signed-in account.
const bankLimit = accountLimit({ keyGenerator: (req) => String(req.user._id) });
router.use(authenticate);
router.use((req, res, next) => { res.set("Cache-Control", "no-store"); next(); });
router.route("/").get(c.get).put(c.update);
router.put("/bank-account", bankLimit, authorize("LANDLORD"), c.updateBankAccount);
module.exports = router;
