const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const request = require("supertest");
const { MongoMemoryReplSet } = require("mongodb-memory-server");
process.env.JWT_SECRET = "integration-test-secret-32-characters-minimum";
process.env.NODE_ENV = "test";
const app = require("../app");
const fixture = require("./fixture");
const Invoice = require("../models/Invoice");
const AuditLog = require("../models/AuditLog");
let db,
  f,
  tokens = {};
before(
  async () => {
    db = await MongoMemoryReplSet.create({
      replSet: { count: 1 },
      binary: { version: "7.0.14" },
    });
    await mongoose.connect(db.getUri(), { dbName: "profile_tests" });
    for (const model of Object.values(mongoose.models)) await model.init();
    f = await fixture();
    for (const name of ["owner", "other", "manager", "admin"]) {
      const response = await request(app)
        .post("/api/v1/auth/login")
        .send({ email: `${name}@test.local`, password: "password123" });
      assert.equal(response.status, 200, JSON.stringify(response.body));
      tokens[name] = response.body.data.token;
    }
  },
  { timeout: 180000 },
);
after(async () => {
  await mongoose.disconnect();
  if (db) await db.stop();
});
const api = (method, path, user = "owner") =>
  request(app)
    [method](`/api/v1${path}`)
    .set("Authorization", `Bearer ${tokens[user]}`);
const bank = (extra = {}) => ({
  bankCode: "mb",
  bankName: "MBBank",
  accountNumber: "0123 456 789",
  accountName: "Nguyễn Văn Đức",
  currentPassword: "password123",
  ...extra,
});

test("profile update only touches non-login fields and keeps emails unique", async () => {
  await request(app).get("/api/v1/profile").expect(401);
  const mine = await api("get", "/profile").expect(200);
  assert.equal(mine.body.data.hasBankAccount, false);
  assert.equal(mine.body.data.bankAccount, null);
  assert.equal(mine.body.data.password, undefined);

  const updated = await api("put", "/profile").send({ name: "  Chủ trọ đổi tên ", phoneNumber: "+84 901 234 567" }).expect(200);
  assert.equal(updated.body.data.name, "Chủ trọ đổi tên");
  assert.equal(updated.body.data.phoneNumber, "0901234567");
  await api("put", "/profile").send({ email: "new-login@test.local" }).expect(400);
  await api("put", "/profile").send({}).expect(400);
  await api("put", "/profile").send({ phoneNumber: "123" }).expect(400);

  await api("put", "/profile", "manager").send({ phoneNumber: "0911111111" }).expect(400);
  const taken = await api("put", "/profile", "manager").send({ email: "OWNER@test.local" }).expect(409);
  assert.equal(taken.body.errorCode, "EMAIL_IN_USE");
  const managed = await api("put", "/profile", "manager").send({ email: "manager.new@test.local" }).expect(200);
  assert.equal(managed.body.data.email, "manager.new@test.local");
  assert.equal(managed.body.data.bankAccount, undefined);
  assert.ok(await AuditLog.exists({ action: "UPDATE_PROFILE", entityId: f.manager._id }));
});

test("only the landlord sets a validated, unique bank account after re-entering the password", async () => {
  await api("put", "/profile/bank-account", "manager").send(bank()).expect(403);
  await api("put", "/profile/bank-account", "admin").send(bank()).expect(403);
  const wrong = await api("put", "/profile/bank-account").send(bank({ currentPassword: "wrong-password" })).expect(400);
  assert.equal(wrong.body.errorCode, "CURRENT_PASSWORD_INVALID");
  await api("put", "/profile/bank-account").send(bank({ accountNumber: "12AB" })).expect(400);
  await api("put", "/profile/bank-account").send(bank({ bankCode: "M B!" })).expect(400);
  await api("put", "/profile/bank-account").send(bank({ accountName: "<script>" })).expect(400);
  await api("put", "/profile/bank-account").send(bank({ currentPassword: undefined })).expect(400);

  const saved = await api("put", "/profile/bank-account").send(bank()).expect(200);
  assert.deepEqual(saved.body.data.bankAccount, {
    bankCode: "MB", bankName: "MBBank", accountNumber: "0123456789", accountName: "NGUYEN VAN DUC",
  });
  assert.equal(saved.body.data.hasBankAccount, true);
  assert.equal(saved.body.data.refreshedInvoices, 0);
  assert.equal((await api("get", "/profile").expect(200)).body.data.bankAccount.accountNumber, "0123456789");
  assert.equal((await api("get", "/auth/me").expect(200)).body.data.bankAccount, undefined);

  const inUse = await api("put", "/profile/bank-account", "other").send(bank()).expect(422);
  assert.equal(inUse.body.errorCode, "BANK_ACCOUNT_IN_USE");
  const users = await api("get", "/users", "admin").expect(200);
  assert.ok(!JSON.stringify(users.body).includes("0123456789"));
  const log = await AuditLog.findOne({ action: "CHANGE_BANK_ACCOUNT" }).lean();
  assert.equal(log.after.accountNumber, "****6789");
  assert.ok(!JSON.stringify(log).includes("0123456789"));
});

test("changing the bank account re-points QR codes of unpaid invoices only", async () => {
  const contract = await api("post", "/contracts").send({
    branchId: String(f.branch._id), roomId: String(f.room._id),
    tenant: { name: "Khách", citizenId: "001234567892" },
    startDate: "2025-01-01", endDate: "2027-12-31", rentalPrice: 3000000, depositAmount: 3000000,
    initialElectricIndex: 100, initialWaterIndex: 10,
  });
  assert.equal(contract.status, 201, JSON.stringify(contract.body));
  const reading = await api("post", "/utility-readings").send({
    branchId: String(f.branch._id), roomId: String(f.room._id), billingPeriod: "2025-03",
    electricNewIndex: 150, waterNewIndex: 15,
  }).expect(201);
  const draftId = reading.body.data.draftInvoiceId;
  await api("post", `/invoices/${draftId}/issue`).expect(200);
  const paid = await Invoice.create({
    ...(await Invoice.findById(draftId).lean()), _id: undefined, publicAccessToken: undefined,
    invoiceCode: "HDPAIDTEST", billingPeriod: "2025-02", month: 2, status: "PAID", remainingAmount: 0,
  });
  const oldUrl = (await Invoice.findById(paid._id)).vietQrUrl;

  const changed = await api("put", "/profile/bank-account")
    .send(bank({ bankCode: "VCB", bankName: "Vietcombank", accountNumber: "9988776655" }))
    .expect(200);
  assert.equal(changed.body.data.refreshedInvoices, 1);
  const open = await Invoice.findById(draftId);
  assert.equal(open.bankSnapshot.accountNumber, "9988776655");
  assert.ok(open.vietQrUrl.includes("VCB-9988776655"));
  assert.ok(open.vietQrUrl.includes(`amount=${open.remainingAmount}`));
  const untouched = await Invoice.findById(paid._id);
  assert.equal(untouched.bankSnapshot.accountNumber, "0123456789");
  assert.equal(untouched.vietQrUrl, oldUrl);
  await api("put", "/profile/bank-account", "other").send(bank()).expect(200);
});
