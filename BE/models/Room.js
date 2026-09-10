const mongoose = require("mongoose");

const roomSchema = new mongoose.Schema(
  {
    landlordId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "landlordId là bắt buộc"],
      index: true,
    },
    branchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Branch",
      required: [true, "branchId là bắt buộc"],
      index: true,
    },
    roomNumber: {
      type: String,
      required: [true, "Vui lòng nhập số/tên phòng"],
      trim: true, // vd: "101", "P.302"
    },
    floor: {
      type: Number,
      default: 1, // Tầng số mấy
    },
    basePrice: {
      type: Number,
      required: [true, "Vui lòng nhập giá thuê niêm yết (VNĐ/tháng)"],
      default: 0,
    },
    maxOccupants: {
      type: Number,
      default: 2, // Số người ở tối đa
    },
    status: {
      type: String,
      enum: ["EMPTY", "RENTED", "DEPOSITED", "MAINTENANCE", "OVERDUE_CLEANUP"],
      default: "EMPTY",
      index: true,
    },

    // Hợp đồng thuê hiện tại đang có hiệu lực (nếu có)
    currentContractId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Contract",
    },

    // Lưu chỉ số điện/nước gần nhất để tiện so sánh khi chốt số mới
    currentElectricIndex: {
      type: Number,
      default: 0,
    },
    currentWaterIndex: {
      type: Number,
      default: 0,
    },

    // Tiện nghi phòng
    amenities: [
      {
        type: String, // vd: "Điều hòa", "Nóng lạnh", "Gác xép", "Tủ lạnh", "Ban công"...
      },
    ],
    notes: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound Index: Đảm bảo trong 1 cơ sở không bao giờ có 2 phòng trùng tên
roomSchema.index({ branchId: 1, roomNumber: 1 }, { unique: true });
// Compound Index hỗ trợ thống kê tỷ lệ lấp đầy cực nhanh
roomSchema.index({ landlordId: 1, status: 1 });

module.exports = mongoose.model("Room", roomSchema);
