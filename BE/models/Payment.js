const mongoose = require("mongoose");

const paymentSchema = new mongoose.Schema(
  {
    landlordId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
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
      required: true, // vd: "HD1024"
      index: true,
    },
    amount: {
      type: Number,
      required: true,
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

    // Trường hợp nộp tiền mặt thì lưu ai là người bấm xác nhận
    confirmedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  {
    timestamps: true,
  }
);

paymentSchema.index({ landlordId: 1, createdAt: -1 });

module.exports = mongoose.model("Payment", paymentSchema);
