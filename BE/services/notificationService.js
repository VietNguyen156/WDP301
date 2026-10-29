// Top bar notifications: the work currently waiting for the signed-in user, read live from the
// data (nothing is stored). Each group gives its total and the most pressing records, each with
// room / branch / tenant / code / amount and a link that opens that exact record.
const {
  Invoice,
  Payment,
  UnmatchedPayment,
  Contract,
  Incident,
  PlatformInvoice,
} = require("../models");
const PlanUpgradeRequest = require("../models/PlanUpgradeRequest");
const { currentSubscription } = require("./quotaService");
const { getTenantScope } = require("../utils/scope");
const { LIVE_CONTRACT_STATUSES, OWING_INVOICE_STATUSES } = require("../utils/statuses");
const { DAY_MS } = require("../utils/vnTime");

const PER_GROUP = 5;
const live = { isDeleted: false, status: { $in: LIVE_CONTRACT_STATUSES } };
const owing = { isDeleted: false, status: { $in: OWING_INVOICE_STATUSES }, remainingAmount: { $gt: 0 } };

const money = (n) => `${Math.round(n || 0).toLocaleString("vi-VN")}đ`;
const dateVn = (d) => (d ? new Date(d).toLocaleDateString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" }) : "");
const daysBetween = (a, b) => Math.floor((a - b) / DAY_MS);
const join = (...parts) => parts.filter(Boolean).join(" · ");
const room = (doc) => doc?.roomId?.roomNumber && `Phòng ${doc.roomId.roomNumber}`;
const who = (user) => user?.name || user?.email;

// Total + the first records of one query, with room / branch / tenant names populated.
async function fetchGroup(Model, filter, sort, populate = ["roomId:roomNumber", "branchId:name", "tenantId:name email"]) {
  let query = Model.find(filter).sort(sort).limit(PER_GROUP);
  for (const spec of populate) {
    const [path, select] = spec.split(":");
    query = query.populate(path, select);
  }
  const [docs, count] = await Promise.all([query.lean(), Model.countDocuments(filter)]);
  return { docs, count };
}

const group = (key, severity, title, link, { docs, count }, entry) => ({
  key,
  severity,
  title,
  link,
  count,
  entries: docs.map(entry),
});

const invoiceEntry = (now) => (i) => {
  const late = daysBetween(now, new Date(i.dueDate));
  return {
    id: String(i._id),
    text: join(room(i), i.branchId?.name, who(i.tenantId)),
    sub: join(
      i.invoiceCode,
      `còn ${money(i.remainingAmount)}`,
      late > 0 ? `quá hạn ${late} ngày` : `hạn ${dateVn(i.dueDate)}`,
    ),
    link: `/invoices?search=${encodeURIComponent(i.invoiceCode)}`,
  };
};
const contractEntry = (detail) => (c) => ({
  id: String(c._id),
  text: join(room(c), c.branchId?.name, who(c.tenantId)),
  sub: join(c.contractCode, detail(c)),
  link: `/contracts?contractId=${c._id}`,
});
const incidentEntry = (now) => (i) => ({
  id: String(i._id),
  text: i.title,
  sub: join(
    room(i),
    i.branchId?.name,
    who(i.reportedBy) && `báo bởi ${who(i.reportedBy)}`,
    `${Math.max(0, Math.round((now - new Date(i.createdAt)) / 3600000))} giờ trước`,
  ),
  link: "/incidents?status=PENDING",
});

async function staffGroups(req) {
  const scope = getTenantScope(req); // landlord: whole chain; manager: assigned branches
  const isLandlord = req.user.role === "LANDLORD";
  const now = new Date();
  const soon = new Date(now.getTime() + 30 * DAY_MS);
  const incidentPop = ["roomId:roomNumber", "branchId:name", "reportedBy:name email"];
  const none = { docs: [], count: 0 };
  const [unmatched, cashReports, overdue, urgent, pending, review, toConfirm, deposits, expiring, subscription] =
    await Promise.all([
      isLandlord
        ? fetchGroup(UnmatchedPayment, { landlordId: scope.landlordId, isDeleted: false, status: "PENDING_REVIEW" }, { transactionDate: -1 }, [])
        : none,
      isLandlord
        ? fetchGroup(Payment, { ...scope, isDeleted: false, status: "PENDING_CONFIRMATION" }, { createdAt: -1 }, ["branchId:name", "reportedBy:name email"])
        : none,
      fetchGroup(Invoice, { ...scope, ...owing, dueDate: { $lt: now } }, { dueDate: 1 }),
      fetchGroup(Incident, { ...scope, isDeleted: false, status: "PENDING", priority: "URGENT" }, { createdAt: 1 }, incidentPop),
      fetchGroup(Incident, { ...scope, isDeleted: false, status: "PENDING", priority: { $ne: "URGENT" } }, { createdAt: 1 }, incidentPop),
      fetchGroup(Incident, { ...scope, isDeleted: false, status: { $in: ["PENDING", "IN_PROGRESS"] }, "triage.needsReview": true }, { createdAt: -1 }, incidentPop),
      isLandlord ? fetchGroup(Contract, { ...scope, ...live, landlordConfirmedAt: null }, { createdAt: 1 }) : none,
      isLandlord ? fetchGroup(Contract, { ...scope, ...live, depositStatus: "UNPAID", depositAmount: { $gt: 0 } }, { startDate: 1 }) : none,
      isLandlord ? fetchGroup(Contract, { ...scope, ...live, endDate: { $gte: now, $lte: soon } }, { endDate: 1 }) : none,
      isLandlord ? currentSubscription(scope.landlordId) : null,
    ]);

  const groups = [
    group("incidents-urgent", "danger", "Sự cố khẩn cấp chưa tiếp nhận", "/incidents?status=PENDING", urgent, incidentEntry(now)),
    group("unmatched", "danger", "Giao dịch chưa khớp hóa đơn", "/unmatched", unmatched, (u) => ({
      id: String(u._id),
      text: `${money(u.amount)} · ${dateVn(u.transactionDate)}`,
      sub: join(u.content && `"${u.content.slice(0, 80)}"`, u.notes),
      link: "/unmatched",
    })),
    group("overdue", "danger", "Hóa đơn quá hạn", "/invoices", overdue, invoiceEntry(now)),
    group("cash-reports", "warning", "Phiếu thu tiền mặt chờ duyệt", "/payments", cashReports, (p) => ({
      id: String(p._id),
      text: join(money(p.amount), p.invoiceCode),
      sub: join(p.branchId?.name, who(p.reportedBy) && `báo bởi ${who(p.reportedBy)}`, dateVn(p.transactionDate || p.createdAt)),
      link: "/payments",
    })),
    group("incidents-pending", "warning", "Sự cố mới chờ tiếp nhận", "/incidents?status=PENDING", pending, incidentEntry(now)),
    group("incidents-review", "info", "Sự cố cần xem lại phân loại", "/incidents", review, incidentEntry(now)),
    group("contracts-confirm", "warning", "Hợp đồng chờ bạn xác nhận", "/contracts", toConfirm, contractEntry((c) => `lập ngày ${dateVn(c.createdAt)}`)),
    group("deposits", "warning", "Tiền cọc chưa nhận", "/contracts", deposits, contractEntry((c) => `cọc ${money(c.depositAmount)}`)),
    group("contracts-expiring", "info", "Hợp đồng sắp hết hạn", "/contracts", expiring, contractEntry((c) => {
      const left = daysBetween(new Date(c.endDate), now);
      return `hết hạn ${dateVn(c.endDate)} (còn ${left} ngày)`;
    })),
  ];
  const planDaysLeft = subscription?.endDate ? daysBetween(new Date(subscription.endDate), now) : null;
  if (planDaysLeft !== null && planDaysLeft <= 7)
    groups.push({
      key: "plan-ending",
      severity: planDaysLeft <= 3 ? "danger" : "warning",
      title: "Gói dịch vụ sắp hết hạn",
      link: "/plans",
      count: 1,
      entries: [
        {
          id: String(subscription._id),
          text: subscription.planId?.name || "Gói hiện tại",
          sub: `hết hạn ${dateVn(subscription.endDate)} (còn ${planDaysLeft} ngày)`,
          link: "/plans",
        },
      ],
    });
  return groups;
}

async function tenantGroups(req) {
  const scope = getTenantScope(req); // { landlordId, tenantId }
  const now = new Date();
  const [due, overdue, toConfirm, deposits] = await Promise.all([
    fetchGroup(Invoice, { ...scope, ...owing, dueDate: { $gte: now } }, { dueDate: 1 }),
    fetchGroup(Invoice, { ...scope, ...owing, dueDate: { $lt: now } }, { dueDate: 1 }),
    fetchGroup(Contract, { ...scope, ...live, tenantConfirmedAt: null }, { createdAt: 1 }),
    fetchGroup(Contract, { ...scope, ...live, depositStatus: "UNPAID", depositAmount: { $gt: 0 } }, { startDate: 1 }),
  ]);
  return [
    group("overdue", "danger", "Hóa đơn quá hạn", "/invoices", overdue, invoiceEntry(now)),
    group("invoices-due", "warning", "Hóa đơn cần thanh toán", "/invoices", due, invoiceEntry(now)),
    group("contracts-confirm", "warning", "Hợp đồng chờ bạn xác nhận", "/contracts", toConfirm, contractEntry(() => "bấm để xem và xác nhận")),
    group("deposits", "info", "Tiền cọc chưa chuyển", "/contracts", deposits, contractEntry((c) => `cọc ${money(c.depositAmount)} · có mã QR`)),
  ];
}

async function adminGroups() {
  const [upgrades, unpaid] = await Promise.all([
    fetchGroup(PlanUpgradeRequest, { isDeleted: false, status: "PENDING" }, { createdAt: 1 }, [
      "landlordId:name email",
      "planId:name",
      "currentPlanId:name",
    ]),
    fetchGroup(PlatformInvoice, { isDeleted: false, status: { $in: ["PENDING", "OVERDUE"] } }, { dueDate: 1 }, [
      "landlordId:name email",
      "planId:name",
    ]),
  ]);
  return [
    group("upgrade-requests", "warning", "Yêu cầu đổi gói chờ duyệt", "/admin?tab=upgrade-requests", upgrades, (u) => ({
      id: String(u._id),
      text: who(u.landlordId) || "Chủ trọ",
      sub: join(u.currentPlanId?.name && `${u.currentPlanId.name} → ${u.planId?.name}`, !u.currentPlanId && u.planId?.name, `gửi ${dateVn(u.createdAt)}`),
      link: "/admin?tab=upgrade-requests",
    })),
    group("platform-invoices", "info", "Hóa đơn SaaS chưa thanh toán", "/admin?tab=invoices", unpaid, (p) => ({
      id: String(p._id),
      text: join(who(p.landlordId), p.planId?.name),
      sub: join(p.invoiceCode, money(p.amount), p.dueDate && `hạn ${dateVn(p.dueDate)}`, p.status === "OVERDUE" && "quá hạn"),
      link: "/admin?tab=invoices",
    })),
  ];
}

async function list(req) {
  const role = req.user.role;
  const all =
    role === "SUPER_ADMIN"
      ? await adminGroups()
      : role === "TENANT"
        ? await tenantGroups(req)
        : await staffGroups(req);
  const items = all.filter((g) => g.count > 0);
  return { items, total: items.reduce((sum, g) => sum + g.count, 0), checkedAt: new Date() };
}

// ---- Recent activity (pre-fills "Hoạt động gần đây" from the audit log) ----
// Audit action -> the same wording as the live "activity" events.
const AUDIT_LABELS = {
  CREATE_BRANCH: "tạo cơ sở mới",
  DELETE_BRANCH: "xóa cơ sở",
  UPDATE_BRANCH_PRICING: "cập nhật giá dịch vụ cơ sở",
  UPDATE_ROOM: "cập nhật phòng",
  DELETE_ROOM: "xóa phòng",
  CREATE_CONTRACT: "lập hợp đồng mới",
  CONFIRM_CONTRACT_LANDLORD: "xác nhận hợp đồng điện tử",
  CONFIRM_CONTRACT_TENANT: "xác nhận hợp đồng điện tử",
  RECEIVE_CONTRACT_DEPOSIT: "ghi nhận tiền cọc",
  APPLY_CONTRACT_DEPOSIT: "cấn trừ tiền cọc",
  PREPARE_CONTRACT_SETTLEMENT: "lập phiếu quyết toán hợp đồng",
  SETTLE_CONTRACT: "thanh lý hợp đồng",
  RENEW_CONTRACT: "gia hạn hợp đồng",
  CREATE_INCIDENT: "báo sự cố",
  UPDATE_INCIDENT_STATUS: "cập nhật trạng thái sự cố",
  UPDATE_INCIDENT_COST: "ghi chi phí sửa chữa",
  TRIAGE_INCIDENT: "phân loại lại sự cố",
  CREATE_UTILITY_READING: "chốt số điện nước",
  UPDATE_UTILITY_READING: "sửa chỉ số điện nước",
  CREATE_INVOICE: "tạo hóa đơn",
  ISSUE_INVOICE: "phát hành hóa đơn",
  CANCEL_INVOICE: "hủy hóa đơn",
  CONFIRM_CASH_PAYMENT: "ghi nhận thu tiền mặt",
  REPORT_CASH_PAYMENT: "báo cáo thu tiền mặt",
  REJECT_CASH_PAYMENT: "từ chối phiếu thu tiền mặt",
  RECEIVE_BANK_PAYMENT: "nhận chuyển khoản",
  RESOLVE_UNMATCHED_PAYMENT: "gán giao dịch chưa khớp vào hóa đơn",
};
const KIND = {
  BRANCH: "branch",
  ROOM: "room",
  CONTRACT: "contract",
  INCIDENT: "incident",
  UTILITY_READING: "reading",
  INVOICE: "invoice",
};
const ACTIVITY_LIMIT = 20;

async function recentActivity(req) {
  // Lazy: activity.js requires the models index, as this file does.
  const { DESCRIBE, build } = require("../realtime/activity");
  const AuditLog = require("../models/AuditLog");
  const role = req.user.role;
  if (role === "SUPER_ADMIN") return { items: [] };
  const landlordId = role === "LANDLORD" ? req.user._id : req.user.landlordId;
  const logs = await AuditLog.find({ landlordId, action: { $in: Object.keys(AUDIT_LABELS) } })
    .sort({ createdAt: -1 })
    .limit(ACTIVITY_LIMIT * 3) // managers and tenants only keep the part they may see
    .populate("actorId", "name email")
    .lean();
  const branches = new Set((req.user.assignedBranches || []).map(String));
  const items = [];
  for (const log of logs) {
    if (items.length >= ACTIVITY_LIMIT) break;
    const kind = KIND[log.entityType];
    const entity = (kind && (await DESCRIBE[kind](log.entityId).catch(() => null))) || {};
    // Same audience rules as the live events.
    if (role === "PROPERTY_MANAGER" && !branches.has(String(entity.branchId))) continue;
    if (role === "TENANT" && String(entity.tenantId) !== String(req.user._id) && String(log.actorId?._id) !== String(req.user._id))
      continue;
    const event = build({
      actor: { id: log.actorId?._id, name: who(log.actorId), role: log.actorRole },
      label: AUDIT_LABELS[log.action],
      entity,
    });
    items.push({ ...event, id: String(log._id), at: new Date(log.createdAt).toISOString() });
  }
  return { items };
}

module.exports = { list, recentActivity };
