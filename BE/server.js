const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });
const app = require("./app");
const connectDB = require("./config/db");
async function start() {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32)
    throw new Error("Cần JWT_SECRET tối thiểu 32 ký tự trong BE/.env");
  await connectDB();
  const server = app.listen(process.env.PORT || 5000);
  server.on("listening", () =>
    console.log(
      `Server đang chạy tại http://localhost:${process.env.PORT || 5000}`,
    ),
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
