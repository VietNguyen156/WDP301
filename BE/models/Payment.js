const mongoose = require("mongoose");

const paymentSchema = new mongoose.Schema(
  {
    landlordId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    branchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Branch",
      index: true,
    },
    // INVOICE: tiền hóa đơn (tiền phòng, điện nước...). CONTRACT_DEPOSIT: tiền cọc hợp đồng,
    // không gắn hóa đơn nào. Bản ghi cũ không có trường này đều là INVOICE.
    purpose: {
      type: String,
      enum: ["INVOICE", "CONTRACT_DEPOSIT"],
      default: "INVOICE",
    },
    invoiceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Invoice",
      required: function () {
        return this.purpose !== "CONTRACT_DEPOSIT";
      },
      index: true,
    },
    invoiceCode: {
      type: String,
      required: function () {
        return this.purpose !== "CONTRACT_DEPOSIT";
      }, // vd: "HD2026090001"
      index: true,
    },
    contractId: { type: mongoose.Schema.Types.ObjectId, ref: "Contract" },
    contractCode: String,
    // Người thuê đứng tên hợp đồng (để người thuê xem được biên nhận cọc của mình).
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    amount: {
      type: Number,
      required: true, // Số nguyên VNĐ
      min: 1,
      validate: Number.isSafeInteger,
    },
    paymentMethod: {
      type: String,
      enum: ["VIETQR", "BANK_TRANSFER", "CASH", "DEPOSIT"],
      default: "VIETQR",
    },

    // QUAN TRỌNG: referenceCode là Mã giao dịch ngân hàng / số biên lai tiền mặt.
    // Unique trong phạm vi (chủ trọ, phương thức) để chống xử lý lặp mà không đụng dữ liệu chủ trọ khác.
    referenceCode: {
      type: String,
      required: true,
      immutable: true,
      trim: true,
      index: true,
    },
    gateway: {
      type: String, // vd: "MBBank", "VCB", "ACB", "CASH"
      default: "VIETQR",
    },
    transactionDate: {
      type: Date,
      default: Date.now,
    },
    content: {
      type: String, // Nội dung chuyển khoản thô nhận từ Ngân hàng
      trim: true,
    },
    senderAccountNumber: {
      type: String,
      trim: true,
    },
    senderBank: {
      type: String,
      trim: true,
    },

    status: {
      type: String,
      enum: ["PENDING_CONFIRMATION", "SUCCESS", "FAILED", "REFUNDED"],
      default: "SUCCESS",
    },

    // Lưu raw payload Webhook để đối soát kế toán khi có tranh chấp
    rawWebhookData: {
      type: Object,
    },

    // Trường hợp nộp tiền mặt thì lưu ai là người bấm xác nhận
    confirmedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    reportedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    reviewedAt: Date,
    reviewNote: String,
    receiptNumber: { type: String, immutable: true },
    payerName: String,
    cashCollectionPoint: String,
    note: String,
    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  {
    timestamps: true,
  },
);

paymentSchema.index({ landlordId: 1, paymentMethod: 1, referenceCode: 1 }, { unique: true });
paymentSchema.index({ landlordId: 1, createdAt: -1 });
// One deposit receipt per contract.
paymentSchema.index(
  { contractId: 1 },
  { unique: true, partialFilterExpression: { purpose: "CONTRACT_DEPOSIT" } },
);
paymentSchema.index({ tenantId: 1, purpose: 1, createdAt: -1 }, { sparse: true });
paymentSchema.index({ landlordId: 1, branchId: 1, createdAt: -1 });

module.exports = mongoose.model("Payment", paymentSchema);
