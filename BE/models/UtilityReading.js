const mongoose = require("mongoose");

const utilityReadingSchema = new mongoose.Schema(
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
    recordedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User", // Property Manager hoặc Landlord ghi số
      required: true,
    },

    // Kỳ hóa đơn chuẩn định dạng YYYY-MM (vd: "2026-09")
    billingPeriod: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    month: {
      type: Number,
      required: true,
      min: 1,
      max: 12,
    },
    year: {
      type: Number,
      required: true,
    },
    readingDate: {
      type: Date,
      default: Date.now,
    },

    // Chỉ số Điện
    oldElectricIndex: {
      type: Number,
      required: true,
    },
    newElectricIndex: {
      type: Number,
      required: true,
    },
    consumedElectric: {
      type: Number, // Số điện tiêu thụ = new - old
      required: true,
    },

    // Chỉ số Nước
    oldWaterIndex: {
      type: Number,
      default: 0,
    },
    newWaterIndex: {
      type: Number,
      default: 0,
    },
    consumedWater: {
      type: Number, // Số khối nước tiêu thụ
      default: 0,
    },

    // Ảnh chụp đồng hồ làm bằng chứng đối soát khi khách có khiếu nại
    electricMeterImage: { type: String },
    waterMeterImage: { type: String },

    // Trạng thái đã lập hóa đơn cho kỳ này chưa (sẽ chuyển sang true khi Invoice phát hành ISSUED)
    isBilled: {
      type: Boolean,
      default: false,
      index: true,
    },
    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Tự động đồng bộ billingPeriod trước khi validate nếu chỉ truyền month và year
utilityReadingSchema.pre("validate", function () {
  if (!this.billingPeriod && this.month && this.year) {
    this.billingPeriod = `${this.year}-${String(this.month).padStart(2, "0")}`;
  }
});

// Một phòng trong một cơ sở trong một kỳ chỉ có 1 bản ghi chốt số duy nhất
utilityReadingSchema.index(
  { landlordId: 1, branchId: 1, roomId: 1, billingPeriod: 1 },
  { unique: true }
);

module.exports = mongoose.model("UtilityReading", utilityReadingSchema);
