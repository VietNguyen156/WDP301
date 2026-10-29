const mongoose = require("mongoose");
const { LIVE_CONTRACT_STATUSES } = require("../utils/statuses");
const UtilityReading = require("../models/UtilityReading");
const Room = require("../models/Room");
const Contract = require("../models/Contract");
const invoiceService = require("./invoiceService");
const branchService = require("./branchService");
const audit = require("./auditService");
const {
  getTenantScope,
  scoped,
  validId,
  assertBranchScope,
} = require("../utils/scope");
const {
  AppError,
  BusinessRuleError,
  NotFoundError,
  ValidationError,
} = require("../utils/errors");
const v = require("../utils/validation");
const { period } = require("../utils/financeValidation");
const { vnDate, currentPeriod, periodRange } = require("../utils/vnTime");

const ABNORMAL_RATIO = 2.5;
const AVERAGE_WINDOW = 3;
const BILLABLE_CONTRACT = LIVE_CONTRACT_STATUSES;
const READING_FIELDS = [
  "electricNewIndex",
  "waterNewIndex",
  "electricImage",
  "waterImage",
  "readingDate",
  "confirmAbnormal",
];

function validateBody(body, isCreate) {
  v.fields(
    body,
    isCreate
      ? ["branchId", "roomId", "billingPeriod", ...READING_FIELDS]
      : READING_FIELDS,
  );
  if (isCreate || body.electricNewIndex !== undefined)
    v.number(body.electricNewIndex, "Chỉ số điện mới");
  if (body.waterNewIndex !== undefined)
    v.number(body.waterNewIndex, "Chỉ số nước mới");
  for (const key of ["electricImage", "waterImage"]) {
    if (body[key] === undefined) continue;
    v.text(body[key], "Ảnh đồng hồ");
    if (!/^https?:\/\//.test(body[key]))
      throw new ValidationError("Ảnh đồng hồ phải là URL http/https");
  }
  if (
    body.confirmAbnormal !== undefined &&
    typeof body.confirmAbnormal !== "boolean"
  )
    throw new ValidationError("confirmAbnormal phải là true/false");
  const readingDate =
    body.readingDate === undefined
      ? undefined
      : v.date(body.readingDate, "Ngày chốt số");
  if (readingDate && readingDate > new Date())
    throw new ValidationError("Ngày chốt số không được ở tương lai");
  if (!isCreate) return { readingDate };
  const billingPeriod = period(body.billingPeriod);
  if (billingPeriod > currentPeriod())
    throw new ValidationError(
      "Không thể chốt số cho kỳ trong tương lai",
      "READING_PERIOD_INVALID",
    );
  return {
    branchId: validId(body.branchId),
    roomId: validId(body.roomId),
    billingPeriod,
    readingDate,
  };
}

async function getRoom(req, branchId, roomId, session) {
  const room = await Room.findOne(
    scoped(getTenantScope(req), { _id: roomId, branchId }),
  ).session(session);
  if (!room) throw new NotFoundError("Không tìm thấy phòng trong cơ sở");
  return room;
}

async function getContract(room, session) {
  const contract =
    room.currentContractId &&
    (await Contract.findOne({
      _id: room.currentContractId,
      landlordId: room.landlordId,
      roomId: room._id,
      isDeleted: false,
      status: { $in: BILLABLE_CONTRACT },
    }).session(session));
  if (!contract)
    throw new BusinessRuleError(
      "Phòng không có hợp đồng đang hiệu lực",
      "CONTRACT_NOT_ACTIVE",
    );
  if (contract.settlement?.state === "PREPARED")
    throw new BusinessRuleError(
      "Phòng đang quyết toán hợp đồng",
      "CONTRACT_SETTLEMENT_PENDING",
    );
  return contract;
}

// Readings of earlier periods, newest first; used for the old index and the average.
const history = (room, billingPeriod, session) =>
  UtilityReading.find({
    landlordId: room.landlordId,
    roomId: room._id,
    isDeleted: false,
    billingPeriod: { $lt: billingPeriod },
  })
    .sort({ billingPeriod: -1 })
    .limit(AVERAGE_WINDOW)
    .session(session)
    .lean();

function abnormal(label, consumed, previous, key) {
  const used = previous.map((r) => r[key]).filter((n) => Number.isFinite(n));
  if (!used.length) return null;
  const average = used.reduce((sum, n) => sum + n, 0) / used.length;
  if (average <= 0 || consumed <= ABNORMAL_RATIO * average) return null;
  return {
    type: label,
    consumed,
    average: Math.round(average * 100) / 100,
    ratio: Math.round((consumed / average) * 100) / 100,
  };
}

// Compute indexes and consumption, enforcing monotonic meters and the 2.5x guard.
function compute({ body, room, branch, contract, previous, existing }) {
  const last = previous[0];
  const oldElectricIndex =
    existing?.oldElectricIndex ??
    Math.max(last?.newElectricIndex ?? 0, contract.initialElectricIndex ?? 0);
  const oldWaterIndex =
    existing?.oldWaterIndex ??
    Math.max(last?.newWaterIndex ?? 0, contract.initialWaterIndex ?? 0);
  const waterType = room.waterBillingType || branch.waterBillingType || "METER";
  const newElectricIndex = body.electricNewIndex ?? existing.newElectricIndex;
  let newWaterIndex = body.waterNewIndex ?? existing?.newWaterIndex;
  if (newWaterIndex === undefined) {
    if (waterType === "METER")
      throw new ValidationError("Chỉ số nước mới không hợp lệ");
    newWaterIndex = oldWaterIndex;
  }
  if (newElectricIndex < oldElectricIndex)
    throw new AppError(
      `Chỉ số điện mới không được nhỏ hơn chỉ số cũ (${oldElectricIndex})`,
      400,
      "READING_LOWER_THAN_PREVIOUS",
    );
  if (newWaterIndex < oldWaterIndex)
    throw new AppError(
      `Chỉ số nước mới không được nhỏ hơn chỉ số cũ (${oldWaterIndex})`,
      400,
      "READING_LOWER_THAN_PREVIOUS",
    );
  const values = {
    oldElectricIndex,
    newElectricIndex,
    consumedElectric: newElectricIndex - oldElectricIndex,
    oldWaterIndex,
    newWaterIndex,
    consumedWater: newWaterIndex - oldWaterIndex,
  };
  const warnings = [
    abnormal("ELECTRIC", values.consumedElectric, previous, "consumedElectric"),
    waterType === "METER"
      ? abnormal("WATER", values.consumedWater, previous, "consumedWater")
      : null,
  ].filter(Boolean);
  if (warnings.length && body.confirmAbnormal !== true) {
    const error = new AppError(
      `Mức tiêu thụ tăng vượt ${ABNORMAL_RATIO} lần trung bình. Kiểm tra lại hoặc gửi confirmAbnormal: true để xác nhận`,
      409,
      "READING_ABNORMAL_INCREASE",
    );
    error.details = { warnings, ...values };
    throw error;
  }
  return values;
}

// New drafts are due paymentDueDays after today (Vietnam date); the landlord can change it via generate.
function defaultDueDate(branch) {
  const today = vnDate();
  return new Date(Date.parse(today) + (branch.paymentDueDays ?? 5) * 86400000);
}

// Create or refresh the room's DRAFT invoice. A reading is still saved when no draft can be
// made (cancelled invoice, contract not covering the period, ...); the reason is returned instead.
async function syncDraftInvoice(req, branch, room, reading, session) {
  try {
    const invoice = await invoiceService.upsertDraftInvoice({
      req,
      branch,
      room,
      billingPeriod: reading.billingPeriod,
      dueDate: defaultDueDate(branch),
      keepDueDate: true,
      session,
    });
    return {
      draftInvoiceId: invoice.status === "DRAFT" ? invoice._id : null,
      draftInvoiceError: null,
    };
  } catch (error) {
    if (!(error instanceof AppError)) throw error;
    return {
      draftInvoiceId: null,
      draftInvoiceError: { errorCode: error.errorCode, message: error.message },
    };
  }
}

function present(reading) {
  const r = reading.toObject ? reading.toObject() : reading;
  return {
    ...r,
    id: r._id,
    electricImage: r.electricMeterImage,
    waterImage: r.waterMeterImage,
  };
}

async function list(req) {
  const branch = await branchService.get(req, req.params.branchId);
  const billingPeriod = req.query.billingPeriod
    ? period(req.query.billingPeriod)
    : currentPeriod();
  const roomFilter = { branchId: branch._id, status: { $ne: "INACTIVE" } };
  if (req.query.status === "RENTED") roomFilter.status = "RENTED";
  const rooms = await Room.find(scoped(getTenantScope(req), roomFilter))
    .sort({ floor: 1, roomNumber: 1, _id: 1 })
    .select(
      "roomNumber floor status waterBillingType currentContractId currentElectricIndex currentWaterIndex",
    )
    .lean();
  const readings = await UtilityReading.find({
    landlordId: branch.landlordId,
    branchId: branch._id,
    billingPeriod,
    isDeleted: false,
  }).lean();
  const byRoom = new Map(readings.map((r) => [String(r.roomId), r]));
  const items = rooms
    .filter((room) => room.status === "RENTED" || byRoom.has(String(room._id)))
    .map((room) => {
      const reading = byRoom.get(String(room._id));
      return {
        room: {
          id: room._id,
          roomNumber: room.roomNumber,
          floor: room.floor,
          status: room.status,
        },
        waterBillingType:
          room.waterBillingType || branch.waterBillingType || "METER",
        previousElectricIndex:
          reading?.oldElectricIndex ?? room.currentElectricIndex ?? 0,
        previousWaterIndex:
          reading?.oldWaterIndex ?? room.currentWaterIndex ?? 0,
        reading: reading ? present(reading) : null,
      };
    });
  const recorded = items.filter((i) => i.reading).length;
  return {
    billingPeriod,
    items,
    stats: {
      total: items.length,
      recorded,
      pending: items.length - recorded,
      billed: items.filter((i) => i.reading?.isBilled).length,
    },
  };
}

async function get(req, id = req.params.readingId) {
  const reading = await UtilityReading.findOne(
    scoped(
      { landlordId: getTenantScope(req).landlordId },
      { _id: validId(id) },
    ),
  ).lean();
  if (!reading) throw new NotFoundError("Không tìm thấy bản chốt số");
  assertBranchScope(req, String(reading.branchId));
  return present(reading);
}

async function create(req) {
  const input = validateBody(req.body, true);
  assertBranchScope(req, input.branchId);
  return mongoose.connection.transaction(async (session) => {
    const branch = await branchService.get(req, input.branchId, session);
    const room = await getRoom(req, branch._id, input.roomId, session);
    const contract = await getContract(room, session);
    const [year, month] = input.billingPeriod.split("-").map(Number);
    if (contract.startDate >= periodRange(input.billingPeriod).end)
      throw new BusinessRuleError(
        "Hợp đồng chưa bắt đầu trong kỳ này",
        "READING_PERIOD_INVALID",
      );
    if (
      await UtilityReading.exists({
        landlordId: room.landlordId,
        roomId: room._id,
        billingPeriod: input.billingPeriod,
        isDeleted: false,
      }).session(session)
    )
      throw new BusinessRuleError(
        "Phòng đã được chốt số kỳ này, hãy cập nhật bản chốt hiện có",
        "READING_ALREADY_EXISTS",
      );
    if (
      await UtilityReading.exists({
        landlordId: room.landlordId,
        roomId: room._id,
        billingPeriod: { $gt: input.billingPeriod },
        isDeleted: false,
      }).session(session)
    )
      throw new BusinessRuleError(
        "Đã có bản chốt số của kỳ sau, không thể chốt bổ sung kỳ trước",
        "READING_PERIOD_CONFLICT",
      );
    const previous = await history(room, input.billingPeriod, session);
    const values = compute({
      body: req.body,
      room,
      branch,
      contract,
      previous,
    });
    const [reading] = await UtilityReading.create(
      [
        {
          landlordId: room.landlordId,
          branchId: branch._id,
          roomId: room._id,
          recordedBy: req.user._id,
          billingPeriod: input.billingPeriod,
          year,
          month,
          readingDate: input.readingDate ?? new Date(),
          ...values,
          electricMeterImage: req.body.electricImage,
          waterMeterImage: req.body.waterImage,
        },
      ],
      { session },
    );
    room.currentElectricIndex = values.newElectricIndex;
    room.currentWaterIndex = values.newWaterIndex;
    await room.save({ session });
    const draft = await syncDraftInvoice(req, branch, room, reading, session);
    await audit.log({
      req,
      action: "CREATE_UTILITY_READING",
      entityType: "UTILITY_READING",
      entityId: reading._id,
      after: reading.toObject(),
      session,
    });
    return { ...present(reading), ...draft };
  });
}

async function update(req) {
  const input = validateBody(req.body, false);
  return mongoose.connection.transaction(async (session) => {
    const reading = await UtilityReading.findOne(
      scoped(
        { landlordId: getTenantScope(req).landlordId },
        { _id: validId(req.params.readingId) },
      ),
    ).session(session);
    if (!reading) throw new NotFoundError("Không tìm thấy bản chốt số");
    assertBranchScope(req, String(reading.branchId));
    if (reading.isBilled)
      throw new AppError(
        "Chỉ số kỳ này đã phát hành hóa đơn, không thể sửa",
        409,
        "READING_ALREADY_BILLED",
      );
    if (
      await UtilityReading.exists({
        landlordId: reading.landlordId,
        roomId: reading.roomId,
        billingPeriod: { $gt: reading.billingPeriod },
        isDeleted: false,
      }).session(session)
    )
      throw new BusinessRuleError(
        "Đã có bản chốt số của kỳ sau, không thể sửa kỳ này",
        "READING_PERIOD_CONFLICT",
      );
    const branch = await branchService.get(
      req,
      String(reading.branchId),
      session,
    );
    const room = await getRoom(req, branch._id, reading.roomId, session);
    const contract = await getContract(room, session);
    const before = reading.toObject();
    const previous = await history(room, reading.billingPeriod, session);
    const values = compute({
      body: req.body,
      room,
      branch,
      contract,
      previous,
      existing: reading,
    });
    Object.assign(reading, values, { recordedBy: req.user._id });
    if (input.readingDate) reading.readingDate = input.readingDate;
    if (req.body.electricImage !== undefined)
      reading.electricMeterImage = req.body.electricImage;
    if (req.body.waterImage !== undefined)
      reading.waterMeterImage = req.body.waterImage;
    await reading.save({ session });
    room.currentElectricIndex = values.newElectricIndex;
    room.currentWaterIndex = values.newWaterIndex;
    await room.save({ session });
    const draft = await syncDraftInvoice(req, branch, room, reading, session);
    await audit.log({
      req,
      action: "UPDATE_UTILITY_READING",
      entityType: "UTILITY_READING",
      entityId: reading._id,
      before,
      after: reading.toObject(),
      session,
    });
    return { ...present(reading), ...draft };
  });
}

module.exports = { list, get, create, update };
