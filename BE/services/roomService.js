const mongoose = require("mongoose");
const Room = require("../models/Room");
const Contract = require("../models/Contract");
const branchService = require("./branchService");
const { getTenantScope, scoped, validId } = require("../utils/scope");
const { NotFoundError, BusinessRuleError } = require("../utils/errors");
const v = require("../utils/validation");
const validate = require("./propertyValidation");
const quota = require("./quotaService");
const audit = require("./auditService");
async function get(req, id, session = null) {
  const room = await Room.findOne(
    scoped(getTenantScope(req), { _id: validId(id) }),
  )
    .session(session)
    .lean();
  if (!room) throw new NotFoundError("Không tìm thấy phòng");
  return room;
}
async function list(req) {
  const branch = await branchService.get(req, req.params.branchId);
  const { page, limit, skip } = v.pagination(req.query),
    filter = { branchId: branch._id };
  if (req.query.status) {
    v.choice(
      req.query.status,
      ["EMPTY", "RENTED", "CLEANING", "MAINTENANCE", "INACTIVE"],
      "Trạng thái",
    );
    filter.status = req.query.status;
  }
  if (req.query.search) filter.roomNumber = v.search(req.query.search);
  if (req.query.floor) {
    filter.floor = Number(req.query.floor);
    v.number(filter.floor, "Tầng", 1, 100);
  }
  const query = scoped(getTenantScope(req), filter);
  const [items, total, groups] = await Promise.all([
    Room.find(query)
      .sort({ floor: 1, roomNumber: 1, _id: 1 })
      .skip(skip)
      .limit(limit)
      .populate({
        path: "currentContractId",
        select: "tenantId",
        match: {
          landlordId: branch.landlordId,
          branchId: branch._id,
          isDeleted: false,
        },
        populate: {
          path: "tenantId",
          select: "name",
          match: { landlordId: branch.landlordId, isDeleted: false },
        },
      })
      .lean(),
    Room.countDocuments(query),
    Room.aggregate([
      {
        $match: {
          landlordId: branch.landlordId,
          branchId: branch._id,
          isDeleted: false,
        },
      },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]),
  ]);
  return {
    items: items.map((room) => ({
      ...room,
      currentTenantName: room.currentContractId?.tenantId?.name || null,
      currentContractId: room.currentContractId?._id || null,
    })),
    total,
    page,
    limit,
    stats: Object.fromEntries(groups.map((g) => [g._id, g.count])),
  };
}
async function create(req, isBulk = false) {
  const inputs = isBulk
    ? validate.bulk(req.body)
    : [validate.room(req.body, true)];
  return mongoose.connection.transaction(async (session) => {
    const branch = await branchService.lock(req, req.params.branchId, session);
    if (inputs.some((r) => (r.floor || 1) > branch.totalFloors))
      throw new BusinessRuleError("Tầng phòng vượt quá số tầng của cơ sở");
    await quota.guard({
      landlordId: branch.landlordId,
      resource: "room",
      count: inputs.length,
      session,
    });
    const rooms = await Room.create(
      inputs.map((r) => ({
        ...r,
        branchId: branch._id,
        landlordId: branch.landlordId,
      })),
      { session, ordered: true },
    );
    await audit.log({
      req,
      action: isBulk ? "BULK_CREATE_ROOMS" : "CREATE_ROOM",
      entityType: "BRANCH",
      entityId: branch._id,
      after: { roomIds: rooms.map((r) => r._id) },
      session,
    });
    return isBulk ? { items: rooms, count: rooms.length } : rooms[0];
  });
}
async function update(req) {
  const body = validate.room(
    req.body,
    false,
    req.user.role === "PROPERTY_MANAGER",
  );
  return mongoose.connection.transaction(async (session) => {
    const before = await get(req, req.params.roomId, session);
    if (req.user.role === "PROPERTY_MANAGER" && before.status === "INACTIVE")
      throw new BusinessRuleError("Chỉ chủ trọ được kích hoạt lại phòng đã ngừng hoạt động", "ROOM_INACTIVE");
    const branch = await branchService.lock(
      req,
      String(before.branchId),
      session,
    );
    if (body.floor > branch.totalFloors)
      throw new BusinessRuleError("Tầng phòng vượt quá số tầng của cơ sở");
    if (before.currentContractId) {
      const contract = await Contract.findOne({
        _id: before.currentContractId, landlordId: before.landlordId,
        roomId: before._id, isDeleted: false,
      }).session(session);
      if (!contract) throw new BusinessRuleError("Phòng không còn liên kết hợp đồng hợp lệ");
      if (contract.settlement?.state === "PREPARED")
        throw new BusinessRuleError("Phòng đang quyết toán hợp đồng", "CONTRACT_SETTLEMENT_PENDING");
      if (body.maxOccupants !== undefined && body.maxOccupants < 1 + contract.roommates.length)
        throw new BusinessRuleError("Sức chứa không được nhỏ hơn số người đang ở", "ROOM_CAPACITY_EXCEEDED");
    }
    if (
      (before.status === "RENTED" || before.currentContractId) &&
      body.status !== undefined
    )
      throw new BusinessRuleError(
        "Hãy thanh lý hợp đồng trước khi thay đổi trạng thái phòng",
      );
    const after = await Room.findOneAndUpdate(
      scoped(getTenantScope(req), { _id: before._id }),
      { $set: body },
      { returnDocument: "after", runValidators: true, session },
    );
    await audit.log({
      req,
      action: "UPDATE_ROOM",
      entityType: "ROOM",
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
    const before = await get(req, req.params.roomId, session);
    if (
      before.currentContractId ||
      before.status === "RENTED" ||
      (await Contract.exists({
        roomId: before._id,
        landlordId: before.landlordId,
        isDeleted: false,
        status: { $in: ["ACTIVE", "EXPIRING_SOON", "EXPIRED"] },
      }).session(session))
    )
      throw new BusinessRuleError("Phòng còn hợp đồng chưa thanh lý");
    await Room.updateOne(
      { _id: before._id, landlordId: before.landlordId, isDeleted: false },
      { $set: { isDeleted: true, status: "INACTIVE" } },
      { session },
    );
    await audit.log({
      req,
      action: "DELETE_ROOM",
      entityType: "ROOM",
      entityId: before._id,
      before,
      session,
    });
    return null;
  });
}
module.exports = { get, list, create, update, remove };
