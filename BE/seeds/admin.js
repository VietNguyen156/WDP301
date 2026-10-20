const User = require("../models/User");

const ADMIN_USERNAME = "admin";
const LEGACY_ADMIN_EMAIL = "admin@wdp301.com";

async function ensureAdmin() {
  let admin = await User.findOne({
    $or: [{ username: ADMIN_USERNAME }, { email: LEGACY_ADMIN_EMAIL }],
  }).select("+password");

  if (admin) {
    if (admin.role !== "SUPER_ADMIN") {
      throw new Error("Tài khoản admin hiện tại không có role SUPER_ADMIN");
    }

    if (!admin.username) {
      admin.username = ADMIN_USERNAME;
      await admin.save();
    }
    return admin;
  }

  admin = await User.create({
    name: "System Admin",
    username: ADMIN_USERNAME,
    password: process.env.ADMIN_PASSWORD || ADMIN_USERNAME,
    role: "SUPER_ADMIN",
    status: "ACTIVE",
    isDeleted: false,
  });

  return admin;
}

module.exports = { ensureAdmin };
