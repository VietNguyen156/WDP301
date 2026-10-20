const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const mongoose = require("mongoose");
const request = require("supertest");
const { MongoMemoryReplSet } = require("mongodb-memory-server");
process.env.JWT_SECRET = "integration-test-secret-32-characters-minimum";
process.env.NODE_ENV = "test";
process.env.SEPAY_BANKHUB_CLIENT_ID = "client-id";
process.env.SEPAY_BANKHUB_CLIENT_SECRET = "client-secret";
process.env.SEPAY_BANKHUB_IPN_API_KEY = "ipn-key";
process.env.SEPAY_BANKHUB_WEBHOOK_SECRET = "event-secret";
const app = require("../app");
const fixture = require("./fixture");
const bankHubClient = require("../services/bankHubClient");
const M = require("../models");

// Stand-in for the Bank Hub sandbox: the test plays the landlord typing a test account in the iframe.
const hub = { calls: [], accounts: [], tokens: 0, rejectNextToken: false };
let db, f, stub, tokens = {}, invoice;
before(
  async () => {
    const fake = express();
    fake.use(express.json());
    fake.use((req, res, next) => { hub.calls.push(`${req.method} ${req.path}`); next(); });
    fake.post("/v1/token", (req, res) => {
      const expected = `Basic ${Buffer.from("client-id:client-secret").toString("base64")}`;
      if (req.get("authorization") !== expected) return res.status(401).json({ code: 401 });
      res.status(201).json({ code: 201, access_token: `token-${++hub.tokens}`, ttl: 60000 });
    });
    fake.use((req, res, next) => {
      if (hub.rejectNextToken) { hub.rejectNextToken = false; return res.status(401).json({ message: "expired" }); }
      if (!/^Bearer token-\d+$/.test(req.get("authorization") || "")) return res.status(401).json({});
      next();
    });
    fake.post("/v1/company/create", (req, res) =>
      res.status(201).json({ code: 201, data: { xid: "company-1", full_name: req.body.full_name } }));
    fake.post("/v1/link-token/create", (req, res) => {
      hub.lastLink = req.body;
      res.status(201).json({ xid: "lt-1", hosted_link_url: "https://bankhub.sepay.vn/link/lt-1", link_token: "t", expires_at: "2026-10-20 10:00:00" });
    });
    fake.get("/v1/bank-account", (req, res) =>
      res.json({ data: hub.accounts.filter((a) => a.company_xid === req.query.company_xid), meta: {} }));
    fake.get("/v1/bank-account/:xid", (req, res) => {
      const account = hub.accounts.find((a) => a.xid === req.params.xid);
      return account ? res.json({ data: account }) : res.status(404).json({ message: "not found" });
    });
    stub = await new Promise((resolve) => { const s = fake.listen(0, "127.0.0.1", () => resolve(s)); });
    process.env.SEPAY_BANKHUB_BASE_URL = `http://127.0.0.1:${stub.address().port}`;

    db = await MongoMemoryReplSet.create({ replSet: { count: 1 }, binary: { version: "7.0.14" } });
    await mongoose.connect(db.getUri(), { dbName: "bankhub_tests" });
    for (const model of Object.values(mongoose.models)) await model.init();
    f = await fixture();
    for (const name of ["owner", "manager"])
      tokens[name] = (await request(app).post("/api/v1/auth/login")
        .send({ email: `${name}@test.local`, password: "password123" }).expect(200)).body.data.token;
  },
  { timeout: 180000 },
);
after(async () => {
  await mongoose.disconnect();
  if (db) await db.stop();
  stub?.close();
});
const api = (method, path, user = "owner") =>
  request(app)[method](`/api/v1${path}`).set("Authorization", `Bearer ${tokens[user]}`);
const ipn = (body, key = "ipn-key") =>
  request(app).post("/api/v1/bank-hub/ipn").set("Authorization", `Apikey ${key}`).send({
    gateway: "MBBank", transaction_date: "2026-10-19 10:30:00", account_number: "0999888777",
    bank_account_xid: "ba-1", va: null, payment_code: null, transfer_type: "credit",
    amount: 5000, reference_code: null, accumulated: 0, ...body,
  });

test("landlords get a hosted link; the company is created once and secrets stay server-side", async () => {
  await api("get", "/bank-hub", "manager").expect(403);
  const status = (await api("get", "/bank-hub").expect(200)).body.data;
  assert.equal(status.configured, true);
  assert.equal(status.environment, "sandbox");
  assert.equal(status.linked, false);
  await api("post", "/bank-hub/link-token").send({ purpose: "UNLINK" }).expect(422);

  const link = (await api("post", "/bank-hub/link-token").send({}).expect(201)).body.data;
  assert.equal(link.hostedLinkUrl, "https://bankhub.sepay.vn/link/lt-1");
  assert.equal(hub.lastLink.purpose, "LINK_BANK_ACCOUNT");
  assert.equal(hub.lastLink.company_xid, "company-1");
  assert.ok(!JSON.stringify(link).includes("token-"));
  await api("post", "/bank-hub/link-token").send({}).expect(201);
  assert.equal(hub.calls.filter((c) => c === "POST /v1/company/create").length, 1);
  assert.equal(hub.calls.filter((c) => c === "POST /v1/token").length, 1, "access token is cached");

  // An expired token is refreshed transparently.
  hub.rejectNextToken = true;
  await api("post", "/bank-hub/link-token").send({}).expect(201);
  assert.equal(hub.calls.filter((c) => c === "POST /v1/token").length, 2);
});

test("after the iframe finishes, sync makes the linked test account the receiving account", async () => {
  const contract = await api("post", "/contracts").send({
    branchId: String(f.branch._id), roomId: String(f.room._id), tenant: { name: "Khách", citizenId: "001234567821" },
    startDate: "2025-01-01", endDate: "2027-12-31", rentalPrice: 3000000, depositAmount: 3000000,
    initialElectricIndex: 100, initialWaterIndex: 10,
  });
  assert.equal(contract.status, 201, JSON.stringify(contract.body));
  await M.User.updateOne({ _id: f.landlord._id }, {
    "bankConfig.bankCode": "VCB", "bankConfig.accountNumber": "1234567", "bankConfig.accountName": "CU",
  });
  const reading = await api("post", "/utility-readings").send({
    branchId: String(f.branch._id), roomId: String(f.room._id), billingPeriod: "2025-03", electricNewIndex: 150, waterNewIndex: 15,
  }).expect(201);
  invoice = (await api("post", `/invoices/${reading.body.data.draftInvoiceId}/issue`).expect(200)).body.data;

  // Nothing linked yet in the sandbox.
  assert.equal((await api("post", "/bank-hub/sync").expect(200)).body.data.linked, false);
  hub.accounts.push({
    xid: "ba-1", company_xid: "company-1", brand_name: "MBBank", bank_bin: "970422", bank_code: "MB",
    account_holder_name: "Nguyễn Văn Test", account_number: "0999888777", active: "1",
  });
  const synced = (await api("post", "/bank-hub/sync").expect(200)).body.data;
  assert.equal(synced.linked, true);
  assert.deepEqual(synced.bankAccount, {
    bankCode: "970422", bankName: "MBBank", accountNumber: "0999888777", accountName: "NGUYEN VAN TEST",
  });
  assert.equal(synced.refreshedInvoices, 1);
  const open = await M.Invoice.findById(invoice._id);
  assert.ok(open.vietQrUrl.includes("970422-0999888777"));
  const manual = await api("put", "/profile/bank-account").send({
    bankCode: "MB", accountNumber: "111222333", accountName: "CHU TRO", currentPassword: "password123",
  }).expect(422);
  assert.equal(manual.body.errorCode, "BANK_HUB_LINKED");
  await api("post", "/bank-hub/link-token").send({ purpose: "LINK" }).expect(422);
  const unlink = (await api("post", "/bank-hub/link-token").send({ purpose: "UNLINK" }).expect(201)).body.data;
  assert.equal(unlink.purpose, "UNLINK");
  assert.equal(hub.lastLink.bank_account_xid, "ba-1");
});

test("balance IPN pays the invoice once and is authenticated by the API key", async () => {
  await ipn({ transaction_id: "tx-1", content: `${invoice.invoiceCode} PA101` }, "wrong").expect(401);
  const paid = (await ipn({ transaction_id: "tx-1", content: `CK ${invoice.invoiceCode}PA101` }).expect(200)).body;
  assert.deepEqual(paid, { success: true, duplicate: false, unmatched: false, ignored: false });
  const payment = await M.Payment.findOne({ invoiceId: invoice._id, paymentMethod: "BANK_TRANSFER" });
  assert.equal(payment.amount, 5000);
  assert.equal(payment.referenceCode, "BH-tx-1");
  assert.equal((await ipn({ transaction_id: "tx-1", content: invoice.invoiceCode }).expect(200)).body.duplicate, true);
  assert.equal((await ipn({ transaction_id: "tx-2", transfer_type: "debit" }).expect(200)).body.ignored, true);
  const unknown = (await ipn({ transaction_id: "tx-3", content: "chuyen tien" }).expect(200)).body;
  assert.equal(unknown.unmatched, true);
  await ipn({ transaction_id: "tx-4", amount: -1 }).expect(400);
  assert.equal(await M.Payment.countDocuments({ landlordId: f.landlord._id, paymentMethod: "BANK_TRANSFER" }), 1);
});

test("unlink events from Bank Hub detach the account; link events attach it", async () => {
  const event = (body, secret = "event-secret") =>
    request(app).post("/api/v1/bank-hub/events").set("X-Secret-Key", secret).send(body);
  await event({ event: "BANK_ACCOUNT_UNLINKED", metadata: { bank_account_xid: "ba-1" } }, "nope").expect(401);
  assert.equal((await event({ event: "LINK_SESSION_INITIALIZED", metadata: {} }).expect(200)).body.ignored, true);

  hub.accounts[0].active = "0";
  await event({ event: "BANK_ACCOUNT_UNLINKED", metadata: { bank_account_xid: "ba-1" } }).expect(200);
  let owner = await M.User.findById(f.landlord._id);
  assert.equal(owner.bankHub.bankAccountXid, undefined);
  assert.equal(owner.bankConfig.accountNumber, "0999888777", "the account itself stays for manual matching");

  hub.accounts[0].active = "1";
  const linked = await event({ event: "BANK_ACCOUNT_LINKED", metadata: { bank_account_xid: "ba-1" } }).expect(200);
  assert.equal(linked.body.synced, true);
  owner = await M.User.findById(f.landlord._id);
  assert.equal(owner.bankHub.bankAccountXid, "ba-1");
  assert.ok(await M.AuditLog.exists({ action: "BANK_HUB_LINKED", actorRole: "SYSTEM" }));
});

test("endpoints refuse to run without Bank Hub credentials", async () => {
  const saved = process.env.SEPAY_BANKHUB_IPN_API_KEY;
  delete process.env.SEPAY_BANKHUB_IPN_API_KEY;
  try {
    await ipn({ transaction_id: "tx-9" }, "anything").expect(503);
  } finally {
    process.env.SEPAY_BANKHUB_IPN_API_KEY = saved;
  }
  const id = process.env.SEPAY_BANKHUB_CLIENT_ID;
  delete process.env.SEPAY_BANKHUB_CLIENT_ID;
  bankHubClient.resetTokenCache();
  try {
    const res = await api("post", "/bank-hub/link-token").send({ purpose: "UNLINK" }).expect(503);
    assert.equal(res.body.errorCode, "BANKHUB_NOT_CONFIGURED");
  } finally {
    process.env.SEPAY_BANKHUB_CLIENT_ID = id;
  }
});
