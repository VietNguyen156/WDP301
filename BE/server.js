const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });
// Indexes are built explicitly after migrations, not automatically on connect.
require("mongoose").set("autoIndex", false);
const http = require("http");
const app = require("./app");
const realtime = require("./realtime");
const connectDB = require("./config/db");
const { migrateFinanceIndexes, backfillPlanFeatureFlags } = require("./config/migrations");
const models = require("./models");
const { ensureAdmin } = require("./seeds/admin");

async function start() {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    throw new Error("Cần JWT_SECRET tối thiểu 32 ký tự trong BE/.env");
  }

  await connectDB();
  await migrateFinanceIndexes();
  await backfillPlanFeatureFlags();
  await Promise.all(
    Object.values(models).map(async (model) => {
      await model.init();
      await model.createIndexes();
    }),
  );
  await ensureAdmin();

  const port = process.env.PORT || 5000;
  const server = http.createServer(app);
  realtime.attach(server, app);
  server.listen(port);
  server.on("listening", () =>
    console.log(`Server đang chạy tại http://localhost:${port}`),
  );
  server.on("error", (error) => {
    console.error("Không thể mở cổng server:", error.message);
    process.exitCode = 1;
    require("mongoose").disconnect();
  });
}

start().catch((error) => {
  console.error("Không thể khởi động BE:", error.message);
  process.exitCode = 1;
  require("mongoose").disconnect();
});
