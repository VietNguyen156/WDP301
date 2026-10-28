const mongoose = require("mongoose");
const {
  FINANCE_ENTITY_TYPES,
  FINANCE_ACTION_PATTERN,
  retentionDays,
} = require("../utils/auditPolicy");

// Indexes from earlier schema versions that model.init() cannot replace by itself:
// global payment references and the invoice index that kept cancelled invoices blocking a period.
const LEGACY_INDEXES = [
  ["payments", (index) => index.name === "referenceCode_1" && index.unique],
  [
    "unmatchedpayments",
    (index) => index.name === "referenceCode_1" && index.unique,
  ],
  [
    "invoices",
    (index) =>
      index.name ===
      "landlordId_1_roomId_1_contractId_1_billingPeriod_1_invoiceType_1",
  ],
  // Platform-wide login names, now unique per landlord (same CCCD with several landlords).
  ["users", (index) => index.name === "email_1" && index.unique],
  ["users", (index) => index.name === "username_1" && index.unique],
  // Replaced by the same keys plus the list sort order.
  ["invoices", (index) => index.name === "landlordId_1_isDeleted_1"],
  ["branches", (index) => index.name === "landlordId_1_isDeleted_1"],
  ["rooms", (index) => index.name === "landlordId_1_branchId_1_isDeleted_1"],
  [
    "platforminvoices",
    (index) =>
      index.name === "gatewayOrders.orderInvoiceNumber_1" &&
      index.sparse &&
      !index.partialFilterExpression,
  ],
];

// Idempotent; must run before model.init() so the new indexes can be built.
async function migrateFinanceIndexes(db = mongoose.connection.db) {
  for (const [name, isLegacy] of LEGACY_INDEXES) {
    if (!(await db.listCollections({ name }).hasNext())) continue;
    for (const index of await db.collection(name).indexes()) {
      if (!isLegacy(index)) continue;
      await db.collection(name).dropIndex(index.name);
      console.log(`Đã xóa index cũ ${name}.${index.name}`);
    }
  }
  // Receipts used to store the bank/cash reference as _id only.
  if (await db.listCollections({ name: "paymentreceipts" }).hasNext())
    await db
      .collection("paymentreceipts")
      .updateMany({ referenceCode: { $exists: false } }, [
        { $set: { referenceCode: "$_id" } },
      ]);
}

// Every plan now includes every feature: drop the per-plan flags and feature texts.
async function unifyPlanFeatures(db = mongoose.connection.db) {
  if (!(await db.listCollections({ name: "saasplans" }).hasNext())) return;
  await db.collection("saasplans").updateMany(
    { $or: [{ featureFlags: { $exists: true } }, { features: { $exists: true } }] },
    { $unset: { featureFlags: "", features: "" } },
  );
}

// Audit logs: drop the single-field indexes the compound ones replace, and give entries
// written before the retention policy an expiry date counted from when they were created.
const AUDIT_LEGACY_INDEXES = ["actorId_1", "landlordId_1", "action_1", "entityType_1"];
async function migrateAuditLogs(db = mongoose.connection.db) {
  if (!(await db.listCollections({ name: "auditlogs" }).hasNext())) return;
  const logs = db.collection("auditlogs");
  for (const index of await logs.indexes()) {
    if (!AUDIT_LEGACY_INDEXES.includes(index.name)) continue;
    await logs.dropIndex(index.name);
    console.log(`Đã xóa index cũ auditlogs.${index.name}`);
  }
  const finance = {
    $or: [
      { entityType: { $in: FINANCE_ENTITY_TYPES } },
      { action: { $regex: FINANCE_ACTION_PATTERN } },
    ],
  };
  for (const [match, keep] of [
    [finance, retentionDays(true)],
    [{ $nor: [finance] }, retentionDays(false)],
  ]) {
    if (!keep) continue;
    await logs.updateMany({ expiresAt: { $exists: false }, ...match }, [
      { $set: { expiresAt: { $add: [{ $ifNull: ["$createdAt", "$$NOW"] }, keep * 86400000] } } },
    ]);
  }
}

module.exports = { migrateFinanceIndexes, unifyPlanFeatures, migrateAuditLogs };
