const mongoose = require("mongoose");
const crypto = require("crypto");
const Invoice = require("../models/Invoice");
const { makeVietQr } = require("./financeCalculation");
const { currentPeriod } = require("../utils/vnTime");
const { LIVE_CONTRACT_STATUSES } = require("../utils/statuses");
const { incidentStatusLabel } = require("../utils/statusLabels");
const Incident = require("../models/Incident");
const Room = require("../models/Room");
const Contract = require("../models/Contract");
const User = require("../models/User");
const branchService = require("./branchService");
const audit = require("./auditService");
const { requireFeature } = require("./planFeatures");
const incidentTriage = require("./incidentTriage");
const expenseService = require("./expenseService");
const {
  getTenantScope,
  scoped,
  validId,
  assertBranchScope,
} = require("../utils/scope");
const {
  BusinessRuleError,
  NotFoundError,
  ValidationError,
  ForbiddenError,
} = require("../utils/errors");
const v = require("../utils/validation");

const PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"];
const CATEGORIES = [...Object.values(incidentTriage.CATEGORY_OPTIONS), "OTHER"];
const STATUSES = ["PENDING", "IN_PROGRESS", "SOLVED", "CLOSED", "REJECTED"];
const COST_PAYERS = ["LANDLORD", "TENANT", "NONE"];
const LIVE_CONTRACT = LIVE_CONTRACT_STATUSES;
// PENDING -> IN_PROGRESS -> SOLVED -> CLOSED; SOLVED may be reopened, PENDING may be rejected.
const TRANSITIONS = {
  PENDING: ["IN_PROGRESS", "REJECTED"],
  IN_PROGRESS: ["SOLVED"],
  SOLVED: ["CLOSED", "IN_PROGRESS"],
  CLOSED: [],
  REJECTED: [],
};
// PENDING too: after a declined quote the landlord may take the cost before work starts.
const COST_EDITABLE = ["PENDING", "IN_PROGRESS", "SOLVED"];
const DAY_MS = 86400000;
const vnd = (n) => `${Number(n || 0).toLocaleString("vi-VN")}đ`;
// Tenant-paid repairs follow the quote → tenant approval → two-party acceptance → invoice flow.
const tenantPays = (incident) => incident.costPayer === "TENANT";

function images(value, label) {
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || value.length > 10)
    throw new ValidationError(`${label} phải là danh sách tối đa 10 ảnh`);
  for (const url of value) {
    v.text(url, label);
    if (!/^https?:\/\//.test(url))
      throw new ValidationError(`${label} phải là URL http/https`);
  }
  return value;
}

function note(value) {
  if (value === undefined) return undefined;
  v.text(value, "Ghi chú");
  return value.trim();
}

// Reading history stays open after a downgrade; only new work needs the plan feature.
const requireIncidents = (req, session) =>
  requireFeature(getTenantScope(req).landlordId, "INCIDENTS", session);

// Tenants see incidents they reported or that belong to any of their contracts.
async function scope(req) {
  const base = getTenantScope(req);
  if (req.user.role !== "TENANT") return base;
  const contractIds = await Contract.distinct("_id", {
    landlordId: base.landlordId,
    tenantId: req.user._id,
    isDeleted: false,
  });
  return {
    landlordId: base.landlordId,
    $or: [{ reportedBy: req.user._id }, { contractId: { $in: contractIds } }],
  };
}

const populate = (query) =>
  query
    .populate({ path: "roomId", select: "roomNumber floor" })
    .populate({ path: "branchId", select: "name" })
    .populate({ path: "reportedBy", select: "name role" })
    .populate({ path: "assignedTo", select: "name role" })
    .populate({ path: "quote.quotedBy", select: "name role" })
    .populate({ path: "acceptance.staffBy", select: "name role" })
    .populate({ path: "acceptance.tenantBy", select: "name role" });

async function find(req, id, session = null) {
  const incident = await Incident.findOne(
    scoped(await scope(req), { _id: validId(id) }),
  ).session(session);
  if (!incident) throw new NotFoundError("Không tìm thấy sự cố");
  return incident;
}

async function list(req) {
  const { page, limit, skip } = v.pagination(req.query);
  const filter = {};
  if (req.query.branchId) {
    assertBranchScope(req, req.query.branchId);
    filter.branchId = new mongoose.Types.ObjectId(req.query.branchId);
  }
  if (req.query.roomId)
    filter.roomId = new mongoose.Types.ObjectId(validId(req.query.roomId));
  if (req.query.status) {
    v.choice(req.query.status, STATUSES, "Trạng thái");
    filter.status = req.query.status;
  }
  if (req.query.priority) {
    v.choice(req.query.priority, PRIORITIES, "Mức ưu tiên");
    filter.priority = req.query.priority;
  }
  if (req.query.category) {
    v.choice(req.query.category, [...CATEGORIES, "UNCLASSIFIED"], "Loại sự cố");
    filter.category = req.query.category === "UNCLASSIFIED" ? { $exists: false } : req.query.category;
  }
  if (req.query.needsReview === "true") filter["triage.needsReview"] = true;
  const query = scoped(await scope(req), filter);
  const [items, total, groups] = await Promise.all([
    populate(
      Incident.find(query)
        .sort({ createdAt: -1, _id: -1 })
        .skip(skip)
        .limit(limit),
    ).lean(),
    Incident.countDocuments(query),
    Incident.aggregate([
      { $match: query },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]),
  ]);
  return {
    items,
    total,
    page,
    limit,
    stats: Object.fromEntries(groups.map((g) => [g._id, g.count])),
    triageEnabled: incidentTriage.enabled(),
  };
}

async function get(req) {
  const incident = await find(req, req.params.incidentId);
  const data = await populate(Incident.findById(incident._id)).lean();
  if (req.user.role === "TENANT") return data;
  // Staff see the money around the repair: what the tenant was billed / paid (thu) and what was
  // paid out to whoever did the work (chi). Tenants never see pay-outs.
  const [expenses, invoice] = await Promise.all([
    expenseService.forIncident(incident._id),
    incident.chargeInvoiceId
      ? Invoice.findById(incident.chargeInvoiceId).select("invoiceCode totalAmount paidAmount remainingAmount status").lean()
      : null,
  ]);
  const paidOut = expenses
    .filter((e) => e.status === "RECORDED")
    .reduce((sum, e) => sum + e.amount, 0);
  const collected = invoice && invoice.status !== "CANCELLED" ? invoice.paidAmount : 0;
  return {
    ...data,
    expenses,
    finance: {
      payer: data.costPayer,
      billed: invoice && invoice.status !== "CANCELLED" ? invoice.totalAmount : 0,
      collected,
      invoice,
      paidOut,
      // Tenant-paid: collected minus pay-outs; landlord-paid: the pay-outs are the landlord's cost.
      net: collected - paidOut,
    },
  };
}

// Resolve branch, room and contract for the reporter; tenants are bound to their own contracts.
async function target(req, body, session) {
  if (req.user.role === "TENANT") {
    const contracts = await Contract.find({
      landlordId: req.user.landlordId,
      tenantId: req.user._id,
      isDeleted: false,
      status: { $in: LIVE_CONTRACT },
      ...(body.roomId !== undefined && { roomId: validId(body.roomId) }),
    }).session(session);
    if (!contracts.length)
      throw new BusinessRuleError(
        "Bạn không có hợp đồng đang thuê phòng này",
        "CONTRACT_NOT_ACTIVE",
      );
    if (contracts.length > 1)
      throw new ValidationError(
        "Bạn đang thuê nhiều phòng, vui lòng chọn roomId",
      );
    const [contract] = contracts;
    return {
      landlordId: contract.landlordId,
      branchId: contract.branchId,
      roomId: contract.roomId,
      contractId: contract._id,
    };
  }
  const branch = await branchService.get(req, validId(body.branchId), session);
  const room = await Room.findOne(
    scoped(getTenantScope(req), {
      _id: validId(body.roomId),
      branchId: branch._id,
    }),
  ).session(session);
  if (!room) throw new NotFoundError("Không tìm thấy phòng trong cơ sở");
  return {
    landlordId: branch.landlordId,
    branchId: branch._id,
    roomId: room._id,
    contractId: room.currentContractId,
  };
}

async function create(req) {
  const body = req.body;
  v.fields(body, [
    "branchId",
    "roomId",
    "title",
    "description",
    "images",
    "priority",
  ]);
  v.text(body.title, "Tiêu đề sự cố");
  if (body.title.trim().length > 200)
    throw new ValidationError("Tiêu đề sự cố tối đa 200 ký tự");
  v.text(body.description, "Mô tả sự cố");
  if (body.priority !== undefined)
    v.choice(body.priority, PRIORITIES, "Mức ưu tiên");
  images(body.images, "Ảnh hiện trường");
  return mongoose.connection.transaction(async (session) => {
    await requireIncidents(req, session);
    const where = await target(req, body, session);
    const [incident] = await Incident.create(
      [
        {
          ...where,
          reportedBy: req.user._id,
          title: body.title.trim(),
          description: body.description.trim(),
          images: body.images || [],
          priority: body.priority || "MEDIUM",
          status: "PENDING",
          statusHistory: [{ status: "PENDING", changedBy: req.user._id }],
        },
      ],
      { session },
    );
    await audit.log({
      req,
      action: "CREATE_INCIDENT",
      entityType: "INCIDENT",
      entityId: incident._id,
      after: incident.toObject(),
      session,
    });
    return incident;
  });
}

async function assignee(req, incident, id, session) {
  const user = await User.findOne({
    _id: validId(id),
    isDeleted: false,
    status: "ACTIVE",
    $or: [
      { _id: incident.landlordId, role: "LANDLORD" },
      {
        role: "PROPERTY_MANAGER",
        landlordId: incident.landlordId,
        assignedBranches: incident.branchId,
      },
    ],
  }).session(session);
  if (!user)
    throw new ValidationError(
      "Người phụ trách phải là chủ trọ hoặc quản lý của cơ sở này",
    );
  return user._id;
}

async function updateStatus(req) {
  const body = req.body;
  v.fields(body, ["status", "note", "resolvedImages", "assignedTo"]);
  v.choice(body.status, STATUSES, "Trạng thái");
  const text = note(body.note);
  // Photos of the finished repair are optional.
  const resolved = images(body.resolvedImages, "Ảnh nghiệm thu");
  return mongoose.connection.transaction(async (session) => {
    await requireIncidents(req, session);
    const incident = await find(req, req.params.incidentId, session);
    const before = incident.toObject();
    if (!TRANSITIONS[incident.status]?.includes(body.status))
      throw new BusinessRuleError(
        `Không thể chuyển sự cố từ "${incidentStatusLabel(incident.status)}" sang "${incidentStatusLabel(body.status)}"`,
        "INCIDENT_INVALID_TRANSITION",
      );
    if (body.status === "REJECTED" && !text)
      throw new ValidationError("Vui lòng nhập lý do từ chối");
    if (
      body.status === "IN_PROGRESS" &&
      incident.status === "PENDING" &&
      tenantPays(incident) &&
      incident.quote?.status !== "ACCEPTED"
    )
      throw new BusinessRuleError(
        "Sự cố do người thuê chi trả: cần người thuê duyệt báo giá trước khi bắt đầu xử lý",
        "INCIDENT_QUOTE_NOT_ACCEPTED",
      );
    if (body.status === "CLOSED" && tenantPays(incident))
      throw new BusinessRuleError(
        "Sự cố do người thuê chi trả: cần người thuê xác nhận nghiệm thu, hồ sơ sẽ tự đóng sau đó",
        "INCIDENT_TENANT_ACCEPTANCE_REQUIRED",
      );
    if (resolved) incident.resolvedImages = resolved;
    if (body.status === "CLOSED" && !incident.costUpdatedAt)
      throw new BusinessRuleError(
        "Cần ghi nhận chi phí và người chịu phí trước khi đóng phiếu",
        "INCIDENT_COST_REQUIRED",
      );
    if (body.assignedTo !== undefined)
      incident.assignedTo = await assignee(
        req,
        incident,
        body.assignedTo,
        session,
      );
    else if (body.status === "IN_PROGRESS" && !incident.assignedTo)
      incident.assignedTo = req.user._id;
    // Staff acceptance ("đã sửa xong") is the SOLVED step; reopening clears it.
    if (body.status === "SOLVED")
      incident.acceptance = { staffBy: req.user._id, staffAt: new Date() };
    else if (body.status === "IN_PROGRESS" && incident.status === "SOLVED")
      incident.acceptance = undefined;
    incident.status = body.status;
    if (text) incident.notes = text;
    incident.statusHistory.push({
      status: body.status,
      changedBy: req.user._id,
      note:
        body.status === "SOLVED" && tenantPays(incident)
          ? [text, "Quản lý đã nghiệm thu, chờ người thuê xác nhận"].filter(Boolean).join(" · ")
          : text,
    });
    await incident.save({ session });
    await audit.log({
      req,
      action: "UPDATE_INCIDENT_STATUS",
      entityType: "INCIDENT",
      entityId: incident._id,
      before,
      after: incident.toObject(),
      session,
    });
    return incident;
  });
}

async function updateCost(req) {
  const body = req.body;
  v.fields(body, ["repairCost", "costPayer", "note"]);
  v.number(body.repairCost, "Chi phí sửa chữa");
  v.choice(body.costPayer, COST_PAYERS, "Người chịu phí");
  const text = note(body.note);
  if (body.costPayer === "NONE" && body.repairCost > 0)
    throw new ValidationError("Có chi phí thì phải chọn người chịu phí");
  if (body.costPayer === "TENANT")
    throw new BusinessRuleError(
      "Chi phí do người thuê trả phải gửi báo giá để người thuê duyệt trước",
      "INCIDENT_QUOTE_REQUIRED",
    );
  return mongoose.connection.transaction(async (session) => {
    await requireIncidents(req, session);
    const incident = await find(req, req.params.incidentId, session);
    const before = incident.toObject();
    if (!COST_EDITABLE.includes(incident.status))
      throw new BusinessRuleError(
        "Chỉ ghi nhận chi phí khi sự cố đang xử lý hoặc đã sửa xong",
        "INCIDENT_COST_LOCKED",
      );
    // Who pays is decided once. A quote the tenant has not refused (waiting or accepted) locks
    // the repair as tenant-paid; only a refused quote may be taken over by the landlord.
    if (tenantPays(incident)) {
      if (incident.quote?.status !== "DECLINED")
        throw new BusinessRuleError(
          "Sự cố đã báo giá cho người thuê chi trả nên không thể chuyển sang chủ trọ chịu",
          "INCIDENT_PAYER_LOCKED",
        );
      if (req.user.role !== "LANDLORD")
        throw new ForbiddenError("Chỉ chủ trọ được nhận chi phí khi người thuê từ chối báo giá");
      incident.statusHistory.push({
        status: incident.status,
        changedBy: req.user._id,
        note: "Người thuê từ chối báo giá, chủ trọ nhận chịu chi phí",
      });
    }
    incident.repairCost = body.repairCost;
    incident.costPayer = body.costPayer;
    incident.costUpdatedAt = new Date();
    if (text) incident.notes = text;
    await incident.save({ session });
    await audit.log({
      req,
      action: "UPDATE_INCIDENT_COST",
      entityType: "INCIDENT",
      entityId: incident._id,
      before,
      after: incident.toObject(),
      session,
    });
    return incident;
  });
}

// The tenant on the incident's contract (only they approve quotes and acceptance).
async function assertIncidentTenant(req, incident, session) {
  const contract = incident.contractId
    ? await Contract.findOne({ _id: incident.contractId, isDeleted: false }).session(session)
    : null;
  if (!contract || String(contract.tenantId) !== String(req.user._id))
    throw new ForbiddenError("Chỉ người thuê đứng tên hợp đồng mới được duyệt");
  return contract;
}

// Staff quotes the repair to the tenant; work starts only after the tenant accepts.
async function sendQuote(req) {
  const body = v.fields(req.body || {}, ["amount", "note"]);
  v.number(body.amount, "Số tiền báo giá", 1);
  const text = note(body.note);
  return mongoose.connection.transaction(async (session) => {
    await requireIncidents(req, session);
    const incident = await find(req, req.params.incidentId, session);
    if (incident.status !== "PENDING")
      throw new BusinessRuleError(
        "Chỉ báo giá khi sự cố chưa bắt đầu xử lý",
        "INCIDENT_QUOTE_LOCKED",
      );
    if (incident.quote?.status === "ACCEPTED")
      throw new BusinessRuleError("Người thuê đã duyệt báo giá này", "INCIDENT_QUOTE_ACCEPTED");
    // Already recorded as landlord-paid / free: the tenant cannot be billed for it any more.
    if (incident.costUpdatedAt && !tenantPays(incident))
      throw new BusinessRuleError(
        "Sự cố đã ghi nhận chủ trọ chịu phí (hoặc miễn phí) nên không thể báo giá cho người thuê",
        "INCIDENT_PAYER_LOCKED",
      );
    if (!incident.contractId)
      throw new BusinessRuleError(
        "Sự cố không gắn với hợp đồng thuê nên không thể tính phí cho người thuê",
        "INCIDENT_NO_CONTRACT",
      );
    const before = incident.toObject();
    incident.quote = {
      amount: body.amount,
      note: text,
      status: "PENDING",
      quotedBy: req.user._id,
      quotedAt: new Date(),
    };
    incident.costPayer = "TENANT";
    incident.repairCost = body.amount;
    incident.costUpdatedAt = new Date();
    incident.statusHistory.push({
      status: incident.status,
      changedBy: req.user._id,
      note: [`Báo giá cho người thuê: ${vnd(body.amount)}`, text].filter(Boolean).join(" · "),
    });
    await incident.save({ session });
    await audit.log({
      req,
      action: "QUOTE_INCIDENT",
      entityType: "INCIDENT",
      entityId: incident._id,
      before,
      after: incident.toObject(),
      session,
    });
    return incident;
  });
}

// Tenant accepts or declines the quote.
async function respondQuote(req) {
  const body = v.fields(req.body || {}, ["accept", "note"]);
  if (typeof body.accept !== "boolean")
    throw new ValidationError("Vui lòng chọn đồng ý hoặc từ chối báo giá");
  const text = note(body.note);
  if (!body.accept && !text) throw new ValidationError("Vui lòng nhập lý do từ chối báo giá");
  return mongoose.connection.transaction(async (session) => {
    const incident = await find(req, req.params.incidentId, session);
    await assertIncidentTenant(req, incident, session);
    if (incident.quote?.status !== "PENDING" || incident.status !== "PENDING")
      throw new BusinessRuleError("Không có báo giá nào đang chờ bạn duyệt", "INCIDENT_NO_PENDING_QUOTE");
    const before = incident.toObject();
    incident.quote.status = body.accept ? "ACCEPTED" : "DECLINED";
    incident.quote.respondedBy = req.user._id;
    incident.quote.respondedAt = new Date();
    incident.quote.responseNote = text;
    incident.statusHistory.push({
      status: incident.status,
      changedBy: req.user._id,
      note: [
        body.accept
          ? `Người thuê đồng ý báo giá ${vnd(incident.quote.amount)}`
          : `Người thuê từ chối báo giá ${vnd(incident.quote.amount)}`,
        text,
      ]
        .filter(Boolean)
        .join(" · "),
    });
    await incident.save({ session });
    await audit.log({
      req,
      action: body.accept ? "ACCEPT_INCIDENT_QUOTE" : "DECLINE_INCIDENT_QUOTE",
      entityType: "INCIDENT",
      entityId: incident._id,
      before,
      after: incident.toObject(),
      session,
    });
    return incident;
  });
}

// Invoice for a tenant-paid repair, issued at once so it can be paid by VietQR or cash.
async function issueIncidentInvoice(incident, contract, session) {
  const [room, landlord] = await Promise.all([
    Room.findById(incident.roomId).select("roomNumber").session(session).lean(),
    User.findById(incident.landlordId).select("bankConfig").session(session).lean(),
  ]);
  const amount = incident.repairCost;
  const billingPeriod = currentPeriod();
  const [year, month] = billingPeriod.split("-").map(Number);
  const invoiceCode = `HDSC${crypto.randomBytes(10).toString("hex").toUpperCase()}`;
  const paymentSyntax = `${invoiceCode} P${String(room?.roomNumber || "").replace(/[^A-Za-z0-9]/g, "")}`;
  const bank = landlord?.bankConfig;
  const dueDays = contract.contractTerms?.paymentDueDays || 5;
  const [invoice] = await Invoice.create(
    [
      {
        invoiceType: "INCIDENT",
        incidentId: incident._id,
        landlordId: incident.landlordId,
        branchId: incident.branchId,
        roomId: incident.roomId,
        contractId: contract._id,
        tenantId: contract.tenantId,
        invoiceCode,
        billingPeriod,
        year,
        month,
        dueDate: new Date(Date.now() + dueDays * DAY_MS),
        paymentSyntax,
        roomAmount: 0,
        additionalFees: [{ reason: `Sửa chữa sự cố: ${incident.title}`, amount }],
        totalAmount: amount,
        remainingAmount: amount,
        status: "ISSUED",
        bankSnapshot: bank,
        notes: `Thu tiền sửa chữa sự cố "${incident.title}" theo báo giá người thuê đã duyệt`,
        vietQrUrl:
          bank?.bankCode && bank.accountNumber && bank.accountName
            ? makeVietQr(bank, amount, paymentSyntax)
            : undefined,
      },
    ],
    { session },
  );
  return invoice;
}

// Tenant's acceptance of a tenant-paid repair: accept closes it and issues the invoice,
// decline sends it back to the repair team.
async function tenantAcceptance(req) {
  const body = v.fields(req.body || {}, ["accept", "note"]);
  if (typeof body.accept !== "boolean")
    throw new ValidationError("Vui lòng chọn nghiệm thu đạt hoặc chưa đạt");
  const text = note(body.note);
  if (!body.accept && !text) throw new ValidationError("Vui lòng nêu điểm chưa đạt để sửa lại");
  return mongoose.connection.transaction(async (session) => {
    const incident = await find(req, req.params.incidentId, session);
    const contract = await assertIncidentTenant(req, incident, session);
    if (incident.status !== "SOLVED" || !tenantPays(incident))
      throw new BusinessRuleError("Sự cố này không chờ bạn nghiệm thu", "INCIDENT_NOT_AWAITING_TENANT");
    const before = incident.toObject();
    let invoice = null;
    if (body.accept) {
      incident.acceptance.tenantBy = req.user._id;
      incident.acceptance.tenantAt = new Date();
      incident.acceptance.tenantNote = text;
      incident.status = "CLOSED";
      if (incident.repairCost > 0) {
        invoice = await issueIncidentInvoice(incident, contract, session);
        incident.chargeInvoiceId = invoice._id;
        incident.chargeInvoiceCode = invoice.invoiceCode;
      }
    } else {
      incident.acceptance = undefined;
      incident.status = "IN_PROGRESS";
    }
    incident.statusHistory.push({
      status: incident.status,
      changedBy: req.user._id,
      note: body.accept
        ? [
            "Người thuê xác nhận nghiệm thu",
            invoice && `Xuất hóa đơn ${invoice.invoiceCode} (${vnd(invoice.totalAmount)})`,
            text,
          ]
            .filter(Boolean)
            .join(" · ")
        : `Người thuê chưa đồng ý nghiệm thu: ${text}`,
    });
    await incident.save({ session });
    await audit.log({
      req,
      action: body.accept ? "TENANT_ACCEPT_INCIDENT" : "TENANT_REJECT_INCIDENT_WORK",
      entityType: "INCIDENT",
      entityId: incident._id,
      before,
      after: { ...incident.toObject(), chargeInvoiceId: invoice?._id },
      session,
    });
    return incident;
  });
}

// Background triage right after a report is created. A tenant's report gets the suggested
// priority; a staff member's own priority is kept and the suggestion is only stored.
async function triageAfterCreate(incident, reporterRole) {
  if (!incidentTriage.enabled()) return null;
  try {
    const triaged = await incidentTriage.triage(incident._id, { applyPriority: reporterRole === "TENANT" });
    return triaged && populate(Incident.findById(triaged._id)).lean();
  } catch (error) {
    console.error(`Phân loại sự cố ${incident._id} thất bại:`, error.message);
    return null;
  }
}

// Staff re-runs the triage on demand; this applies both category and priority.
async function retriage(req) {
  await requireIncidents(req);
  const incident = await find(req, req.params.incidentId);
  if (!["PENDING", "IN_PROGRESS"].includes(incident.status))
    throw new BusinessRuleError("Chỉ phân loại lại sự cố đang chờ hoặc đang xử lý");
  const before = { category: incident.category, priority: incident.priority };
  const triaged = await incidentTriage.triage(incident._id, { applyPriority: true });
  await audit.log({
    req,
    action: "TRIAGE_INCIDENT",
    entityType: "INCIDENT",
    entityId: incident._id,
    before,
    after: { category: triaged.category, priority: triaged.priority, needsReview: triaged.triage?.needsReview },
  });
  return populate(Incident.findById(incident._id)).lean();
}

module.exports = {
  list,
  get,
  create,
  updateStatus,
  updateCost,
  sendQuote,
  respondQuote,
  tenantAcceptance,
  triageAfterCreate,
  retriage,
};
