const mongoose = require("mongoose");

const saasPlanSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Vui lòng nhập tên gói dịch vụ"],
      trim: true,
    },
    code: {
      type: String,
      required: [true, "Vui lòng nhập mã gói"],
      unique: true,
      uppercase: true,
      trim: true, // vd: FREE_TRIAL, STARTER, PRO, ENTERPRISE
    },
    price: {
      type: Number,
      required: [true, "Vui lòng nhập giá gói (VNĐ/tháng)"],
      default: 0,
    },
    billingCycle: {
      type: String,
      enum: ["MONTHLY", "YEARLY"],
      default: "MONTHLY",
    },
    // Hạn ngạch tài nguyên (Quotas)
    maxBranches: {
      type: Number,
      default: 1, // Số cơ sở/tòa nhà tối đa
    },
    maxRooms: {
      type: Number,
      default: 10, // Số phòng tối đa
    },
    maxManagers: {
      type: Number,
      default: 1, // Số nhân viên quản lý tối đa
    },
    features: [
      {
        type: String, // Danh sách tính năng (vd: Auto VietQR, SMS Noti, Webhook SePay...)
      },
    ],
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("SaaSPlan", saasPlanSchema);
