const mongoose = require("mongoose");

const branchSchema = new mongoose.Schema(
  {
    landlordId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "landlordId là bắt buộc"],
      index: true,
    },
    name: {
      type: String,
      required: [true, "Vui lòng nhập tên cơ sở / tòa nhà"],
      trim: true, // vd: "Tòa nhà Happy House Cầu Giấy"
    },
    address: {
      street: { type: String, trim: true },
      ward: { type: String, trim: true }, // Phường / Xã
      district: { type: String, trim: true }, // Quận / Huyện
      city: { type: String, trim: true }, // Tỉnh / Thành phố
      fullAddress: { type: String, trim: true },
    },

    // Bảng giá dịch vụ mặc định của cơ sở
    defaultElectricityPrice: {
      type: Number,
      required: true,
      default: 3500, // VNĐ / kWh
    },
    waterBillingType: {
      type: String,
      enum: ["METER", "PER_PERSON"], // METER: theo đồng hồ khối, PER_PERSON: theo đầu người
      default: "METER",
    },
    defaultWaterPrice: {
      type: Number,
      required: true,
      default: 30000, // VNĐ/khối hoặc VNĐ/người/tháng
    },
    // Các loại phí dịch vụ cố định (rác, wifi, thang máy, gửi xe)
    defaultServices: [
      {
        name: { type: String, required: true }, // vd: "Rác", "Internet", "Gửi xe máy"
        price: { type: Number, required: true },
        billingType: {
          type: String,
          enum: ["PER_ROOM", "PER_PERSON", "PER_UNIT"],
          default: "PER_ROOM",
        },
      },
    ],

    // Cài đặt ngày chốt số & hạn nộp tiền
    billingCycleDay: {
      type: Number,
      default: 1, // Ngày chốt số điện nước hàng tháng (từ 1 đến 28)
      min: 1,
      max: 28,
    },
    paymentDueDays: {
      type: Number,
      default: 5, // Số ngày sau ngày xuất hóa đơn thì tính là quá hạn
    },

    // Danh sách Quản lý cơ sở (Property Managers) được gán phụ trách
    managerIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    status: {
      type: String,
      enum: ["ACTIVE", "INACTIVE"],
      default: "ACTIVE",
    },
  },
  {
    timestamps: true,
  }
);

// Compound Index để tra cứu cơ sở của một Chủ trọ nhanh
branchSchema.index({ landlordId: 1, name: 1 });

module.exports = mongoose.model("Branch", branchSchema);
