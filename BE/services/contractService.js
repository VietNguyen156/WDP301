const mongoose = require("mongoose");
const crypto = require("crypto");
const Contract = require("../models/Contract");
const User = require("../models/User");
const Room = require("../models/Room");
const Invoice = require("../models/Invoice");
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
  ]);
  validId(body.branchId);
  validId(body.roomId);
  v.fields(body.tenant, [
    "name",
    "email",
    "phoneNumber",
    "citizenId",
    "hometown",
  ]);
  for (const key of ["name", "email", "phoneNumber", "citizenId"])
    v.text(body.tenant[key], key);
  if (
    !/^\S+@\S+\.\S+$/.test(body.tenant.email) ||
    !/^\+?[\d\s-]{9,15}$/.test(body.tenant.phoneNumber)
  )
    throw new ValidationError("Email hoặc số điện thoại không hợp lệ");
  if (body.tenant.hometown !== undefined)
    v.text(body.tenant.hometown, "Quê quán", false);
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
async function enrich(items) {
  return Contract.populate(items, [
    {
      path: "tenantId",
      select: "name email phoneNumber citizenId hometown",
      match: (doc) => ({ landlordId: doc.landlordId, isDeleted: false }),
    },
    {
      path: "branchId",
      select:
        "name address defaultElectricityPrice defaultWaterPrice waterBillingType",
      match: (doc) => ({ landlordId: doc.landlordId, isDeleted: false }),
    },
    {
      path: "roomId",
      select: "roomNumber floor currentElectricIndex currentWaterIndex",
      match: (doc) => ({ landlordId: doc.landlordId, isDeleted: false }),
    },
  ]);
}
async function get(req, id) {
  const contract = await Contract.findOne(
    scoped(getTenantScope(req), { _id: validId(id) }),
  ).lean();
  if (!contract) throw new NotFoundError("Không tìm thấy hợp đồng");
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
  const id = await mongoose.connection.transaction(async (session) => {
    const branch = await branchService.lock(req, body.branchId, session);
    const room = await Room.findOne({
      _id: body.roomId,
      branchId: branch._id,
      landlordId: branch.landlordId,
      isDeleted: false,
    }).session(session);
    if (!room) throw new NotFoundError("Không tìm thấy phòng trong cơ sở");
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
    const email = body.tenant.email.trim().toLowerCase(),
      phoneNumber = body.tenant.phoneNumber.trim();
    const matches = await User.find({
      $or: [{ email }, { phoneNumber }],
    }).session(session);
    let tenant = matches[0];
    if (
      matches.length > 1 ||
      (tenant &&
        (tenant.role !== "TENANT" ||
          tenant.isDeleted ||
          !["ACTIVE", "PENDING_ACTIVATION"].includes(tenant.status) ||
          String(tenant.landlordId) !== String(branch.landlordId) ||
          tenant.email !== email ||
          tenant.phoneNumber !== phoneNumber ||
          (tenant.citizenId &&
            tenant.citizenId !== body.tenant.citizenId.trim())))
    )
      throw new BusinessRuleError(
        "Thông tin khách thuê trùng với tài khoản khác. Vui lòng kiểm tra email, SĐT và CCCD.",
        "TENANT_IDENTITY_CONFLICT",
      );
    if (!tenant) {
      [tenant] = await User.create(
        [
          {
            ...body.tenant,
            email,
            phoneNumber,
            role: "TENANT",
            status: "PENDING_ACTIVATION",
            landlordId: branch.landlordId,
            password: crypto.randomBytes(32).toString("hex"),
          },
        ],
        { session },
      );
    }
    const { tenant: ignoredTenant, ...input } = body;
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
    return String(contract._id);
  });
  return get(req, id);
}
function calculateSettlement({ contract, room, branch, body, debt = 0 }) {
  v.number(body.finalElectricIndex, "Chỉ số điện cuối");
  v.number(body.finalWaterIndex, "Chỉ số nước cuối");
  if (
    body.finalElectricIndex < room.currentElectricIndex ||
    body.finalWaterIndex < room.currentWaterIndex
  )
    throw new BusinessRuleError(
      "Chỉ số cuối phải lớn hơn hoặc bằng chỉ số hiện tại",
      "READING_LOWER_THAN_PREVIOUS",
    );
  if (!Array.isArray(body.deductions) || body.deductions.length > 30)
    throw new ValidationError("Các khoản khấu trừ không hợp lệ");
  body.deductions.forEach((d) => {
    v.fields(d, ["reason", "amount", "evidenceImage"]);
    v.text(d.reason, "Lý do khấu trừ");
    v.number(d.amount, "Số tiền khấu trừ");
    v.text(d.evidenceImage, "Ảnh nghiệm thu");
    if (!/^https?:\/\//.test(d.evidenceImage))
      throw new ValidationError("Ảnh nghiệm thu phải là URL http/https");
  });
  const electricAmount =
    (body.finalElectricIndex - room.currentElectricIndex) *
    branch.defaultElectricityPrice;
  const waterAmount =
    branch.waterBillingType === "METER"
      ? (body.finalWaterIndex - room.currentWaterIndex) *
        branch.defaultWaterPrice
      : 0;
  const deductionAmount = body.deductions.reduce((sum, d) => sum + d.amount, 0);
  const heldDeposit =
    contract.depositStatus === "PAID" ? contract.depositAmount : 0;
  const totalCharges = electricAmount + waterAmount + deductionAmount + debt;
  v.number(totalCharges, "Tổng quyết toán");
  return {
    heldDeposit,
    electricAmount,
    waterAmount,
    deductionAmount,
    outstandingDebt: debt,
    totalCharges,
    refundedDepositAmount: Math.max(heldDeposit - totalCharges, 0),
    remainingDue: Math.max(totalCharges - heldDeposit, 0),
  };
}
async function terminate(req) {
  const body = v.fields(req.body, [
    "actualEndDate",
    "finalElectricIndex",
    "finalWaterIndex",
    "deductions",
    "settlementNotes",
    "confirmedByBothParties",
    "electricImage",
    "waterImage",
  ]);
  const actualEndDate = v.date(body.actualEndDate, "Ngày trả phòng");
  if (body.confirmedByBothParties !== true)
    throw new ValidationError(
      "Cần xác nhận biên bản bởi chủ nhà và người thuê",
    );
  for (const key of ["electricImage", "waterImage"]) {
    v.text(body[key], "Ảnh đồng hồ");
    if (!/^https?:\/\//.test(body[key]))
      throw new ValidationError("Ảnh đồng hồ phải là URL http/https");
  }
  v.text(body.settlementNotes, "Ghi chú", false);
  const id = validId(req.params.contractId);
  await mongoose.connection.transaction(async (session) => {
    const contract = await Contract.findOne(
      scoped(getTenantScope(req), { _id: id }),
    ).session(session);
    if (!contract) throw new NotFoundError();
    if (!liveStatuses.includes(contract.status))
      throw new BusinessRuleError("Hợp đồng không còn hiệu lực để thanh lý");
    if (actualEndDate < contract.startDate || actualEndDate > new Date())
      throw new ValidationError(
        "Ngày trả phòng phải từ ngày bắt đầu đến hôm nay",
      );
    const branch = await branchService.get(
      req,
      String(contract.branchId),
      session,
    );
    const room = await Room.findOne({
      _id: contract.roomId,
      landlordId: contract.landlordId,
      branchId: contract.branchId,
      isDeleted: false,
      currentContractId: contract._id,
    }).session(session);
    if (!room)
      throw new BusinessRuleError("Phòng không còn gắn với hợp đồng này");
    const pending = await Invoice.exists({
      landlordId: contract.landlordId,
      branchId: contract.branchId,
      contractId: contract._id,
      isDeleted: false,
      status: { $nin: ["PAID", "OVERPAID", "CANCELLED"] },
    }).session(session);
    // Finance owns payment allocation. Do not silently mark existing invoices paid.
    if (pending)
      throw new BusinessRuleError(
        "Cần quyết toán các hóa đơn còn mở ở phân hệ tài chính trước khi thanh lý",
        "CONTRACT_OUTSTANDING_INVOICES",
      );
    const settlement = calculateSettlement({ contract, room, branch, body });
    if (settlement.remainingDue > 0)
      throw new BusinessRuleError(
        `Chi phí vượt cọc ${settlement.remainingDue.toLocaleString("vi-VN")} ₫. Cần thu và quyết toán chi phí qua phân hệ tài chính trước.`,
        "SETTLEMENT_BALANCE_DUE",
      );
    const before = contract.toObject();
    Object.assign(contract, body, {
      actualEndDate,
      status: "TERMINATED",
      settlement,
      refundedDepositAmount: settlement.refundedDepositAmount,
      depositStatus: settlement.heldDeposit
        ? settlement.totalCharges
          ? "PARTIALLY_REFUNDED"
          : "REFUNDED"
        : contract.depositStatus,
    });
    await contract.save({ session });
    room.status = "CLEANING";
    room.currentContractId = undefined;
    room.currentElectricIndex = body.finalElectricIndex;
    room.currentWaterIndex = body.finalWaterIndex;
    await room.save({ session });
    await audit.log({
      req,
      action: "SETTLE_CONTRACT",
      entityType: "CONTRACT",
      entityId: contract._id,
      before,
      after: contract.toObject(),
      session,
    });
  });
  return get(req, id);
}
module.exports = {
  get,
  list,
  create,
  terminate,
  displayStatus,
  validateCreate,
  calculateSettlement,
};
