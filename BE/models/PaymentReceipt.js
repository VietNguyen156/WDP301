const mongoose = require("mongoose");

// One receipt per (landlord, source, reference) across matched and unmatched payments.
// _id is built by receiptId() so two landlords, or cash vs bank, never share a reference.
const schema = new mongoose.Schema(
  {
    _id: { type: String, required: true },
    referenceCode: { type: String, required: true },
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

const PaymentReceipt = mongoose.model("PaymentReceipt", schema);
PaymentReceipt.receiptId = (landlordId, source, referenceCode) =>
  `${landlordId}:${source}:${referenceCode}`;
module.exports = PaymentReceipt;
