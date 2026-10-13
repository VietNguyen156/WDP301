const mongoose = require("mongoose");
const Branch = require("../models/Branch");
const Room = require("../models/Room");
const {
  getBranchScope,
  scoped,
  validId,
  assertBranchScope,
} = require("../utils/scope");
const { NotFoundError, BusinessRuleError } = require("../utils/errors");
const v = require("../utils/validation");
const validate = require("./propertyValidation");
const quota = require("./quotaService");
const audit = require("./auditService");
async function get(req, id, session = null) {
  assertBranchScope(req, validId(id));
  const branch = await Branch.findOne(scoped(getBranchScope(req), { _id: id }))
    .session(session)
    .lean();
  if (!branch) throw new NotFoundError("Không tìm thấy cơ sở");
  return branch;
}
async function list(req) {
  const { page, limit, skip } = v.pagination(req.query),
    filter = {};
  if (req.query.search) filter.name = v.search(req.query.search);
  if (req.query.status) {
    v.choice(req.query.status, ["ACTIVE", "INACTIVE"], "Trạng thái");
    filter.status = req.query.status;
  }
  const query = scoped(getBranchScope(req), filter);
  const [items, total] = await Promise.all([
    Branch.find(query)
      .sort({ createdAt: -1, _id: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Branch.countDocuments(query),
  ]);
  const stats = await Room.aggregate([
    {
      $match: {
        landlordId: new mongoose.Types.ObjectId(getBranchScope(req).landlordId),
        branchId: { $in: items.map((b) => b._id) },
        isDeleted: false,
      },
    },
    {
      $group: {
        _id: "$branchId",
        total: { $sum: 1 },
        rented: { $sum: { $cond: [{ $eq: ["$status", "RENTED"] }, 1, 0] } },
      },
    },
  ]);
  return {
    items: items.map((b) => ({
      ...b,
      roomStats: stats.find((s) => String(s._id) === String(b._id)) || {
        total: 0,
        rented: 0,
      },
    })),
    total,
    page,
    limit,
  };
}
async function create(req) {
  const body = validate.branch(req.body, true);
  return mongoose.connection.transaction(async (session) => {
    await quota.guard({
      landlordId: req.user._id,
      resource: "branch",
      session,
    });
    const [branch] = await Branch.create(
      [{ ...body, landlordId: req.user._id }],
      { session },
    );
    await audit.log({
      req,
      action: "CREATE_BRANCH",
      entityType: "BRANCH",
      entityId: branch._id,
      after: branch.toObject(),
      session,
    });
    return branch;
  });
}
async function update(req) {
  const body = validate.branch(req.body);
  return mongoose.connection.transaction(async (session) => {
    const before = await get(req, req.params.branchId, session);
    if (
      body.totalFloors &&
      (await Room.exists({
        branchId: before._id,
        landlordId: before.landlordId,
        isDeleted: false,
        floor: { $gt: body.totalFloors },
      }).session(session))
    )
      throw new BusinessRuleError("Còn phòng nằm trên tầng muốn loại bỏ");
    const after = await Branch.findOneAndUpdate(
      scoped(getBranchScope(req), { _id: before._id }),
      { $set: body },
      { returnDocument: "after", runValidators: true, session },
    );
    await audit.log({
      req,
      action: "UPDATE_BRANCH_PRICING",
      entityType: "BRANCH",
      entityId: before._id,
      before,
      after: after.toObject(),
      session,
    });
    return after;
  });
}
async function remove(req) {
  return mongoose.connection.transaction(async (session) => {
    const before = await get(req, req.params.branchId, session);
    if (
      await Room.exists({
        branchId: before._id,
        landlordId: before.landlordId,
        isDeleted: false,
      }).session(session)
    )
      throw new BusinessRuleError(
        "Hãy xóa hoặc thanh lý các phòng trước khi xóa cơ sở",
      );
    await Branch.updateOne(
      { _id: before._id, landlordId: before.landlordId, isDeleted: false },
      {
        $set: { isDeleted: true, status: "INACTIVE" },
        $inc: { mutationVersion: 1 },
      },
      { session },
    );
    await audit.log({
      req,
      action: "DELETE_BRANCH",
      entityType: "BRANCH",
      entityId: before._id,
      before,
      session,
    });
    return null;
  });
}
// Lock parent for child writes so deletion/deactivation cannot race inserts.
async function lock(req, id, session) {
  const branch = await get(req, id, session);
  if (branch.status !== "ACTIVE")
    throw new BusinessRuleError("Cơ sở đang ngừng hoạt động");
  await Branch.updateOne(
    { _id: branch._id, landlordId: branch.landlordId, isDeleted: false },
    { $inc: { mutationVersion: 1 } },
    { session },
  );
  return branch;
}
module.exports = { get, list, create, update, remove, lock };
