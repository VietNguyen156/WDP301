const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const mongoose = require("mongoose");
const request = require("supertest");
const { io: connect } = require("socket.io-client");
const { MongoMemoryReplSet } = require("mongodb-memory-server");
process.env.JWT_SECRET = "integration-test-secret-32-characters-minimum";
process.env.NODE_ENV = "test";
const app = require("../app");
const realtime = require("../realtime");
const fixture = require("./fixture");
const M = require("../models");
let db, f, server, url, invoice, tokens = {};
const sockets = [];
before(
  async () => {
    db = await MongoMemoryReplSet.create({ replSet: { count: 1 }, binary: { version: "7.0.14" } });
    await mongoose.connect(db.getUri(), { dbName: "realtime_tests" });
    for (const model of Object.values(mongoose.models)) await model.init();
    f = await fixture();
    await M.User.updateOne({ _id: f.landlord._id }, {
      bankConfig: { bankCode: "MB", accountNumber: "1111222244", accountName: "CHU TRO" },
    });
    server = http.createServer(app);
    realtime.attach(server, app);
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    url = `http://127.0.0.1:${server.address().port}`;
    for (const name of ["owner", "other", "manager"])
      tokens[name] = (await request(app).post("/api/v1/auth/login")
        .send({ email: `${name}@test.local`, password: "password123" }).expect(200)).body.data.token;
    await api("post", "/contracts").send({
      branchId: String(f.branch._id), roomId: String(f.room._id), tenant: { name: "Khách", citizenId: "001234567841" },
      startDate: "2025-01-01", endDate: "2027-12-31", rentalPrice: 3000000, depositAmount: 3000000,
      initialElectricIndex: 100, initialWaterIndex: 10,
    }).expect(201);
    const reading = await api("post", "/utility-readings").send({
      branchId: String(f.branch._id), roomId: String(f.room._id), billingPeriod: "2025-03",
      electricNewIndex: 150, waterNewIndex: 15,
    }).expect(201);
    invoice = (await api("post", `/invoices/${reading.body.data.draftInvoiceId}/issue`).expect(200)).body.data;
  },
  { timeout: 180000 },
);
after(async () => {
  for (const socket of sockets) socket.close();
  realtime.close();
  await new Promise((resolve) => server.close(resolve));
  await mongoose.disconnect();
  if (db) await db.stop();
});
const api = (method, path, user = "owner") =>
  request(app)[method](`/api/v1${path}`).set("Authorization", `Bearer ${tokens[user]}`);

function open(token) {
  const socket = connect(url, { auth: token ? { token } : {}, transports: ["websocket"], reconnection: false });
  sockets.push(socket);
  return socket;
}
const connected = (socket) =>
  new Promise((resolve, reject) => {
    socket.once("connect", resolve);
    socket.once("connect_error", reject);
  });
const emitAck = (socket, event, payload) => new Promise((resolve) => socket.emit(event, payload, resolve));
// Collects every event of a name; `settle` waits a little so "nothing arrived" is meaningful.
function collect(socket, event) {
  const seen = [];
  socket.on(event, (payload) => seen.push(payload));
  return seen;
}
const settle = () => new Promise((resolve) => setTimeout(resolve, 300));

test("sockets authenticate with the access token; bad tokens are refused", async () => {
  await assert.rejects(connected(open("not-a-token")), /AUTH_REQUIRED/);
  await connected(open()); // anonymous: allowed, only for the public invoice page
});

test("payment:success reaches the landlord, the public invoice page and nobody else", async () => {
  const owner = open(tokens.owner);
  const other = open(tokens.other);
  const manager = open(tokens.manager);
  const publicPage = open();
  await Promise.all([owner, other, manager, publicPage].map(connected));
  const stored = await M.Invoice.findById(invoice._id);
  assert.deepEqual(await emitAck(publicPage, "invoice:subscribe_public", { token: "f".repeat(32) }), { ok: false, message: "RESOURCE_NOT_FOUND" });
  assert.equal((await emitAck(publicPage, "invoice:subscribe_public", { token: stored.publicAccessToken })).ok, true);
  assert.equal((await emitAck(other, "invoice:subscribe", { invoiceId: String(invoice._id) })).ok, false);

  const ownerSeen = collect(owner, "payment:success");
  const publicSeen = collect(publicPage, "payment:success");
  const paidSeen = collect(publicPage, "invoice_paid");
  const otherSeen = collect(other, "payment:success");
  const managerSeen = collect(manager, "payment:success");

  // A manager's cash report is only pending: no success event yet.
  await api("post", "/payments/cash", "manager").send({
    invoiceId: invoice._id, amount: 1000, receiptNumber: "PT-RT-0", transactionDate: "2025-03-20",
  }).expect(201);
  await settle();
  assert.equal(ownerSeen.length + publicSeen.length + managerSeen.length, 0);

  await api("post", "/payments/cash").send({
    invoiceId: invoice._id, amount: 1000000, receiptNumber: "PT-RT-1", transactionDate: "2025-03-20",
  }).expect(201);
  await settle();
  assert.equal(ownerSeen.length, 1);
  assert.equal(publicSeen.length, 1);
  assert.equal(managerSeen.length, 1, "the manager of the invoice's branch is told too");
  assert.equal(otherSeen.length, 0);
  assert.deepEqual(Object.keys(publicSeen[0]).sort(), ["invoiceId", "paidAmount", "paymentId", "remainingAmount", "status"]);
  assert.equal(publicSeen[0].status, "PARTIALLY_PAID");
  assert.equal(paidSeen.length, 0);

  await api("post", "/payments/cash").send({
    invoiceId: invoice._id, amount: publicSeen[0].remainingAmount, receiptNumber: "PT-RT-2", transactionDate: "2025-03-21",
  }).expect(201);
  await settle();
  assert.equal(paidSeen.length, 1);
  assert.equal(paidSeen[0].remainingAmount, 0);
});

test("managers hear about new incidents in their own branches only", async () => {
  const manager = open(tokens.manager);
  const owner = open(tokens.owner);
  await Promise.all([manager, owner].map(connected));
  const managerSeen = collect(manager, "incident:created");
  const ownerSeen = collect(owner, "incident:created");
  const hiddenRoom = await M.Room.create({ landlordId: f.landlord._id, branchId: f.hidden._id, roomNumber: "B.1", basePrice: 1 });
  await api("post", "/incidents").send({
    branchId: String(f.hidden._id), roomId: String(hiddenRoom._id), title: "Ngoài phân công", description: "x",
  }).expect(201);
  await api("post", "/incidents").send({
    branchId: String(f.branch._id), roomId: String(f.room._id), title: "Rò nước", description: "Bồn rửa", priority: "HIGH",
  }).expect(201);
  await settle();
  assert.equal(ownerSeen.length, 2);
  assert.equal(managerSeen.length, 1);
  assert.equal(managerSeen[0].title, "Rò nước");
  assert.equal(managerSeen[0].priority, "HIGH");
});
