const mongoose = require("mongoose");

const platformInvoiceSchema = new mongoose.Schema(
  {
    landlordId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    subscriptionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Subscription",
      required: true,
    },
    planId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SaaSPlan",
      required: true,
    },
    invoiceCode: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true, // vd: "SAAS-2026-0012"
    },
    amount: {
      type: Number,
      required: true,
    },
    billingCycle: {
      type: String,
      enum: ["MONTHLY", "YEARLY"],
      default: "MONTHLY",
    },
    dueDate: {
      type: Date,
      required: true,
    },
    paidAt: {
      type: Date,
    },
    status: {
      type: String,
      enum: ["PENDING", "PAID", "OVERDUE", "CANCELLED"],
      default: "PENDING",
      index: true,
    },
    paymentGateway: {
      type: String,
    },
    paymentReference: {
      type: String,
    },
    notes: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

platformInvoiceSchema.index({ landlordId: 1, status: 1 });

module.exports = mongoose.model("PlatformInvoice", platformInvoiceSchema);
