const mongoose = require("mongoose");

const subscriptionSchema = new mongoose.Schema(
  {
    isDeleted: { type: Boolean, default: false, index: true },
    billingCycle: { type: String, enum: ["MONTHLY", "YEARLY"], default: "MONTHLY" },
    quotedPrice: { type: Number, default: 0, min: 0, validate: Number.isSafeInteger },
    landlordId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    planId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SaaSPlan",
      required: true,
    },
    startDate: {
      type: Date,
      default: Date.now,
    },
    endDate: {
      type: Date,
      required: true,
    },
    pricePaid: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      enum: ["ACTIVE", "EXPIRED", "CANCELLED", "PENDING_PAYMENT"],
      default: "ACTIVE",
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

require('./propertyValidators')(subscriptionSchema, ['pricePaid']);
subscriptionSchema.pre('validate', function () {
  if (this.endDate && this.startDate && this.endDate <= this.startDate)
    this.invalidate('endDate', 'Ngày kết thúc phải sau ngày bắt đầu');
});
subscriptionSchema.index({ landlordId: 1, status: 1, endDate: 1 });
module.exports = mongoose.model("Subscription", subscriptionSchema);
