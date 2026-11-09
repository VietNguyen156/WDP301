const mongoose = require("mongoose");

// Phiếu chi: money the landlord pays out (repair contractor, materials...). The payment ledger
// (Payment) only holds money in; a repair the tenant pays for has both: the incident invoice's
// payment (thu) and the payout to whoever did the work (chi).
const expenseSchema = new mongoose.Schema(
  {
    landlordId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    branchId: { type: mongoose.Schema.Types.ObjectId, ref: "Branch", required: true },
    roomId: { type: mongoose.Schema.Types.ObjectId, ref: "Room" },
    incidentId: { type: mongoose.Schema.Types.ObjectId, ref: "Incident", index: true },
    category: { type: String, enum: ["REPAIR", "OTHER"], default: "REPAIR" },
    // Who received the money: contractor, shop, technician...
    payee: { type: String, required: true, trim: true },
    amount: { type: Number, required: true, min: 1, validate: Number.isSafeInteger },
    paymentMethod: { type: String, enum: ["CASH", "BANK_TRANSFER"], required: true },
    // Bank reference / receipt number of the payout, if any.
    referenceCode: { type: String, trim: true },
    paidAt: { type: Date, required: true },
    note: { type: String, trim: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    // VOID keeps the record (audit) but takes it out of every total.
    status: { type: String, enum: ["RECORDED", "VOID"], default: "RECORDED" },
    voidedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    voidedAt: Date,
    voidReason: String,
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true },
);

expenseSchema.index({ landlordId: 1, paidAt: -1 });
expenseSchema.index({ landlordId: 1, branchId: 1, paidAt: -1 });

module.exports = mongoose.model("Expense", expenseSchema);
