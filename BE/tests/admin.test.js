const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const request = require("supertest");
const { MongoMemoryReplSet } = require("mongodb-memory-server");
process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "admin-test-secret-at-least-32-characters";
const app = require("../app");
const models = require("../models");
const fixture = require("./fixture");
const { ensureAdmin } = require("../seeds/admin");
let db, f, adminToken, ownerToken, managerToken, plan, subscription, invoice;
const api = (method, path, token = adminToken) => {
  const call = request(app)[method](`/api/v1/admin${path}`);
  return token ? call.set("Authorization", `Bearer ${token}`) : call;
};
const me = async () => (await request(app).get("/api/v1/auth/me")
  .set("Authorization", `Bearer ${ownerToken}`).expect(200)).body.data;
const login = async (username, password) => (await request(app).post("/api/v1/auth/login")
  .send({ username, password }).expect(200)).body.data.token;

before(async () => {
  db = await MongoMemoryReplSet.create({ replSet: { count: 1 }, binary: { version: "7.0.14" } });
  await mongoose.connect(db.getUri(), { dbName: "admin_tests" });
  for (const model of Object.values(models)) await model.init();
  f = await fixture();
  await ensureAdmin();
  adminToken = await login("admin", "admin");
  ownerToken = await login("owner@test.local", "password123");
  managerToken = await login("manager@test.local", "password123");
}, { timeout: 180000 });
after(async () => { await mongoose.disconnect(); if (db) await db.stop(); });

test("admin APIs reject non-admin roles and protect plan quotas", async () => {
  for (const path of ["/plans", "/landlords", "/subscriptions", "/invoices", "/analytics"]) {
    await api("get", path, null).expect(401);
    await api("get", path, ownerToken).expect(403);
    await api("get", path, managerToken).expect(403);
  }
  await api("put", `/plans/${f.plan._id}`).send({ maxRooms: 0 }).expect(422);
  await api("delete", `/plans/${f.plan._id}`).expect(422);
  await api("post", "/plans").send({ name: "Sai giá", code: "INVALID", price: 1.5 }).expect(400);
  plan = (await api("post", "/plans").send({ name: "Gói Admin", code: "ADMIN_PRO", price: 120000,
    billingCycle: "MONTHLY", maxBranches: 10, maxRooms: 100, maxManagers: 10 }).expect(201)).body.data;
  await api("put", `/plans/${plan._id}`).send({ code: "RENAMED" }).expect(400);
});

test("subscription invoices precede activation; quotes survive price edits and confirmation is idempotent", async () => {
  const body = { landlordId: String(f.landlord._id), planId: plan._id,
    startDate: new Date(Date.now() - 3600000).toISOString(), endDate: new Date(Date.now() + 30 * 86400000).toISOString() };
  const created = (await api("post", "/subscriptions").send(body).expect(201)).body.data;
  subscription = created.subscription;
  invoice = created.invoice;
  assert.equal(subscription.status, "PENDING_PAYMENT");
  assert.equal(invoice.status, "PENDING");
  // Until the SaaS invoice is paid the landlord keeps the old plan and sees the upgrade as pending.
  const waiting = await me();
  assert.equal(waiting.subscription.plan.code, "TEST");
  assert.equal(waiting.pendingSubscription.plan.code, "ADMIN_PRO");
  assert.equal(String((await models.User.findById(f.landlord._id)).subscriptionId), String(f.subscription._id));
  await api("post", "/subscriptions").send(body).expect(422);
  await api("put", `/subscriptions/${subscription._id}`).send({ status: "ACTIVE" }).expect(400);
  await api("put", `/plans/${plan._id}`).send({ price: 240000 }).expect(200);
  const payment = { paymentReference: "SAAS-RECEIPT-001", paymentGateway: "BANK_TRANSFER_MANUAL",
    paidAt: new Date().toISOString(), paymentEvidence: "https://example.com/receipt.jpg" };
  const paid = (await api("post", `/invoices/${invoice._id}/paid`).send(payment).expect(200)).body.data;
  assert.equal(paid.invoice.amount, 120000);
  assert.equal(paid.subscription.status, "ACTIVE");
  assert.equal(String((await models.User.findById(f.landlord._id)).subscriptionId), subscription._id);
  const upgraded = await me();
  assert.equal(upgraded.subscriptionPlan, "ADMIN_PRO");
  assert.equal(upgraded.subscription.plan.maxRooms, 100);
  assert.equal(upgraded.pendingSubscription, null);
  const relogged = (await request(app).post("/api/v1/auth/login")
    .send({ username: "owner@test.local", password: "password123" }).expect(200)).body.data.user;
  assert.equal(relogged.subscription.plan.code, "ADMIN_PRO");
  assert.equal((await request(app).get("/api/v1/auth/me").set("Authorization", `Bearer ${managerToken}`)
    .expect(200)).body.data.subscription, undefined);
  assert.equal((await api("post", `/invoices/${invoice._id}/paid`).send(payment).expect(200)).body.data.duplicate, true);
  await api("post", `/invoices/${invoice._id}/paid`).send({ ...payment, paymentReference: "OTHER" }).expect(422);
  const stats = (await api("get", "/analytics").expect(200)).body.data;
  assert.equal(stats.saas.mrr, 120000);
  assert.equal(stats.saas.collectedAmount, 120000);
  assert.equal(await models.AuditLog.countDocuments({ action: "CONFIRM_PLATFORM_PAYMENT", entityId: invoice._id }), 1);
});

test("landlord suspension revokes sessions; platform responses do not expose private financial details", async () => {
  const landlords = (await api("get", "/landlords").expect(200)).body;
  assert.ok(!JSON.stringify(landlords).includes("bankConfig"));
  assert.ok(!JSON.stringify(landlords).includes("password"));
  await api("put", `/landlords/${f.landlord._id}/status`).send({ status: "SUSPENDED", reason: "Kiểm tra phạm vi" }).expect(200);
  await request(app).get("/api/v1/branches").set("Authorization", `Bearer ${ownerToken}`).expect(401);
  await request(app).get("/api/v1/branches").set("Authorization", `Bearer ${managerToken}`).expect(403);
  await api("put", `/landlords/${f.landlord._id}/status`).send({ status: "ACTIVE", reason: "Hoàn tất xử lý" }).expect(200);
  await request(app).get("/api/v1/branches").set("Authorization", `Bearer ${managerToken}`).expect(401);
  assert.equal(await models.AuthSession.countDocuments({ userId: f.landlord._id }), 0);
});
