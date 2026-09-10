const mongoose = require("mongoose");
const crypto = require("crypto");

const invoiceSchema = new mongoose.Schema(
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
    contractId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Contract",
      required: true,
    },
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    // Mã hóa đơn duy nhất toàn sàn để sinh mã VietQR và khớp Webhook ngân hàng (vd: "HD1024")
    invoiceCode: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
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
    dueDate: {
      type: Date, // Hạn chót thanh toán
      required: true,
    },

    // 1. Tiền phòng
    roomAmount: {
      type: Number,
      required: true,
      default: 0,
    },

    // 2. Chi tiết Tiền điện
    electricDetail: {
      oldIndex: { type: Number, default: 0 },
      newIndex: { type: Number, default: 0 },
      consumed: { type: Number, default: 0 }, // Số kWh tiêu thụ
      unitPrice: { type: Number, default: 3500 }, // Đơn giá / kWh
      amount: { type: Number, default: 0 }, // = consumed * unitPrice
    },

    // 3. Chi tiết Tiền nước
    waterDetail: {
      billingType: { type: String, enum: ["METER", "PER_PERSON"], default: "METER" },
      oldIndex: { type: Number, default: 0 },
      newIndex: { type: Number, default: 0 },
      consumed: { type: Number, default: 0 }, // Số m3 nếu tính theo đồng hồ
      headCount: { type: Number, default: 1 }, // Số người nếu tính theo đầu người
      unitPrice: { type: Number, default: 30000 },
      amount: { type: Number, default: 0 },
    },

    // 4. Chi tiết Dịch vụ cố định (rác, wifi, gửi xe...)
    servicesDetail: [
      {
        serviceName: { type: String, required: true },
        unitPrice: { type: Number, required: true },
        quantity: { type: Number, default: 1 },
        amount: { type: Number, required: true },
      },
    ],

    // 5. Chi phí phát sinh (nếu có: phạt nộp trễ, đền bù hỏng đồ...)
    additionalFees: [
      {
        reason: { type: String, required: true },
        amount: { type: Number, required: true },
      },
    ],

    // 6. Giảm giá / Khấu trừ
    discount: {
      reason: { type: String, default: "" },
      amount: { type: Number, default: 0 },
    },

    // Tổng kết tài chính
    totalAmount: {
      type: Number,
      required: true,
      default: 0,
    },
    paidAmount: {
      type: Number,
      default: 0,
    },
    remainingAmount: {
      type: Number,
      default: 0, // = totalAmount - paidAmount
    },

    // Tích hợp VietQR Động
    vietQrUrl: {
      type: String, // Link ảnh QuickLink VietQR
    },
    paymentSyntax: {
      type: String, // Cú pháp chuẩn gạch nợ: vd "HD1024 P301"
    },

    // Token bảo mật truy cập trực tiếp xem hóa đơn No-App cho Khách thuê
    publicAccessToken: {
      type: String,
      unique: true,
      default: () => crypto.randomBytes(16).toString("hex"),
    },

    status: {
      type: String,
      enum: ["DRAFT", "UNPAID", "PARTIALLY_PAID", "PAID", "OVERDUE", "CANCELLED"],
      default: "UNPAID",
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

// Compound Indexes tối ưu cho Dashboard Chủ trọ và lọc công nợ
invoiceSchema.index({ landlordId: 1, status: 1, createdAt: -1 });
invoiceSchema.index({ landlordId: 1, month: 1, year: 1 });

module.exports = mongoose.model("Invoice", invoiceSchema);
