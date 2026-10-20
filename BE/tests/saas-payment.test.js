const crypto = require("node:crypto");
const { test, before, after } = require("node:test");
const express = require("express");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const request = require("supertest");
const { MongoMemoryReplSet } = require("mongodb-memory-server");
process.env.JWT_SECRET = "integration-test-secret-32-characters-minimum";
process.env.NODE_ENV = "test";
process.env.SEPAY_PG_MERCHANT_ID = "SP-TEST-MERCHANT";
process.env.SEPAY_PG_SECRET_KEY = "spsk_test_secret";
process.env.SEPAY_PG_IPN_SECRET = "ipn-secret";
process.env.SEPAY_PG_RETURN_URL = "http://localhost:5173/plans";
const app = require("../app");
const fixture = require("./fixture");
const { sign } = require("../services/saasPaymentService");
const M = require("../models");
let db, f, plan, invoice, checkout, stub, tokens = {};
// Stand-in for pgapi-sandbox.sepay.vn order lookups.
const gateway = { orders: {}, lookups: 0 };
before(
  async () => {
    const fake = express();
    fake.get("/v1/order/detail/:number", (req, res) => {
      gateway.lookups += 1;
      const expected = `Basic ${Buffer.from("SP-TEST-MERCHANT:spsk_test_secret").toString("base64")}`;
      if (req.get("authorization") !== expected) return res.status(401).json({ message: "unauthorized" });
      const order = gateway.orders[req.params.number];
      return order ? res.json({ data: order }) : res.status(404).json({ message: "not found" });
    });
    stub = await new Promise((resolve) => { const s = fake.listen(0, "127.0.0.1", () => resolve(s)); });
    process.env.SEPAY_PG_API_URL = `http://127.0.0.1:${stub.address().port}`;
    db = await MongoMemoryReplSet.create({ replSet: { count: 1 }, binary: { version: "7.0.14" } });
    await mongoose.connect(db.getUri(), { dbName: "saas_payment_tests" });
    for (const model of Object.values(mongoose.models)) await model.init();
    f = await fixture();
    plan = await M.SaaSPlan.create({ name: "Pro", code: "PRO", price: 499000, maxBranches: 5, maxRooms: 100, maxManagers: 5 });
    for (const name of ["owner", "other", "admin"])
      tokens[name] = (await request(app).post("/api/v1/auth/login")
        .send({ email: `${name}@test.local`, password: "password123" }).expect(200)).body.data.token;
    const created = await api("post", "/admin/subscriptions", "admin").send({
      landlordId: String(f.landlord._id), planId: String(plan._id),
      endDate: new Date(Date.now() + 30 * 86400000).toISOString(),
    }).expect(201);
    invoice = created.body.data.invoice;
  },
  { timeout: 180000 },
);
after(async () => {
  stub?.close();
  await mongoose.disconnect();
  if (db) await db.stop();
});
const api = (method, path, user = "owner") =>
  request(app)[method](`/api/v1${path}`).set("Authorization", `Bearer ${tokens[user]}`);
const ipn = (body, secret = "ipn-secret") =>
  request(app).post("/api/v1/plans/payments/ipn").set("X-Secret-Key", secret).send(body);
const paid = (overrides = {}) => ({
  timestamp: Math.floor(Date.now() / 1000),
  notification_type: "ORDER_PAID",
  order: {
    id: "ord-uuid", order_id: "NQD-1", order_status: "CAPTURED", order_currency: "VND",
    order_amount: "499000.00", order_invoice_number: checkout.orderInvoiceNumber, order_description: "x",
  },
  transaction: {
    id: "txn-uuid", payment_method: "BANK_TRANSFER", transaction_id: "68da43da2d9de", transaction_type: "PAYMENT",
    transaction_date: new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 19).replace("T", " "),
    transaction_status: "APPROVED", transaction_amount: "499000", transaction_currency: "VND",
  },
  customer: { id: "c", customer_id: String(f.landlord._id) },
  ...overrides,
});

test("signature follows the SePay SDK: HMAC-SHA256 of field=value pairs, base64", () => {
  const fields = { operation: "PURCHASE", order_invoice_number: "DH0001", order_amount: 10000, currency: "VND", custom_data: "skip", merchant: "M1" };
  const expected = crypto.createHmac("sha256", "secret")
    .update("operation=PURCHASE,order_invoice_number=DH0001,order_amount=10000,currency=VND,merchant=M1")
    .digest("base64");
  assert.equal(sign(fields, "secret"), expected);
});

test("landlords see their SaaS invoices and get a signed checkout form", async () => {
  const list = (await api("get", "/plans/invoices").expect(200)).body.data;
  const mine = list.items.find((i) => String(i.id) === String(invoice._id));
  assert.equal(mine.payable, true);
  assert.equal(mine.plan.code, "PRO");
  assert.equal((await api("get", "/plans/invoices", "other").expect(200)).body.data.total, 0);
  await api("post", `/plans/invoices/${invoice._id}/checkout`, "other").send({}).expect(404);
  await api("post", `/plans/invoices/${invoice._id}/checkout`).send({ paymentMethod: "BITCOIN" }).expect(400);

  checkout = (await api("post", `/plans/invoices/${invoice._id}/checkout`).send({}).expect(201)).body.data;
  assert.equal(checkout.checkoutUrl, "https://pay-sandbox.sepay.vn/v1/checkout/init");
  assert.equal(checkout.method, "POST");
  const { signature, ...unsigned } = checkout.fields;
  assert.equal(signature, sign(unsigned, "spsk_test_secret"));
  assert.equal(unsigned.merchant, "SP-TEST-MERCHANT");
  assert.equal(unsigned.order_amount, 499000);
  assert.equal(unsigned.payment_method, "BANK_TRANSFER");
  assert.ok(unsigned.order_invoice_number.startsWith(`${invoice.invoiceCode}-`));
  assert.ok(unsigned.success_url.startsWith("http://localhost:5173/plans?payment=success&invoice="));
  assert.ok(!JSON.stringify(checkout).includes("spsk_test_secret"));
  const again = (await api("post", `/plans/invoices/${invoice._id}/checkout`).send({ paymentMethod: "CARD" }).expect(201)).body.data;
  assert.notEqual(again.orderInvoiceNumber, checkout.orderInvoiceNumber);
  assert.equal((await M.PlatformInvoice.findById(invoice._id)).gatewayOrders.length, 2);
});

test("the gateway IPN activates the plan once, after checking the secret and the amount", async () => {
  await ipn(paid(), "wrong").expect(401);
  assert.equal((await ipn(paid({ order: { order_invoice_number: "UNKNOWN-1" } })).expect(200)).body.ignored, true);
  const short = paid();
  short.transaction.transaction_amount = "1000";
  assert.equal((await ipn(short).expect(200)).body.unapplied, true);
  assert.equal((await M.PlatformInvoice.findById(invoice._id)).status, "PENDING");

  const ok = (await ipn(paid()).expect(200)).body;
  assert.deepEqual(ok, { success: true, paid: true, duplicate: false });
  const stored = await M.PlatformInvoice.findById(invoice._id);
  assert.equal(stored.status, "PAID");
  // Order-level reference, shared with the pull check (verify-payment).
  assert.equal(stored.paymentReference, "SEPAY_PG:ord-uuid");
  assert.equal(stored.paymentGateway, "SEPAY_PG_BANK_TRANSFER");
  assert.equal(stored.confirmedBy, undefined);
  const me = (await api("get", "/auth/me").expect(200)).body.data;
  assert.equal(me.subscription.plan.code, "PRO");
  assert.equal((await ipn(paid()).expect(200)).body.duplicate, true);
  assert.ok(await M.AuditLog.exists({ action: "CONFIRM_PLATFORM_PAYMENT", actorRole: "SYSTEM", entityId: invoice._id }));
  await api("post", `/plans/invoices/${invoice._id}/checkout`).send({}).expect(422);

  const voided = (await ipn(paid({ notification_type: "TRANSACTION_VOID" })).expect(200)).body;
  assert.equal(voided.unapplied, true);
  assert.ok(await M.AuditLog.exists({ action: "UNAPPLIED_PLATFORM_PAYMENT", entityId: invoice._id }));
});

test("verify-payment asks SePay and activates the plan when no IPN arrived", async () => {
  const created = await api("post", "/admin/subscriptions", "admin").send({
    landlordId: String(f.other._id), planId: String(plan._id),
    endDate: new Date(Date.now() + 30 * 86400000).toISOString(),
  }).expect(201);
  const second = created.body.data.invoice;
  const order = (await api("post", `/plans/invoices/${second._id}/checkout`, "other").send({}).expect(201)).body.data;
  await api("post", `/plans/invoices/${second._id}/verify-payment`).expect(404);

  // Not paid yet on SePay's side.
  const waiting = (await api("post", `/plans/invoices/${second._id}/verify-payment`, "other").expect(200)).body.data;
  assert.equal(waiting.status, "PENDING");

  gateway.orders[order.orderInvoiceNumber] = {
    id: "order-2", order_invoice_number: order.orderInvoiceNumber, order_status: "CAPTURED",
    order_amount: "499000.00", order_currency: "VND", updated_at: "2026-10-20 12:38:54", transactions: [],
  };
  const verified = (await api("post", `/plans/invoices/${second._id}/verify-payment`, "other").expect(200)).body.data;
  assert.equal(verified.status, "PAID");
  const stored = await M.PlatformInvoice.findById(second._id);
  assert.equal(stored.status, "PAID");
  assert.equal(stored.paymentReference, "SEPAY_PG:order-2");
  assert.equal(stored.paymentGateway, "SEPAY_PG_BANK_TRANSFER");
  const me = (await api("get", "/auth/me", "other").expect(200)).body.data;
  assert.equal(me.subscription.plan.code, "PRO");

  // The IPN arriving afterwards is recognised as the same payment.
  const late = paid();
  late.order = { ...late.order, id: "order-2", order_invoice_number: order.orderInvoiceNumber };
  assert.equal((await ipn(late).expect(200)).body.duplicate, true);
  const lookups = gateway.lookups;
  assert.equal((await api("post", `/plans/invoices/${second._id}/verify-payment`, "other").expect(200)).body.data.status, "PAID");
  assert.equal(gateway.lookups, lookups, "a paid invoice is not looked up again");
});

test("a lost IPN cannot lead to paying twice; an extra paid order is kept for a refund", async () => {
  const created = await api("post", "/admin/subscriptions", "admin").send({
    landlordId: String(f.landlord._id), planId: String(plan._id),
    endDate: new Date(Date.now() + 60 * 86400000).toISOString(),
  }).expect(201);
  const third = created.body.data.invoice;
  const first = (await api("post", `/plans/invoices/${third._id}/checkout`).send({}).expect(201)).body.data;
  const second = (await api("post", `/plans/invoices/${third._id}/checkout`).send({}).expect(201)).body.data;
  // Both were paid on SePay while their IPNs were lost (e.g. IPN URL pointing at the wrong place).
  for (const [order, id] of [[first, "order-a"], [second, "order-b"]])
    gateway.orders[order.orderInvoiceNumber] = {
      id, order_invoice_number: order.orderInvoiceNumber, order_status: "CAPTURED",
      order_amount: "499000.00", order_currency: "VND", updated_at: "2026-10-20 12:40:00", transactions: [],
    };

  // Opening a third payment first asks SePay and refuses.
  const refused = await api("post", `/plans/invoices/${third._id}/checkout`).send({}).expect(422);
  assert.equal(refused.body.errorCode, "PLATFORM_INVOICE_ALREADY_PAID");
  const stored = await M.PlatformInvoice.findById(third._id);
  assert.equal(stored.status, "PAID");
  assert.equal(stored.paymentReference, "SEPAY_PG:order-a", "the oldest paid order is the one applied");
  assert.deepEqual(stored.gatewayOrders.map((o) => o.result), ["PAID", "UNAPPLIED"]);
  const refunds = await M.AuditLog.find({ action: "UNAPPLIED_PLATFORM_PAYMENT", entityId: third._id }).lean();
  assert.equal(refunds.length, 1);
  assert.match(refunds[0].after.reason, /Thanh toán trùng/);

  // Checking again does not flag the same extra order twice.
  const again = (await api("post", `/plans/invoices/${third._id}/verify-payment`).expect(200)).body.data;
  assert.equal(again.status, "PAID");
  assert.equal(await M.AuditLog.countDocuments({ action: "UNAPPLIED_PLATFORM_PAYMENT", entityId: third._id }), 1);
});

test("checkout and IPN refuse to run without gateway credentials", async () => {
  const secret = process.env.SEPAY_PG_IPN_SECRET;
  delete process.env.SEPAY_PG_IPN_SECRET;
  try {
    await ipn(paid(), "anything").expect(503);
  } finally {
    process.env.SEPAY_PG_IPN_SECRET = secret;
  }
  const merchant = process.env.SEPAY_PG_MERCHANT_ID;
  delete process.env.SEPAY_PG_MERCHANT_ID;
  try {
    const res = await api("post", `/plans/invoices/${invoice._id}/checkout`).send({}).expect(503);
    assert.equal(res.body.errorCode, "PAYMENT_GATEWAY_NOT_CONFIGURED");
  } finally {
    process.env.SEPAY_PG_MERCHANT_ID = merchant;
  }
});
