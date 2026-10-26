const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const request = require("supertest");
const { MongoMemoryReplSet } = require("mongodb-memory-server");
process.env.JWT_SECRET = "integration-test-secret-32-characters-minimum";
process.env.NODE_ENV = "test";
const app = require("../app");
const fixture = require("./fixture");
const M = require("../models");
let db,
  f,
  tokens = {};
before(
  async () => {
    db = await MongoMemoryReplSet.create({
      replSet: { count: 1 },
      binary: { version: "7.0.14" },
    });
    await mongoose.connect(db.getUri(), { dbName: "plans_tests" });
    for (const model of Object.values(mongoose.models)) await model.init();
    f = await fixture();
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
const plans = (user = "owner") =>
  request(app).get("/api/v1/plans").set("Authorization", `Bearer ${tokens[user]}`);

test("only landlords read the plan catalog", async () => {
  await request(app).get("/api/v1/plans").expect(401);
  await plans("manager").expect(403);
  await plans("admin").expect(403);
});

test("catalog lists plans on sale from the DB with usage against the current plan", async () => {
  const trial = await M.SaaSPlan.create({ name: "Dùng thử", code: "FREE_TRIAL", price: 0, maxBranches: 1, maxRooms: 5, maxManagers: 1, trialDays: 14 });
  await M.SaaSPlan.create({ name: "Nhỏ", code: "SMALL", price: 99000, maxBranches: 1, maxRooms: 50, maxManagers: 5 });
  const big = await M.SaaSPlan.create({
    name: "Lớn", code: "BIG", price: 999000, maxBranches: 999, maxRooms: 9999, maxManagers: 99,
    features: ["Đối soát SePay", "Quản lý sự cố"],
  });
  await M.SaaSPlan.create({ name: "Ngừng bán", code: "OLD", price: 1, isActive: false });
  await M.SaaSPlan.create({ name: "Đã xóa", code: "GONE", price: 2, isDeleted: true });
  await M.Subscription.create({
    landlordId: f.landlord._id, planId: big._id, status: "PENDING_PAYMENT",
    endDate: new Date(Date.now() + 30 * 86400000),
  });

  const { data } = (await plans().expect(200)).body;
  // Sorted by price, then creation (the fixture plan TEST is also free).
  assert.deepEqual(data.items.map((p) => p.code), ["TEST", "FREE_TRIAL", "SMALL", "BIG"]);
  assert.equal(data.current.plan.code, "TEST");
  assert.equal(data.pending.plan.code, "BIG");
  // Fixture: 2 branches, 1 room, 1 manager on a 5/30/2 plan.
  assert.deepEqual(data.usage, {
    branches: { used: 2, limit: 5 },
    rooms: { used: 1, limit: 30 },
    managers: { used: 1, limit: 2 },
  });
  const byCode = Object.fromEntries(data.items.map((p) => [p.code, p]));
  assert.equal(byCode.TEST.isCurrent, true);
  assert.equal(byCode.BIG.isPending, true);
  assert.deepEqual(byCode.BIG.features, ["Đối soát SePay", "Quản lý sự cố"]);
  assert.equal(byCode.BIG.selectable, true);
  assert.deepEqual(byCode.SMALL.blockedBy, ["maxBranches"]);
  assert.equal(byCode.SMALL.selectable, false);
  assert.equal(byCode.FREE_TRIAL.selectable, false);
  assert.equal(byCode.FREE_TRIAL.trialDays, 14);
  assert.equal(byCode.TEST.trialDays, undefined);
  assert.ok(!JSON.stringify(data).includes("mutationVersion"));
  assert.equal(String(byCode.FREE_TRIAL.id), String(trial._id));
});

test("a landlord without an active subscription sees no limits", async () => {
  const { data } = (await plans("other").expect(200)).body;
  assert.equal(data.current, null);
  assert.equal(data.pending, null);
  assert.deepEqual(data.usage.branches, { used: 1, limit: null });
  assert.ok(data.items.every((p) => !p.isCurrent));
});
