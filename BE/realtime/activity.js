// "activity" events: who did what, in which room / branch, on which contract or invoice.
// Unlike "data:changed" these carry names and codes, so they only go to people allowed to see
// them: the landlord (landlord:<id>), managers of that branch (branch:<id>), the tenant concerned
// (user:<id>) and, for SaaS matters, admins.
const {
  Branch,
  Room,
  Contract,
  Invoice,
  Payment,
  Incident,
  UtilityReading,
  User,
  PlatformInvoice,
} = require("../models");
const PlanUpgradeRequest = require("../models/PlanUpgradeRequest");

const ROLE_LABELS = {
  LANDLORD: "Chủ trọ",
  PROPERTY_MANAGER: "Quản lý",
  TENANT: "Khách thuê",
  SUPER_ADMIN: "Quản trị",
  SYSTEM: "Hệ thống",
};

// [method, path (after /api/v1/), what happened, entity kind, where the entity id comes from]
// id: "param" = first capture group, "response" = data._id of the response, "body:<field>".
const ACTIONS = [
  ["POST", /^branches$/, "tạo cơ sở mới", "branch", "response"],
  ["PUT", /^branches\/(\w+)$/, "cập nhật thông tin cơ sở", "branch", "param"],
  ["DELETE", /^branches\/(\w+)$/, "xóa cơ sở", "branch", "param"],
  ["POST", /^branches\/(\w+)\/rooms$/, "thêm phòng mới", "room", "response"],
  ["POST", /^branches\/(\w+)\/rooms\/bulk$/, "thêm nhiều phòng", "branch", "param"],
  ["PUT", /^rooms\/(\w+)$/, "cập nhật phòng", "room", "param"],
  ["DELETE", /^rooms\/(\w+)$/, "xóa phòng", "room", "param"],
  ["POST", /^contracts$/, "lập hợp đồng mới", "contract", "response"],
  ["POST", /^contracts\/(\w+)\/settlement$/, "lập phiếu quyết toán hợp đồng", "contract", "param"],
  ["POST", /^contracts\/(\w+)\/terminate$/, "thanh lý hợp đồng", "contract", "param"],
  ["POST", /^contracts\/(\w+)\/renew$/, "gia hạn hợp đồng", "contract", "param"],
  ["POST", /^contracts\/(\w+)\/confirm\/(landlord|tenant)$/, "xác nhận hợp đồng điện tử", "contract", "param"],
  ["POST", /^contracts\/(\w+)\/deposit\/received$/, "xác nhận đã nhận tiền cọc", "contract", "param"],
  ["POST", /^incidents$/, "báo sự cố", "incident", "response"],
  ["PUT", /^incidents\/(\w+)\/status$/, "cập nhật trạng thái sự cố", "incident", "param"],
  ["PUT", /^incidents\/(\w+)\/cost$/, "ghi chi phí sửa chữa", "incident", "param"],
  ["POST", /^incidents\/(\w+)\/triage$/, "phân loại lại sự cố", "incident", "param"],
  ["POST", /^invoices\/generate$/, "tạo hóa đơn nháp", "branch", "body:branchId"],
  ["POST", /^invoices\/(\w+)\/issue$/, "phát hành hóa đơn", "invoice", "param"],
  ["POST", /^invoices\/(\w+)\/cancel$/, "hủy hóa đơn", "invoice", "param"],
  ["POST", /^payments\/cash$/, "ghi nhận thu tiền mặt", "invoice", "body:invoiceId"],
  ["POST", /^payments\/cash\/(\w+)\/confirm$/, "duyệt phiếu thu tiền mặt", "payment", "param"],
  ["POST", /^payments\/cash\/(\w+)\/reject$/, "từ chối phiếu thu tiền mặt", "payment", "param"],
  ["POST", /^payments\/unmatched\/(\w+)\/resolve$/, "gán giao dịch chưa khớp vào hóa đơn", "invoice", "body:invoiceId"],
  ["POST", /^utility-readings$/, "chốt số điện nước", "reading", "response"],
  ["PUT", /^utility-readings\/(\w+)$/, "sửa chỉ số điện nước", "reading", "param"],
  ["POST", /^staff$/, "thêm nhân viên quản lý", null, null],
  ["POST", /^plans\/upgrade-requests$/, "gửi yêu cầu đổi gói", "upgrade", "response"],
  ["POST", /^plans\/upgrade-requests\/(\w+)\/cancel$/, "hủy yêu cầu đổi gói", "upgrade", "param"],
  ["POST", /^admin\/upgrade-requests\/(\w+)\/approve$/, "duyệt yêu cầu đổi gói", "upgrade", "param"],
  ["POST", /^admin\/upgrade-requests\/(\w+)\/reject$/, "từ chối yêu cầu đổi gói", "upgrade", "param"],
  ["PUT", /^admin\/landlords\/(\w+)\/status$/, "đổi trạng thái tài khoản chủ trọ", "landlord", "param"],
  ["POST", /^admin\/invoices\/(\w+)\/paid$/, "xác nhận thanh toán gói dịch vụ", "platformInvoice", "param"],
];

const name = (doc) => doc?.name || doc?.email || undefined;

// Who / where for one entity. Soft-deleted records are still described (e.g. "xóa phòng").
const DESCRIBE = {
  async branch(id) {
    const b = await Branch.findById(id).select("name landlordId").lean();
    return b && { landlordId: b.landlordId, branchId: b._id, branchName: b.name, link: "/branches" };
  },
  async room(id) {
    const r = await Room.findById(id).select("roomNumber branchId landlordId").populate("branchId", "name").lean();
    return (
      r && {
        landlordId: r.landlordId,
        branchId: r.branchId?._id,
        branchName: r.branchId?.name,
        roomNumber: r.roomNumber,
        link: "/rooms",
      }
    );
  },
  async contract(id) {
    const c = await Contract.findById(id)
      .select("contractCode landlordId branchId roomId tenantId")
      .populate("branchId", "name")
      .populate("roomId", "roomNumber")
      .populate("tenantId", "name email")
      .lean();
    return (
      c && {
        landlordId: c.landlordId,
        branchId: c.branchId?._id,
        branchName: c.branchId?.name,
        roomNumber: c.roomId?.roomNumber,
        tenantId: c.tenantId?._id,
        tenantName: name(c.tenantId),
        code: c.contractCode,
        link: `/contracts?contractId=${c._id}`,
      }
    );
  },
  async invoice(id) {
    const i = await Invoice.findById(id)
      .select("invoiceCode landlordId branchId roomId tenantId")
      .populate("branchId", "name")
      .populate("roomId", "roomNumber")
      .populate("tenantId", "name email")
      .lean();
    return (
      i && {
        landlordId: i.landlordId,
        branchId: i.branchId?._id,
        branchName: i.branchId?.name,
        roomNumber: i.roomId?.roomNumber,
        tenantId: i.tenantId?._id,
        tenantName: name(i.tenantId),
        code: i.invoiceCode,
        link: `/invoices?search=${encodeURIComponent(i.invoiceCode || "")}`,
      }
    );
  },
  async payment(id) {
    const p = await Payment.findById(id).select("invoiceId").lean();
    return p?.invoiceId ? DESCRIBE.invoice(p.invoiceId) : null;
  },
  async incident(id) {
    const i = await Incident.findById(id)
      .select("title landlordId branchId roomId reportedBy")
      .populate("branchId", "name")
      .populate("roomId", "roomNumber")
      .populate("reportedBy", "name email role")
      .lean();
    return (
      i && {
        landlordId: i.landlordId,
        branchId: i.branchId?._id,
        branchName: i.branchId?.name,
        roomNumber: i.roomId?.roomNumber,
        // The tenant who reported it hears about its progress.
        tenantId: i.reportedBy?.role === "TENANT" ? i.reportedBy._id : undefined,
        code: `"${i.title}"`,
        link: "/incidents",
      }
    );
  },
  async reading(id) {
    const r = await UtilityReading.findById(id)
      .select("billingPeriod landlordId branchId roomId")
      .populate("branchId", "name")
      .populate("roomId", "roomNumber")
      .lean();
    return (
      r && {
        landlordId: r.landlordId,
        branchId: r.branchId?._id,
        branchName: r.branchId?.name,
        roomNumber: r.roomId?.roomNumber,
        code: r.billingPeriod && `kỳ ${r.billingPeriod.split("-").reverse().join("/")}`,
        link: "/utility-readings",
      }
    );
  },
  async upgrade(id) {
    const u = await PlanUpgradeRequest.findById(id).populate("landlordId", "name email").populate("planId", "name").lean();
    return (
      u && {
        landlordId: u.landlordId?._id,
        landlordName: name(u.landlordId),
        code: u.planId?.name && `gói ${u.planId.name}`,
        link: "/admin?tab=upgrade-requests",
        admins: true,
      }
    );
  },
  async landlord(id) {
    const l = await User.findById(id).select("name email").lean();
    return l && { landlordId: l._id, landlordName: name(l), link: "/admin?tab=landlords", admins: true };
  },
  async platformInvoice(id) {
    const p = await PlatformInvoice.findById(id).populate("landlordId", "name email").lean();
    return (
      p && {
        landlordId: p.landlordId?._id,
        landlordName: name(p.landlordId),
        code: p.invoiceCode || p.paymentReference,
        link: "/admin?tab=invoices",
        admins: true,
      }
    );
  },
};

// "Phòng P.101 · Tòa Cầu Giấy · HDT-2026-..." style details line.
function details(d) {
  return [
    d.roomNumber && `Phòng ${d.roomNumber}`,
    d.branchName,
    d.tenantName && `Khách: ${d.tenantName}`,
    d.landlordName && `Chủ trọ: ${d.landlordName}`,
    d.code,
  ]
    .filter(Boolean)
    .join(" · ");
}

function build({ actor, label, entity = {}, extra }) {
  const who = `${actor.name || ROLE_LABELS[actor.role] || "Ai đó"}${actor.name ? ` (${ROLE_LABELS[actor.role] || actor.role})` : ""}`;
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    at: new Date().toISOString(),
    actor: { id: actor.id ? String(actor.id) : null, name: actor.name || null, role: actor.role },
    action: label,
    message: `${who} ${label}${extra ? ` ${extra}` : ""}`,
    details: details(entity),
    room: entity.roomNumber || null,
    branch: entity.branchName || null,
    code: entity.code || null,
    link: entity.link || null,
  };
}

// Rooms allowed to see this entity's activity.
function audience(entity, actorId) {
  const rooms = [];
  if (entity.landlordId) rooms.push(`landlord:${entity.landlordId}`);
  if (entity.branchId) rooms.push(`branch:${entity.branchId}`);
  if (entity.tenantId && String(entity.tenantId) !== String(actorId)) rooms.push(`user:${entity.tenantId}`);
  if (entity.admins) rooms.push("admins");
  return rooms;
}

let emitter = null;
const setEmitter = (emit) => {
  emitter = emit;
};

const responseId = (body) => {
  const data = body?.data;
  return data?._id || data?.id || data?.contract?._id || data?.request?._id || null;
};

// From the request that just succeeded (called by the live-updates middleware).
async function fromRequest(req, path, body) {
  if (!emitter) return;
  const match = ACTIONS.find(([method, re]) => method === req.method && re.test(path));
  if (!match) return;
  const [, re, label, kind, idFrom] = match;
  const user = req.user;
  let entity = {};
  if (kind) {
    const id =
      idFrom === "param"
        ? path.match(re)[1]
        : idFrom === "response"
          ? responseId(body)
          : req.body?.[idFrom.slice(5)];
    entity = (id && (await DESCRIBE[kind](id))) || {};
  }
  if (!entity.landlordId && user.role !== "SUPER_ADMIN")
    entity.landlordId = user.role === "LANDLORD" ? user._id : user.landlordId;
  // Invoices generated in bulk: say how many.
  const extra = Array.isArray(body?.data) ? `(${body.data.length} hóa đơn)` : undefined;
  const event = build({ actor: { id: user._id, name: user.name, role: user.role }, label, entity, extra });
  const rooms = audience(entity, user._id);
  if (user.role === "SUPER_ADMIN") rooms.push("admins");
  if (rooms.length) emitter([...new Set(rooms)], "activity", event);
}

// For changes without a signed-in user (bank webhook, payment gateway IPN).
async function system({ label, kind, id, extra }) {
  if (!emitter) return;
  const entity = (kind && id && (await DESCRIBE[kind](id))) || {};
  const event = build({ actor: { role: "SYSTEM" }, label, entity, extra });
  const rooms = audience(entity);
  if (rooms.length) emitter(rooms, "activity", event);
}

module.exports = { fromRequest, system, setEmitter, ACTIONS, DESCRIBE, build, ROLE_LABELS };
