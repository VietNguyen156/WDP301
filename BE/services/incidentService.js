const mongoose = require("mongoose");
const Incident = require("../models/Incident");
const Room = require("../models/Room");
const Contract = require("../models/Contract");
const User = require("../models/User");
const branchService = require("./branchService");
const audit = require("./auditService");
const { requireFeature } = require("./planFeatures");
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
const STATUSES = ["PENDING", "IN_PROGRESS", "SOLVED", "CLOSED", "REJECTED"];
const COST_PAYERS = ["LANDLORD", "TENANT", "NONE"];
const LIVE_CONTRACT = ["ACTIVE", "EXPIRING_SOON", "EXPIRED"];
// PENDING -> IN_PROGRESS -> SOLVED -> CLOSED; SOLVED may be reopened, PENDING may be rejected.
const TRANSITIONS = {
  PENDING: ["IN_PROGRESS", "REJECTED"],
  IN_PROGRESS: ["SOLVED"],
  SOLVED: ["CLOSED", "IN_PROGRESS"],
  CLOSED: [],
  REJECTED: [],
};
const COST_EDITABLE = ["IN_PROGRESS", "SOLVED"];

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
    .populate({ path: "assignedTo", select: "name role" });

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
  };
}

async function get(req) {
  const incident = await find(req, req.params.incidentId);
  return populate(Incident.findById(incident._id)).lean();
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
  const resolved = images(body.resolvedImages, "Ảnh nghiệm thu");
  return mongoose.connection.transaction(async (session) => {
    await requireIncidents(req, session);
    const incident = await find(req, req.params.incidentId, session);
    const before = incident.toObject();
    if (!TRANSITIONS[incident.status]?.includes(body.status))
      throw new BusinessRuleError(
        `Không thể chuyển sự cố từ ${incident.status} sang ${body.status}`,
        "INCIDENT_INVALID_TRANSITION",
      );
    if (body.status === "REJECTED" && !text)
      throw new ValidationError("Vui lòng nhập lý do từ chối");
    if (resolved) incident.resolvedImages = resolved;
    if (body.status === "SOLVED" && !incident.resolvedImages.length)
      throw new ValidationError(
        "Cần ít nhất 1 ảnh nghiệm thu khi báo sửa xong",
        "INCIDENT_EVIDENCE_REQUIRED",
      );
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
    incident.status = body.status;
    if (text) incident.notes = text;
    incident.statusHistory.push({
      status: body.status,
      changedBy: req.user._id,
      note: text,
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
  if (body.costPayer === "TENANT" && req.user.role !== "LANDLORD")
    throw new ForbiddenError("Chỉ chủ trọ được quyết định khách thuê chịu phí");
  return mongoose.connection.transaction(async (session) => {
    await requireIncidents(req, session);
    const incident = await find(req, req.params.incidentId, session);
    const before = incident.toObject();
    if (!COST_EDITABLE.includes(incident.status))
      throw new BusinessRuleError(
        "Chỉ ghi nhận chi phí khi sự cố đang xử lý hoặc đã sửa xong",
        "INCIDENT_COST_LOCKED",
      );
    if (body.costPayer === "TENANT" && !incident.contractId)
      throw new BusinessRuleError(
        "Sự cố không gắn với hợp đồng nên không thể tính phí cho khách thuê",
      );
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

module.exports = { list, get, create, updateStatus, updateCost };
