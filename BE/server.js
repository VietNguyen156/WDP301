const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });
const app = require("./app");
const connectDB = require("./config/db");
const models = require("./models");

async function start() {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("Cần JWT_SECRET tối thiểu 32 ký tự trong BE/.env");
    } else {
      process.env.JWT_SECRET =
        process.env.JWT_SECRET || "development-jwt-secret-wdp301-super-secure-32chars";
      console.warn("⚠️ [DEV] Chưa cấu hình JWT_SECRET chuẩn, sử dụng khóa phát triển tạm thời.");
    }
  }

  await connectDB();
  try {
    await Promise.all(Object.values(models).map((model) => model.init?.()));
  } catch (err) {
    console.warn("Lưu ý khi tạo index database:", err.message);
  }

  const port = process.env.PORT || 5000;
  const server = app.listen(port);
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
});
