const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });
const mongoose = require("mongoose");
const connectDB = require("../config/db");
const models = require("../models");

async function setup() {
  if (process.env.NODE_ENV !== "development")
    throw new Error("Lệnh setup chỉ dành cho NODE_ENV=development.");
  await connectDB();
  for (const Model of Object.values(models)) await Model.init();
  await mongoose.connection.transaction(async (session) => {
    // Never delete, overwrite or reset an existing account/database.
    for (const Model of Object.values(models)) {
      if (await Model.exists({}).session(session))
        throw new Error(
          "Database đã có dữ liệu. Setup dừng lại và không thay đổi bản ghi nào.",
        );
    }
    const [owner] = await models.User.create(
      [
        {
          name: "Chủ cơ sở",
          email: "landlord@wdp301.com",
          password: "password123",
          role: "LANDLORD",
          status: "ACTIVE",
        },
      ],
      { session },
    );
    const [plan] = await models.SaaSPlan.create(
      [
        {
          name: "Gói Dùng Thử",
          code: "FREE_TRIAL",
          price: 0,
          maxBranches: 1,
          maxRooms: 5,
          maxManagers: 1,
          features: ["Quản lý cơ bản", "Chốt số điện nước", "Hóa đơn VietQR"],
        },
      ],
      { session },
    );
    const [subscription] = await models.Subscription.create(
      [
        {
          landlordId: owner._id,
          planId: plan._id,
          status: "ACTIVE",
          startDate: new Date(),
          endDate: new Date(Date.now() + 30 * 86400000),
          pricePaid: 0,
        },
      ],
      { session },
    );
    owner.subscriptionId = subscription._id;
    await owner.save({ session });
  });
  console.log("Đã tạo tài khoản phát triển: landlord@wdp301.com / password123");
  console.log(
    "Gói dùng thử: 1 cơ sở, 5 phòng, 1 quản lý, 30 ngày. Hãy thêm cơ sở và phòng qua giao diện.",
  );
}
setup()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
