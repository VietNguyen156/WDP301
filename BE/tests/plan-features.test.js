const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const request = require("supertest");
const { MongoMemoryReplSet } = require("mongodb-memory-server");
process.env.JWT_SECRET = "integration-test-secret-32-characters-minimum";
process.env.NODE_ENV = "test";
process.env.SEPAY_AUTH_MODE = "apikey";
process.env.SEPAY_API_KEY = "plan-feature-key";
const app = require("../app");
const fixture = require("./fixture");
const { backfillPlanFeatureFlags } = require("../config/migrations");
const M = require("../models");
let db,
  f,
  big,
  tokens = {};
before(
  async () => {
    db = await MongoMemoryReplSet.create({
      replSet: { count: 1 },
      binary: { version: "7.0.14" },
    });
    await mongoose.connect(db.getUri(), { dbName: "plan_feature_tests" });
    for (const model of Object.values(mongoose.models)) await model.init();
    f = await fixture();
    await M.User.updateOne({ _id: f.landlord._id }, {
      bankConfig: { bankCode: "MB", accountNumber: "5555555555", accountName: "CHU TRO" },
    });
    big = await M.SaaSPlan.create({
      name: "Lớn", code: "BIG", price: 999000, maxBranches: 10, maxRooms: 100, maxManagers: 10,
      featureFlags: ["SEPAY_WEBHOOK", "INCIDENTS"],
    });
    for (const name of ["owner", "other", "manager", "admin"])
      tokens[name] = (await request(app).post("/api/v1/auth/login")
        .send({ email: `${name}@test.local`, password: "password123" }).expect(200)).body.data.token;
  },
  { timeout: 180000 },
);
after(async () => {
  await mongoose.disconnect();
  if (db) await db.stop();
});
const api = (method, path, user = "owner") =>
  request(app)[method](`/api/v1${path}`).set("Authorization", `Bearer ${tokens[user]}`);
const incident = (user = "owner") =>
  api("post", "/incidents", user).send({
    branchId: String(f.branch._id), roomId: String(f.room._id), title: "Hỏng đèn", description: "Đèn hành lang",
  });
let webhookId = 1;
const webhook = (referenceCode) =>
  request(app).post("/api/v1/payments/webhook").set("Authorization", "Apikey plan-feature-key").send({
    id: ++webhookId, gateway: "MBBank", transactionDate: "2025-04-02 10:00:00", accountNumber: "5555555555",
    transferType: "in", transferAmount: 5000, referenceCode, content: "HD123456 P101",
  });

test("admins configure feature flags; plans saved before flags keep every feature", async () => {
  await api("put", `/admin/plans/${f.plan._id}`, "admin").send({ featureFlags: ["NOT_A_FEATURE"] }).expect(400);
  // The fixture plan has no flags yet: legacy behaviour, everything allowed.
  await incident().expect(201);
  const me = (await api("get", "/auth/me").expect(200)).body.data;
  assert.deepEqual(me.subscription.plan.featureFlags, ["SEPAY_WEBHOOK", "INCIDENTS"]);
  const saved = await api("put", `/admin/plans/${f.plan._id}`, "admin")
    .send({ featureFlags: ["INCIDENTS", "INCIDENTS"] }).expect(200);
  assert.deepEqual(saved.body.data.featureFlags, ["INCIDENTS"]);
});

test("incidents and SePay auto-matching follow the current plan", async () => {
  await api("put", `/admin/plans/${f.plan._id}`, "admin").send({ featureFlags: [] }).expect(200);
  const blocked = await incident().expect(403);
  assert.equal(blocked.body.errorCode, "FEATURE_NOT_IN_PLAN");
  await incident("manager").expect(403);
  const existing = await M.Incident.findOne({ landlordId: f.landlord._id });
  await api("put", `/incidents/${existing._id}/status`).send({ status: "IN_PROGRESS" }).expect(403);
  // History stays readable after a downgrade.
  assert.equal((await api("get", "/incidents").expect(200)).body.data.total, 1);

  const kept = await webhook("FT-PLAN-1").expect(200);
  assert.equal(kept.body.data.unmatched, true);
  const unmatched = await M.UnmatchedPayment.findById(kept.body.data.unmatchedPaymentId);
  assert.match(unmatched.notes, /chưa bao gồm đối soát SePay/);

  await api("put", `/admin/plans/${f.plan._id}`, "admin").send({ featureFlags: ["INCIDENTS"] }).expect(200);
  await incident().expect(201);
  const catalog = (await api("get", "/plans").expect(200)).body.data;
  assert.deepEqual(catalog.items.find((p) => p.code === "TEST").featureFlags, ["INCIDENTS"]);
  assert.ok(catalog.featureCatalog.SEPAY_WEBHOOK);
});

test("landlords request a plan change and admins approve it into a SaaS invoice", async () => {
  await api("post", "/plans/upgrade-requests", "manager").send({ planId: String(big._id) }).expect(403);
  const small = await M.SaaSPlan.create({ name: "Nhỏ", code: "SMALL", price: 1000, maxBranches: 1, maxRooms: 5, maxManagers: 1 });
  const tooSmall = await api("post", "/plans/upgrade-requests").send({ planId: String(small._id) }).expect(422);
  assert.equal(tooSmall.body.errorCode, "PLAN_QUOTA_BELOW_USAGE");
  const trial = await M.SaaSPlan.create({ name: "Dùng thử", code: "FREE_TRIAL", price: 0 });
  await api("post", "/plans/upgrade-requests").send({ planId: String(trial._id) }).expect(422);

  const sent = await api("post", "/plans/upgrade-requests").send({ planId: String(big._id), note: "Mở thêm cơ sở" }).expect(201);
  assert.equal(sent.body.data.status, "PENDING");
  assert.equal(String(sent.body.data.currentPlanId), String(f.plan._id));
  const twice = await api("post", "/plans/upgrade-requests").send({ planId: String(big._id) }).expect(422);
  assert.equal(twice.body.errorCode, "UPGRADE_REQUEST_PENDING");
  const catalog = (await api("get", "/plans").expect(200)).body.data;
  assert.equal(catalog.upgradeRequest.planId.code, "BIG");
  assert.equal(catalog.items.find((p) => p.code === "BIG").isRequested, true);

  await api("get", "/admin/upgrade-requests", "owner").expect(403);
  const queue = (await api("get", "/admin/upgrade-requests", "admin").expect(200)).body.data;
  assert.equal(queue.total, 1);
  assert.equal(queue.items[0].landlordId.email, "owner@test.local");
  const approved = (await api("post", `/admin/upgrade-requests/${sent.body.data._id}/approve`, "admin").send({}).expect(200)).body.data;
  assert.equal(approved.request.status, "APPROVED");
  assert.equal(approved.subscription.status, "PENDING_PAYMENT");
  assert.equal(approved.invoice.amount, 999000);
  const days = (new Date(approved.subscription.endDate) - new Date(approved.subscription.startDate)) / 86400000;
  assert.ok(days >= 28 && days <= 31);
  await api("post", `/admin/upgrade-requests/${sent.body.data._id}/approve`, "admin").send({}).expect(422);
  const after = (await api("get", "/plans").expect(200)).body.data;
  assert.equal(after.upgradeRequest, null);
  assert.equal(after.pending.plan.code, "BIG");
  // Until the SaaS invoice is paid, a further request is refused.
  const blocked = await api("post", "/plans/upgrade-requests").send({ planId: String(big._id) }).expect(422);
  assert.equal(blocked.body.errorCode, "SUBSCRIPTION_PENDING_EXISTS");
});

test("requests can be rejected with a reason or cancelled by the landlord", async () => {
  const first = await api("post", "/plans/upgrade-requests", "other").send({ planId: String(big._id) }).expect(201);
  await api("post", `/admin/upgrade-requests/${first.body.data._id}/reject`, "admin").send({}).expect(400);
  const rejected = await api("post", `/admin/upgrade-requests/${first.body.data._id}/reject`, "admin")
    .send({ reason: "Vui lòng xác minh thông tin doanh nghiệp" }).expect(200);
  assert.equal(rejected.body.data.status, "REJECTED");
  const second = await api("post", "/plans/upgrade-requests", "other").send({ planId: String(big._id) }).expect(201);
  await api("post", `/plans/upgrade-requests/${second.body.data._id}/cancel`, "owner").expect(404);
  await api("post", `/plans/upgrade-requests/${second.body.data._id}/cancel`, "other").expect(200);
  await api("post", `/plans/upgrade-requests/${second.body.data._id}/cancel`, "other").expect(422);
  const history = (await api("get", "/plans/upgrade-requests", "other").expect(200)).body.data;
  assert.deepEqual(history.items.map((r) => r.status), ["CANCELLED", "REJECTED"]);
  assert.equal(history.items[1].rejectReason, "Vui lòng xác minh thông tin doanh nghiệp");
  assert.ok(await M.AuditLog.exists({ action: "REJECT_PLAN_UPGRADE" }));
});

test("backfill gives standard plans their flags once and leaves others alone", async () => {
  const legacy = mongoose.connection.useDb("plan_feature_legacy").db;
  const plans = legacy.collection("saasplans");
  await plans.insertMany([
    { code: "FREE_TRIAL" }, { code: "STARTER" }, { code: "PRO", featureFlags: ["INCIDENTS"] }, { code: "CUSTOM" },
  ]);
  await backfillPlanFeatureFlags(legacy);
  const byCode = Object.fromEntries((await plans.find().toArray()).map((p) => [p.code, p.featureFlags]));
  assert.deepEqual(byCode, {
    FREE_TRIAL: [], STARTER: ["SEPAY_WEBHOOK"], PRO: ["INCIDENTS"], CUSTOM: undefined,
  });
});
