const mongoose = require("mongoose");

const contractSchema = new mongoose.Schema(
  {
    settlement: {
      state: { type: String, enum: ["PREPARED", "COMPLETED"] },
      preparedAt: Date,
      invoiceId: { type: mongoose.Schema.Types.ObjectId, ref: "Invoice" },
      invoiceIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "Invoice" }],
      depositAppliedAmount: Number,
      roomAmount: Number,
      serviceAmount: Number,
      paymentsAfterPreparation: Number,
      heldDeposit: Number, electricAmount: Number, waterAmount: Number,
      deductionAmount: Number, outstandingDebt: Number, totalCharges: Number,
      refundedDepositAmount: Number, remainingDue: Number,
    },
    mutationVersion: { type: Number, default: 0, select: false },
    electricImage: String,
    waterImage: String,

    // Xác nhận hợp đồng điện tử 2 chiều (Hợp đồng điện tử theo pháp luật Việt Nam)
    landlordConfirmedAt: { type: Date },
    landlordConfirmedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    tenantConfirmedAt: { type: Date },
    tenantConfirmedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    confirmedByBothParties: { type: Boolean, default: false },
    contractSigningLocation: { type: String, default: "Online qua Cổng cư dân điện tử" },
    contractTerms: {
      paymentDueDays: { type: Number, default: 5 }, // Hạn thanh toán (ngày)
      latePaymentPenaltyRate: { type: Number, default: 0.5 }, // Phạt chậm đóng (%/ngày)
      terminationNoticeDays: { type: Number, default: 30 }, // Thời gian báo trước chấm dứt (ngày)
    },
    landlordId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    branchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Branch",
      required: true,
      index: true,
    },
    roomId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Room",
      required: true,
      index: true,
    },
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true, // Người đại diện ký hợp đồng
      index: true,
    },
    contractCode: {
      type: String,
      required: true,
      trim: true, // vd: "HDT-2026-P301-01"
    },
    startDate: {
      type: Date,
      required: true,
    },
    endDate: {
      type: Date,
      required: true,
    },
    rentalPrice: {
      type: Number,
      required: true, // Giá thuê thỏa thuận thực tế (VNĐ/tháng)
    },
    // Phụ lục gia hạn: mỗi lần gia hạn ghi lại ngày kết thúc và giá thuê trước / sau.
    renewals: [
      {
        _id: false,
        previousEndDate: { type: Date, required: true },
        endDate: { type: Date, required: true },
        previousRentalPrice: Number,
        rentalPrice: Number,
        notes: { type: String, trim: true },
        renewedAt: { type: Date, default: Date.now },
        renewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      },
    ],
    // Tiền cọc phòng
    depositAmount: {
      type: Number,
      default: 0,
    },
    depositStatus: {
      type: String,
      enum: ["PAID", "UNPAID", "REFUNDED", "PARTIALLY_REFUNDED", "APPLIED"],
      default: "UNPAID",
    },
    // Set when the landlord confirms the deposit after the contract was created.
    depositReceivedAt: Date,
    depositReceivedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    // Bank reference when the deposit was booked automatically from a transfer.
    depositReferenceCode: String,

    // Chỉ số ban đầu khi bàn giao chìa khóa
    initialElectricIndex: {
      type: Number,
      required: true,
      default: 0,
    },
    initialWaterIndex: {
      type: Number,
      required: true,
      default: 0,
    },

    // Danh sách người ở cùng phòng
    serviceQuantities: {
      type: Map,
      of: { type: Number, min: 0, validate: Number.isSafeInteger },
      default: {},
    },
    roommates: [
      {
        fullName: { type: String, required: true },
        citizenId: { type: String },
        phoneNumber: { type: String },
      },
    ],

    // Dữ liệu phục vụ quy trình Nghiệm thu Trả phòng & Quyết toán Tiền cọc (Check-out Settlement)
    actualEndDate: {
      type: Date,
    },
    finalElectricIndex: {
      type: Number,
    },
    finalWaterIndex: {
      type: Number,
    },
    deductions: [
      {
        reason: { type: String, required: true },
        amount: { type: Number, required: true },
        evidenceImage: { type: String },
      },
    ],
    refundedDepositAmount: {
      type: Number,
      default: 0,
    },
    settlementNotes: {
      type: String,
    },

    status: {
      type: String,
      enum: ["ACTIVE", "EXPIRING_SOON", "EXPIRED", "TERMINATED", "DRAFT"],
      default: "ACTIVE",
      index: true,
    },
    notes: {
      type: String,
    },
    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound Index: Đảm bảo trong 1 chuỗi trọ của Chủ trọ mã hợp đồng là duy nhất
contractSchema.index({ landlordId: 1, contractCode: 1 }, { unique: true });
contractSchema.index({ landlordId: 1, status: 1 });
contractSchema.index({ landlordId: 1, roomId: 1, status: 1 });
// List pages: newest first within one landlord.
contractSchema.index({ landlordId: 1, isDeleted: 1, createdAt: -1 });

require('./propertyValidators')(contractSchema, ['rentalPrice', 'depositAmount', 'initialElectricIndex', 'initialWaterIndex', 'finalElectricIndex', 'finalWaterIndex', 'refundedDepositAmount']);
require('./propertyValidators')(contractSchema.path('deductions').schema, ['amount']);
require('./propertyValidators')(contractSchema, ['settlement.heldDeposit', 'settlement.electricAmount',
  'settlement.waterAmount', 'settlement.deductionAmount', 'settlement.outstandingDebt', 'settlement.totalCharges',
  'settlement.refundedDepositAmount', 'settlement.remainingDue', 'settlement.depositAppliedAmount',
  'settlement.roomAmount', 'settlement.serviceAmount', 'settlement.paymentsAfterPreparation']);
contractSchema.pre('validate', function () {
  if (this.startDate && this.endDate && this.endDate <= this.startDate) this.invalidate('endDate', 'Ngày kết thúc phải sau ngày bắt đầu');
});
module.exports = mongoose.model("Contract", contractSchema);
