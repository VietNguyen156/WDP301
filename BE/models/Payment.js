const mongoose = require("mongoose");

const paymentSchema = new mongoose.Schema(
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
      index: true,
    },
    invoiceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Invoice",
      required: true,
      index: true,
    },
    invoiceCode: {
      type: String,
      required: true, // vd: "HD2026090001"
      index: true,
    },
    amount: {
      type: Number,
      required: true, // Số nguyên VNĐ
    },
    paymentMethod: {
      type: String,
      enum: ["VIETQR", "BANK_TRANSFER", "CASH"],
      default: "VIETQR",
    },

    // QUAN TRỌNG: referenceCode là Mã giao dịch ngân hàng / ID giao dịch SePay
    // Unique để chống lỗi Idempotency (bắn lặp webhook xử lý trừ tiền 2 lần)
    referenceCode: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    gateway: {
      type: String, // vd: "MBBank", "VCB", "ACB", "CASH"
      default: "VIETQR",
    },
    transactionDate: {
      type: Date,
      default: Date.now,
    },
    content: {
      type: String, // Nội dung chuyển khoản thô nhận từ Ngân hàng
      trim: true,
    },
    senderAccountNumber: {
      type: String,
      trim: true,
    },
    senderBank: {
      type: String,
      trim: true,
    },

    status: {
      type: String,
      enum: ["SUCCESS", "FAILED", "REFUNDED"],
      default: "SUCCESS",
    },

    // Lưu raw payload Webhook để đối soát kế toán khi có tranh chấp
    rawWebhookData: {
      type: Object,
    },

    // Trường hợp nộp tiền mặt thì lưu ai là người bấm xác nhận
    confirmedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
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

paymentSchema.index({ landlordId: 1, createdAt: -1 });
paymentSchema.index({ landlordId: 1, branchId: 1, createdAt: -1 });

module.exports = mongoose.model("Payment", paymentSchema);
