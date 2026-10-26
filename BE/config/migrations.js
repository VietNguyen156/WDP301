const mongoose = require("mongoose");
const { DEFAULT_FLAGS } = require("../utils/planFeatures");

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

// Give the standard plans their feature flags once. Custom plans stay unset (all features)
// until an admin chooses their flags; plans already configured are never touched.
async function backfillPlanFeatureFlags(db = mongoose.connection.db) {
  if (!(await db.listCollections({ name: "saasplans" }).hasNext())) return;
  for (const [code, featureFlags] of Object.entries(DEFAULT_FLAGS))
    await db
      .collection("saasplans")
      .updateOne(
        { code, featureFlags: { $exists: false } },
        { $set: { featureFlags } },
      );
}

module.exports = { migrateFinanceIndexes, backfillPlanFeatureFlags };
