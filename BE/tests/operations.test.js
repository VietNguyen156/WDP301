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
const Invoice = require("../models/Invoice");
const UtilityReading = require("../models/UtilityReading");
const AuditLog = require("../models/AuditLog");
let db,
  f,
  hiddenRoom,
  tokens = {};
const login = async (body) =>
  (await request(app).post("/api/v1/auth/login").send(body).expect(200)).body
    .data.token;
before(
  async () => {
    db = await MongoMemoryReplSet.create({
      replSet: { count: 1 },
      binary: { version: "7.0.14" },
    });
    await mongoose.connect(db.getUri(), { dbName: "operations_tests" });
    for (const model of Object.values(mongoose.models)) await model.init();
    f = await fixture();
    f.landlord.bankConfig = {
      bankCode: "MB", bankName: "MBBank", accountNumber: "0123456789", accountName: "CHU TRO",
    };
    await f.landlord.save();
    hiddenRoom = await Room.create({
      landlordId: f.landlord._id, branchId: f.hidden._id, roomNumber: "B.201", basePrice: 2500000,
    });
    for (const name of ["owner", "other", "manager"])
      tokens[name] = await login({ email: `${name}@test.local`, password: "password123" });
    const created = await api("post", "/contracts").send({
      branchId: String(f.branch._id),
      roomId: String(f.room._id),
      tenant: { name: "Khách vận hành", email: "tenant-ops@test.local", phoneNumber: "0912345670", citizenId: "001234567891" },
      startDate: "2025-01-01",
      endDate: "2027-12-31",
      rentalPrice: 3000000,
      depositAmount: 3000000,
      depositStatus: "PAID",
      initialElectricIndex: 100,
      initialWaterIndex: 10,
      roommates: [],
    });
    assert.equal(created.status, 201, JSON.stringify(created.body));
    const tenant = await User.findOne({ email: "tenant-ops@test.local" });
    tenant.password = "tenant-test-password";
    tenant.mustChangePassword = false;
    await tenant.save();
    tokens.tenant = await login({ email: "tenant-ops@test.local", password: "tenant-test-password" });
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
const reading = (billingPeriod, electricNewIndex, waterNewIndex, extra = {}) => ({
  branchId: String(f.branch._id),
  roomId: String(f.room._id),
  billingPeriod,
  electricNewIndex,
  waterNewIndex,
  ...extra,
});

test("utility readings enforce scope, monotonic indexes and period order", async () => {
  const sheet = await api("get", `/branches/${f.branch._id}/utility-readings?billingPeriod=2025-03`, "manager").expect(200);
  assert.equal(sheet.body.data.stats.pending, 1);
  assert.equal(sheet.body.data.items[0].previousElectricIndex, 100);
  await api("get", `/branches/${f.hidden._id}/utility-readings`, "manager").expect(403);
  await api("get", `/branches/${f.branch._id}/utility-readings`, "tenant").expect(403);

  const lower = await api("post", "/utility-readings", "manager").send(reading("2025-03", 90, 15)).expect(400);
  assert.equal(lower.body.errorCode, "READING_LOWER_THAN_PREVIOUS");
  await api("post", "/utility-readings", "manager")
    .send({ ...reading("2025-03", 150, 15), branchId: String(f.hidden._id), roomId: String(hiddenRoom._id) })
    .expect(403);
  const future = await api("post", "/utility-readings").send(reading("2099-01", 150, 15)).expect(400);
  assert.equal(future.body.errorCode, "READING_PERIOD_INVALID");
  await api("post", "/utility-readings").send({ ...reading("2025-03", 150, 15), electricImage: "javascript:x" }).expect(400);

  const first = await api("post", "/utility-readings", "manager")
    .send(reading("2025-03", 150, 15, { electricImage: "https://img.test/e.jpg" }))
    .expect(201);
  assert.equal(first.body.data.consumedElectric, 50);
  assert.equal(first.body.data.consumedWater, 5);
  assert.equal(first.body.data.electricImage, "https://img.test/e.jpg");
  assert.equal((await Room.findById(f.room._id)).currentElectricIndex, 150);
  const autoDraft = await Invoice.findById(first.body.data.draftInvoiceId);
  assert.equal(autoDraft.status, "DRAFT");
  assert.equal(autoDraft.billingPeriod, "2025-03");
  assert.equal(autoDraft.electricDetail.consumed, 50);
  const expectedDue = Date.parse(new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 10)) + 5 * 86400000;
  assert.equal(autoDraft.dueDate.getTime(), expectedDue);
  const duplicate = await api("post", "/utility-readings").send(reading("2025-03", 160, 16)).expect(422);
  assert.equal(duplicate.body.errorCode, "READING_ALREADY_EXISTS");
  await api("get", `/utility-readings/${first.body.data._id}`, "other").expect(404);
  await api("get", `/utility-readings/${first.body.data._id}`, "manager").expect(200);

  const cancelled = autoDraft.toObject();
  delete cancelled._id;
  delete cancelled.publicAccessToken;
  await Invoice.create({ ...cancelled, billingPeriod: "2025-04", month: 4, invoiceCode: "HDCANCELLED04", status: "CANCELLED" });
  const april = await api("post", "/utility-readings").send(reading("2025-04", 200, 20)).expect(201);
  // A cancelled invoice of the period no longer blocks a fresh draft.
  const aprilDraft = await Invoice.findById(april.body.data.draftInvoiceId);
  assert.equal(aprilDraft.status, "DRAFT");
  assert.notEqual(aprilDraft.invoiceCode, "HDCANCELLED04");
  assert.equal(april.body.data.draftInvoiceError, null);
  assert.ok(await UtilityReading.exists({ roomId: f.room._id, billingPeriod: "2025-04" }));
  const backfill = await api("post", "/utility-readings").send(reading("2025-02", 120, 12)).expect(422);
  assert.equal(backfill.body.errorCode, "READING_PERIOD_CONFLICT");

  const spike = await api("post", "/utility-readings").send(reading("2025-05", 400, 25)).expect(409);
  assert.equal(spike.body.errorCode, "READING_ABNORMAL_INCREASE");
  assert.equal(spike.body.data.warnings[0].type, "ELECTRIC");
  assert.equal(spike.body.data.warnings[0].average, 50);
  const confirmed = await api("post", "/utility-readings")
    .send(reading("2025-05", 400, 25, { confirmAbnormal: true }))
    .expect(201);
  assert.equal(confirmed.body.data.oldElectricIndex, 200);

  const locked = await api("put", `/utility-readings/${april.body.data._id}`).send({ electricNewIndex: 210 }).expect(422);
  assert.equal(locked.body.errorCode, "READING_PERIOD_CONFLICT");
  const fixed = await api("put", `/utility-readings/${confirmed.body.data._id}`, "manager")
    .send({ electricNewIndex: 260 })
    .expect(200);
  assert.equal(fixed.body.data.consumedElectric, 60);
  assert.equal(fixed.body.data.newWaterIndex, 25);
  assert.ok(await AuditLog.exists({ action: "UPDATE_UTILITY_READING", entityId: fixed.body.data._id }));
});

test("editing a reading refreshes its DRAFT invoice and issuing locks it", async () => {
  const may = await UtilityReading.findOne({ roomId: f.room._id, billingPeriod: "2025-05" });
  assert.equal(await Invoice.countDocuments({ roomId: f.room._id, billingPeriod: "2025-05" }), 1);
  const generated = await api("post", "/invoices/generate")
    .send({ branchId: String(f.branch._id), billingPeriod: "2025-05", dueDate: "2025-06-05" });
  assert.equal(generated.status, 201, JSON.stringify(generated.body));
  const draft = await Invoice.findOne({ roomId: f.room._id, billingPeriod: "2025-05" });
  assert.equal(draft.status, "DRAFT");
  assert.equal(draft.electricDetail.newIndex, 260);

  const edited = await api("put", `/utility-readings/${may._id}`).send({ electricNewIndex: 270 }).expect(200);
  assert.equal(String(edited.body.data.draftInvoiceId), String(draft._id));
  const refreshed = await Invoice.findById(draft._id);
  assert.equal(refreshed.electricDetail.newIndex, 270);
  assert.equal(refreshed.electricDetail.consumed, 70);
  assert.equal(refreshed.dueDate.toISOString().slice(0, 10), "2025-06-05");

  const issued = await api("post", `/invoices/${draft._id}/issue`);
  assert.equal(issued.status, 200, JSON.stringify(issued.body));
  assert.equal((await UtilityReading.findById(may._id)).isBilled, true);
  const billed = await api("put", `/utility-readings/${may._id}`).send({ electricNewIndex: 280 }).expect(409);
  assert.equal(billed.body.errorCode, "READING_ALREADY_BILLED");
  const sheet = await api("get", `/branches/${f.branch._id}/utility-readings?billingPeriod=2025-05`).expect(200);
  assert.equal(sheet.body.data.stats.billed, 1);
});

test("incident lifecycle with tenant reporting, scoped access and cost rules", async () => {
  const created = await api("post", "/incidents", "tenant")
    .send({ title: "Hỏng vòi nước", description: "Vòi bồn rửa bị rò rỉ", images: ["https://img.test/leak.jpg"], priority: "HIGH" })
    .expect(201);
  const id = created.body.data._id;
  assert.equal(created.body.data.status, "PENDING");
  assert.equal(String(created.body.data.roomId), String(f.room._id));
  assert.ok(created.body.data.contractId);

  assert.equal((await api("get", "/incidents", "tenant").expect(200)).body.data.total, 1);
  assert.equal((await api("get", "/incidents", "other").expect(200)).body.data.total, 0);
  const managerList = await api("get", `/incidents?branchId=${f.branch._id}&status=PENDING`, "manager").expect(200);
  assert.equal(managerList.body.data.total, 1);
  assert.equal(managerList.body.data.stats.PENDING, 1);
  assert.equal(managerList.body.data.items[0].roomId.roomNumber, "A.101");
  await api("get", `/incidents/${id}`, "other").expect(404);

  await api("put", `/incidents/${id}/status`, "tenant").send({ status: "IN_PROGRESS" }).expect(403);
  const skip = await api("put", `/incidents/${id}/status`, "manager").send({ status: "SOLVED" }).expect(422);
  assert.equal(skip.body.errorCode, "INCIDENT_INVALID_TRANSITION");
  const started = await api("put", `/incidents/${id}/status`, "manager").send({ status: "IN_PROGRESS" }).expect(200);
  assert.equal(String(started.body.data.assignedTo), String(f.manager._id));

  await api("put", `/incidents/${id}/cost`, "manager").send({ repairCost: 200000, costPayer: "TENANT" }).expect(403);
  await api("put", `/incidents/${id}/cost`).send({ repairCost: 200000, costPayer: "NONE" }).expect(400);
  await api("put", `/incidents/${id}/cost`).send({ repairCost: 200000.5, costPayer: "LANDLORD" }).expect(400);
  const cost = await api("put", `/incidents/${id}/cost`).send({ repairCost: 200000, costPayer: "TENANT" }).expect(200);
  assert.equal(cost.body.data.costPayer, "TENANT");

  const noEvidence = await api("put", `/incidents/${id}/status`, "manager").send({ status: "SOLVED" }).expect(400);
  assert.equal(noEvidence.body.errorCode, "INCIDENT_EVIDENCE_REQUIRED");
  await api("put", `/incidents/${id}/status`, "manager")
    .send({ status: "SOLVED", resolvedImages: ["https://img.test/fixed.jpg"] })
    .expect(200);
  const closed = await api("put", `/incidents/${id}/status`).send({ status: "CLOSED", note: "Đã nghiệm thu" }).expect(200);
  assert.deepEqual(closed.body.data.statusHistory.map((h) => h.status), ["PENDING", "IN_PROGRESS", "SOLVED", "CLOSED"]);
  const lockedCost = await api("put", `/incidents/${id}/cost`).send({ repairCost: 1, costPayer: "LANDLORD" }).expect(422);
  assert.equal(lockedCost.body.errorCode, "INCIDENT_COST_LOCKED");
});

test("incident closing needs cost, rejection needs reason and managers stay in their branches", async () => {
  await api("post", "/incidents", "manager")
    .send({ branchId: String(f.hidden._id), roomId: String(hiddenRoom._id), title: "Mất điện", description: "Cả tầng mất điện" })
    .expect(403);
  const hidden = await api("post", "/incidents")
    .send({ branchId: String(f.hidden._id), roomId: String(hiddenRoom._id), title: "Mất điện", description: "Cả tầng mất điện" })
    .expect(201);
  assert.equal(hidden.body.data.contractId, undefined);
  await api("get", `/incidents/${hidden.body.data._id}`, "manager").expect(404);
  const noReason = await api("put", `/incidents/${hidden.body.data._id}/status`).send({ status: "REJECTED" }).expect(400);
  assert.equal(noReason.body.errorCode, "VALIDATION_ERROR");
  await api("put", `/incidents/${hidden.body.data._id}/status`).send({ status: "REJECTED", note: "Báo trùng" }).expect(200);

  const other = await api("post", "/incidents", "manager")
    .send({ branchId: String(f.branch._id), roomId: String(f.room._id), title: "Kẹt cửa", description: "Cửa phòng khó mở" })
    .expect(201);
  const oid = other.body.data._id;
  await api("put", `/incidents/${oid}/status`).send({ status: "IN_PROGRESS", assignedTo: String(f.other._id) }).expect(400);
  await api("put", `/incidents/${oid}/status`).send({ status: "IN_PROGRESS", assignedTo: String(f.manager._id) }).expect(200);
  await api("put", `/incidents/${oid}/status`).send({ status: "SOLVED", resolvedImages: ["https://img.test/door.jpg"] }).expect(200);
  const noCost = await api("put", `/incidents/${oid}/status`).send({ status: "CLOSED" }).expect(422);
  assert.equal(noCost.body.errorCode, "INCIDENT_COST_REQUIRED");
  await api("put", `/incidents/${oid}/cost`, "manager").send({ repairCost: 0, costPayer: "NONE" }).expect(200);
  await api("put", `/incidents/${oid}/status`).send({ status: "CLOSED" }).expect(200);
  assert.equal((await api("get", "/incidents?status=CLOSED", "tenant").expect(200)).body.data.total, 2);
});
