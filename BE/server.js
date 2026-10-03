const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });
const connectDB = require("./config/db");
const express = require("express");
const cors = require("cors");
const routes = require("./routes");
const errorHandler = require("./middlewares/errorHandler");
const models = require("./models");
const port = process.env.PORT || 5000;
const app = express();

app.use(cors({
  origin: process.env.CLIENT_URL || "http://localhost:5173",
  credentials: true,
}));
app.use(express.json({
  limit: "100kb",
  verify: (req, res, buffer) => {
    req.rawBody = buffer;
  },
}));
app.use(express.urlencoded({ extended: true, limit: "100kb" }));
app.use("/api", routes);
app.use((req, res) => res.status(404).json({
  success: false,
  errorCode: "RESOURCE_NOT_FOUND",
  message: "Không tìm thấy API",
  data: null,
}));
app.use(errorHandler);

connectDB().then(async () => {
  await Promise.all(Object.values(models).map((model) => model.init()));
  app.listen(port, () => {
    console.log(`Server đang chạy tại http://localhost:${port}`);
  });
}).catch((error) => {
  console.error("Không thể khởi tạo index:", error.name, error.code || "");
  process.exitCode = 1;
  require("mongoose").disconnect();
});
