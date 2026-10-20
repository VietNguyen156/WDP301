const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const request = require("supertest");
const jwt = require("jsonwebtoken");
const { MongoMemoryReplSet } = require("mongodb-memory-server");
process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "auth-test-secret-at-least-32-characters";
const app = require("../app");
const models = require("../models");
const fixture = require("./fixture");
let db, f, ownerToken, otherToken, adminToken, manager, tenant;
const endpoint = (method, path, token) => {
  const call = request(app)[method](`/api/v1${path}`);
  return token ? call.set("Authorization", `Bearer ${token}`) : call;
};
const login = (username, password) => endpoint("post", "/auth/login").send({ username, password });

before(async () => {
  db = await MongoMemoryReplSet.create({ replSet: { count: 1 }, binary: { version: "7.0.14" } });
  await mongoose.connect(db.getUri(), { dbName: "auth_tests" });
  for (const model of Object.values(models)) await model.init();
  f = await fixture();
  ownerToken = (await login("owner@test.local", "password123").expect(200)).body.data.token;
  otherToken = (await login("other@test.local", "password123").expect(200)).body.data.token;
  adminToken = (await login("admin@test.local", "password123").expect(200)).body.data.token;
}, { timeout: 180000 });

after(async () => {
  await mongoose.disconnect();
  if (db) await db.stop();
});

test("registration is landlord-only, active immediately, with trial quota and no credential leakage", async () => {
  const body = { name: "Chủ trọ mới", email: "NEW@test.local", password: "landlord-password", phoneNumber: "0901234567" };
  for (const role of ["SUPER_ADMIN", "PROPERTY_MANAGER", "TENANT"])
    await endpoint("post", "/auth/register").send({ ...body, role }).expect(403);
  await endpoint("post", "/auth/register").send({ ...body, landlordId: String(f.other._id) }).expect(400);
  const registered = await endpoint("post", "/auth/register").send(body).expect(201);
  assert.equal(registered.body.data.user.role, "LANDLORD");
  assert.equal(registered.body.data.user.status, "ACTIVE");
  assert.equal(registered.body.data.user.username, "new@test.local");
  assert.equal(registered.body.data.user.password, undefined);
  await endpoint("post", "/auth/register").send(body).expect(409);
  const logged = await login("new@test.local", body.password).expect(200);
  const stored = await models.User.findById(registered.body.data.user.id).select("+password");
  assert.ok(stored.subscriptionId);
  assert.notEqual(stored.password, body.password);
  assert.equal(stored.toJSON().password, undefined);
  await endpoint("get", "/branches", logged.body.data.token).expect(200);
});

test("only landlord can provision manager, with owned branches and quota", async () => {
  const body = { name: "Quản lý mới", phoneNumber: "+84 912 345 678", assignedBranches: [String(f.branch._id)] };
  await endpoint("post", "/staff").send(body).expect(401);
  await endpoint("post", "/staff", adminToken).send(body).expect(403);
  await endpoint("post", "/staff", ownerToken).send({ ...body, landlordId: String(f.other._id) }).expect(400);
  await endpoint("post", "/staff", ownerToken).send({ ...body, assignedBranches: [String(f.foreign._id)] }).expect(400);
  const created = await endpoint("post", "/staff", ownerToken).send(body).expect(201);
  manager = created.body.data;
  assert.equal(manager.credentials.username, "0912345678");
  assert.equal(manager.user.landlordId, String(f.landlord._id));
  assert.equal(manager.user.mustChangePassword, true);
  assert.equal(manager.user.password, undefined);
  assert.ok(manager.credentials.temporaryPassword.length >= 16);
  assert.match(created.headers["cache-control"], /no-store/);
  const quota = await endpoint("post", "/staff", ownerToken).send({ ...body, phoneNumber: "0912345679" }).expect(422);
  assert.equal(quota.body.errorCode, "QUOTA_EXCEEDED");
});

test("temporary password cannot access any business API; password change revokes old sessions", async () => {
  const first = await login(manager.credentials.username, manager.credentials.temporaryPassword).expect(200);
  const token = first.body.data.token;
  for (const path of ["/branches", "/invoices", "/payments", "/staff", "/tenants"])
    assert.equal((await endpoint("get", path, token).expect(403)).body.errorCode, "PASSWORD_CHANGE_REQUIRED");
  assert.equal((await endpoint("get", "/auth/me", token).expect(200)).body.data.mustChangePassword, true);
  await endpoint("post", "/auth/change-password", token)
    .send({ currentPassword: "wrong-password", newPassword: "manager-new-password" }).expect(400);
  await endpoint("post", "/auth/change-password", token)
    .send({ currentPassword: manager.credentials.temporaryPassword, newPassword: manager.credentials.temporaryPassword }).expect(400);
  const changed = await endpoint("post", "/auth/change-password", token)
    .send({ currentPassword: manager.credentials.temporaryPassword, newPassword: "manager-new-password" }).expect(200);
  assert.equal(changed.body.data.requiresLogin, true);
  await endpoint("get", "/auth/me", token).expect(401);
  const previousRefreshCookie = first.headers["set-cookie"].find((cookie) => cookie.includes("Max-Age="));
  assert.ok(previousRefreshCookie);
  await request(app).post("/api/v1/auth/refresh").set("Cookie", previousRefreshCookie.split(";")[0]).expect(401);
  await login(manager.credentials.username, manager.credentials.temporaryPassword).expect(401);
  const second = await login(manager.credentials.username, "manager-new-password").expect(200);
  manager.token = second.body.data.token;
  const branches = await endpoint("get", "/branches", manager.token).expect(200);
  assert.equal(branches.body.data.items.length, 1);
  assert.equal(branches.body.data.items[0]._id, String(f.branch._id));
  await endpoint("post", "/staff", manager.token).send({}).expect(403);
});

test("contract provisions tenant by CCCD without email; standalone creation and foreign reset are rejected", async () => {
  const body = { name: "Khách thuê mới", citizenId: "001234567891" };
  await endpoint("post", "/tenants", ownerToken).send(body).expect(404);
  assert.equal(await models.User.countDocuments({ username: body.citizenId }), 0);
  const created = await endpoint("post", "/contracts", ownerToken).send({
    branchId: String(f.branch._id), roomId: String(f.room._id), tenant: body,
    startDate: "2026-01-01", endDate: "2027-12-31", rentalPrice: 3000000,
    depositAmount: 3000000, initialElectricIndex: 100, initialWaterIndex: 10,
  }).expect(201);
  tenant = {
    user: { ...created.body.data.tenantId, id: created.body.data.tenantId._id },
    credentials: created.body.data.tenantCredentials,
  };
  assert.equal(tenant.credentials.username, body.citizenId);
  assert.equal(tenant.user.email, undefined);
  await endpoint("post", `/tenants/${tenant.user.id}/reset-password`, otherToken).send({}).expect(404);
  const logged = await login(tenant.credentials.username, tenant.credentials.temporaryPassword).expect(200);
  tenant.token = logged.body.data.token;
  const denied = await endpoint("get", "/invoices", tenant.token).expect(403);
  assert.equal(denied.body.errorCode, "PASSWORD_CHANGE_REQUIRED");
  await endpoint("post", "/auth/change-password", tenant.token)
    .send({ currentPassword: tenant.credentials.temporaryPassword, newPassword: "tenant-new-password" }).expect(200);
  tenant.token = (await login(tenant.credentials.username, "tenant-new-password").expect(200)).body.data.token;
  await endpoint("get", "/invoices", tenant.token).expect(200);
  await endpoint("get", "/tenants", tenant.token).expect(403);
});

test("landlord suspension blocks both auth middleware paths and legacy user writes are closed", async () => {
  await models.User.updateOne({ _id: f.landlord._id }, { $set: { status: "SUSPENDED" } });
  try {
    await endpoint("get", "/contracts", tenant.token).expect(403);
    await endpoint("get", "/invoices", tenant.token).expect(403);
    await endpoint("get", "/payments", tenant.token).expect(403);
    await endpoint("get", "/branches", manager.token).expect(403);
  } finally {
    await models.User.updateOne({ _id: f.landlord._id }, { $set: { status: "ACTIVE" } });
  }
  await endpoint("post", "/users", adminToken).send({ role: "SUPER_ADMIN" }).expect(404);
  await endpoint("put", `/users/${tenant.user.id}`, adminToken).send({ password: "plain-password" }).expect(404);
  await endpoint("delete", `/users/${tenant.user.id}`, adminToken).expect(404);
  const users = await endpoint("get", "/users", adminToken).expect(200);
  assert.ok(users.body.data.items.every((user) => !user.password && !user.bankConfig));
});

test("password reset is landlord-scoped, revokes tokens, and excludes credentials from audit/list", async () => {
  const reset = await endpoint("post", `/tenants/${tenant.user.id}/reset-password`, ownerToken).send({}).expect(200);
  assert.notEqual(reset.body.data.credentials.temporaryPassword, tenant.credentials.temporaryPassword);
  await endpoint("get", "/invoices", tenant.token).expect(401);
  const logged = await login(tenant.credentials.username, reset.body.data.credentials.temporaryPassword).expect(200);
  assert.equal(logged.body.data.user.mustChangePassword, true);
  const list = await endpoint("get", "/tenants", ownerToken).expect(200);
  const logs = await models.AuditLog.find({ entityId: tenant.user.id }).lean();
  for (const content of [JSON.stringify(list.body), JSON.stringify(logs)]) {
    assert.ok(!content.includes(reset.body.data.credentials.temporaryPassword));
    assert.ok(!content.includes(tenant.credentials.temporaryPassword));
  }
});

test("alias cookie supports refresh/logout and JWT validation is consistent", async () => {
  const agent = request.agent(app);
  const logged = await agent.post("/api/auth/login").send({ username: "admin@test.local", password: "password123" }).expect(200);
  const token = logged.body.data.token;
  assert.ok(logged.headers["set-cookie"].some((cookie) => /Path=\/api;/.test(cookie) && cookie.includes("HttpOnly")));
  await agent.post("/api/auth/refresh").expect(200);
  const decoded = jwt.decode(token);
  const wrongAudience = jwt.sign({ sub: decoded.sub, sid: decoded.sid, version: decoded.version }, process.env.JWT_SECRET,
    { expiresIn: "15m", issuer: "wdp301", audience: "other-app" });
  for (const path of ["/auth/me", "/invoices", "/users"])
    await endpoint("get", path, wrongAudience).expect(401);
  await agent.post("/api/auth/logout").expect(200);
  await agent.post("/api/auth/refresh").expect(401);
  await endpoint("get", "/auth/me", token).expect(401);
  await endpoint("post", "/auth/otp/request").send({}).expect(410);
});
