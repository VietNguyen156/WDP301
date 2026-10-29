const mongoose = require("mongoose");

const auditLogSchema = new mongoose.Schema(
  {
    actorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    actorRole: {
      type: String,
      enum: ["SUPER_ADMIN", "LANDLORD", "PROPERTY_MANAGER", "TENANT", "SYSTEM"],
      required: true,
    },
    landlordId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    action: {
      type: String,
      required: true, // vd: CREATE_INVOICE, CANCEL_INVOICE, CONFIRM_CASH_PAYMENT, CHANGE_PRICING, RESOLVE_UNMATCHED_PAYMENT
    },
    entityType: {
      type: String,
      required: true, // vd: INVOICE, CONTRACT, ROOM, BRANCH, PRICING, USER
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
    // Set by auditService from the retention policy; entries without it never expire.
    expiresAt: {
      type: Date,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false }, // Chỉ cần thời gian tạo log
  },
);

// Landlord history, one entity's history, and the admin audit page (newest first, optionally by action/type).
auditLogSchema.index({ landlordId: 1, createdAt: -1 });
auditLogSchema.index({ entityType: 1, entityId: 1, createdAt: -1 });
auditLogSchema.index({ createdAt: -1 });
auditLogSchema.index({ action: 1, createdAt: -1 });
auditLogSchema.index({ entityType: 1, createdAt: -1 });
// Old entries are removed by MongoDB once expiresAt passes.
auditLogSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model("AuditLog", auditLogSchema);
