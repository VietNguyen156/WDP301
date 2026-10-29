// "data:changed" events: after any successful change, every open screen that shows the affected
// data refreshes itself. The payload only names what changed (no records, no amounts), so it can
// go to everyone in the same chain, tenants included.
//
// Rooms (joined in realtime/index.js):
//   scope:<landlordId>  landlord, managers and tenants of one chain
//   admins              SUPER_ADMIN sockets
//   landlords           every landlord socket (platform-wide changes: plans, subscriptions)

const activity = require("./activity");

// Which screens a change to one API resource can affect.
const RELATED = {
  branches: ["branches", "rooms", "dashboard"],
  rooms: ["rooms", "branches", "dashboard"],
  contracts: ["contracts", "rooms", "tenants", "invoices", "dashboard"],
  tenants: ["tenants", "contracts"],
  staff: ["staff"],
  profile: ["profile", "contracts", "invoices"],
  plans: ["plans", "subscription"],
  "utility-readings": ["utility-readings", "invoices", "rooms", "dashboard"],
  incidents: ["incidents", "dashboard"],
  invoices: ["invoices", "payments", "contracts", "dashboard"],
  payments: ["payments", "invoices", "unmatched", "contracts", "dashboard"],
  "bank-hub": ["profile", "payments", "unmatched"],
  admin: ["admin", "plans", "subscription"],
  users: ["admin"],
};
// Requests that change nothing other screens show.
const SKIP = new Set(["auth", "search", "notifications", "dashboard"]);
// A landlord's plan requests and SaaS payments also change what admins see.
const ADMIN_TOO = new Set(["plans", "bank-hub"]);

let emitter = null;
const setEmitter = (emit) => {
  emitter = emit;
};

function changed(rooms, resources) {
  if (!emitter || !rooms.length || !resources.length) return;
  // "notifications" is implied: almost every change moves a count under the bell.
  emitter(rooms, "data:changed", { resources: [...new Set([...resources, "notifications"])], at: Date.now() });
}

const chainOf = (user) => (user.role === "LANDLORD" ? user._id : user.landlordId);

// Express middleware: emit after a successful write made by a signed-in user.
function liveUpdates(req, res, next) {
  if (!["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) return next();
  // Keep the JSON body: new records' ids (for the activity description) are only in the response.
  let body;
  const json = res.json.bind(res);
  res.json = (payload) => {
    body = payload;
    return json(payload);
  };
  res.on("finish", () => {
    const user = req.user;
    if (!user || res.statusCode >= 400) return;
    const pathname = req.originalUrl.replace(/^\/api(\/v1)?\//, "").split("?")[0].replace(/\/+$/, "");
    const resource = pathname.split("/")[0];
    if (!resource || SKIP.has(resource)) return;
    activity
      .fromRequest(req, pathname, body)
      .catch((error) => console.error("Không phát được hoạt động realtime:", error.message));
    const resources = RELATED[resource] || [resource];
    if (user.role === "SUPER_ADMIN") {
      // Admin actions (plans, subscriptions, landlord status) can touch any landlord.
      changed(["admins", "landlords"], resources);
      return;
    }
    const rooms = [`scope:${chainOf(user)}`];
    if (ADMIN_TOO.has(resource)) rooms.push("admins");
    changed(rooms, resources);
  });
  next();
}

// For changes without a signed-in user: bank webhooks, payment gateway IPN, background jobs.
const chainChanged = (landlordId, resources, { admins = false } = {}) =>
  landlordId && changed([`scope:${landlordId}`, ...(admins ? ["admins"] : [])], resources);

module.exports = { liveUpdates, chainChanged, setEmitter, RELATED };
