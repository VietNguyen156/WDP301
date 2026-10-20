const mongoose = require("mongoose");
const crypto = require("node:crypto");
const Contract = require("../models/Contract");
const Room = require("../models/Room");
const Branch = require("../models/Branch");
const User = require("../models/User");
const Invoice = require("../models/Invoice");
const Payment = require("../models/Payment");
const { getTenantScope, scoped, validId } = require("../utils/scope");
const { BusinessRuleError, NotFoundError, ValidationError } = require("../utils/errors");
const v = require("../utils/validation");
const { paymentBalance, makeVietQr } = require("./financeCalculation");
const audit = require("./auditService");
const { vnDate } = require("../utils/vnTime");
const liveStatuses = ["ACTIVE", "EXPIRING_SOON", "EXPIRED"];
const payableStatuses = ["ISSUED", "PARTIALLY_PAID", "UNPAID"];
const dayKey = vnDate;

function validateCharges(body) {
  v.number(body.finalElectricIndex, "Chỉ số điện cuối");
  v.number(body.finalWaterIndex, "Chỉ số nước cuối");
  if (!Array.isArray(body.deductions) || body.deductions.length > 30)
    throw new ValidationError("Các khoản khấu trừ không hợp lệ");
  for (const deduction of body.deductions) {
    v.fields(deduction, ["reason", "amount", "evidenceImage"]);
    v.text(deduction.reason, "Lý do khấu trừ");
    v.number(deduction.amount, "Số tiền khấu trừ");
    v.text(deduction.evidenceImage, "Ảnh nghiệm thu");
    if (!/^https?:\/\//.test(deduction.evidenceImage)) throw new ValidationError("Ảnh nghiệm thu phải là URL http/https");
  }
}

function validateBody(body) {
  v.fields(body, ["actualEndDate", "finalElectricIndex", "finalWaterIndex", "deductions",
    "settlementNotes", "confirmedByBothParties", "electricImage", "waterImage"]);
  v.date(body.actualEndDate, "Ngày trả phòng");
  validateCharges(body);
  if (body.confirmedByBothParties !== true)
    throw new ValidationError("Cần xác nhận biên bản bởi chủ nhà và người thuê");
  for (const key of ["electricImage", "waterImage"]) {
    v.text(body[key], "Ảnh đồng hồ");
    if (!/^https?:\/\//.test(body[key])) throw new ValidationError("Ảnh đồng hồ phải là URL http/https");
  }
  v.text(body.settlementNotes, "Ghi chú", false);
  return body;
}

function calculateSettlement({ contract, room, branch, body, debt = 0, invoices = [] }) {
  validateCharges(body);
  // Only issued invoices establish billed consumption; unbilled readings are not payments.
  const oldElectricIndex = Math.max(contract.initialElectricIndex ?? room.currentElectricIndex ?? 0,
    ...invoices.map((i) => i.electricDetail?.newIndex || 0));
  const oldWaterIndex = Math.max(contract.initialWaterIndex ?? room.currentWaterIndex ?? 0,
    ...invoices.map((i) => i.waterDetail?.newIndex || 0));
  if (body.finalElectricIndex < Math.max(oldElectricIndex, room.currentElectricIndex || 0)
    || body.finalWaterIndex < Math.max(oldWaterIndex, room.currentWaterIndex || 0))
    throw new BusinessRuleError("Chỉ số cuối không được nhỏ hơn chỉ số đã ghi nhận", "READING_LOWER_THAN_PREVIOUS");
  const electricPrice = room.electricityPrice ?? branch.defaultElectricityPrice;
  const waterPrice = room.waterPrice ?? branch.defaultWaterPrice;
  const waterType = room.waterBillingType || branch.waterBillingType;
  v.number(electricPrice, "Đơn giá điện");
  v.number(waterPrice, "Đơn giá nước");
  const electricAmount = (body.finalElectricIndex - oldElectricIndex) * electricPrice;
  let waterAmount = waterType === "METER" ? (body.finalWaterIndex - oldWaterIndex) * waterPrice : 0;
  let roomAmount = 0;
  const servicesDetail = [];
  const headCount = 1 + (contract.roommates?.length || 0);
  if (body.actualEndDate && contract.startDate) {
    const start = dayKey(contract.startDate), end = dayKey(body.actualEndDate);
    const endMonth = end.slice(0, 7);
    const chargedPeriods = new Set(invoices.map((i) => i.billingPeriod));
    let cursor = new Date(`${start.slice(0, 7)}-01T00:00:00Z`);
    const services = room.services || branch.defaultServices || [];
    while (cursor.toISOString().slice(0, 7) <= endMonth) {
      const period = cursor.toISOString().slice(0, 7);
      const year = cursor.getUTCFullYear(), month = cursor.getUTCMonth();
      const days = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
      const first = period === start.slice(0, 7) ? Number(start.slice(8)) : 1;
      const last = period === endMonth ? Number(end.slice(8)) : days;
      const ratio = (last - first + 1) / days;
      if (!chargedPeriods.has(period)) {
        roomAmount += Math.round(contract.rentalPrice * ratio);
        if (waterType !== "METER") waterAmount += Math.round(waterPrice * (waterType === "PER_PERSON" ? headCount : 1) * ratio);
        for (const service of services) {
          let quantity = service.billingType === "PER_PERSON" ? headCount : 1;
          if (service.billingType === "PER_UNIT") {
            quantity = contract.serviceQuantities?.get?.(service.name) ?? contract.serviceQuantities?.[service.name];
            v.number(quantity, `Số lượng dịch vụ ${service.name}`);
          }
          v.number(service.price, "Giá dịch vụ");
          servicesDetail.push({ serviceName: `${service.name} (${period})`, billingType: service.billingType,
            unitPrice: service.price, quantity, amount: Math.round(service.price * quantity * ratio) });
        }
      }
      cursor = new Date(Date.UTC(year, month + 1, 1));
    }
  }
  const serviceAmount = servicesDetail.reduce((sum, s) => sum + s.amount, 0);
  const deductionAmount = body.deductions.reduce((sum, d) => sum + d.amount, 0);
  const heldDeposit = contract.depositStatus === "PAID" ? contract.depositAmount : 0;
  const totalCharges = debt + roomAmount + electricAmount + waterAmount + serviceAmount + deductionAmount;
  v.number(totalCharges, "Tổng quyết toán");
  return {
    heldDeposit, roomAmount, electricAmount, waterAmount, serviceAmount, deductionAmount,
    outstandingDebt: debt, totalCharges, refundedDepositAmount: Math.max(heldDeposit - totalCharges, 0),
    remainingDue: Math.max(totalCharges - heldDeposit, 0), servicesDetail,
    electricDetail: { oldIndex: oldElectricIndex, newIndex: body.finalElectricIndex,
      consumed: body.finalElectricIndex - oldElectricIndex, unitPrice: electricPrice, amount: electricAmount },
    waterDetail: { billingType: waterType, oldIndex: oldWaterIndex, newIndex: body.finalWaterIndex,
      consumed: waterType === "METER" ? body.finalWaterIndex - oldWaterIndex : 0,
      headCount, unitPrice: waterPrice, amount: waterAmount },
  };
}

async function context(req, session) {
  const contract = await Contract.findOne(scoped(getTenantScope(req), {
    _id: validId(req.params.contractId),
  })).session(session);
  if (!contract) throw new NotFoundError("Không tìm thấy hợp đồng");
  if (!liveStatuses.includes(contract.status)) throw new BusinessRuleError("Hợp đồng không còn hiệu lực để thanh lý");
  const room = await Room.findOne({ _id: contract.roomId, branchId: contract.branchId,
    landlordId: contract.landlordId, isDeleted: false, currentContractId: contract._id }).session(session);
  const branch = await Branch.findOne({ _id: contract.branchId,
    landlordId: contract.landlordId, isDeleted: false }).session(session).lean();
  if (!room || !branch) throw new BusinessRuleError("Phòng hoặc cơ sở không còn liên kết hợp đồng");
  return { contract, room, branch };
}

function assertSameBody(contract, body) {
  if (!Object.keys(body || {}).length) return;
  validateBody(body);
  for (const key of ["finalElectricIndex", "finalWaterIndex", "electricImage", "waterImage", "confirmedByBothParties"])
    if (body[key] !== contract[key]) throw new BusinessRuleError("Biên bản quyết toán đã được chốt", "SETTLEMENT_IMMUTABLE");
  const existing = contract.deductions.map(({ reason, amount, evidenceImage }) => ({ reason, amount, evidenceImage }));
  const incoming = body.deductions.map(({ reason, amount, evidenceImage }) => ({ reason, amount, evidenceImage }));
  if (new Date(body.actualEndDate).getTime() !== contract.actualEndDate.getTime()
    || JSON.stringify(incoming) !== JSON.stringify(existing)
    || (body.settlementNotes || "") !== (contract.settlementNotes || ""))
    throw new BusinessRuleError("Biên bản quyết toán đã được chốt", "SETTLEMENT_IMMUTABLE");
}

async function applyDeposit(req, contract, invoice, amount, session) {
  const before = invoice.toObject();
  Object.assign(invoice, paymentBalance(invoice, amount));
  invoice.depositAppliedAmount = (invoice.depositAppliedAmount || 0) + amount;
  const [payment] = await Payment.create([{
    landlordId: contract.landlordId, branchId: contract.branchId, invoiceId: invoice._id,
    invoiceCode: invoice.invoiceCode, amount, paymentMethod: "DEPOSIT", gateway: "DEPOSIT",
    referenceCode: `DEPOSIT-${contract._id}-${invoice._id}`, confirmedBy: req.user._id,
    note: `Cấn trừ cọc hợp đồng ${contract.contractCode}`, status: "SUCCESS",
  }], { session });
  if (invoice.bankSnapshot?.bankCode && invoice.remainingAmount > 0)
    invoice.vietQrUrl = makeVietQr(invoice.bankSnapshot, invoice.remainingAmount, invoice.paymentSyntax);
  else invoice.vietQrUrl = undefined;
  await audit.log({ req, action: "APPLY_CONTRACT_DEPOSIT", entityType: "INVOICE",
    entityId: invoice._id, before, after: { paymentId: payment._id, amount, remainingAmount: invoice.remainingAmount }, session });
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
    throw new ValidationError("Ngày trả phòng phải từ ngày bắt đầu đến hôm nay");
  const invoices = await Invoice.find({ landlordId: contract.landlordId, branchId: contract.branchId,
    roomId: contract.roomId, contractId: contract._id, tenantId: contract.tenantId,
    isDeleted: false, status: { $ne: "CANCELLED" } }).sort({ dueDate: 1, _id: 1 }).session(session);
  if (invoices.some((i) => i.status === "DRAFT"))
    throw new BusinessRuleError("Phát hành hoặc hủy hóa đơn nháp trước khi quyết toán", "CONTRACT_DRAFT_INVOICES");
  if (invoices.some((i) => i.billingPeriod > dayKey(actualEndDate).slice(0, 7)))
    throw new BusinessRuleError("Cần xử lý hóa đơn kỳ sau ngày trả phòng trước khi quyết toán", "SETTLEMENT_FUTURE_INVOICES");
  for (const invoice of invoices) {
    v.number(invoice.totalAmount, "Tổng hóa đơn");
    v.number(invoice.paidAmount, "Tiền đã thu");
    v.number(invoice.remainingAmount, "Số dư hóa đơn");
    v.number(invoice.overpaidAmount, "Tiền trả thừa");
    if (invoice.remainingAmount !== Math.max(invoice.totalAmount - invoice.paidAmount, 0)
      || invoice.overpaidAmount !== Math.max(invoice.paidAmount - invoice.totalAmount, 0))
      throw new BusinessRuleError("Số dư hóa đơn không khớp, cần đối soát trước", "INVOICE_BALANCE_CONFLICT");
    if (invoice.overpaidAmount > 0)
      throw new BusinessRuleError("Cần hoàn hoặc đối soát tiền trả thừa trước khi quyết toán", "SETTLEMENT_OVERPAYMENT");
  }
  const debt = invoices.reduce((sum, i) => sum + i.remainingAmount, 0);
  const calculated = calculateSettlement({ contract, room, branch, body, invoices, debt });
  const billingPeriod = dayKey(actualEndDate).slice(0, 7);
  const [year, month] = billingPeriod.split("-").map(Number);
  const landlord = await User.findOne({ _id: contract.landlordId, role: "LANDLORD", isDeleted: false }).session(session).lean();
  const invoiceCode = `HDQT${crypto.randomBytes(10).toString("hex").toUpperCase()}`;
  const paymentSyntax = `${invoiceCode} P${room.roomNumber.replace(/[^A-Za-z0-9]/g, "")}`;
  const finalAmount = calculated.totalCharges - debt;
  const bank = landlord?.bankConfig;
  const [finalInvoice] = await Invoice.create([{
    landlordId: contract.landlordId, branchId: contract.branchId, roomId: contract.roomId,
    contractId: contract._id, tenantId: contract.tenantId, invoiceType: "SETTLEMENT",
    invoiceCode, billingPeriod, year, month, dueDate: new Date(), paymentSyntax,
    roomAmount: calculated.roomAmount, electricDetail: calculated.electricDetail,
    waterDetail: calculated.waterDetail, servicesDetail: calculated.servicesDetail,
    additionalFees: body.deductions.map(({ reason, amount }) => ({ reason, amount })),
    totalAmount: finalAmount, remainingAmount: finalAmount, status: finalAmount === 0 ? "PAID" : "ISSUED",
    bankSnapshot: bank, notes: `Quyết toán ${contract.contractCode}`,
    vietQrUrl: finalAmount > 0 && bank?.bankCode && bank.accountNumber && bank.accountName
      ? makeVietQr(bank, finalAmount, paymentSyntax) : undefined,
  }], { session });
  invoices.push(finalInvoice);
  let availableDeposit = calculated.heldDeposit;
  for (const invoice of invoices) {
    const amount = Math.min(availableDeposit, invoice.remainingAmount);
    if (amount > 0) {
      if (!payableStatuses.includes(invoice.status)) throw new BusinessRuleError("Hóa đơn không thể nhận cọc");
      await applyDeposit(req, contract, invoice, amount, session);
      availableDeposit -= amount;
    }
    // Write even zero-credit invoices to serialize concurrent payments/cancellation.
    invoice.__v = (invoice.__v || 0) + 1;
    await invoice.save({ session });
  }
  Object.assign(contract, body, { actualEndDate, settlement: {
    state: "PREPARED", preparedAt: new Date(), invoiceId: finalInvoice._id,
    invoiceIds: invoices.map((i) => i._id), heldDeposit: calculated.heldDeposit,
    roomAmount: calculated.roomAmount, electricAmount: calculated.electricAmount, waterAmount: calculated.waterAmount,
    serviceAmount: calculated.serviceAmount, deductionAmount: calculated.deductionAmount,
    outstandingDebt: debt, totalCharges: calculated.totalCharges,
    depositAppliedAmount: calculated.heldDeposit - availableDeposit,
    refundedDepositAmount: availableDeposit, remainingDue: calculated.remainingDue,
  } });
  await contract.save({ session });
  // Serialize room edits and prevent a second contract until final termination.
  room.__v = (room.__v || 0) + 1;
  room.currentElectricIndex = body.finalElectricIndex;
  room.currentWaterIndex = body.finalWaterIndex;
  await room.save({ session });
  await audit.log({ req, action: "PREPARE_CONTRACT_SETTLEMENT", entityType: "CONTRACT",
    entityId: contract._id, after: contract.toObject(), session });
}

async function balances(contract, session = null) {
  const invoices = await Invoice.find({ _id: { $in: contract.settlement.invoiceIds }, landlordId: contract.landlordId,
    contractId: contract._id, isDeleted: false }).session(session).lean();
  if (invoices.length !== contract.settlement.invoiceIds.length || invoices.some((i) => i.status === "CANCELLED"))
    throw new BusinessRuleError("Hóa đơn quyết toán không còn hợp lệ", "SETTLEMENT_INVOICE_CONFLICT");
  for (const invoice of invoices) {
    v.number(invoice.remainingAmount, "Số dư hóa đơn");
    if (invoice.remainingAmount !== Math.max(invoice.totalAmount - invoice.paidAmount, 0)
      || invoice.overpaidAmount !== Math.max(invoice.paidAmount - invoice.totalAmount, 0))
      throw new BusinessRuleError("Số dư hóa đơn không khớp", "INVOICE_BALANCE_CONFLICT");
  }
  return { invoices, remainingDue: invoices.reduce((sum, i) => sum + i.remainingAmount, 0),
    overpaidAmount: invoices.reduce((sum, i) => sum + i.overpaidAmount, 0) };
}

async function currentSettlement(contract) {
  const current = await balances(contract);
  return { ...contract.settlement, remainingDue: current.remainingDue, overpaidAmount: current.overpaidAmount };
}

async function prepareSettlement(req) {
  await mongoose.connection.transaction(async (session) => {
    const ctx = await context(req, session);
    await prepare(req, ctx, session);
  });
  const contract = await Contract.findOne(scoped(getTenantScope(req), { _id: validId(req.params.contractId) })).lean();
  const current = await balances(contract);
  return { ...contract, settlement: { ...contract.settlement, remainingDue: current.remainingDue,
    overpaidAmount: current.overpaidAmount }, settlementInvoices: current.invoices };
}

async function terminate(req) {
  await mongoose.connection.transaction(async (session) => {
    const ctx = await context(req, session);
    await prepare(req, ctx, session);
    const { contract, room } = ctx;
    const current = await balances(contract, session);
    if (current.remainingDue > 0)
      throw new BusinessRuleError("Lập phiếu qua /settlement và thu đủ phần còn thiếu trước khi thanh lý", "SETTLEMENT_BALANCE_DUE");
    if (current.overpaidAmount > 0)
      throw new BusinessRuleError("Cần đối soát tiền trả thừa trước khi thanh lý", "SETTLEMENT_OVERPAYMENT");
    const before = contract.toObject();
    contract.status = "TERMINATED";
    contract.settlement.state = "COMPLETED";
    contract.settlement.paymentsAfterPreparation = Math.max(contract.settlement.totalCharges - contract.settlement.depositAppliedAmount, 0);
    contract.settlement.remainingDue = 0;
    contract.refundedDepositAmount = contract.settlement.refundedDepositAmount;
    contract.depositStatus = contract.settlement.heldDeposit > 0
      ? contract.refundedDepositAmount === 0 ? "APPLIED"
        : contract.settlement.depositAppliedAmount > 0 ? "PARTIALLY_REFUNDED" : "REFUNDED" : contract.depositStatus;
    await contract.save({ session });
    room.status = "CLEANING";
    room.currentContractId = undefined;
    await room.save({ session });
    await audit.log({ req, action: "SETTLE_CONTRACT", entityType: "CONTRACT", entityId: contract._id,
      before, after: contract.toObject(), session });
  });
}

module.exports = { calculateSettlement, prepareSettlement, terminate, currentSettlement };
