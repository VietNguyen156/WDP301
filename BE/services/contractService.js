const mongoose = require("mongoose");
const crypto = require("crypto");
const Contract = require("../models/Contract");
const accounts = require("./accountService");
const Room = require("../models/Room");
const settlementService = require("./contractSettlementService");
const branchService = require("./branchService");
const {
  getTenantScope,
  scoped,
  validId,
  assertBranchScope,
} = require("../utils/scope");
const {
  NotFoundError,
  BusinessRuleError,
  ValidationError,
} = require("../utils/errors");
const v = require("../utils/validation");
const audit = require("./auditService");
const liveStatuses = ["ACTIVE", "EXPIRING_SOON", "EXPIRED"];
function displayStatus(contract, now = new Date()) {
  if (!liveStatuses.includes(contract.status)) return contract.status;
  if (new Date(contract.endDate) < now) return "EXPIRED";
  return new Date(contract.endDate) <= new Date(now.getTime() + 30 * 86400000)
    ? "EXPIRING_SOON"
    : "ACTIVE";
}
function validateCreate(body) {
  v.fields(body, [
    "branchId",
    "roomId",
    "tenant",
    "startDate",
    "endDate",
    "rentalPrice",
    "depositAmount",
    "depositStatus",
    "initialElectricIndex",
    "initialWaterIndex",
    "roommates",
    "notes",
    "serviceQuantities",
  ]);
  validId(body.branchId);
  validId(body.roomId);
  accounts.profile(body.tenant, "TENANT");
  if (body.serviceQuantities !== undefined) {
    v.object(body.serviceQuantities, "Số lượng dịch vụ");
    if (Object.keys(body.serviceQuantities).length > 30)
      throw new ValidationError("Tối đa 30 số lượng dịch vụ");
    for (const [name, quantity] of Object.entries(body.serviceQuantities)) {
      v.text(name, "Tên dịch vụ");
      if (/[.$]/.test(name) || ["__proto__", "prototype", "constructor"].includes(name))
        throw new ValidationError("Tên dịch vụ không hợp lệ");
      v.number(quantity, "Số lượng dịch vụ");
    }
  }
  const start = v.date(body.startDate, "Ngày bắt đầu"),
    end = v.date(body.endDate, "Ngày kết thúc");
  if (end <= start)
    throw new ValidationError("Ngày kết thúc phải sau ngày bắt đầu");
  for (const key of [
    "rentalPrice",
    "depositAmount",
    "initialElectricIndex",
    "initialWaterIndex",
  ])
    v.number(body[key], key);
  if (body.depositStatus !== undefined)
    v.choice(body.depositStatus, ["PAID", "UNPAID"], "Trạng thái cọc");
  if (body.roommates !== undefined) {
    if (!Array.isArray(body.roommates) || body.roommates.length > 29)
      throw new ValidationError("Danh sách người ở cùng không hợp lệ");
    body.roommates.forEach((r) => {
      v.fields(r, ["fullName", "citizenId", "phoneNumber"]);
      v.text(r.fullName, "Tên người ở cùng");
      v.text(r.citizenId, "CCCD", false);
      v.text(r.phoneNumber, "Số điện thoại", false);
    });
  }
  if (body.notes !== undefined) v.text(body.notes, "Ghi chú", false);
  return body;
}
// Mongoose re-checks a per-document match on the fetched docs, so the matched
// fields must be selected or every populate silently falls back to the raw id.
const owned = (doc) => ({ landlordId: doc.landlordId, isDeleted: false });
const OWNED_FIELDS = " landlordId isDeleted";
async function enrich(items) {
  return Contract.populate(items, [
    {
      path: "tenantId",
      select: "name email phoneNumber citizenId hometown" + OWNED_FIELDS,
      match: owned,
    },
    {
      path: "branchId",
      select:
        "name address defaultElectricityPrice defaultWaterPrice waterBillingType" +
        OWNED_FIELDS,
      match: owned,
    },
    {
      path: "roomId",
      select:
        "roomNumber floor currentElectricIndex currentWaterIndex" + OWNED_FIELDS,
      match: owned,
    },
  ]);
}
async function get(req, id) {
  const contract = await Contract.findOne(
    scoped(getTenantScope(req), { _id: validId(id) }),
  ).lean();
  if (!contract) throw new NotFoundError("Không tìm thấy hợp đồng");
  if (contract.settlement?.state === "PREPARED")
    contract.settlement = await settlementService.currentSettlement(contract);
  await enrich([contract]);
  return { ...contract, displayStatus: displayStatus(contract) };
}
async function list(req) {
  const { page, limit, skip } = v.pagination(req.query),
    filter = {};
  if (req.query.branchId) {
    assertBranchScope(req, req.query.branchId);
    filter.branchId = req.query.branchId;
  }
  if (req.query.status) {
    v.choice(
      req.query.status,
      ["ACTIVE", "EXPIRING_SOON", "EXPIRED", "TERMINATED", "DRAFT"],
      "Trạng thái hợp đồng",
    );
    const now = new Date(),
      soon = new Date(now.getTime() + 30 * 86400000);
    filter.status = liveStatuses.includes(req.query.status)
      ? { $in: liveStatuses }
      : req.query.status;
    if (req.query.status === "ACTIVE") filter.endDate = { $gt: soon };
    if (req.query.status === "EXPIRING_SOON")
      filter.endDate = { $gte: now, $lte: soon };
    if (req.query.status === "EXPIRED") filter.endDate = { $lt: now };
  }
  if (req.query.search) filter.contractCode = v.search(req.query.search);
  const query = scoped(getTenantScope(req), filter);
  const [items, total] = await Promise.all([
    Contract.find(query)
      .sort({ createdAt: -1, _id: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Contract.countDocuments(query),
  ]);
  await enrich(items);
  return {
    items: items.map((c) => ({ ...c, displayStatus: displayStatus(c) })),
    total,
    page,
    limit,
  };
}
async function create(req) {
  const body = validateCreate(req.body);
  const result = await mongoose.connection.transaction(async (session) => {
    const branch = await branchService.lock(req, body.branchId, session);
    const room = await Room.findOne({
      _id: body.roomId,
      branchId: branch._id,
      landlordId: branch.landlordId,
      isDeleted: false,
    }).session(session);
    if (!room) throw new NotFoundError("Không tìm thấy phòng trong cơ sở");
    for (const service of room.services || branch.defaultServices || []) {
      if (service.billingType === "PER_UNIT" && body.serviceQuantities?.[service.name] === undefined)
        throw new ValidationError(`Thiếu số lượng dịch vụ ${service.name}`);
    }
    if (
      room.status !== "EMPTY" ||
      room.currentContractId ||
      (await Contract.exists({
        roomId: room._id,
        landlordId: branch.landlordId,
        isDeleted: false,
        status: { $in: liveStatuses },
      }).session(session))
    )
      throw new BusinessRuleError("Chỉ có thể lập hợp đồng cho phòng trống");
    if (1 + (body.roommates?.length || 0) > room.maxOccupants)
      throw new BusinessRuleError("Số người ở vượt sức chứa của phòng");
    if (
      body.initialElectricIndex < room.currentElectricIndex ||
      body.initialWaterIndex < room.currentWaterIndex
    )
      throw new BusinessRuleError(
        "Chỉ số bàn giao không được nhỏ hơn chỉ số hiện tại",
        "READING_LOWER_THAN_PREVIOUS",
      );
    const { user: tenant, credentials } = await accounts.tenantForContract(req, body.tenant, session);
    const { tenant: _tenant, ...input } = body;
    const [contract] = await Contract.create(
      [
        {
          ...input,
          landlordId: branch.landlordId,
          tenantId: tenant._id,
          contractCode: `HDT-${new Date().getUTCFullYear()}-${crypto.randomBytes(6).toString("hex").toUpperCase()}`,
          status: "ACTIVE",
        },
      ],
      { session },
    );
    room.status = "RENTED";
    room.currentContractId = contract._id;
    room.currentElectricIndex = body.initialElectricIndex;
    room.currentWaterIndex = body.initialWaterIndex;
    await room.save({ session });
    await audit.log({
      req,
      action: "CREATE_CONTRACT",
      entityType: "CONTRACT",
      entityId: contract._id,
      after: contract.toObject(),
      session,
    });
    return { id: String(contract._id), credentials };
  });
  const contract = await get(req, result.id);
  return result.credentials ? { ...contract, tenantCredentials: result.credentials } : contract;
}
async function terminate(req) {
  await settlementService.terminate(req);
  return get(req, req.params.contractId);
}
const { prepareSettlement } = settlementService;
module.exports = {
  get,
  list,
  create,
  terminate,
  displayStatus,
  prepareSettlement,
};
