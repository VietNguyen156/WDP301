const mongoose = require("mongoose");

// Landlord asks to switch plan; SUPER_ADMIN approves (creating a PENDING_PAYMENT
// subscription and its SaaS invoice) or rejects with a reason.
const planUpgradeRequestSchema = new mongoose.Schema(
  {
    landlordId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    planId: { type: mongoose.Schema.Types.ObjectId, ref: "SaaSPlan", required: true },
    // Plan in force when the request was sent, for the admin's context.
    currentPlanId: { type: mongoose.Schema.Types.ObjectId, ref: "SaaSPlan" },
    note: { type: String, trim: true, maxlength: 1000 },
    status: {
      type: String,
      enum: ["PENDING", "APPROVED", "REJECTED", "CANCELLED"],
      default: "PENDING",
      index: true,
    },
    handledBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    handledAt: { type: Date },
    rejectReason: { type: String, trim: true, maxlength: 1000 },
    subscriptionId: { type: mongoose.Schema.Types.ObjectId, ref: "Subscription" },
    platformInvoiceId: { type: mongoose.Schema.Types.ObjectId, ref: "PlatformInvoice" },
    isDeleted: { type: Boolean, default: false, index: true },
  },
  { timestamps: true },
);

// At most one open request per landlord.
planUpgradeRequestSchema.index(
  { landlordId: 1 },
  { unique: true, name: "one_pending_request", partialFilterExpression: { status: "PENDING", isDeleted: false } },
);
planUpgradeRequestSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model("PlanUpgradeRequest", planUpgradeRequestSchema);
