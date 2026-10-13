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

    // Mã hóa đơn công khai duy nhất trong chuỗi của Chủ trọ (vd: "HD2026090001")
    invoiceCode: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
      index: true,
    },

    // Kỳ hóa đơn định dạng chuỗi chuẩn: YYYY-MM (vd: "2026-09")
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
      billingType: {
        type: String,
        enum: ["METER", "PER_PERSON", "FIXED"],
        default: "METER",
      },
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
        billingType: { type: String, enum: ["PER_ROOM", "PER_PERSON", "PER_UNIT"] },
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
      default: 0, // = totalAmount - paidAmount (nếu > 0)
    },
    overpaidAmount: {
      type: Number,
      default: 0, // Số tiền khách trả thừa (nếu paidAmount > totalAmount)
    },

    // Tích hợp VietQR Động
    vietQrUrl: {
      type: String, // Link ảnh QuickLink VietQR
    },
    paymentSyntax: {
      type: String, // Cú pháp chuẩn gạch nợ: vd "HD2026090001 P101"
    },

    // Token bảo mật truy cập trực tiếp xem hóa đơn No-App cho Khách thuê
    bankSnapshot: {
      bankCode: String,
      bankName: String,
      accountNumber: String,
      accountName: String,
    },
    cancellationReason: String,
    publicAccessToken: {
      type: String,
      unique: true,
      default: () => crypto.randomBytes(16).toString("hex"),
    },

    status: {
      type: String,
      enum: [
        "DRAFT",
        "ISSUED",
        "PARTIALLY_PAID",
        "PAID",
        "OVERPAID",
        "CANCELLED",
        "UNPAID", // Giữ hỗ trợ tương thích nếu dữ liệu cũ còn
      ],
      default: "DRAFT",
      index: true,
    },
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
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Tự động đồng bộ billingPeriod trước khi validate
invoiceSchema.pre("validate", function () {
  if (!this.billingPeriod && this.month && this.year) {
    this.billingPeriod = `${this.year}-${String(this.month).padStart(2, "0")}`;
  }
});

// Virtual: OVERDUE là trạng thái suy diễn (Derived Condition), không lưu cứng
invoiceSchema.virtual("isOverdue").get(function () {
  if (this.dueDate && ["ISSUED", "PARTIALLY_PAID", "UNPAID"].includes(this.status)) {
    return new Date() > this.dueDate;
  }
  return false;
});

// Compound Indexes tối ưu Multi-tenancy
invoiceSchema.index({ landlordId: 1, invoiceCode: 1 }, { unique: true });
invoiceSchema.index({ landlordId: 1, status: 1, billingPeriod: -1 });
invoiceSchema.index({ landlordId: 1, status: 1, dueDate: 1 });
invoiceSchema.index({ landlordId: 1, isDeleted: 1 });
invoiceSchema.index({ landlordId: 1, roomId: 1, billingPeriod: 1 }, { unique: true, partialFilterExpression: { isDeleted: false } });

module.exports = mongoose.model("Invoice", invoiceSchema);
