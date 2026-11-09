const mongoose = require("mongoose");
const { LIVE_CONTRACT_STATUSES, OPEN_CONTRACT_STATUSES } = require("../utils/statuses");
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
const User = require("../models/User");
const { makeVietQr } = require("./financeCalculation");
const { hasFeature } = require("./planFeatures");
const { simulatorEnabled } = require("../utils/paymentSimulator");
const bankTransfer = require("./payments/bankTransferService");
const { recordDepositPayment, manualDepositReference } = require("./payments/depositPayment");
const DEPOSIT_RECEIVE_METHODS = ["CASH", "BANK_TRANSFER"];
const liveStatuses = LIVE_CONTRACT_STATUSES;
const openStatuses = OPEN_CONTRACT_STATUSES;
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
      if (
        /[.$]/.test(name) ||
        ["__proto__", "prototype", "constructor"].includes(name)
      )
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
      path: "landlordId",
      select: "name email phoneNumber citizenId hometown" + OWNED_FIELDS,
      match: (doc) => ({ _id: doc.landlordId, isDeleted: false }),
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
        "roomNumber floor currentElectricIndex currentWaterIndex" +
        OWNED_FIELDS,
      match: owned,
    },
  ]);
}
const awaitingDeposit = (contract) =>
  contract.depositStatus === "UNPAID" &&
  contract.depositAmount > 0 &&
  openStatuses.includes(contract.status);

// VietQR to the landlord's bank account for a deposit not received yet; null otherwise.
async function depositPayment(contract) {
  if (!awaitingDeposit(contract)) return null;
  const landlord = await User.findById(contract.landlordId).select("bankConfig").lean();
  const bank = landlord?.bankConfig;
  if (!bank?.bankCode || !bank.accountNumber || !bank.accountName)
    return { amount: contract.depositAmount, bankConfigured: false };
  const syntax = bankTransfer.depositSyntax(contract.contractCode);
  return {
    amount: contract.depositAmount,
    bankConfigured: true,
    // Bank notifications book the deposit by themselves on plans with automatic reconciliation.
    autoConfirm: await hasFeature(contract.landlordId, "SEPAY_WEBHOOK"),
    simulator: simulatorEnabled(),
    paymentSyntax: syntax,
    bank: {
      bankName: bank.bankName || bank.bankCode,
      accountNumber: bank.accountNumber,
      accountName: bank.accountName,
    },
    vietQrUrl: makeVietQr(bank, contract.depositAmount, syntax),
  };
}

async function get(req, id) {
  const contract = await Contract.findOne(
    scoped(getTenantScope(req), { _id: validId(id) }),
  ).lean();
  if (!contract) throw new NotFoundError("Không tìm thấy hợp đồng");
  if (contract.settlement?.state === "PREPARED")
    contract.settlement = await settlementService.currentSettlement(contract);
  const [, deposit] = await Promise.all([enrich([contract]), depositPayment(contract)]);
  return {
    ...contract,
    displayStatus: displayStatus(contract),
    depositPayment: deposit,
  };
}

// Landlord confirms the deposit was received (cash or transfer). Only UNPAID -> PAID;
// a deposit already received, refunded or applied is left untouched.
async function markDepositReceived(req, contractId) {
  const body = v.fields(req.body || {}, ["paymentMethod", "note"]);
  const paymentMethod = body.paymentMethod ?? "CASH";
  if (!DEPOSIT_RECEIVE_METHODS.includes(paymentMethod))
    throw new ValidationError("Hình thức nhận cọc không hợp lệ");
  v.text(body.note, "Ghi chú", false);
  const note = body.note?.trim() || undefined;
  const filter = scoped(getTenantScope(req), { _id: validId(contractId) });
  const now = new Date();
  const contract = await mongoose.connection.transaction(async (session) => {
    const updated = await Contract.findOneAndUpdate(
      {
        $and: [
          filter,
          {
            depositStatus: "UNPAID",
            depositAmount: { $gt: 0 },
            status: { $in: openStatuses },
          },
        ],
      },
      {
        $set: {
          depositStatus: "PAID",
          depositReceivedAt: now,
          depositReceivedBy: req.user._id,
        },
      },
      { session, returnDocument: "after" },
    );
    if (!updated) {
      const current = await Contract.findOne(filter).session(session).lean();
      if (!current) throw new NotFoundError("Không tìm thấy hợp đồng");
      if (current.depositStatus !== "UNPAID")
        throw new BusinessRuleError("Hợp đồng đã ghi nhận tiền cọc", "DEPOSIT_ALREADY_RECEIVED");
      if (!(current.depositAmount > 0))
        throw new BusinessRuleError("Hợp đồng không có tiền cọc", "DEPOSIT_NOT_REQUIRED");
      throw new BusinessRuleError("Hợp đồng đã kết thúc, không thể ghi nhận cọc", "CONTRACT_NOT_ACTIVE");
    }
    const referenceCode = manualDepositReference(updated.contractCode);
    updated.depositReferenceCode = referenceCode;
    await updated.save({ session });
    const payment = await recordDepositPayment(
      updated,
      {
        paymentMethod,
        referenceCode,
        receiptNumber: referenceCode,
        gateway: paymentMethod === "CASH" ? "CASH" : "MANUAL",
        transactionDate: now,
        confirmedBy: req.user._id,
        reportedBy: req.user._id,
        note,
      },
      session,
    );
    await audit.log({
      req,
      action: "RECEIVE_CONTRACT_DEPOSIT",
      entityType: "CONTRACT",
      entityId: updated._id,
      before: { depositStatus: "UNPAID" },
      after: {
        depositStatus: "PAID",
        depositAmount: updated.depositAmount,
        depositReceivedAt: now,
        paymentMethod,
        paymentId: payment._id,
      },
      session,
    });
    return updated;
  });
  return get(req, String(contract._id));
}
const DEPOSIT_STATUSES = ["PAID", "UNPAID", "REFUNDED", "PARTIALLY_REFUNDED", "APPLIED"];

// Free-text search: contract code, room number, tenant name / phone / CCCD, or a roommate.
async function searchFilter(scope, re) {
  const [rooms, tenants] = await Promise.all([
    Room.find({ landlordId: scope.landlordId, isDeleted: false, roomNumber: re })
      .select("_id")
      .limit(200)
      .lean(),
    User.find({
      role: "TENANT",
      landlordId: scope.landlordId,
      isDeleted: false,
      $or: [{ name: re }, { phoneNumber: re }, { citizenId: re }],
    })
      .select("_id")
      .limit(200)
      .lean(),
  ]);
  return {
    $or: [
      { contractCode: re },
      { roomId: { $in: rooms.map((r) => r._id) } },
      { tenantId: { $in: tenants.map((t) => t._id) } },
      { "roommates.fullName": re },
      { "roommates.phoneNumber": re },
      { "roommates.citizenId": re },
    ],
  };
}

async function list(req) {
  const { page, limit, skip } = v.pagination(req.query),
    baseFilter = {};
  if (req.query.branchId) {
    assertBranchScope(req, req.query.branchId);
    baseFilter.branchId = req.query.branchId;
  }
  if (req.query.depositStatus) {
    v.choice(req.query.depositStatus, DEPOSIT_STATUSES, "Trạng thái cọc");
    baseFilter.depositStatus = req.query.depositStatus;
  }
  if (req.query.confirmation) {
    v.choice(req.query.confirmation, ["PENDING", "CONFIRMED"], "Xác nhận");
    Object.assign(
      baseFilter,
      req.query.confirmation === "CONFIRMED"
        ? { landlordConfirmedAt: { $ne: null }, tenantConfirmedAt: { $ne: null } }
        : { $or: [{ landlordConfirmedAt: null }, { tenantConfirmedAt: null }] },
    );
  }
  const scope = getTenantScope(req);
  if (req.query.search)
    baseFilter.$and = [await searchFilter(scope, v.search(req.query.search))];

  const filter = { ...baseFilter };
  const now = new Date(),
    soon = new Date(now.getTime() + 30 * 86400000);
  if (req.query.status) {
    v.choice(
      req.query.status,
      ["ACTIVE", "EXPIRING_SOON", "EXPIRED", "TERMINATED", "DRAFT"],
      "Trạng thái hợp đồng",
    );
    filter.status = liveStatuses.includes(req.query.status)
      ? { $in: liveStatuses }
      : req.query.status;
    if (req.query.status === "ACTIVE") filter.endDate = { $gt: soon };
    if (req.query.status === "EXPIRING_SOON")
      filter.endDate = { $gte: now, $lte: soon };
    if (req.query.status === "EXPIRED") filter.endDate = { $lt: now };
  }
  const query = scoped(scope, filter);
  const baseQuery = scoped(scope, baseFilter);
  const [items, total, allForSummary] = await Promise.all([
    Contract.find(query)
      .sort({ createdAt: -1, _id: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Contract.countDocuments(query),
    Contract.find(baseQuery)
      .select("status endDate depositAmount depositStatus")
      .lean(),
  ]);
  await enrich(items);
  const summary = {
    all: allForSummary.length,
    draft: 0,
    active: 0,
    expiringSoon: 0,
    expired: 0,
    terminated: 0,
    totalDeposit: 0,
  };
  for (const c of allForSummary) {
    const ds = displayStatus(c, now);
    if (ds === "DRAFT") summary.draft += 1;
    else if (ds === "ACTIVE") summary.active += 1;
    else if (ds === "EXPIRING_SOON") summary.expiringSoon += 1;
    else if (ds === "EXPIRED") summary.expired += 1;
    else if (ds === "TERMINATED") summary.terminated += 1;
    if (c.depositStatus === "PAID" && openStatuses.includes(c.status)) {
      summary.totalDeposit += Number(c.depositAmount || 0);
    }
  }
  return {
    items: items.map((c) => ({ ...c, displayStatus: displayStatus(c, now) })),
    total,
    page,
    limit,
    summary,
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
      if (
        service.billingType === "PER_UNIT" &&
        body.serviceQuantities?.[service.name] === undefined
      )
        throw new ValidationError(`Thiếu số lượng dịch vụ ${service.name}`);
    }
    if (
      room.status !== "EMPTY" ||
      room.currentContractId ||
      (await Contract.exists({
        roomId: room._id,
        landlordId: branch.landlordId,
        isDeleted: false,
        status: { $in: openStatuses },
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
    const { user: tenant, credentials } = await accounts.tenantForContract(
      req,
      body.tenant,
      session,
    );
    const { tenant: _tenant, ...input } = body;
    const [contract] = await Contract.create(
      [
        {
          ...input,
          landlordId: branch.landlordId,
          tenantId: tenant._id,
          contractCode: `HDT-${new Date().getUTCFullYear()}-${crypto.randomBytes(6).toString("hex").toUpperCase()}`,
          // Nháp cho tới khi cả chủ trọ và khách thuê ký xác nhận; chưa được lập hóa đơn.
          status: "DRAFT",
          confirmedByBothParties: false,
          contractSigningLocation: branch.address?.fullAddress || "Online qua Cổng cư dân",
          contractTerms: {
            paymentDueDays: 5,
            latePaymentPenaltyRate: 0.5,
            terminationNoticeDays: 30,
          },
        },
      ],
      { session },
    );
    // Deposit already handed over at signing: it goes in the ledger like any other deposit.
    if (contract.depositStatus === "PAID" && contract.depositAmount > 0) {
      const referenceCode = manualDepositReference(contract.contractCode);
      contract.depositReceivedAt = new Date();
      contract.depositReceivedBy = req.user._id;
      contract.depositReferenceCode = referenceCode;
      await contract.save({ session });
      await recordDepositPayment(
        contract,
        {
          paymentMethod: "CASH",
          referenceCode,
          receiptNumber: referenceCode,
          gateway: "CASH",
          transactionDate: contract.depositReceivedAt,
          confirmedBy: req.user._id,
          reportedBy: req.user._id,
          note: "Nhận cọc khi ký hợp đồng",
        },
        session,
      );
    }
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
  return result.credentials
    ? { ...contract, tenantCredentials: result.credentials }
    : contract;
}
async function terminate(req) {
  await settlementService.terminate(req);
  return get(req, req.params.contractId);
}

// ============ Xác nhận hợp đồng điện tử 2 chiều ============
function validateConfirm(body) {
  if (body && typeof body === "object" && !Array.isArray(body)) {
    v.fields(body, []);
  }
  return body || {};
}

// Both signatures in: the draft becomes a running contract (and can be invoiced from now on).
// Returns true when this call activated it.
function activateIfSigned(contract) {
  contract.confirmedByBothParties = !!(contract.landlordConfirmedAt && contract.tenantConfirmedAt);
  if (!contract.confirmedByBothParties || contract.status !== "DRAFT") return false;
  contract.status = "ACTIVE";
  contract.activatedAt = new Date();
  return true;
}
function auditActivation(req, contract) {
  return audit.log({
    req,
    action: "ACTIVATE_CONTRACT",
    entityType: "CONTRACT",
    entityId: contract._id,
    before: { status: "DRAFT" },
    after: { status: "ACTIVE", activatedAt: contract.activatedAt },
  });
}

// A draft that will not be signed: free the room. A deposit already taken is recorded as
// handed back in full (nothing was billed yet).
async function cancelDraft(req, contractId) {
  const body = v.fields(req.body || {}, ["reason"]);
  v.text(body.reason, "Lý do hủy", false);
  await mongoose.connection.transaction(async (session) => {
    const contract = await Contract.findOne(
      scoped(getTenantScope(req), { _id: validId(contractId) }),
    ).session(session);
    if (!contract) throw new NotFoundError("Không tìm thấy hợp đồng");
    if (contract.status !== "DRAFT")
      throw new BusinessRuleError(
        "Chỉ hủy được hợp đồng nháp; hợp đồng đã ký phải thanh lý",
        "CONTRACT_NOT_DRAFT",
      );
    const before = { status: contract.status, depositStatus: contract.depositStatus };
    const now = new Date();
    contract.status = "TERMINATED";
    contract.actualEndDate = now;
    contract.cancelledAt = now;
    contract.cancellationReason = body.reason?.trim() || undefined;
    if (contract.depositStatus === "PAID") {
      contract.depositStatus = "REFUNDED";
      contract.refundedDepositAmount = contract.depositAmount;
    }
    await contract.save({ session });
    await Room.updateOne(
      { _id: contract.roomId, landlordId: contract.landlordId, currentContractId: contract._id },
      { $set: { status: "EMPTY" }, $unset: { currentContractId: "" } },
      { session },
    );
    await audit.log({
      req,
      action: "CANCEL_DRAFT_CONTRACT",
      entityType: "CONTRACT",
      entityId: contract._id,
      before,
      after: {
        status: contract.status,
        depositStatus: contract.depositStatus,
        reason: contract.cancellationReason,
      },
      session,
    });
  });
  return get(req, contractId);
}

async function confirmByLandlord(req, contractId) {
  validateConfirm(req.body);
  const contract = await Contract.findOne(
    scoped(getTenantScope(req), { _id: validId(contractId) }),
  );
  if (!contract) throw new NotFoundError("Không tìm thấy hợp đồng");
  if (contract.landlordConfirmedAt)
    throw new BusinessRuleError("Hợp đồng đã được chủ trọ xác nhận");
  if (contract.status === "TERMINATED")
    throw new BusinessRuleError("Không thể xác nhận hợp đồng đã thanh lý");

  contract.landlordConfirmedAt = new Date();
  contract.landlordConfirmedBy = req.user._id;
  const activated = activateIfSigned(contract);
  await contract.save();

  await audit.log({
    req,
    action: "CONFIRM_CONTRACT_LANDLORD",
    entityType: "CONTRACT",
    entityId: contract._id,
    before: { landlordConfirmedAt: null },
    after: { landlordConfirmedAt: contract.landlordConfirmedAt },
  });
  if (activated) await auditActivation(req, contract);

  return get(req, contractId);
}

async function confirmByTenant(req, contractId) {
  validateConfirm(req.body);
  const contract = await Contract.findOne(
    scoped(getTenantScope(req), { _id: validId(contractId) }),
  );
  if (!contract) throw new NotFoundError("Không tìm thấy hợp đồng");
  if (contract.tenantId.toString() !== req.user._id.toString())
    throw new BusinessRuleError("Chỉ khách thuê trong hợp đồng mới có quyền xác nhận");
  if (contract.tenantConfirmedAt)
    throw new BusinessRuleError("Hợp đồng đã được khách thuê xác nhận");
  if (contract.status === "TERMINATED")
    throw new BusinessRuleError("Không thể xác nhận hợp đồng đã thanh lý");

  contract.tenantConfirmedAt = new Date();
  contract.tenantConfirmedBy = req.user._id;
  const activated = activateIfSigned(contract);
  await contract.save();

  await audit.log({
    req,
    action: "CONFIRM_CONTRACT_TENANT",
    entityType: "CONTRACT",
    entityId: contract._id,
    before: { tenantConfirmedAt: null },
    after: { tenantConfirmedAt: contract.tenantConfirmedAt },
  });
  if (activated) await auditActivation(req, contract);

  return get(req, contractId);
}

// Sandbox: pretend the tenant transferred the deposit, through the real bank matching path.
async function simulateDeposit(req, contractId) {
  v.fields(req.body || {}, []);
  const contract = await Contract.findOne(
    scoped(getTenantScope(req), { _id: validId(contractId) }),
  ).lean();
  if (!contract) throw new NotFoundError("Không tìm thấy hợp đồng");
  if (!awaitingDeposit(contract))
    throw new BusinessRuleError("Hợp đồng không còn khoản cọc cần chuyển", "DEPOSIT_ALREADY_RECEIVED");
  const result = await bankTransfer.simulateDepositTransfer(contract);
  return { result, contract: await get(req, contractId) };
}

// Contract extension (phụ lục gia hạn): new end date, optionally a new monthly rent from the next
// invoice on. Same contract code, deposit and tenant; each extension is kept in contract.renewals.
async function renew(req, contractId) {
  const body = v.fields(req.body || {}, ["endDate", "rentalPrice", "notes"]);
  const newEnd = v.date(body.endDate, "Ngày kết thúc mới");
  if (body.rentalPrice !== undefined) v.number(body.rentalPrice, "Giá thuê mới", 0);
  if (body.notes !== undefined) v.text(body.notes, "Ghi chú", false);
  const result = await mongoose.connection.transaction(async (session) => {
    const contract = await Contract.findOne(
      scoped(getTenantScope(req), { _id: validId(contractId) }),
    ).session(session);
    if (!contract) throw new NotFoundError("Không tìm thấy hợp đồng");
    if (!liveStatuses.includes(contract.status))
      throw new BusinessRuleError("Chỉ gia hạn hợp đồng chưa thanh lý", "CONTRACT_NOT_ACTIVE");
    if (contract.settlement?.state === "PREPARED")
      throw new BusinessRuleError(
        "Hợp đồng đang lập phiếu quyết toán; hủy quyết toán trước khi gia hạn",
        "CONTRACT_SETTLEMENT_PREPARED",
      );
    if (newEnd <= contract.endDate)
      throw new ValidationError("Ngày kết thúc mới phải sau ngày kết thúc hiện tại");
    if (newEnd <= new Date())
      throw new ValidationError("Ngày kết thúc mới phải ở tương lai");
    const before = { endDate: contract.endDate, rentalPrice: contract.rentalPrice };
    const rentalPrice = body.rentalPrice ?? contract.rentalPrice;
    contract.renewals.push({
      previousEndDate: contract.endDate,
      endDate: newEnd,
      previousRentalPrice: contract.rentalPrice,
      rentalPrice,
      notes: body.notes?.trim() || undefined,
      renewedBy: req.user._id,
    });
    contract.endDate = newEnd;
    contract.rentalPrice = rentalPrice;
    contract.status = "ACTIVE";
    await contract.save({ session });
    // A tenant locked after the old end date gets back in with their own password.
    const tenant = await User.findOne({ _id: contract.tenantId, landlordId: contract.landlordId }).session(session);
    if (tenant) await accounts.reopenTenant(req, tenant, "CONTRACT_RENEWED", session);
    await audit.log({
      req,
      action: "RENEW_CONTRACT",
      entityType: "CONTRACT",
      entityId: contract._id,
      before,
      after: { endDate: newEnd, rentalPrice, renewals: contract.renewals.length },
      session,
    });
    return String(contract._id);
  });
  return get(req, result);
}

const { prepareSettlement } = settlementService;
module.exports = {
  get,
  list,
  create,
  terminate,
  displayStatus,
  prepareSettlement,
  confirmByLandlord,
  confirmByTenant,
  cancelDraft,
  markDepositReceived,
  simulateDeposit,
  renew,
};
