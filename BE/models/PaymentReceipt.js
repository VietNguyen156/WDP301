const mongoose = require("mongoose");

// One transaction reference across cash, matched and unmatched payments.
const schema = new mongoose.Schema(
  {
    _id: { type: String, required: true },
    landlordId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    gatewayTransactionId: { type: String, unique: true, sparse: true },
    source: { type: String, enum: ["CASH", "SEPAY"], required: true },
    amount: {
      type: Number,
      required: true,
      min: 1,
      validate: Number.isSafeInteger,
    },
    paymentId: { type: mongoose.Schema.Types.ObjectId, ref: "Payment" },
    unmatchedPaymentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "UnmatchedPayment",
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model("PaymentReceipt", schema);
