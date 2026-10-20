const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const request = require("supertest");
const { MongoMemoryReplSet } = require("mongodb-memory-server");
process.env.JWT_SECRET = "integration-test-secret-32-characters-minimum";
process.env.NODE_ENV = "test";
process.env.SEPAY_AUTH_MODE = "apikey";
process.env.SEPAY_API_KEY = "finance-test-key";
const app = require("../app");
const fixture = require("./fixture");
const { migrateFinanceIndexes } = require("../config/migrations");
const M = require("../models");
let db,
  f,
  otherRoom,
  invoices = {},
  tokens = {};
let webhookId = 1000;
before(
  async () => {
    db = await MongoMemoryReplSet.create({
      replSet: { count: 1 },
      binary: { version: "7.0.14" },
    });
    await mongoose.connect(db.getUri(), { dbName: "finance_tests" });
    for (const model of Object.values(mongoose.models)) await model.init();
    f = await fixture();
    const subscription = await M.Subscription.create({
      landlordId: f.other._id, planId: f.plan._id, endDate: new Date(Date.now() + 86400000),
    });
    await M.User.updateOne({ _id: f.other._id }, {
      subscriptionId: subscription._id,
      bankConfig: { bankCode: "VCB", accountNumber: "2222222222", accountName: "CHU TRO KHAC" },
    });
    await M.User.updateOne({ _id: f.landlord._id }, {
      bankConfig: { bankCode: "MB", accountNumber: "1111111111", accountName: "CHU TRO" },
    });
    otherRoom = await M.Room.create({ landlordId: f.other._id, branchId: f.foreign._id, roomNumber: "101", basePrice: 1 });
    for (const name of ["owner", "other"])
      tokens[name] = (await request(app).post("/api/v1/auth/login")
        .send({ email: `${name}@test.local`, password: "password123" }).expect(200)).body.data.token;
    invoices.owner = await issued("owner", f.branch, f.room, "001234567811");
    invoices.other = await issued("other", f.foreign, otherRoom, "001234567812");
  },
  { timeout: 180000 },
);
after(async () => {
  await mongoose.disconnect();
  if (db) await db.stop();
});
const api = (method, path, user = "owner") =>
  request(app)[method](`/api/v1${path}`).set("Authorization", `Bearer ${tokens[user]}`);
async function issued(user, branch, room, citizenId) {
  const contract = await api("post", "/contracts", user).send({
    branchId: String(branch._id), roomId: String(room._id), tenant: { name: "Khách", citizenId },
    startDate: "2025-01-01", endDate: "2027-12-31", rentalPrice: 3000000, depositAmount: 3000000,
    initialElectricIndex: 100, initialWaterIndex: 10,
  });
  assert.equal(contract.status, 201, JSON.stringify(contract.body));
  const reading = await api("post", "/utility-readings", user).send({
    branchId: String(branch._id), roomId: String(room._id), billingPeriod: "2025-03",
    electricNewIndex: 150, waterNewIndex: 15,
  }).expect(201);
  return (await api("post", `/invoices/${reading.body.data.draftInvoiceId}/issue`, user).expect(200)).body.data;
}
const cash = (user, invoice, receiptNumber) =>
  api("post", "/payments/cash", user).send({
    invoiceId: invoice._id, amount: 1000, receiptNumber, transactionDate: "2025-04-01",
  });
const webhook = (body) =>
  request(app).post("/api/v1/payments/webhook").set("Authorization", "Apikey finance-test-key").send({
    id: ++webhookId, gateway: "MBBank", transactionDate: "2025-04-02 10:00:00", accountNumber: "1111111111",
    transferType: "in", transferAmount: 5000, content: `${invoices.owner.invoiceCode} PA101`, ...body,
  });

test("payment references are scoped per landlord and per cash/bank source", async () => {
  await cash("owner", invoices.owner, "PT001").expect(201);
  await cash("other", invoices.other, "PT001").expect(201);
  const again = await cash("owner", invoices.owner, "PT001").expect(409);
  assert.equal(again.body.errorCode, "PAYMENT_REFERENCE_DUPLICATED");

  // A cash receipt number equal to a later bank reference must not block the transfer.
  await cash("owner", invoices.owner, "FT25100001").expect(201);
  const bank = await webhook({ referenceCode: "FT25100001" }).expect(200);
  assert.equal(bank.body.data.unmatched, false);
  assert.ok(bank.body.data.paymentId);

  // Two banks may reuse a reference for different landlords.
  const other = await webhook({
    referenceCode: "FT25100001", accountNumber: "2222222222",
    content: `${invoices.other.invoiceCode} P101`,
  }).expect(200);
  assert.ok(other.body.data.paymentId);
  assert.notEqual(other.body.data.paymentId, bank.body.data.paymentId);

  // Idempotency per landlord still holds for retried webhooks.
  const retried = await webhook({ id: webhookId, referenceCode: "FT25100001", accountNumber: "2222222222" }).expect(200);
  assert.equal(retried.body.data.duplicate, true);
  const conflict = await webhook({ referenceCode: "FT25100001", transferAmount: 9999 }).expect(409);
  assert.equal(conflict.body.errorCode, "PAYMENT_REFERENCE_CONFLICT");
});

test("invoice codes are recognised even when the bank glues the room code on", async () => {
  const glued = await webhook({ referenceCode: "FT25100010", content: `MBVCB.123.CK ${invoices.owner.invoiceCode}PA101` }).expect(200);
  assert.equal(glued.body.data.unmatched, false);
  // Another landlord's code in the content is ignored rather than making it ambiguous.
  const foreign = await webhook({
    referenceCode: "FT25100013",
    content: `${invoices.owner.invoiceCode} ${invoices.other.invoiceCode}`,
  }).expect(200);
  assert.equal(foreign.body.data.unmatched, false);
  const second = await M.Invoice.create({
    ...(await M.Invoice.findById(invoices.owner._id).lean()), _id: undefined, publicAccessToken: undefined,
    invoiceCode: "HD202502SECOND", billingPeriod: "2025-02", month: 2,
  });
  const ambiguous = await webhook({
    referenceCode: "FT25100011",
    content: `${invoices.owner.invoiceCode} ${second.invoiceCode}`,
  }).expect(200);
  assert.equal(ambiguous.body.data.unmatched, true);
  const unknown = await webhook({ referenceCode: "FT25100012", content: "HD000000 tien phong" }).expect(200);
  assert.equal(unknown.body.data.unmatched, true);
});

test("transfers to a suspended landlord are kept as unmatched and resolvable later", async () => {
  await M.User.updateOne({ _id: f.landlord._id }, { status: "SUSPENDED" });
  let hook;
  try {
    hook = await webhook({ referenceCode: "FT25100020" }).expect(200);
  } finally {
    await M.User.updateOne({ _id: f.landlord._id }, { status: "ACTIVE" });
  }
  assert.equal(hook.body.data.unmatched, true);
  const unmatched = await M.UnmatchedPayment.findById(hook.body.data.unmatchedPaymentId);
  assert.match(unmatched.notes, /bị khóa/);
  assert.equal(await M.Payment.countDocuments({ referenceCode: "FT25100020" }), 0);
  const resolved = await api("post", `/payments/unmatched/${unmatched._id}/resolve`)
    .send({ invoiceId: String(invoices.owner._id) }).expect(200);
  assert.equal(resolved.body.data.payment.referenceCode, "FT25100020");
  await webhook({ referenceCode: "FT25100020" }).expect(200);
  assert.equal(await M.Payment.countDocuments({ referenceCode: "FT25100020" }), 1);
});

test("cancelling an issued invoice unlocks the reading and lets the period be billed again", async () => {
  const room = await M.Room.create({ landlordId: f.other._id, branchId: f.foreign._id, roomNumber: "102", basePrice: 1 });
  const first = await issued("other", f.foreign, room, "001234567813");
  const reading = await M.UtilityReading.findOne({ roomId: room._id, billingPeriod: "2025-03" });
  assert.equal(reading.isBilled, true);
  await api("post", `/invoices/${first._id}/cancel`, "other").send({ reason: "Sai đơn giá" }).expect(200);
  assert.equal((await M.UtilityReading.findById(reading._id)).isBilled, false);

  const fixed = await api("put", `/utility-readings/${reading._id}`, "other").send({ electricNewIndex: 160 }).expect(200);
  assert.ok(fixed.body.data.draftInvoiceId);
  assert.notEqual(String(fixed.body.data.draftInvoiceId), String(first._id));
  const regenerated = await api("post", "/invoices/generate", "other").send({
    branchId: String(f.foreign._id), billingPeriod: "2025-03", dueDate: "2025-04-10", roomIds: [String(room._id)],
  }).expect(201);
  assert.equal(String(regenerated.body.data[0]._id), String(fixed.body.data.draftInvoiceId));
  const reissued = await api("post", `/invoices/${fixed.body.data.draftInvoiceId}/issue`, "other").expect(200);
  assert.equal(reissued.body.data.electricDetail.newIndex, 160);
  assert.equal((await M.Invoice.findById(first._id)).status, "CANCELLED");
  assert.equal(await M.Invoice.countDocuments({ roomId: room._id, billingPeriod: "2025-03" }), 2);
});

test("finance migration drops legacy global indexes and backfills receipt references", async () => {
  const legacy = mongoose.connection.useDb("finance_legacy").db;
  await legacy.collection("payments").createIndex({ referenceCode: 1 }, { unique: true });
  await legacy.collection("unmatchedpayments").createIndex({ referenceCode: 1 }, { unique: true });
  await legacy.collection("invoices").createIndex(
    { landlordId: 1, roomId: 1, contractId: 1, billingPeriod: 1, invoiceType: 1 },
    { unique: true, partialFilterExpression: { isDeleted: false } },
  );
  await legacy.collection("paymentreceipts").insertOne({ _id: "FT-OLD", source: "SEPAY", amount: 1 });
  await migrateFinanceIndexes(legacy);
  await migrateFinanceIndexes(legacy);
  for (const name of ["payments", "unmatchedpayments", "invoices"]) {
    const names = (await legacy.collection(name).indexes()).map((index) => index.name);
    assert.deepEqual(names, ["_id_"], name);
  }
  assert.equal((await legacy.collection("paymentreceipts").findOne({ _id: "FT-OLD" })).referenceCode, "FT-OLD");
});
