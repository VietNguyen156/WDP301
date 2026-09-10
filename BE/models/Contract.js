const mongoose = require("mongoose");

const contractSchema = new mongoose.Schema(
  {
    landlordId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    branchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Branch",
      required: true,
      index: true,
    },
    roomId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Room",
      required: true,
      index: true,
    },
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true, // Người đại diện ký hợp đồng
      index: true,
    },
    contractCode: {
      type: String,
      required: true,
      unique: true,
      trim: true, // vd: "HDT-2026-P301-01"
    },
    startDate: {
      type: Date,
      required: true,
    },
    endDate: {
      type: Date,
      required: true,
    },
    rentalPrice: {
      type: Number,
      required: true, // Giá thuê thỏa thuận thực tế
    },
    // Tiền cọc phòng
    depositAmount: {
      type: Number,
      default: 0,
    },
    depositStatus: {
      type: String,
      enum: ["PAID", "UNPAID", "REFUNDED", "PARTIALLY_REFUNDED"],
      default: "UNPAID",
    },

    // Chỉ số ban đầu khi bàn giao chìa khóa
    initialElectricIndex: {
      type: Number,
      required: true,
      default: 0,
    },
    initialWaterIndex: {
      type: Number,
      required: true,
      default: 0,
    },

    // Danh sách người ở cùng phòng (đăng ký tạm trú)
    roommates: [
      {
        fullName: { type: String, required: true },
        citizenId: { type: String },
        phoneNumber: { type: String },
      },
    ],

    status: {
      type: String,
      enum: ["ACTIVE", "EXPIRED", "TERMINATED", "DRAFT"],
      default: "ACTIVE",
      index: true,
    },
    notes: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

contractSchema.index({ landlordId: 1, status: 1 });

module.exports = mongoose.model("Contract", contractSchema);
