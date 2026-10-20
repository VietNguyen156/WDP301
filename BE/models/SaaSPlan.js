const mongoose = require("mongoose");
const { FEATURE_KEYS } = require("../utils/planFeatures");

const saasPlanSchema = new mongoose.Schema(
  {
    isDeleted: { type: Boolean, default: false, index: true },
    mutationVersion: { type: Number, default: 0, select: false },
    trialDays: { type: Number, default: 30, min: 1, max: 365, validate: Number.isSafeInteger },
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
        type: String, // Danh sách tính năng hiển thị (vd: Auto VietQR, SMS Noti, Webhook SePay...)
      },
    ],
    // Tính năng được backend chặn theo gói (danh mục trong utils/planFeatures.js).
    // Không đặt (undefined) = gói cũ trước khi có cờ, được dùng mọi tính năng.
    featureFlags: {
      type: [{ type: String, enum: FEATURE_KEYS }],
      default: undefined,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

require('./propertyValidators')(saasPlanSchema, ['price', 'maxBranches', 'maxRooms', 'maxManagers']);
module.exports = mongoose.model("SaaSPlan", saasPlanSchema);
