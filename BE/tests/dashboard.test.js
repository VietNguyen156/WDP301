const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const request = require("supertest");
const { MongoMemoryReplSet } = require("mongodb-memory-server");
process.env.JWT_SECRET = "integration-test-secret-32-characters-minimum";
process.env.NODE_ENV = "test";
process.env.CLIENT_URL = "http://localhost:5173";
const app = require("../app");
const fixture = require("./fixture");
const M = require("../models");
let db, f, invoice, tokens = {};
before(
  async () => {
    db = await MongoMemoryReplSet.create({ replSet: { count: 1 }, binary: { version: "7.0.14" } });
    await mongoose.connect(db.getUri(), { dbName: "dashboard_tests" });
    for (const model of Object.values(mongoose.models)) await model.init();
    f = await fixture();
    await M.User.updateOne({ _id: f.landlord._id }, {
      bankConfig: { bankCode: "MB", accountNumber: "1111222233", accountName: "CHU TRO" },
    });
    await M.Room.create({ landlordId: f.landlord._id, branchId: f.branch._id, roomNumber: "A.102", basePrice: 1 });
    await M.Room.create({ landlordId: f.landlord._id, branchId: f.branch._id, roomNumber: "A.103", basePrice: 1, status: "MAINTENANCE" });
    for (const name of ["owner", "other", "manager"])
      tokens[name] = (await request(app).post("/api/v1/auth/login")
        .send({ email: `${name}@test.local`, password: "password123" }).expect(200)).body.data.token;
    await api("post", "/contracts").send({
      branchId: String(f.branch._id), roomId: String(f.room._id),
      tenant: { name: "Nguyễn Văn Khách", citizenId: "001234567831", phoneNumber: "0912000111" },
      startDate: "2025-01-01", endDate: new Date(Date.now() + 10 * 86400000).toISOString().slice(0, 10),
      rentalPrice: 3000000, depositAmount: 3000000, initialElectricIndex: 100, initialWaterIndex: 10,
    }).expect(201);
    const reading = await api("post", "/utility-readings").send({
      branchId: String(f.branch._id), roomId: String(f.room._id), billingPeriod: "2025-03",
      electricNewIndex: 150, waterNewIndex: 15,
    }).expect(201);
    invoice = (await api("post", `/invoices/${reading.body.data.draftInvoiceId}/issue`).expect(200)).body.data;
    await api("post", "/payments/cash").send({
      invoiceId: invoice._id, amount: 1000000, receiptNumber: "PT-DASH-1", transactionDate: "2025-03-20",
    }).expect(201);
    // Make it overdue by 5 days.
    await M.Invoice.updateOne({ _id: invoice._id }, { dueDate: new Date(Date.now() - 5 * 86400000 - 3600000) });
  },
  { timeout: 180000 },
);
after(async () => {
  await mongoose.disconnect();
  if (db) await db.stop();
});
const api = (method, path, user = "owner") =>
  request(app)[method](`/api/v1${path}`).set("Authorization", `Bearer ${tokens[user]}`);

test("only landlords read the revenue dashboard", async () => {
  await request(app).get("/api/v1/dashboard/stats").expect(401);
  await api("get", "/dashboard/stats", "manager").expect(403);
  await api("get", "/dashboard/debts", "manager").expect(403);
  await api("get", `/dashboard/stats?branchId=${f.foreign._id}`).expect(404);
  await api("get", "/dashboard/stats?billingPeriod=2025-13").expect(400);
});

test("stats answer collection, debts and occupancy for the period", async () => {
  const data = (await api("get", "/dashboard/stats?billingPeriod=2025-03").expect(200)).body.data;
  const total = invoice.totalAmount;
  assert.equal(data.billingPeriod, "2025-03");
  assert.equal(data.collection.expectedAmount, total);
  assert.equal(data.collection.collectedAmount, 1000000);
  assert.equal(data.collection.outstandingAmount, total - 1000000);
  assert.equal(data.collection.collectionRate, Math.round((1000000 / total) * 10000) / 100);
  // Cash flow follows the payment date (20/03/2025), not the invoice period.
  assert.equal(data.collection.receivedAmount, 1000000);
  assert.deepEqual(data.collection.receivedByMethod, { CASH: 1000000 });

  assert.equal(data.debts.roomCount, 1);
  assert.equal(data.debts.totalAmount, total - 1000000);
  const debt = data.debts.items[0];
  assert.equal(debt.overdueDays, 5);
  assert.equal(debt.room.roomNumber, "A.101");
  assert.equal(debt.tenant.name, "Nguyễn Văn Khách");
  assert.ok(debt.publicPath.startsWith("/i/"));
  assert.match(debt.reminderMessage, /phòng A\.101/);
  assert.match(debt.reminderMessage, /quá hạn 5 ngày/);
  assert.ok(debt.reminderMessage.includes(`http://localhost:5173${debt.publicPath}`));

  assert.deepEqual(data.occupancy, {
    totalRooms: 3, rentedRooms: 1, rate: 33.33,
    byStatus: { RENTED: 1, EMPTY: 1, MAINTENANCE: 1, CLEANING: 0 },
  });
  assert.deepEqual(data.contracts, { live: 1, expiringSoon: 1, expired: 0 });
});

test("other periods, other branches and other landlords stay separate", async () => {
  const april = (await api("get", "/dashboard/stats?billingPeriod=2025-04").expect(200)).body.data;
  assert.equal(april.collection.expectedAmount, 0);
  assert.equal(april.collection.collectionRate, 0);
  assert.equal(april.collection.receivedAmount, 0);
  assert.equal(april.debts.roomCount, 1, "debts are not limited to the selected period");
  const hidden = (await api("get", `/dashboard/stats?branchId=${f.hidden._id}&billingPeriod=2025-03`).expect(200)).body.data;
  assert.equal(hidden.collection.expectedAmount, 0);
  assert.equal(hidden.occupancy.totalRooms, 0);
  const other = (await api("get", "/dashboard/stats?billingPeriod=2025-03", "other").expect(200)).body.data;
  assert.equal(other.collection.expectedAmount, 0);
  assert.equal(other.debts.totalAmount, 0);

  const debts = (await api("get", "/dashboard/debts").expect(200)).body.data;
  assert.equal(debts.invoiceCount, 1);
  assert.equal(debts.overdueCount, 1);
  assert.equal((await api("get", `/dashboard/debts?branchId=${f.hidden._id}`).expect(200)).body.data.items.length, 0);
});
