const mongoose = require("mongoose");

const platformInvoiceSchema = new mongoose.Schema(
  {
    isDeleted: { type: Boolean, default: false, index: true },
    confirmedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    paymentEvidence: String,
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
    // Each SePay checkout attempt needs its own unique order_invoice_number.
    gatewayOrders: [
      {
        _id: false,
        orderInvoiceNumber: { type: String, required: true },
        paymentMethod: { type: String },
        createdAt: { type: Date, default: Date.now },
        // Outcome once SePay reported this order paid: applied, or kept for a refund (paid twice).
        result: { type: String, enum: ["PAID", "UNAPPLIED"] },
      },
    ],
  },
  {
    timestamps: true,
  }
);

platformInvoiceSchema.index({ landlordId: 1, status: 1 });
platformInvoiceSchema.index(
  { "gatewayOrders.orderInvoiceNumber": 1 },
  { unique: true, partialFilterExpression: { "gatewayOrders.orderInvoiceNumber": { $exists: true } } },
);
platformInvoiceSchema.index({ paymentReference: 1 }, { unique: true, partialFilterExpression: { paymentReference: { $type: "string" } } });
require('./propertyValidators')(platformInvoiceSchema, ['amount']);

module.exports = mongoose.model("PlatformInvoice", platformInvoiceSchema);
