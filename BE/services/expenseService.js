// Phiếu chi: money paid out (repair contractors, materials...). Landlords and the managers of
// the branch record them; only the landlord voids one. Tenants never see expenses.
const mongoose = require("mongoose");
const Expense = require("../models/Expense");
const Incident = require("../models/Incident");
const audit = require("./auditService");
const { getTenantScope, scoped, validId, assertBranchScope } = require("../utils/scope");
const { BusinessRuleError, NotFoundError, ValidationError } = require("../utils/errors");
const v = require("../utils/validation");

const METHODS = ["CASH", "BANK_TRANSFER"];
const CATEGORIES = ["REPAIR", "OTHER"];
// Work was (or is being) done: pay-outs make sense from here on.
const PAYABLE_INCIDENT = ["IN_PROGRESS", "SOLVED", "CLOSED"];

const populate = (query) =>
  query
    .populate({ path: "branchId", select: "name" })
    .populate({ path: "roomId", select: "roomNumber" })
    .populate({ path: "incidentId", select: "title costPayer status chargeInvoiceCode" })
    .populate({ path: "createdBy", select: "name role" })
    .populate({ path: "voidedBy", select: "name role" });

async function list(req) {
  const { page, limit, skip } = v.pagination(req.query);
  const filter = {};
  if (req.query.branchId) {
    assertBranchScope(req, req.query.branchId);
    filter.branchId = new mongoose.Types.ObjectId(req.query.branchId);
  }
  if (req.query.incidentId) filter.incidentId = new mongoose.Types.ObjectId(validId(req.query.incidentId));
  if (req.query.status) {
    v.choice(req.query.status, ["RECORDED", "VOID"], "Trạng thái phiếu chi");
    filter.status = req.query.status;
  }
  const query = scoped(getTenantScope(req), filter);
  const [data, total, totals] = await Promise.all([
    populate(Expense.find(query).sort({ paidAt: -1, _id: -1 }).skip(skip).limit(limit)).lean(),
    Expense.countDocuments(query),
    Expense.aggregate([
      { $match: { $and: [query, { status: "RECORDED" }] } },
      { $group: { _id: "$paymentMethod", amount: { $sum: "$amount" } } },
    ]),
  ]);
  const byMethod = Object.fromEntries(totals.map((t) => [t._id, t.amount]));
  return {
    data,
    pagination: { page, limit, total },
    totals: { all: (byMethod.CASH || 0) + (byMethod.BANK_TRANSFER || 0), ...byMethod },
  };
}

// Recorded expenses of one incident (staff view of an incident).
function forIncident(incidentId) {
  return populate(
    Expense.find({ incidentId, isDeleted: false }).sort({ paidAt: 1, _id: 1 }),
  ).lean();
}

async function create(req) {
  const body = v.fields(req.body || {}, [
    "incidentId",
    "payee",
    "amount",
    "paymentMethod",
    "referenceCode",
    "paidAt",
    "note",
    "category",
  ]);
  v.text(body.payee, "Người nhận tiền");
  v.number(body.amount, "Số tiền chi", 1);
  v.choice(body.paymentMethod, METHODS, "Hình thức chi");
  if (body.category !== undefined) v.choice(body.category, CATEGORIES, "Loại chi");
  v.text(body.referenceCode, "Mã giao dịch / số phiếu", false);
  v.text(body.note, "Ghi chú", false);
  const paidAt = body.paidAt === undefined ? new Date() : v.date(body.paidAt, "Ngày chi");
  if (paidAt > new Date()) throw new ValidationError("Ngày chi không được ở tương lai");
  if (body.incidentId === undefined)
    throw new ValidationError("Phiếu chi sửa chữa phải gắn với một sự cố");
  return mongoose.connection.transaction(async (session) => {
    const incident = await Incident.findOne(
      scoped(getTenantScope(req), { _id: validId(body.incidentId) }),
    ).session(session);
    if (!incident) throw new NotFoundError("Không tìm thấy sự cố");
    if (!PAYABLE_INCIDENT.includes(incident.status))
      throw new BusinessRuleError(
        "Chỉ ghi phiếu chi khi sự cố đã bắt đầu xử lý",
        "INCIDENT_NOT_STARTED",
      );
    const [expense] = await Expense.create(
      [
        {
          landlordId: incident.landlordId,
          branchId: incident.branchId,
          roomId: incident.roomId,
          incidentId: incident._id,
          category: body.category || "REPAIR",
          payee: body.payee.trim(),
          amount: body.amount,
          paymentMethod: body.paymentMethod,
          referenceCode: body.referenceCode?.trim() || undefined,
          paidAt,
          note: body.note?.trim() || undefined,
          createdBy: req.user._id,
        },
      ],
      { session },
    );
    await audit.log({
      req,
      action: "CREATE_EXPENSE",
      entityType: "INCIDENT",
      entityId: incident._id,
      after: { expenseId: expense._id, payee: expense.payee, amount: expense.amount, paymentMethod: expense.paymentMethod },
      session,
    });
    return expense;
  });
}

async function voidExpense(req) {
  const body = v.fields(req.body || {}, ["reason"]);
  v.text(body.reason, "Lý do hủy phiếu chi");
  return mongoose.connection.transaction(async (session) => {
    const expense = await Expense.findOne(
      scoped(getTenantScope(req), { _id: validId(req.params.expenseId) }),
    ).session(session);
    if (!expense) throw new NotFoundError("Không tìm thấy phiếu chi");
    if (expense.status === "VOID")
      throw new BusinessRuleError("Phiếu chi đã được hủy", "EXPENSE_ALREADY_VOID");
    expense.status = "VOID";
    expense.voidedBy = req.user._id;
    expense.voidedAt = new Date();
    expense.voidReason = body.reason.trim();
    await expense.save({ session });
    await audit.log({
      req,
      action: "VOID_EXPENSE",
      entityType: expense.incidentId ? "INCIDENT" : "EXPENSE",
      entityId: expense.incidentId || expense._id,
      before: { expenseId: expense._id, status: "RECORDED" },
      after: { expenseId: expense._id, status: "VOID", reason: expense.voidReason },
      session,
    });
    return expense;
  });
}

module.exports = { list, forIncident, create, voidExpense };
