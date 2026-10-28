const Branch = require("../models/Branch");
const Room = require("../models/Room");
const Contract = require("../models/Contract");
const Invoice = require("../models/Invoice");
const User = require("../models/User");
const { getTenantScope, getBranchScope, scoped } = require("../utils/scope");
const { invoiceScope } = require("./invoiceService");
const { ValidationError } = require("../utils/errors");
const v = require("../utils/validation");

// Global search for the top bar: a few best matches per kind, always inside the caller's
// scope (landlord: whole chain; manager: assigned branches; contracts are landlord-only).
const PER_KIND = 5;
const ROOM_STATUS = {
  EMPTY: "Phòng trống",
  RENTED: "Đang thuê",
  MAINTENANCE: "Bảo trì",
  CLEANING: "Cần dọn",
  INACTIVE: "Ngừng hoạt động",
};

async function search(req) {
  const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
  if (q.length < 2) throw new ValidationError("Nhập ít nhất 2 ký tự để tìm kiếm");
  const re = v.search(q);
  const tenantScope = getTenantScope(req);
  const isLandlord = req.user.role === "LANDLORD";

  const [branches, rooms, contracts, invoices] = await Promise.all([
    Branch.find(scoped(getBranchScope(req), { $or: [{ name: re }, { "address.fullAddress": re }] }))
      .select("name address.fullAddress")
      .limit(PER_KIND)
      .lean(),
    Room.find(scoped(tenantScope, { roomNumber: re }))
      .select("roomNumber floor status branchId")
      .populate({ path: "branchId", select: "name" })
      .limit(PER_KIND)
      .lean(),
    isLandlord ? findContracts(req, tenantScope, re) : [],
    Invoice.find({ $and: [invoiceScope(req), { invoiceCode: re }] })
      .select("invoiceCode billingPeriod status totalAmount roomId")
      .populate({ path: "roomId", select: "roomNumber" })
      .sort({ createdAt: -1 })
      .limit(PER_KIND)
      .lean(),
  ]);

  const items = [
    ...branches.map((b) => ({
      type: "branch",
      id: b._id,
      title: b.name,
      subtitle: b.address?.fullAddress || "",
      branchId: b._id,
    })),
    ...rooms.map((r) => ({
      type: "room",
      id: r._id,
      title: `Phòng ${r.roomNumber}`,
      subtitle: [r.branchId?.name, `Tầng ${r.floor}`, ROOM_STATUS[r.status]].filter(Boolean).join(" · "),
      branchId: r.branchId?._id,
      query: r.roomNumber,
    })),
    ...contracts,
    ...invoices.map((i) => ({
      type: "invoice",
      id: i._id,
      title: i.invoiceCode,
      subtitle: [i.roomId?.roomNumber && `Phòng ${i.roomId.roomNumber}`, `Kỳ ${i.billingPeriod}`].filter(Boolean).join(" · "),
      query: i.invoiceCode,
    })),
  ];
  return { q, items };
}

// Contracts matched by contract code or by the tenant's name / phone / citizen ID.
async function findContracts(req, tenantScope, re) {
  const tenantIds = await User.find({
    role: "TENANT",
    landlordId: tenantScope.landlordId,
    isDeleted: false,
    $or: [{ name: re }, { phoneNumber: re }, { citizenId: re }],
  })
    .select("_id")
    .limit(20)
    .lean();
  const contracts = await Contract.find(
    scoped(tenantScope, { $or: [{ contractCode: re }, { tenantId: { $in: tenantIds.map((t) => t._id) } }] }),
  )
    .select("contractCode status tenantId roomId branchId")
    .populate({ path: "tenantId", select: "name phoneNumber" })
    .populate({ path: "roomId", select: "roomNumber" })
    .sort({ createdAt: -1 })
    .limit(PER_KIND)
    .lean();
  return contracts.map((c) => ({
    type: "contract",
    id: c._id,
    title: c.tenantId?.name || c.contractCode,
    subtitle: [`HĐ ${c.contractCode}`, c.roomId?.roomNumber && `Phòng ${c.roomId.roomNumber}`, c.tenantId?.phoneNumber]
      .filter(Boolean)
      .join(" · "),
    branchId: c.branchId,
    query: c.contractCode,
  }));
}

module.exports = { search };
