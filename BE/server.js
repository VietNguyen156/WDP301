require("dotenv").config();
const express = require("express");
const cors = require("cors");
const connectDB = require("./config/db");
const routes = require("./routes");
const errorHandler = require("./middlewares/errorHandler");

const app = express();
const port = process.env.PORT || 5000;

// Kết nối cơ sở dữ liệu MongoDB
connectDB();

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Định tuyến API
app.use("/api", routes);

// Middleware xử lý lỗi (luôn đặt sau routes)
app.use(errorHandler);

app.listen(port, () => {
  console.log(`Server đang chạy tại http://localhost:${port}`);
});
