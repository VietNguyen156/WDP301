const router = require("express").Router();
const { getUsers, getUserById } = require("../controllers/userController");
router.get("/", getUsers);
router.get("/:id", getUserById);
module.exports = router;
