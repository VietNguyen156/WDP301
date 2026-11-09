const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });
// Indexes are built explicitly after migrations, not automatically on connect.
require("mongoose").set("autoIndex", false);
const http = require("http");
const app = require("./app");
const realtime = require("./realtime");
const connectDB = require("./config/db");
const {
  migrateFinanceIndexes,
  unifyPlanFeatures,
  migrateAuditLogs,
  ignoreSimulatedUnmatched,
  backfillDepositPayments,
} = require("./config/migrations");
const models = require("./models");

async function runStartupMigrations() {
  try {
    await Promise.all([
      migrateFinanceIndexes(),
      unifyPlanFeatures(),
      migrateAuditLogs(),
      ignoreSimulatedUnmatched(),
    ]);
    await Promise.all(
      Object.values(models).map((model) => model.createIndexes()),
    );
    // Needs the one-deposit-per-contract index above.
    await backfillDepositPayments();
  } catch (error) {
    console.error("Cảnh báo khi đồng bộ migration/index:", error.message);
  }
}

async function start() {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    throw new Error("Cần JWT_SECRET tối thiểu 32 ký tự trong BE/.env");
  }

  await connectDB();

  const port = process.env.PORT || 5000;
  const server = http.createServer(app);
  realtime.attach(server, app);
  server.listen(port);
  // Background: lock tenants whose contracts have ended (TENANT_AUTO_LOCK=false turns it off).
  require("./jobs/tenantAccess").start();
  // Daily debt reminder emails to tenants (DEBT_REMINDER_AUTO=false turns it off).
  require("./jobs/debtReminders").start();
  server.on("listening", () =>
    console.log(`Server đang chạy tại http://localhost:${port}`),
  );
  server.on("error", (error) => {
    console.error("Không thể mở cổng server:", error.message);
    process.exitCode = 1;
    require("mongoose").disconnect();
  });

  // Run idempotent migrations & index checks in background after HTTP port is open
  runStartupMigrations();
}

start().catch((error) => {
  console.error("Không thể khởi động BE:", error.message);
  process.exitCode = 1;
  require("mongoose").disconnect();
});
