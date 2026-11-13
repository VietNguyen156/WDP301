const mongoose = require("mongoose");
const { LIVE_CONTRACT_STATUSES, OWING_INVOICE_STATUSES } = require("../utils/statuses");
const crypto = require("node:crypto");
const Contract = require("../models/Contract");
const Room = require("../models/Room");
const Branch = require("../models/Branch");
const User = require("../models/User");
const Invoice = require("../models/Invoice");
const Payment = require("../models/Payment");
const { getTenantScope, scoped, validId } = require("../utils/scope");
const {
  BusinessRuleError,
  NotFoundError,
  ValidationError,
} = require("../utils/errors");
const v = require("../utils/validation");
const { paymentBalance, makeVietQr } = require("./financeCalculation");
const audit = require("./auditService");
const { vnDate } = require("../utils/vnTime");
const liveStatuses = LIVE_CONTRACT_STATUSES;
const payableStatuses = OWING_INVOICE_STATUSES;
const dayKey = vnDate;

// Why the contract ends. Decides which end dates are allowed and whether the deposit may be kept.
//   EXPIRED        hết hạn hợp đồng (trả phòng từ ngày kết thúc trở đi)
//   MUTUAL         hai bên thỏa thuận chấm dứt
//   TENANT_EARLY   khách trả phòng trước hạn, có báo trước đúng hợp đồng
//   TENANT_BREACH  khách tự ý chấm dứt / không báo trước / vi phạm: được giữ lại cọc (Điều tiền cọc)
//   LANDLORD_EARLY chủ trọ chấm dứt trước hạn: hoàn đủ phần cọc còn lại
const TERMINATION_REASONS = ["EXPIRED", "MUTUAL", "TENANT_EARLY", "TENANT_BREACH", "LANDLORD_EARLY"];
const EARLY_REASONS = ["TENANT_EARLY", "TENANT_BREACH", "LANDLORD_EARLY"];
const REFUND_METHODS = ["CASH", "BANK_TRANSFER"];

// Optional photo link (meter, damage): empty is allowed, otherwise it must be http(s).
function optionalUrl(value, label) {
  if (value === undefined || value === "") return undefined;
  v.text(value, label);
  if (!/^https?:\/\//.test(value)) throw new ValidationError(`${label} phải là URL http/https`);
  return value;
}

function validateCharges(body) {
  v.number(body.finalElectricIndex, "Chỉ số điện cuối");
  v.number(body.finalWaterIndex, "Chỉ số nước cuối");
  if (!Array.isArray(body.deductions) || body.deductions.length > 30)
    throw new ValidationError("Các khoản khấu trừ không hợp lệ");
  for (const deduction of body.deductions) {
    v.fields(deduction, ["reason", "amount", "evidenceImage", "furnishingName", "quantity"]);
    v.text(deduction.reason, "Lý do khấu trừ");
    v.number(deduction.amount, "Số tiền khấu trừ");
    deduction.evidenceImage = optionalUrl(deduction.evidenceImage, "Ảnh nghiệm thu");
    if (deduction.evidenceImage === undefined) delete deduction.evidenceImage;
    if (deduction.furnishingName !== undefined) {
      v.text(deduction.furnishingName, "Vật dụng");
      v.number(deduction.quantity, "Số lượng vật dụng", 1, 1000);
    } else if (deduction.quantity !== undefined)
      throw new ValidationError("Số lượng chỉ dùng cho khoản đền bù vật dụng");
  }
}

// Damage to items in the contract's handover list is capped at the agreed unit price
// (contract clause: compensate at that price, or the real repair cost if lower).
function checkFurnishingDeductions(contract, deductions) {
  const used = new Map();
  for (const d of deductions) {
    if (d.furnishingName === undefined) continue;
    const item = (contract.furnishings || []).find((f) => f.name === d.furnishingName);
    if (!item)
      throw new ValidationError(
        `"${d.furnishingName}" không có trong danh mục vật dụng bàn giao của hợp đồng`,
        "SETTLEMENT_FURNISHING_UNKNOWN",
      );
    const quantity = (used.get(item.name) || 0) + d.quantity;
    if (quantity > item.quantity)
      throw new ValidationError(
        `Số lượng "${item.name}" bị đền bù vượt số đã bàn giao (${item.quantity})`,
        "SETTLEMENT_FURNISHING_QUANTITY",
      );
    used.set(item.name, quantity);
    if (d.amount > item.price * d.quantity)
      throw new ValidationError(
        `Tiền đền bù "${item.name}" không được vượt đơn giá đã thỏa thuận (${item.price} x ${d.quantity})`,
        "SETTLEMENT_FURNISHING_OVER_PRICE",
      );
  }
}

function validateBody(body) {
  v.fields(body, [
    "actualEndDate",
    "finalElectricIndex",
    "finalWaterIndex",
    "deductions",
    "settlementNotes",
    "confirmedByBothParties",
    "electricImage",
    "waterImage",
    "terminationReason",
    "forfeitDeposit",
  ]);
  v.date(body.actualEndDate, "Ngày trả phòng");
  validateCharges(body);
  v.choice(body.terminationReason, TERMINATION_REASONS, "Lý do chấm dứt hợp đồng");
  if (body.forfeitDeposit !== undefined && typeof body.forfeitDeposit !== "boolean")
    throw new ValidationError("Giá trị giữ lại cọc không hợp lệ");
  if (body.forfeitDeposit && body.terminationReason !== "TENANT_BREACH")
    throw new ValidationError(
      "Chỉ được giữ lại tiền cọc khi khách vi phạm hợp đồng (tự ý chấm dứt hoặc không báo trước)",
      "SETTLEMENT_FORFEIT_NOT_ALLOWED",
    );
  if (body.confirmedByBothParties !== true)
    throw new ValidationError(
      "Cần xác nhận biên bản bởi chủ nhà và người thuê",
    );
  for (const key of ["electricImage", "waterImage"]) {
    body[key] = optionalUrl(body[key], "Ảnh đồng hồ");
    if (body[key] === undefined) delete body[key];
  }
  v.text(body.settlementNotes, "Ghi chú", false);
  return body;
}

// The end date has to fit the reason: "hết hạn" from the contract end date on, the early
// reasons before it.
function checkReasonAgainstDates(contract, reason, actualEndDate) {
  const end = dayKey(contract.endDate);
  const out = dayKey(actualEndDate);
  if (reason === "EXPIRED" && out < end)
    throw new ValidationError(
      `Hợp đồng kết thúc ngày ${end}; trả phòng trước ngày này hãy chọn lý do thỏa thuận hoặc trả phòng trước hạn`,
      "SETTLEMENT_REASON_DATE",
    );
  if (EARLY_REASONS.includes(reason) && out >= end)
    throw new ValidationError(
      `Ngày trả phòng không trước ngày kết thúc hợp đồng (${end}); hãy chọn lý do hết hạn hợp đồng`,
      "SETTLEMENT_REASON_DATE",
    );
}

function calculateSettlement({
  contract,
  room,
  branch,
  body,
  debt = 0,
  invoices = [],
}) {
  validateCharges(body);
  // Only issued invoices establish billed consumption; unbilled readings are not payments.
  const oldElectricIndex = Math.max(
    contract.initialElectricIndex ?? room.currentElectricIndex ?? 0,
    ...invoices.map((i) => i.electricDetail?.newIndex || 0),
  );
  const oldWaterIndex = Math.max(
    contract.initialWaterIndex ?? room.currentWaterIndex ?? 0,
    ...invoices.map((i) => i.waterDetail?.newIndex || 0),
  );
  if (
    body.finalElectricIndex <
      Math.max(oldElectricIndex, room.currentElectricIndex || 0) ||
    body.finalWaterIndex < Math.max(oldWaterIndex, room.currentWaterIndex || 0)
  )
    throw new BusinessRuleError(
      "Chỉ số cuối không được nhỏ hơn chỉ số đã ghi nhận",
      "READING_LOWER_THAN_PREVIOUS",
    );
  const electricPrice = room.electricityPrice ?? branch.defaultElectricityPrice;
  const waterPrice = room.waterPrice ?? branch.defaultWaterPrice;
  const waterType = room.waterBillingType || branch.waterBillingType;
  v.number(electricPrice, "Đơn giá điện");
  v.number(waterPrice, "Đơn giá nước");
  const electricAmount =
    (body.finalElectricIndex - oldElectricIndex) * electricPrice;
  let waterAmount =
    waterType === "METER"
      ? (body.finalWaterIndex - oldWaterIndex) * waterPrice
      : 0;
  let roomAmount = 0;
  const servicesDetail = [];
  const headCount = 1 + (contract.roommates?.length || 0);
  if (body.actualEndDate && contract.startDate) {
    const start = dayKey(contract.startDate),
      end = dayKey(body.actualEndDate);
    const endMonth = end.slice(0, 7);
    const chargedPeriods = new Set(invoices.map((i) => i.billingPeriod));
    let cursor = new Date(`${start.slice(0, 7)}-01T00:00:00Z`);
    const services = room.services || branch.defaultServices || [];
    while (cursor.toISOString().slice(0, 7) <= endMonth) {
      const period = cursor.toISOString().slice(0, 7);
      const year = cursor.getUTCFullYear(),
        month = cursor.getUTCMonth();
      const days = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
      const first = period === start.slice(0, 7) ? Number(start.slice(8)) : 1;
      const last = period === endMonth ? Number(end.slice(8)) : days;
      const ratio = (last - first + 1) / days;
      if (!chargedPeriods.has(period)) {
        roomAmount += Math.round(contract.rentalPrice * ratio);
        if (waterType !== "METER")
          waterAmount += Math.round(
            waterPrice * (waterType === "PER_PERSON" ? headCount : 1) * ratio,
          );
        for (const service of services) {
          let quantity = service.billingType === "PER_PERSON" ? headCount : 1;
          if (service.billingType === "PER_UNIT") {
            quantity =
              contract.serviceQuantities?.get?.(service.name) ??
              contract.serviceQuantities?.[service.name];
            v.number(quantity, `Số lượng dịch vụ ${service.name}`);
          }
          v.number(service.price, "Giá dịch vụ");
          servicesDetail.push({
            serviceName: `${service.name} (${period})`,
            billingType: service.billingType,
            unitPrice: service.price,
            quantity,
            amount: Math.round(service.price * quantity * ratio),
          });
        }
      }
      cursor = new Date(Date.UTC(year, month + 1, 1));
    }
  }
  const serviceAmount = servicesDetail.reduce((sum, s) => sum + s.amount, 0);
  const deductionAmount = body.deductions.reduce((sum, d) => sum + d.amount, 0);
  const heldDeposit =
    contract.depositStatus === "PAID" ? contract.depositAmount : 0;
  const totalCharges =
    debt +
    roomAmount +
    electricAmount +
    waterAmount +
    serviceAmount +
    deductionAmount;
  v.number(totalCharges, "Tổng quyết toán");
  return {
    heldDeposit,
    roomAmount,
    electricAmount,
    waterAmount,
    serviceAmount,
    deductionAmount,
    outstandingDebt: debt,
    totalCharges,
    refundedDepositAmount: Math.max(heldDeposit - totalCharges, 0),
    remainingDue: Math.max(totalCharges - heldDeposit, 0),
    servicesDetail,
    electricDetail: {
      oldIndex: oldElectricIndex,
      newIndex: body.finalElectricIndex,
      consumed: body.finalElectricIndex - oldElectricIndex,
      unitPrice: electricPrice,
      amount: electricAmount,
    },
    waterDetail: {
      billingType: waterType,
      oldIndex: oldWaterIndex,
      newIndex: body.finalWaterIndex,
      consumed:
        waterType === "METER" ? body.finalWaterIndex - oldWaterIndex : 0,
      headCount,
      unitPrice: waterPrice,
      amount: waterAmount,
    },
  };
}

async function context(req, session) {
  const contract = await Contract.findOne(
    scoped(getTenantScope(req), {
      _id: validId(req.params.contractId),
    }),
  ).session(session);
  if (!contract) throw new NotFoundError("Không tìm thấy hợp đồng");
  if (!liveStatuses.includes(contract.status))
    throw new BusinessRuleError("Hợp đồng không còn hiệu lực để thanh lý");
  const room = await Room.findOne({
    _id: contract.roomId,
    branchId: contract.branchId,
    landlordId: contract.landlordId,
    isDeleted: false,
    currentContractId: contract._id,
  }).session(session);
  const branch = await Branch.findOne({
    _id: contract.branchId,
    landlordId: contract.landlordId,
    isDeleted: false,
  })
    .session(session)
    .lean();
  if (!room || !branch)
    throw new BusinessRuleError("Phòng hoặc cơ sở không còn liên kết hợp đồng");
  return { contract, room, branch };
}

function assertSameBody(contract, body) {
  if (!Object.keys(body || {}).length) return;
  validateBody(body);
  for (const key of [
    "finalElectricIndex",
    "finalWaterIndex",
    "electricImage",
    "waterImage",
    "confirmedByBothParties",
    "terminationReason",
  ])
    if (body[key] !== contract[key])
      throw new BusinessRuleError(
        "Biên bản quyết toán đã được chốt",
        "SETTLEMENT_IMMUTABLE",
      );
  // forfeitedDeposit is stored (even 0) exactly when the landlord chose to keep the deposit.
  if (Boolean(body.forfeitDeposit) !== (contract.settlement?.forfeitedDeposit != null))
    throw new BusinessRuleError("Biên bản quyết toán đã được chốt", "SETTLEMENT_IMMUTABLE");
  const pick = ({ reason, amount, evidenceImage, furnishingName, quantity }) => ({
    reason,
    amount,
    evidenceImage: evidenceImage || undefined,
    furnishingName: furnishingName || undefined,
    quantity: quantity || undefined,
  });
  const existing = contract.deductions.map(pick);
  const incoming = body.deductions.map(pick);
  if (
    new Date(body.actualEndDate).getTime() !==
      contract.actualEndDate.getTime() ||
    JSON.stringify(incoming) !== JSON.stringify(existing) ||
    (body.settlementNotes || "") !== (contract.settlementNotes || "")
  )
    throw new BusinessRuleError(
      "Biên bản quyết toán đã được chốt",
      "SETTLEMENT_IMMUTABLE",
    );
}

async function applyDeposit(req, contract, invoice, amount, session) {
  const before = invoice.toObject();
  Object.assign(invoice, paymentBalance(invoice, amount));
  invoice.depositAppliedAmount = (invoice.depositAppliedAmount || 0) + amount;
  const [payment] = await Payment.create(
    [
      {
        landlordId: contract.landlordId,
        branchId: contract.branchId,
        invoiceId: invoice._id,
        invoiceCode: invoice.invoiceCode,
        amount,
        paymentMethod: "DEPOSIT",
        gateway: "DEPOSIT",
        referenceCode: `DEPOSIT-${contract._id}-${invoice._id}`,
        confirmedBy: req.user._id,
        note: `Cấn trừ cọc hợp đồng ${contract.contractCode}`,
        status: "SUCCESS",
      },
    ],
    { session },
  );
  if (invoice.bankSnapshot?.bankCode && invoice.remainingAmount > 0)
    invoice.vietQrUrl = makeVietQr(
      invoice.bankSnapshot,
      invoice.remainingAmount,
      invoice.paymentSyntax,
    );
  else invoice.vietQrUrl = undefined;
  await audit.log({
    req,
    action: "APPLY_CONTRACT_DEPOSIT",
    entityType: "INVOICE",
    entityId: invoice._id,
    before,
    after: {
      paymentId: payment._id,
      amount,
      remainingAmount: invoice.remainingAmount,
    },
    session,
  });
}

async function prepare(req, ctx, session) {
  const { contract, room, branch } = ctx;
  if (contract.settlement?.state === "PREPARED") {
    assertSameBody(contract, req.body);
    return;
  }
  const body = validateBody(req.body);
  const actualEndDate = v.date(body.actualEndDate, "Ngày trả phòng");
  if (actualEndDate < contract.startDate || actualEndDate > new Date())
    throw new ValidationError(
      "Ngày trả phòng phải từ ngày bắt đầu đến hôm nay",
    );
  checkReasonAgainstDates(contract, body.terminationReason, actualEndDate);
  checkFurnishingDeductions(contract, body.deductions);
  const invoices = await Invoice.find({
    landlordId: contract.landlordId,
    branchId: contract.branchId,
    roomId: contract.roomId,
    contractId: contract._id,
    tenantId: contract.tenantId,
    isDeleted: false,
    status: { $ne: "CANCELLED" },
  })
    .sort({ dueDate: 1, _id: 1 })
    .session(session);
  if (invoices.some((i) => i.status === "DRAFT"))
    throw new BusinessRuleError(
      "Phát hành hoặc hủy hóa đơn nháp trước khi quyết toán",
      "CONTRACT_DRAFT_INVOICES",
    );
  if (invoices.some((i) => i.billingPeriod > dayKey(actualEndDate).slice(0, 7)))
    throw new BusinessRuleError(
      "Cần xử lý hóa đơn kỳ sau ngày trả phòng trước khi quyết toán",
      "SETTLEMENT_FUTURE_INVOICES",
    );
  for (const invoice of invoices) {
    v.number(invoice.totalAmount, "Tổng hóa đơn");
    v.number(invoice.paidAmount, "Tiền đã thu");
    v.number(invoice.remainingAmount, "Số dư hóa đơn");
    v.number(invoice.overpaidAmount, "Tiền trả thừa");
    if (
      invoice.remainingAmount !==
        Math.max(invoice.totalAmount - invoice.paidAmount, 0) ||
      invoice.overpaidAmount !==
        Math.max(invoice.paidAmount - invoice.totalAmount, 0)
    )
      throw new BusinessRuleError(
        "Số dư hóa đơn không khớp, cần đối soát trước",
        "INVOICE_BALANCE_CONFLICT",
      );
    if (invoice.overpaidAmount > 0)
      throw new BusinessRuleError(
        "Cần hoàn hoặc đối soát tiền trả thừa trước khi quyết toán",
        "SETTLEMENT_OVERPAYMENT",
      );
  }
  const debt = invoices.reduce((sum, i) => sum + i.remainingAmount, 0);
  const calculated = calculateSettlement({
    contract,
    room,
    branch,
    body,
    invoices,
    debt,
  });
  // Tenant breach: the landlord keeps what is left of the deposit after every charge, as the
  // contract's deposit clause allows. It never makes the tenant owe more than the charges.
  const forfeitedDeposit = body.forfeitDeposit
    ? Math.max(calculated.heldDeposit - calculated.totalCharges, 0)
    : undefined;
  const penaltyFees = forfeitedDeposit
    ? [{ reason: "Giữ lại tiền cọc do Bên thuê vi phạm hợp đồng (tự ý chấm dứt / không báo trước)", amount: forfeitedDeposit }]
    : [];
  if (forfeitedDeposit) {
    calculated.totalCharges += forfeitedDeposit;
    calculated.refundedDepositAmount = 0;
  }
  const billingPeriod = dayKey(actualEndDate).slice(0, 7);
  const [year, month] = billingPeriod.split("-").map(Number);
  const landlord = await User.findOne({
    _id: contract.landlordId,
    role: "LANDLORD",
    isDeleted: false,
  })
    .session(session)
    .lean();
  const invoiceCode = `HDQT${crypto.randomBytes(10).toString("hex").toUpperCase()}`;
  const paymentSyntax = `${invoiceCode} P${room.roomNumber.replace(/[^A-Za-z0-9]/g, "")}`;
  const finalAmount = calculated.totalCharges - debt;
  const bank = landlord?.bankConfig;
  const [finalInvoice] = await Invoice.create(
    [
      {
        landlordId: contract.landlordId,
        branchId: contract.branchId,
        roomId: contract.roomId,
        contractId: contract._id,
        tenantId: contract.tenantId,
        invoiceType: "SETTLEMENT",
        invoiceCode,
        billingPeriod,
        year,
        month,
        dueDate: new Date(),
        paymentSyntax,
        roomAmount: calculated.roomAmount,
        electricDetail: calculated.electricDetail,
        waterDetail: calculated.waterDetail,
        servicesDetail: calculated.servicesDetail,
        additionalFees: [
          ...body.deductions.map(({ reason, amount }) => ({ reason, amount })),
          ...penaltyFees,
        ],
        totalAmount: finalAmount,
        remainingAmount: finalAmount,
        status: finalAmount === 0 ? "PAID" : "ISSUED",
        bankSnapshot: bank,
        notes: `Quyết toán ${contract.contractCode}`,
        vietQrUrl:
          finalAmount > 0 &&
          bank?.bankCode &&
          bank.accountNumber &&
          bank.accountName
            ? makeVietQr(bank, finalAmount, paymentSyntax)
            : undefined,
      },
    ],
    { session },
  );
  invoices.push(finalInvoice);
  let availableDeposit = calculated.heldDeposit;
  for (const invoice of invoices) {
    const amount = Math.min(availableDeposit, invoice.remainingAmount);
    if (amount > 0) {
      if (!payableStatuses.includes(invoice.status))
        throw new BusinessRuleError("Hóa đơn không thể nhận cọc");
      await applyDeposit(req, contract, invoice, amount, session);
      availableDeposit -= amount;
    }
    // Write even zero-credit invoices to serialize concurrent payments/cancellation.
    invoice.__v = (invoice.__v || 0) + 1;
    await invoice.save({ session });
  }
  const { forfeitDeposit: _forfeit, ...record } = body;
  Object.assign(contract, record, {
    actualEndDate,
    settlement: {
      forfeitedDeposit,
      state: "PREPARED",
      preparedAt: new Date(),
      invoiceId: finalInvoice._id,
      invoiceIds: invoices.map((i) => i._id),
      heldDeposit: calculated.heldDeposit,
      roomAmount: calculated.roomAmount,
      electricAmount: calculated.electricAmount,
      waterAmount: calculated.waterAmount,
      serviceAmount: calculated.serviceAmount,
      deductionAmount: calculated.deductionAmount,
      outstandingDebt: debt,
      totalCharges: calculated.totalCharges,
      depositAppliedAmount: calculated.heldDeposit - availableDeposit,
      refundedDepositAmount: availableDeposit,
      remainingDue: calculated.remainingDue,
    },
  });
  await contract.save({ session });
  // Serialize room edits and prevent a second contract until final termination.
  room.__v = (room.__v || 0) + 1;
  room.currentElectricIndex = body.finalElectricIndex;
  room.currentWaterIndex = body.finalWaterIndex;
  await room.save({ session });
  await audit.log({
    req,
    action: "PREPARE_CONTRACT_SETTLEMENT",
    entityType: "CONTRACT",
    entityId: contract._id,
    after: contract.toObject(),
    session,
  });
}

async function balances(contract, session = null) {
  const invoices = await Invoice.find({
    _id: { $in: contract.settlement.invoiceIds },
    landlordId: contract.landlordId,
    contractId: contract._id,
    isDeleted: false,
  })
    .session(session)
    .lean();
  if (
    invoices.length !== contract.settlement.invoiceIds.length ||
    invoices.some((i) => i.status === "CANCELLED")
  )
    throw new BusinessRuleError(
      "Hóa đơn quyết toán không còn hợp lệ",
      "SETTLEMENT_INVOICE_CONFLICT",
    );
  for (const invoice of invoices) {
    v.number(invoice.remainingAmount, "Số dư hóa đơn");
    if (
      invoice.remainingAmount !==
        Math.max(invoice.totalAmount - invoice.paidAmount, 0) ||
      invoice.overpaidAmount !==
        Math.max(invoice.paidAmount - invoice.totalAmount, 0)
    )
      throw new BusinessRuleError(
        "Số dư hóa đơn không khớp",
        "INVOICE_BALANCE_CONFLICT",
      );
  }
  return {
    invoices,
    remainingDue: invoices.reduce((sum, i) => sum + i.remainingAmount, 0),
    overpaidAmount: invoices.reduce((sum, i) => sum + i.overpaidAmount, 0),
  };
}

async function currentSettlement(contract) {
  const current = await balances(contract);
  return {
    ...contract.settlement,
    remainingDue: current.remainingDue,
    overpaidAmount: current.overpaidAmount,
  };
}

async function prepareSettlement(req) {
  await mongoose.connection.transaction(async (session) => {
    const ctx = await context(req, session);
    await prepare(req, ctx, session);
  });
  const contract = await Contract.findOne(
    scoped(getTenantScope(req), { _id: validId(req.params.contractId) }),
  ).lean();
  const current = await balances(contract);
  return {
    ...contract,
    settlement: {
      ...contract.settlement,
      remainingDue: current.remainingDue,
      overpaidAmount: current.overpaidAmount,
    },
    settlementInvoices: current.invoices,
  };
}

// Body: { refundMethod?: CASH | BANK_TRANSFER, refundNote? }. The settlement must already be
// prepared (POST /settlement); when deposit is refunded the landlord records how it was paid back.
function validateTermination(body = {}) {
  v.fields(body, ["refundMethod", "refundNote"]);
  if (body.refundMethod !== undefined) v.choice(body.refundMethod, REFUND_METHODS, "Hình thức hoàn cọc");
  v.text(body.refundNote, "Ghi chú hoàn cọc", false);
  return body;
}

async function terminate(req) {
  const body = validateTermination(req.body || {});
  await mongoose.connection.transaction(async (session) => {
    const ctx = await context(req, session);
    const { contract, room } = ctx;
    if (contract.settlement?.state !== "PREPARED")
      throw new BusinessRuleError(
        "Lập biên bản quyết toán trước khi thanh lý hợp đồng",
        "SETTLEMENT_NOT_PREPARED",
      );
    const refund = contract.settlement.refundedDepositAmount || 0;
    if (refund > 0 && !body.refundMethod)
      throw new ValidationError(
        "Chọn hình thức đã hoàn trả tiền cọc cho khách (tiền mặt hoặc chuyển khoản)",
        "REFUND_METHOD_REQUIRED",
      );
    const current = await balances(contract, session);
    if (current.remainingDue > 0)
      throw new BusinessRuleError(
        "Lập phiếu qua /settlement và thu đủ phần còn thiếu trước khi thanh lý",
        "SETTLEMENT_BALANCE_DUE",
      );
    if (current.overpaidAmount > 0)
      throw new BusinessRuleError(
        "Cần đối soát tiền trả thừa trước khi thanh lý",
        "SETTLEMENT_OVERPAYMENT",
      );
    const before = contract.toObject();
    contract.status = "TERMINATED";
    contract.settlement.state = "COMPLETED";
    contract.settlement.completedAt = new Date();
    if (refund > 0) {
      contract.settlement.refundMethod = body.refundMethod;
      contract.settlement.refundNote = body.refundNote || undefined;
      contract.settlement.refundedAt = new Date();
      contract.settlement.refundedBy = req.user._id;
    }
    contract.settlement.paymentsAfterPreparation = Math.max(
      contract.settlement.totalCharges -
        contract.settlement.depositAppliedAmount,
      0,
    );
    contract.settlement.remainingDue = 0;
    contract.refundedDepositAmount = contract.settlement.refundedDepositAmount;
    contract.depositStatus =
      contract.settlement.heldDeposit > 0
        ? contract.refundedDepositAmount === 0
          ? "APPLIED"
          : contract.settlement.depositAppliedAmount > 0
            ? "PARTIALLY_REFUNDED"
            : "REFUNDED"
        : contract.depositStatus;
    await contract.save({ session });
    room.status = "CLEANING";
    room.currentContractId = undefined;
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
}

module.exports = {
  TERMINATION_REASONS,
  calculateSettlement,
  prepareSettlement,
  terminate,
  currentSettlement,
};
