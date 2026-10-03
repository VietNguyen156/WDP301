const mongoose = require("mongoose");
const crypto = require("node:crypto");
const {
  Invoice,
  Branch,
  Room,
  Contract,
  UtilityReading,
  User,
} = require("../models");
const AppError = require("../utils/AppError");
const validate = require("../utils/financeValidation");
const { getTenantScope, getBranchScope } = require("../utils/tenantScope");
const { calculateInvoice, makeVietQr } = require("./financeCalculation");
const { recordAudit } = require("./auditService");

const VISIBLE_STATUSES = [
  "ISSUED",
  "PARTIALLY_PAID",
  "PAID",
  "OVERPAID",
  "UNPAID",
];
const INVOICE_STATUSES = ["DRAFT", ...VISIBLE_STATUSES, "CANCELLED"];

function invoiceScope(req) {
  const scope = { ...getTenantScope(req), isDeleted: false };
  if (req.user.role === "TENANT") scope.status = { $in: VISIBLE_STATUSES };
  return scope;
}

async function getInvoice(req, id, session) {
  const invoice = await Invoice.findOne({
    ...invoiceScope(req),
    _id: validate.objectId(id, "invoiceId"),
  }).session(session || null);
  if (!invoice)
    throw new AppError(404, "RESOURCE_NOT_FOUND", "Không tìm thấy hóa đơn");
  return invoice;
}

async function listInvoices(req) {
  const filters = [];
  const { branchId, billingPeriod, status } = req.query;
  if (branchId)
    filters.push({ branchId: validate.objectId(branchId, "branchId") });
  if (billingPeriod)
    filters.push({ billingPeriod: validate.period(billingPeriod) });
  if (status) {
    if (!INVOICE_STATUSES.includes(status))
      throw new AppError(
        400,
        "VALIDATION_ERROR",
        "Trạng thái hóa đơn không hợp lệ",
      );
    filters.push({ status });
  }
  const filter = { $and: [invoiceScope(req), ...filters] };
  const { page, limit, skip } = validate.pagination(req.query);
  const [data, total] = await Promise.all([
    Invoice.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .skip(skip)
      .limit(limit),
    Invoice.countDocuments(filter),
  ]);
  return { data, pagination: { page, limit, total } };
}

async function invoiceInputs(req, room, billingPeriod, session, contractId) {
  const landlordId = getTenantScope(req).landlordId;
  const [year, month] = billingPeriod.split("-").map(Number);
  const start = new Date(Date.UTC(year, month - 1, 1) - 7 * 60 * 60 * 1000);
  const end = new Date(Date.UTC(year, month, 1) - 7 * 60 * 60 * 1000);
  const contract = await Contract.findOne({
    _id: contractId || room.currentContractId,
    landlordId,
    branchId: room.branchId,
    roomId: room._id,
    isDeleted: false,
    status: { $in: ["ACTIVE", "EXPIRING_SOON", "EXPIRED"] },
    startDate: { $lt: end },
    endDate: { $gte: start },
  }).session(session);
  if (!contract)
    throw new AppError(
      409,
      "CONTRACT_NOT_ACTIVE",
      `Phòng ${room.roomNumber} không có hợp đồng hợp lệ cho kỳ này`,
    );
  const reading = await UtilityReading.findOne({
    landlordId,
    branchId: room.branchId,
    roomId: room._id,
    billingPeriod,
    isDeleted: false,
  }).session(session);
  if (!reading)
    throw new AppError(
      409,
      "READING_REQUIRED",
      `Phòng ${room.roomNumber} chưa chốt số điện nước`,
    );
  return { contract, reading };
}

async function generateInvoices(req) {
  const body = req.body || {};
  const branchId = validate.objectId(body.branchId, "branchId");
  const billingPeriod = validate.period(body.billingPeriod);
  const dueDate = validate.date(body.dueDate, "dueDate");
  let roomIds;
  if (body.roomIds !== undefined) {
    if (
      !Array.isArray(body.roomIds) ||
      !body.roomIds.length ||
      body.roomIds.length > 500
    ) {
      throw new AppError(
        400,
        "VALIDATION_ERROR",
        "roomIds phải có từ 1 đến 500 phòng",
      );
    }
    roomIds = [...new Set(body.roomIds)].map((id) =>
      validate.objectId(id, "roomId"),
    );
  }
  return mongoose.connection.transaction(async (session) => {
    const branch = await Branch.findOne({
      $and: [
        getBranchScope(req),
        { _id: branchId, isDeleted: false, status: "ACTIVE" },
      ],
    }).session(session);
    if (!branch)
      throw new AppError(404, "RESOURCE_NOT_FOUND", "Không tìm thấy cơ sở");
    const rooms = await Room.find({
      landlordId: branch.landlordId,
      branchId,
      isDeleted: false,
      status: "RENTED",
      ...(roomIds && { _id: { $in: roomIds } }),
    }).session(session);
    if (!rooms.length || (roomIds && rooms.length !== roomIds.length)) {
      throw new AppError(
        400,
        "ROOM_NOT_BILLABLE",
        "Danh sách phòng không hợp lệ hoặc không có phòng đang thuê",
      );
    }
    if (rooms.length > 500)
      throw new AppError(
        400,
        "VALIDATION_ERROR",
        "Mỗi lần tạo tối đa 500 hóa đơn",
      );
    const invoices = [];
    for (const room of rooms) {
      const existing = await Invoice.findOne({
        landlordId: branch.landlordId,
        roomId: room._id,
        billingPeriod,
        isDeleted: false,
      }).session(session);
      if (existing?.status === "CANCELLED") {
        throw new AppError(409, "INVOICE_CANCELLED", `Hóa đơn kỳ ${billingPeriod} đã hủy; cần xử lý điều chỉnh riêng`);
      }
      if (existing && existing.status !== "DRAFT") {
        invoices.push(existing);
        continue;
      }
      const { contract, reading } = await invoiceInputs(
        req,
        room,
        billingPeriod,
        session,
        existing?.contractId,
      );
      if (reading.isBilled)
        throw new AppError(
          409,
          "READING_ALREADY_BILLED",
          "Chỉ số kỳ này đã được phát hành hóa đơn",
        );
      const calculated = calculateInvoice({
        branch,
        room,
        contract,
        reading,
        snapshot: existing,
      });
      if (existing) {
        Object.assign(existing, calculated, { dueDate });
        await existing.save({ session });
        invoices.push(existing);
      } else {
        const [invoice] = await Invoice.create(
          [
            {
              landlordId: branch.landlordId,
              branchId,
              roomId: room._id,
              contractId: contract._id,
              tenantId: contract.tenantId,
              invoiceCode: `HD${billingPeriod.replace("-", "")}${crypto.randomBytes(6).toString("hex").toUpperCase()}`,
              billingPeriod,
              year: Number(billingPeriod.slice(0, 4)),
              month: Number(billingPeriod.slice(5)),
              dueDate,
              ...calculated,
            },
          ],
          { session },
        );
        await recordAudit(
          {
            actor: req.user,
            invoice,
            action: "CREATE_INVOICE",
            after: invoice.toObject(),
            metadata: req.auditMetadata,
          },
          session,
        );
        invoices.push(invoice);
      }
    }
    return invoices;
  });
}

async function issueInvoice(req) {
  return mongoose.connection.transaction(async (session) => {
    const invoice = await getInvoice(req, req.params.invoiceId, session);
    if (invoice.status !== "DRAFT")
      throw new AppError(
        409,
        "INVOICE_NOT_DRAFT",
        "Chỉ phát hành hóa đơn nháp",
      );
    const branch = await Branch.findOne({
      _id: invoice.branchId,
      landlordId: invoice.landlordId,
      isDeleted: false,
    }).session(session);
    const room = await Room.findOne({
      _id: invoice.roomId,
      branchId: invoice.branchId,
      landlordId: invoice.landlordId,
      isDeleted: false,
    }).session(session);
    const landlord = await User.findOne({
      _id: invoice.landlordId,
      role: "LANDLORD",
      status: "ACTIVE",
      isDeleted: false,
    }).session(session);
    if (!branch || !room || !landlord)
      throw new AppError(
        404,
        "RESOURCE_NOT_FOUND",
        "Dữ liệu cơ sở, phòng hoặc chủ trọ không còn hoạt động",
      );
    const { contract, reading } = await invoiceInputs(
      req,
      room,
      invoice.billingPeriod,
      session,
      invoice.contractId,
    );
    if (reading.isBilled)
      throw new AppError(
        409,
        "READING_ALREADY_BILLED",
        "Chỉ số kỳ này đã được lập hóa đơn",
      );
    const before = invoice.toObject();
    Object.assign(
      invoice,
      calculateInvoice({ branch, room, contract, reading, snapshot: invoice }),
    );
    if (invoice.totalAmount <= 0)
      throw new AppError(
        400,
        "INVOICE_AMOUNT_INVALID",
        "Hóa đơn phát hành phải có tổng tiền dương",
      );
    const roomCode = room.roomNumber.replace(/[^a-zA-Z0-9]/g, "");
    invoice.paymentSyntax = `${invoice.invoiceCode} ${/^P/i.test(roomCode) ? roomCode : `P${roomCode}`}`;
    invoice.bankSnapshot = landlord.bankConfig.toObject
      ? landlord.bankConfig.toObject()
      : landlord.bankConfig;
    invoice.vietQrUrl = makeVietQr(
      invoice.bankSnapshot,
      invoice.remainingAmount,
      invoice.paymentSyntax,
    );
    invoice.status = "ISSUED";
    await invoice.save({ session });
    reading.isBilled = true;
    await reading.save({ session });
    await recordAudit(
      {
        actor: req.user,
        invoice,
        action: "ISSUE_INVOICE",
        before,
        after: invoice.toObject(),
        metadata: req.auditMetadata,
      },
      session,
    );
    return invoice;
  });
}

async function cancelInvoice(req) {
  const reason = validate.text(req.body?.reason, "reason", 1000);
  return mongoose.connection.transaction(async (session) => {
    const invoice = await getInvoice(req, req.params.invoiceId, session);
    if (
      invoice.paidAmount > 0 ||
      ["PAID", "OVERPAID", "CANCELLED"].includes(invoice.status)
    ) {
      throw new AppError(
        409,
        "INVOICE_CANNOT_CANCEL",
        "Không thể hủy hóa đơn đã thu tiền hoặc đã hủy",
      );
    }
    const before = invoice.toObject();
    invoice.status = "CANCELLED";
    invoice.cancellationReason = reason;
    invoice.vietQrUrl = undefined;
    await invoice.save({ session });
    await recordAudit(
      {
        actor: req.user,
        invoice,
        action: "CANCEL_INVOICE",
        before,
        after: invoice.toObject(),
        metadata: req.auditMetadata,
      },
      session,
    );
    return invoice;
  });
}

function maskName(value = "") {
  if (!value.trim()) return "";
  if (!value.trim().includes(" ")) return `${value.trim()[0]}***`;
  return value
    .trim()
    .split(/\s+/)
    .map((word, index) => (index === 0 ? word : `${word[0]}***`))
    .join(" ");
}

async function publicInvoice(token) {
  if (typeof token !== "string" || !/^[a-f\d]{32}$/i.test(token))
    throw new AppError(404, "RESOURCE_NOT_FOUND", "Không tìm thấy hóa đơn");
  const invoice = await Invoice.findOne({
    publicAccessToken: token,
    isDeleted: false,
    status: { $in: VISIBLE_STATUSES },
  });
  if (!invoice)
    throw new AppError(404, "RESOURCE_NOT_FOUND", "Không tìm thấy hóa đơn");
  const [tenant, room, branch] = await Promise.all([
    User.findOne({
      _id: invoice.tenantId,
      landlordId: invoice.landlordId,
      isDeleted: false,
    }).select("name phoneNumber"),
    Room.findOne({
      _id: invoice.roomId,
      landlordId: invoice.landlordId,
      isDeleted: false,
    }).select("roomNumber"),
    Branch.findOne({
      _id: invoice.branchId,
      landlordId: invoice.landlordId,
      isDeleted: false,
    }).select("name"),
  ]);
  const phone = tenant?.phoneNumber || "";
  const detail = invoice.toObject();
  return {
    id: invoice.id,
    invoiceCode: invoice.invoiceCode,
    billingPeriod: invoice.billingPeriod,
    title: `GIẤY BÁO TIỀN PHÒNG & DỊCH VỤ - THÁNG ${String(invoice.month).padStart(2, "0")}/${invoice.year}`,
    description: "Chứng từ nội bộ phục vụ thanh toán tiền thuê phòng",
    tenant: {
      name: maskName(tenant?.name || ""),
      phoneNumber:
        phone.length >= 9
          ? `${phone.slice(0, 3)}****${phone.slice(-3)}`
          : "***",
    },
    branch: { name: branch?.name || "" },
    room: { roomNumber: room?.roomNumber || "" },
    roomAmount: invoice.roomAmount,
    electricDetail: detail.electricDetail,
    waterDetail: detail.waterDetail,
    servicesDetail: detail.servicesDetail.map(
      ({ serviceName, unitPrice, quantity, amount }) => ({
        serviceName,
        unitPrice,
        quantity,
        amount,
      }),
    ),
    additionalFees: detail.additionalFees.map(({ reason, amount }) => ({
      reason,
      amount,
    })),
    discount: {
      reason: detail.discount.reason,
      amount: detail.discount.amount,
    },
    totalAmount: invoice.totalAmount,
    paidAmount: invoice.paidAmount,
    remainingAmount: invoice.remainingAmount,
    overpaidAmount: invoice.overpaidAmount,
    status: invoice.status,
    isOverdue: invoice.isOverdue,
    dueDate: invoice.dueDate,
    vietQrUrl: invoice.remainingAmount > 0 ? invoice.vietQrUrl : null,
    paymentSyntax: invoice.paymentSyntax,
    bank: invoice.bankSnapshot,
  };
}

module.exports = {
  getInvoice,
  listInvoices,
  generateInvoices,
  issueInvoice,
  cancelInvoice,
  publicInvoice,
  invoiceScope,
};
