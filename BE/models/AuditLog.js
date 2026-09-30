const mongoose = require("mongoose");

const auditLogSchema = new mongoose.Schema(
  {
    actorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    actorRole: {
      type: String,
      enum: ["SUPER_ADMIN", "LANDLORD", "PROPERTY_MANAGER", "TENANT", "SYSTEM"],
      required: true,
    },
    landlordId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      index: true,
    },
    action: {
      type: String,
      required: true, // vd: CREATE_INVOICE, CANCEL_INVOICE, CONFIRM_CASH_PAYMENT, CHANGE_PRICING, RESOLVE_UNMATCHED_PAYMENT
      index: true,
    },
    entityType: {
      type: String,
      required: true, // vd: INVOICE, CONTRACT, ROOM, BRANCH, PRICING, USER
      index: true,
    },
    entityId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
    before: {
      type: Object, // Dữ liệu trước khi thay đổi
    },
    after: {
      type: Object, // Dữ liệu sau khi thay đổi
    },
    ipAddress: {
      type: String,
    },
    userAgent: {
      type: String,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false }, // Chỉ cần thời gian tạo log
  }
);

auditLogSchema.index({ landlordId: 1, createdAt: -1 });
auditLogSchema.index({ entityType: 1, entityId: 1, createdAt: -1 });

module.exports = mongoose.model("AuditLog", auditLogSchema);
