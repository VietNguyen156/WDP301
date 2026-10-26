const { Server } = require("socket.io");
const mongoose = require("mongoose");
const authService = require("../services/authService");
const Invoice = require("../models/Invoice");
const { invoiceScope } = require("../services/invoiceService");
const { clientUrl } = require("../utils/appUrls");

// Socket rooms (PROJECT_RULES §16):
//   landlord:<landlordId>  revenue and paid invoices, joined automatically by the landlord
//   branch:<branchId>      new incidents, joined automatically by managers of that branch (and the landlord)
//   invoice:<invoiceId>    one invoice's payment status, joined on request (tenant page or public /i/:token)
// Events are only emitted after the MongoDB transaction has committed.
let io = null;

const ack = (callback, payload) => (typeof callback === "function" ? callback(payload) : undefined);
const fail = (callback, message) => ack(callback, { ok: false, message });

function attach(httpServer, app) {
  io = new Server(httpServer, {
    cors: { origin: clientUrl(), credentials: true },
  });
  if (app) app.set("io", io);

  // Anonymous sockets are allowed (public invoice page); a token, when sent, must be valid.
  io.use(async (socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next();
    try {
      const user = await authService.authenticate(token);
      if (user.mustChangePassword) return next(new Error("PASSWORD_CHANGE_REQUIRED"));
      socket.data.user = user;
      next();
    } catch {
      next(new Error("AUTH_REQUIRED"));
    }
  });

  io.on("connection", (socket) => {
    const user = socket.data.user;
    if (user?.role === "LANDLORD") socket.join(`landlord:${user._id}`);
    if (user?.role === "PROPERTY_MANAGER")
      for (const branchId of user.assignedBranches || []) socket.join(`branch:${branchId}`);

    // Signed-in tenant/landlord/manager: only invoices inside their own scope.
    socket.on("invoice:subscribe", async ({ invoiceId } = {}, callback) => {
      if (!user) return fail(callback, "AUTH_REQUIRED");
      if (!mongoose.isObjectIdOrHexString(invoiceId)) return fail(callback, "INVALID_ID");
      try {
        const invoice = await Invoice.exists({ ...invoiceScope({ user }), _id: invoiceId });
        if (!invoice) return fail(callback, "RESOURCE_NOT_FOUND");
        socket.join(`invoice:${invoiceId}`);
        ack(callback, { ok: true, room: `invoice:${invoiceId}` });
      } catch {
        fail(callback, "FORBIDDEN");
      }
    });

    // No-App tenant page: the unguessable public token is the credential, as for GET /invoices/public/:token.
    socket.on("invoice:subscribe_public", async ({ token } = {}, callback) => {
      if (typeof token !== "string" || !/^[a-f\d]{32}$/i.test(token)) return fail(callback, "RESOURCE_NOT_FOUND");
      const invoice = await Invoice.findOne({
        publicAccessToken: token, isDeleted: false, status: { $nin: ["DRAFT", "CANCELLED"] },
      }).select("_id").lean();
      if (!invoice) return fail(callback, "RESOURCE_NOT_FOUND");
      socket.join(`invoice:${invoice._id}`);
      ack(callback, { ok: true, invoiceId: String(invoice._id) });
    });

    socket.on("invoice:unsubscribe", ({ invoiceId } = {}) => {
      if (typeof invoiceId === "string") socket.leave(`invoice:${invoiceId}`);
    });
  });
  return io;
}

// Never let a realtime failure break a request whose data is already committed.
function emit(rooms, event, payload) {
  if (!io) return;
  try {
    io.to(rooms).emit(event, payload);
  } catch (error) {
    console.error("Không phát được sự kiện realtime:", event, error.message);
  }
}

function paymentEvent({ invoice, payment }) {
  // A manager's cash report stays PENDING_CONFIRMATION until the landlord approves it.
  if (!invoice || !payment || payment.status !== "SUCCESS") return;
  const payload = {
    invoiceId: String(invoice._id),
    paymentId: String(payment._id),
    paidAmount: invoice.paidAmount,
    remainingAmount: invoice.remainingAmount,
    status: invoice.status,
  };
  const rooms = [`landlord:${invoice.landlordId}`, `branch:${invoice.branchId}`, `invoice:${invoice._id}`];
  emit(rooms, "payment:success", payload);
  if (["PAID", "OVERPAID"].includes(invoice.status)) emit(rooms, "invoice_paid", payload);
}

function incidentEvent(event, incident) {
  if (!incident) return;
  emit([`landlord:${incident.landlordId}`, `branch:${incident.branchId}`], event, {
    incidentId: String(incident._id),
    branchId: String(incident.branchId),
    roomId: String(incident.roomId),
    title: incident.title,
    priority: incident.priority,
    status: incident.status,
  });
}

const close = () => io?.close();

module.exports = { attach, emit, paymentEvent, incidentEvent, close };
