const mongoose = require("mongoose");

const incidentSchema = new mongoose.Schema(
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
    reportedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User", // Khách thuê hoặc Quản lý cơ sở báo
      required: true,
    },

    title: {
      type: String,
      required: [true, "Vui lòng nhập tiêu đề sự cố"],
      trim: true, // vd: "Hỏng vòi xịt vệ sinh", "Điều hòa không mát"
    },
    description: {
      type: String,
      required: [true, "Vui lòng mô tả chi tiết sự cố"],
      trim: true,
    },
    images: [
      {
        type: String, // Link ảnh tình trạng sự cố ban đầu
      },
    ],
    resolvedImages: [
      {
        type: String, // Link ảnh nghiệm thu sau khi thợ đã sửa xong
      },
    ],

    priority: {
      type: String,
      enum: ["LOW", "MEDIUM", "HIGH", "URGENT"],
      default: "MEDIUM",
    },
    status: {
      type: String,
      enum: ["PENDING", "IN_PROGRESS", "SOLVED", "RESOLVED", "CLOSED", "REJECTED"],
      default: "PENDING",
      index: true,
    },

    // Chi phí sửa chữa & Phân bổ người chịu phí
    repairCost: {
      type: Number,
      default: 0,
    },
    costPayer: {
      type: String,
      enum: ["LANDLORD", "TENANT", "NONE"],
      default: "LANDLORD", // Mặc định hao mòn tự nhiên thì chủ chịu
    },

    // Ngày ghi nhận chi phí gần nhất; bắt buộc có trước khi đóng phiếu
    costUpdatedAt: { type: Date },
    // Hợp đồng của phòng tại thời điểm báo sự cố (để khấu trừ cọc khi khách chịu phí)
    contractId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Contract",
    },

    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User", // Nhân viên / Quản lý phụ trách theo dõi ca sửa
    },
    statusHistory: [
      {
        _id: false,
        status: { type: String, required: true },
        changedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
        changedAt: { type: Date, default: Date.now },
        note: { type: String, trim: true },
      },
    ],
    notes: {
      type: String,
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

incidentSchema.index({ landlordId: 1, status: 1 });
incidentSchema.index({ landlordId: 1, branchId: 1, status: 1 });

incidentSchema.index({ landlordId: 1, contractId: 1 });

require("./propertyValidators")(incidentSchema, ["repairCost"]);
module.exports = mongoose.model("Incident", incidentSchema);
