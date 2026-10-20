const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const request = require("supertest");
const { MongoMemoryReplSet } = require("mongodb-memory-server");
process.env.JWT_SECRET = "integration-test-secret-32-characters-minimum";
process.env.NODE_ENV = "test";
const app = require("../app");
const fixture = require("./fixture");
const User = require("../models/User");
const Room = require("../models/Room");
const Branch = require("../models/Branch");
const Contract = require("../models/Contract");
const Invoice = require("../models/Invoice");
const AuditLog = require("../models/AuditLog");
const quota = require("../services/quotaService");
let db,
  f,
  tokens = {};
before(
  async () => {
    db = await MongoMemoryReplSet.create({
      replSet: { count: 1 },
      binary: { version: "7.0.14" },
    });
    await mongoose.connect(db.getUri(), { dbName: "property_core_tests" });
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
const contractBody = (roomId, suffix = "a") => ({
  branchId: String(f.branch._id),
  roomId: String(roomId),
  tenant: {
    name: "Khách kiểm thử",
    email: `tenant-${suffix}@test.local`,
    phoneNumber: suffix === "a" ? "0912345678" : "0912345679",
    citizenId: "001234567890",
  },
  startDate: "2026-01-01",
  endDate: "2027-12-31",
  rentalPrice: 3000000,
  depositAmount: 3000000,
  depositStatus: "PAID",
  initialElectricIndex: 100,
  initialWaterIndex: 10,
  roommates: [],
});
test("authentication contract, refresh, logout and invalid credentials", async () => {
  await request(app).get("/api/v1/branches").expect(401);
  await request(app)
    .post("/api/v1/auth/login")
    .send({ email: "owner@test.local", password: "wrong" })
    .expect(401);
  const agent = request.agent(app);
  const login = await agent
    .post("/api/v1/auth/login")
    .send({ email: "owner@test.local", password: "password123" })
    .expect(200);
  assert.ok(login.headers["set-cookie"][0].includes("HttpOnly"));
  assert.equal(login.body.data.user.role, "LANDLORD");
  assert.equal(login.body.data.user.password, undefined);
  await agent.post("/api/v1/auth/refresh").expect(200);
  await agent.post("/api/v1/auth/logout").expect(200);
  await agent.post("/api/v1/auth/refresh").expect(401);
  await api("get", "/auth/me").expect(200);
  await request(app).get("/api/users").expect(401);
  await api("get", "/branches")
    .set("x-landlord-id", String(f.other._id))
    .expect(403);
});
test("tenant and branch isolation, manager read access and forbidden writes", async () => {
  const result = await api("get", "/branches", "manager").expect(200);
  assert.equal(result.body.data.items.length, 1);
  assert.equal(result.body.data.items[0]._id, String(f.branch._id));
  await api("get", `/branches/${f.hidden._id}`, "manager").expect(403);
  await api("get", `/branches/${f.foreign._id}`).expect(404);
  await api("get", `/rooms/${f.room._id}`, "other").expect(404);
  await api("post", "/branches", "manager")
    .send({ name: "Denied" })
    .expect(403);
  await api("get", "/branches", "admin").expect(403);
  await api("get", "/contracts", "manager").expect(403);
  await api("put", `/rooms/${f.room._id}`, "manager")
    .send({ basePrice: 1 })
    .expect(400);
  await api("put", `/rooms/${f.room._id}`, "manager")
    .send({ status: "CLEANING" })
    .expect(200);
  await api("put", `/rooms/${f.room._id}`, "manager")
    .send({ status: "EMPTY" })
    .expect(200);
  await api("get", "/rooms/invalid").expect(400);
  await api("post", "/branches")
    .send({ name: "Injected", landlordId: String(f.other._id) })
    .expect(400);
});
test("branch CRUD, pricing audit, soft delete and validation", async () => {
  const created = await api("post", "/branches")
    .send({ name: "Cơ sở mới", totalFloors: 2 })
    .expect(201);
  const id = created.body.data._id;
  await api("put", `/branches/${id}`)
    .send({ defaultElectricityPrice: 4000 })
    .expect(200);
  assert.equal(
    await AuditLog.countDocuments({
      entityId: id,
      action: "UPDATE_BRANCH_PRICING",
    }),
    1,
  );
  await api("delete", `/branches/${id}`).expect(200);
  await api("get", `/branches/${id}`).expect(404);
  assert.equal((await Branch.findById(id)).isDeleted, true);
  await api("delete", `/branches/${f.branch._id}`).expect(422);
  await api("post", "/branches")
    .send({ name: "Invalid", defaultWaterPrice: 0.1 })
    .expect(400);
});
test("bulk creation all-or-nothing, pagination and room quota", async () => {
  const input = {
    fromFloor: 1,
    toFloor: 4,
    fromRoomNumber: 101,
    toRoomNumber: 105,
    prefix: "P.",
    basePrice: 2500000,
  };
  const result = await api("post", `/branches/${f.branch._id}/rooms/bulk`)
    .send(input)
    .expect(201);
  assert.equal(result.body.data.count, 20);
  await api("post", `/branches/${f.branch._id}/rooms/bulk`)
    .send({ ...input, toFloor: 1, fromRoomNumber: 100, toRoomNumber: 101 })
    .expect(409);
  assert.equal(await Room.countDocuments({ branchId: f.branch._id }), 21);
  const listing = await api(
    "get",
    `/branches/${f.branch._id}/rooms?limit=5&page=2`,
  ).expect(200);
  assert.equal(listing.body.data.items.length, 5);
  assert.equal(listing.body.data.total, 21);
  const denied = await api("post", `/branches/${f.branch._id}/rooms/bulk`)
    .send({ ...input, prefix: "Q." })
    .expect(422);
  assert.equal(denied.body.errorCode, "QUOTA_EXCEEDED");
  assert.equal(await Room.countDocuments({ branchId: f.branch._id }), 21);
});
test("concurrent contracts reserve room once and roll back duplicate tenant writes", async () => {
  const responses = await Promise.all([
    api("post", "/contracts").send(contractBody(f.room._id, "a")),
    api("post", "/contracts").send(contractBody(f.room._id, "b")),
  ]);
  assert.deepEqual(responses.map((r) => r.status).sort(), [201, 422]);
  const room = await Room.findById(f.room._id);
  assert.equal(room.status, "RENTED");
  assert.ok(room.currentContractId);
  assert.equal(await Contract.countDocuments({ roomId: f.room._id }), 1);
  assert.equal(await User.countDocuments({ role: "TENANT" }), 1);
  await api("delete", `/rooms/${f.room._id}`).expect(422);
  await api("put", `/rooms/${f.room._id}`)
    .send({ status: "EMPTY" })
    .expect(422);
  await api("put", `/rooms/${f.room._id}`, "manager")
    .send({ status: "EMPTY" })
    .expect(422);
  const contract = await Contract.findById(room.currentContractId);
  const tenant = await User.findById(contract.tenantId);
  assert.equal(tenant.status, "ACTIVE");
  assert.equal(tenant.mustChangePassword, true);
  const credentials = responses.find((r) => r.status === 201).body.data.tenantCredentials;
  assert.equal(credentials.username, tenant.citizenId);
  const firstLogin = await request(app).post("/api/v1/auth/login")
    .send({ username: credentials.username, password: credentials.temporaryPassword }).expect(200);
  const restrictedToken = firstLogin.body.data.token;
  const restricted = await request(app).get("/api/v1/contracts")
    .set("Authorization", `Bearer ${restrictedToken}`).expect(403);
  assert.equal(restricted.body.errorCode, "PASSWORD_CHANGE_REQUIRED");
  await request(app).post("/api/v1/auth/change-password")
    .set("Authorization", `Bearer ${restrictedToken}`)
    .send({ currentPassword: credentials.temporaryPassword, newPassword: "tenant-test-password" }).expect(200);
  const logged = await request(app)
    .post("/api/v1/auth/login")
    .send({ email: tenant.email, password: "tenant-test-password" })
    .expect(200);
  tokens.tenant = logged.body.data.token;
  const mine = await api("get", "/contracts", "tenant").expect(200);
  assert.equal(mine.body.data.total, 1);
  await api("get", "/branches", "tenant").expect(403);
  await api("get", `/contracts/${contract._id}`, "other").expect(404);
});
test("termination applies deposit to outstanding invoices and preserves their payments atomically", async () => {
  const contract = await Contract.findOne({ roomId: f.room._id });
  const now = new Date();
  contract.startDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  await contract.save();
  const body = {
    actualEndDate: new Date().toISOString(),
    finalElectricIndex: 110,
    finalWaterIndex: 11,
    deductions: [],
    electricImage: "https://example.com/electric.jpg",
    waterImage: "https://example.com/water.jpg",
    confirmedByBothParties: true,
  };
  await api("post", `/contracts/${contract._id}/terminate`)
    .send({ ...body, finalElectricIndex: 99 })
    .expect(422);
  const invoice = await Invoice.create({
    landlordId: f.landlord._id,
    branchId: f.branch._id,
    roomId: f.room._id,
    contractId: contract._id,
    tenantId: contract.tenantId,
    invoiceCode: "TEST-OPEN",
    month: now.getUTCMonth() + 1,
    year: now.getUTCFullYear(),
    dueDate: new Date(),
    status: "ISSUED",
    totalAmount: 10,
    remainingAmount: 10,
  });
  const response = await api("post", `/contracts/${contract._id}/terminate`)
    .send(body)
    .expect(200);
  assert.equal(response.body.data.status, "TERMINATED");
  assert.equal(response.body.data.refundedDepositAmount, 2934990);
  const credited = await Invoice.findById(invoice._id);
  assert.equal(credited.status, "PAID");
  assert.equal(credited.depositAppliedAmount, 10);
  assert.equal(await mongoose.models.Payment.countDocuments({ invoiceId: invoice._id, paymentMethod: "DEPOSIT" }), 1);
  const room = await Room.findById(f.room._id);
  assert.equal(room.status, "CLEANING");
  assert.equal(room.currentContractId, undefined);
  assert.equal(
    await AuditLog.countDocuments({
      action: "SETTLE_CONTRACT",
      entityId: contract._id,
    }),
    1,
  );
  await api("post", `/contracts/${contract._id}/terminate`)
    .send(body)
    .expect(422);
});
test("prepared settlement survives a shortfall, accepts real payments, and never applies deposit twice", async () => {
  const room = await Room.create({ landlordId: f.landlord._id, branchId: f.branch._id,
    roomNumber: "SETTLEMENT.01", basePrice: 3100000, maxOccupants: 3 });
  const startDate = new Date().toISOString().slice(0, 10);
  const endDate = new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10);
  const created = await api("post", "/contracts").send({
    branchId: String(f.branch._id), roomId: String(room._id),
    tenant: { name: "Khách quyết toán", citizenId: "001234567899" },
    startDate, endDate, rentalPrice: 3100000, depositAmount: 1000, depositStatus: "PAID",
    initialElectricIndex: 0, initialWaterIndex: 0,
    roommates: [{ fullName: "Người ở cùng" }],
  }).expect(201);
  const id = created.body.data._id;
  await api("put", `/rooms/${room._id}`).send({ maxOccupants: 1 }).expect(422);
  const body = { actualEndDate: startDate, finalElectricIndex: 10, finalWaterIndex: 0,
    electricImage: "https://example.com/e.jpg", waterImage: "https://example.com/w.jpg",
    deductions: [], confirmedByBothParties: true };
  await api("post", `/contracts/${id}/settlement`, "other").send(body).expect(404);
  const prepared = await api("post", `/contracts/${id}/settlement`).send(body).expect(200);
  assert.equal(prepared.body.data.settlement.state, "PREPARED");
  assert.equal(prepared.body.data.settlement.depositAppliedAmount, 1000);
  assert.ok(prepared.body.data.settlement.remainingDue > 0);
  const invoiceId = prepared.body.data.settlement.invoiceId;
  const repeated = await api("post", `/contracts/${id}/settlement`).send({}).expect(200);
  assert.equal(repeated.body.data.settlement.invoiceId, invoiceId);
  assert.equal(await mongoose.models.Payment.countDocuments({ invoiceId, paymentMethod: "DEPOSIT" }), 1);
  await api("post", `/contracts/${id}/settlement`).send({ ...body, finalElectricIndex: 11 }).expect(422);
  await api("put", `/rooms/${room._id}`).send({ notes: "Không sửa khi đã chốt" }).expect(422);
  const denied = await api("post", `/contracts/${id}/terminate`).send({}).expect(422);
  assert.equal(denied.body.errorCode, "SETTLEMENT_BALANCE_DUE");
  assert.equal((await Room.findById(room._id)).status, "RENTED");
  await api("post", "/payments/cash").send({ invoiceId,
    amount: prepared.body.data.settlement.remainingDue, receiptNumber: "SETTLEMENT-RECEIPT-01",
    transactionDate: new Date().toISOString(), payerName: "Khách quyết toán" }).expect(201);
  assert.equal((await api("get", `/contracts/${id}`).expect(200)).body.data.settlement.remainingDue, 0);
  const terminated = await api("post", `/contracts/${id}/terminate`).send({}).expect(200);
  assert.equal(terminated.body.data.status, "TERMINATED");
  assert.equal(terminated.body.data.depositStatus, "APPLIED");
  assert.equal((await Room.findById(room._id)).status, "CLEANING");
  assert.equal(await Invoice.countDocuments({ contractId: id, invoiceType: "SETTLEMENT" }), 1);
});

test("manager cannot reopen an inactive room", async () => {
  const room = await Room.create({ landlordId: f.landlord._id, branchId: f.branch._id,
    roomNumber: "INACTIVE.01", status: "INACTIVE" });
  const denied = await api("put", `/rooms/${room._id}`, "manager").send({ status: "EMPTY" }).expect(422);
  assert.equal(denied.body.errorCode, "ROOM_INACTIVE");
});

test("manager quota interface requires same transaction and excludes deleted staff", async () => {
  await assert.rejects(
    quota.guard({ landlordId: f.landlord._id, resource: "manager" }),
    { errorCode: "BUSINESS_RULE_ERROR" },
  );
  const result = await mongoose.connection.transaction((session) =>
    quota.guard({ landlordId: f.landlord._id, resource: "manager", session }),
  );
  assert.equal(result.used, 1);
  assert.equal(result.limit, 2);
});
test("quota prevents two concurrent creates exceeding plan limit and denies expired subscription", async () => {
  f.plan.maxBranches =
    (await Branch.countDocuments({
      landlordId: f.landlord._id,
      isDeleted: false,
    })) + 1;
  await f.plan.save();
  const responses = await Promise.all([
    api("post", "/branches").send({ name: "Last slot A" }),
    api("post", "/branches").send({ name: "Last slot B" }),
  ]);
  assert.deepEqual(responses.map((r) => r.status).sort(), [201, 422]);
  f.subscription.endDate = new Date(Date.now() - 1000);
  await f.subscription.save();
  const response = await api("post", `/branches/${f.branch._id}/rooms`)
    .send({ roomNumber: "Expired-plan" })
    .expect(422);
  assert.equal(response.body.errorCode, "QUOTA_EXCEEDED");
});
