const mongoose = require("mongoose");

const unmatchedPaymentSchema = new mongoose.Schema(
  {
    landlordId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    referenceCode: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    amount: {
      type: Number,
      required: true,
    },
    content: {
      type: String,
      trim: true,
    },
    gateway: {
      type: String,
    },
    senderAccountNumber: {
      type: String,
      trim: true,
    },
    senderBank: {
      type: String,
      trim: true,
    },
    transactionDate: {
      type: Date,
      default: Date.now,
    },
    rawWebhookData: {
      type: Object,
    },
    status: {
      type: String,
      enum: ["PENDING_REVIEW", "RESOLVED", "IGNORED"],
      default: "PENDING_REVIEW",
      index: true,
    },
    // Sau khi Chủ trọ đối soát gán thủ công vào hóa đơn
    resolvedInvoiceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Invoice",
    },
    resolvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    resolvedAt: {
      type: Date,
    },
    notes: {
      type: String,
    },
    isDeleted: { type: Boolean, default: false, index: true },
  },
  {
    timestamps: true,
  }
);

unmatchedPaymentSchema.index({ landlordId: 1, status: 1, createdAt: -1 });

module.exports = mongoose.model("UnmatchedPayment", unmatchedPaymentSchema);
