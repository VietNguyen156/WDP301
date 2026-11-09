const mongoose = require("mongoose");

// One debt reminder sent to a tenant about an unpaid invoice (manual button or daily job).
const debtReminderSchema = new mongoose.Schema(
  {
    landlordId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    invoiceId: { type: mongoose.Schema.Types.ObjectId, ref: "Invoice", required: true },
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    channel: { type: String, enum: ["EMAIL"], default: "EMAIL" },
    to: { type: String, required: true },
    // true = sent by the daily job; false = a landlord / manager pressed the button.
    auto: { type: Boolean, default: false },
    sentBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    // Vietnam calendar day "YYYY-MM-DD": the job sends at most one reminder per invoice per day.
    sentDate: { type: String, required: true },
    remainingAmount: { type: Number, default: 0 },
    status: { type: String, enum: ["SENDING", "SENT", "FAILED"], default: "SENDING" },
    provider: String,
    messageId: String,
    error: String,
  },
  { timestamps: true },
);

debtReminderSchema.index({ invoiceId: 1, createdAt: -1 });
debtReminderSchema.index(
  { invoiceId: 1, sentDate: 1 },
  { unique: true, name: "one_auto_reminder_per_day", partialFilterExpression: { auto: true } },
);

module.exports = mongoose.model("DebtReminder", debtReminderSchema);
