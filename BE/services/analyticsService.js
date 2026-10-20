const User = require("../models/User");
const Room = require("../models/Room");
const Subscription = require("../models/Subscription");
const PlatformInvoice = require("../models/PlatformInvoice");
const v = require("../utils/validation");
const { ValidationError } = require("../utils/errors");
const {
  VN_OFFSET_MS,
  DAY_MS,
  currentPeriod,
  periodRange,
} = require("../utils/vnTime");

// Landlords late on their SaaS invoice, longest overdue first (PROJECT_RULES §3.1).
async function overdueInvoices(now, limit = 20) {
  const rows = await PlatformInvoice.aggregate([
    {
      $match: {
        isDeleted: false,
        $or: [
          { status: "OVERDUE" },
          { status: "PENDING", dueDate: { $lt: now } },
        ],
      },
    },
    { $sort: { dueDate: 1, _id: 1 } },
    { $limit: limit },
    {
      $lookup: {
        from: User.collection.name,
        localField: "landlordId",
        foreignField: "_id",
        as: "owner",
        pipeline: [
          { $project: { name: 1, email: 1, phoneNumber: 1, status: 1 } },
        ],
      },
    },
    {
      $lookup: {
        from: "saasplans",
        localField: "planId",
        foreignField: "_id",
        as: "plan",
        pipeline: [{ $project: { code: 1, name: 1 } }],
      },
    },
  ]);
  return rows.map((row) => ({
    invoiceId: row._id,
    invoiceCode: row.invoiceCode,
    amount: row.amount,
    dueDate: row.dueDate,
    overdueDays: Math.floor((now - row.dueDate) / 86400000),
    landlord: row.owner[0] && {
      id: row.owner[0]._id,
      name: row.owner[0].name,
      email: row.owner[0].email,
      phoneNumber: row.owner[0].phoneNumber,
      status: row.owner[0].status,
    },
    plan: row.plan[0] && { code: row.plan[0].code, name: row.plan[0].name },
  }));
}

async function stats(req) {
  const now = new Date();
  let from = req.query.from
    ? v.date(req.query.from, "Từ ngày")
    : periodRange(currentPeriod()).start;
  let to = req.query.to ? v.date(req.query.to, "Đến ngày") : now;
  // Plain dates mean whole Vietnam days.
  if (req.query.from?.length === 10)
    from = new Date(from.getTime() - VN_OFFSET_MS);
  if (req.query.to?.length === 10)
    to = new Date(to.getTime() - VN_OFFSET_MS + DAY_MS - 1);
  if (to < from) throw new ValidationError("Đến ngày phải sau từ ngày");
  const soon = new Date(now.getTime() + 7 * 86400000);
  const [
    users,
    newAccounts,
    suspended,
    rooms,
    recurring,
    receipts,
    overdue,
    renewals,
    trials,
    converted,
    overdueList,
  ] = await Promise.all([
    User.aggregate([
      {
        $match: {
          isDeleted: false,
          role: { $in: ["LANDLORD", "PROPERTY_MANAGER", "TENANT"] },
        },
      },
      { $group: { _id: "$role", count: { $sum: 1 } } },
    ]),
    User.countDocuments({
      isDeleted: false,
      role: { $ne: "SUPER_ADMIN" },
      createdAt: { $gte: from, $lte: to },
    }),
    User.countDocuments({
      isDeleted: false,
      role: { $ne: "SUPER_ADMIN" },
      status: "SUSPENDED",
    }),
    Room.countDocuments({ isDeleted: false, status: { $ne: "INACTIVE" } }),
    Subscription.aggregate([
      {
        $match: {
          isDeleted: false,
          status: "ACTIVE",
          startDate: { $lte: now },
          endDate: { $gt: now },
        },
      },
      {
        $lookup: {
          from: User.collection.name,
          localField: "landlordId",
          foreignField: "_id",
          as: "owner",
        },
      },
      {
        $match: {
          "owner.0.role": "LANDLORD",
          "owner.0.isDeleted": false,
          "owner.0.status": "ACTIVE",
        },
      },
      { $sort: { startDate: -1, createdAt: -1, _id: -1 } },
      {
        $group: {
          _id: "$landlordId",
          price: { $first: { $ifNull: ["$quotedPrice", "$pricePaid"] } },
          cycle: { $first: "$billingCycle" },
        },
      },
      {
        $group: {
          _id: null,
          activeLandlords: { $sum: 1 },
          mrr: {
            $sum: {
              $cond: [
                { $eq: ["$cycle", "YEARLY"] },
                { $divide: ["$price", 12] },
                "$price",
              ],
            },
          },
          payingLandlords: { $sum: { $cond: [{ $gt: ["$price", 0] }, 1, 0] } },
        },
      },
    ]),
    PlatformInvoice.aggregate([
      {
        $match: {
          isDeleted: false,
          status: "PAID",
          paidAt: { $gte: from, $lte: to },
        },
      },
      {
        $group: { _id: null, amount: { $sum: "$amount" }, count: { $sum: 1 } },
      },
    ]),
    PlatformInvoice.countDocuments({
      isDeleted: false,
      $or: [
        { status: "OVERDUE" },
        { status: "PENDING", dueDate: { $lt: now } },
      ],
    }),
    Subscription.countDocuments({
      isDeleted: false,
      status: "ACTIVE",
      endDate: { $gt: now, $lte: soon },
    }),
    Subscription.distinct("landlordId", { isDeleted: false, quotedPrice: 0 }),
    Subscription.distinct("landlordId", {
      isDeleted: false,
      pricePaid: { $gt: 0 },
      status: { $in: ["ACTIVE", "EXPIRED", "CANCELLED"] },
    }),
    overdueInvoices(now),
  ]);
  const counts = Object.fromEntries(users.map((u) => [u._id, u.count]));
  const paidOwners = new Set(converted.map(String));
  const convertedTrials = trials.filter((id) =>
    paidOwners.has(String(id)),
  ).length;
  return {
    period: { from, to },
    users: {
      landlords: counts.LANDLORD || 0,
      managers: counts.PROPERTY_MANAGER || 0,
      tenants: counts.TENANT || 0,
      newAccounts,
      suspendedAccounts: suspended,
    },
    saas: {
      mrr: Math.round(recurring[0]?.mrr || 0),
      activeLandlords: recurring[0]?.activeLandlords || 0,
      payingLandlords: recurring[0]?.payingLandlords || 0,
      collectedAmount: receipts[0]?.amount || 0,
      paidInvoiceCount: receipts[0]?.count || 0,
      overdueInvoiceCount: overdue,
      expiringWithin7Days: renewals,
      trialLandlords: trials.length,
      convertedTrialLandlords: convertedTrials,
      trialConversionRate: trials.length
        ? Math.round((convertedTrials / trials.length) * 10000) / 100
        : 0,
      overdueInvoices: overdueList,
    },
    property: { activeRoomCount: rooms },
  };
}

module.exports = { stats };
