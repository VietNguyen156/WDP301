const mongoose = require("mongoose");
const Invoice = require("../models/Invoice");
const Payment = require("../models/Payment");
const Room = require("../models/Room");
const Contract = require("../models/Contract");
const branchService = require("./branchService");
const { period } = require("../utils/financeValidation");
const { publicAppUrl } = require("../utils/appUrls");
const {
  DAY_MS,
  vnDate,
  currentPeriod,
  periodRange,
} = require("../utils/vnTime");

// "3-second dashboard": how much came in, who still owes (and for how long), how full we are.
const BILLED = ["ISSUED", "PARTIALLY_PAID", "PAID", "OVERPAID", "UNPAID"];
const OWING = ["ISSUED", "PARTIALLY_PAID", "UNPAID"];
const ROOM_STATUSES = ["RENTED", "EMPTY", "MAINTENANCE", "CLEANING"];
const rate = (part, whole) =>
  whole ? Math.round((part / whole) * 10000) / 100 : 0;
const money = (value) => `${Math.round(value).toLocaleString("vi-VN")}đ`;
const dateVn = (value) => vnDate(value).split("-").reverse().join("/");

// Landlord only (PROPERTY_MANAGER must not see total revenue); optional branch filter.
async function scope(req) {
  const landlordId = new mongoose.Types.ObjectId(String(req.user._id));
  if (!req.query.branchId) return { landlordId };
  const branch = await branchService.get(req, req.query.branchId);
  return { landlordId, branchId: branch._id };
}

function reminder(item) {
  const [year, month] = item.billingPeriod.split("-");
  const link = `${publicAppUrl()}/i/${item.publicAccessToken}`;
  return (
    `Chào ${item.tenant?.name || "anh/chị"}, phòng ${item.room?.roomNumber || ""} còn ${money(item.remainingAmount)} ` +
    `tiền phòng kỳ ${month}/${year}${item.overdueDays > 0 ? ` (đã quá hạn ${item.overdueDays} ngày)` : ` (hạn ${dateVn(item.dueDate)})`}. ` +
    `Anh/chị vui lòng thanh toán qua link: ${link}. Cảm ơn anh/chị!`
  );
}

async function debtItems(match, limit) {
  const now = new Date();
  const rows = await Invoice.aggregate([
    {
      $match: {
        ...match,
        isDeleted: false,
        status: { $in: OWING },
        remainingAmount: { $gt: 0 },
      },
    },
    { $sort: { dueDate: 1, _id: 1 } },
    { $limit: limit },
    {
      $lookup: {
        from: "rooms",
        localField: "roomId",
        foreignField: "_id",
        as: "room",
        pipeline: [{ $project: { roomNumber: 1, floor: 1 } }],
      },
    },
    {
      $lookup: {
        from: "branches",
        localField: "branchId",
        foreignField: "_id",
        as: "branch",
        pipeline: [{ $project: { name: 1 } }],
      },
    },
    {
      $lookup: {
        from: "users",
        localField: "tenantId",
        foreignField: "_id",
        as: "tenant",
        pipeline: [{ $project: { name: 1, phoneNumber: 1 } }],
      },
    },
    {
      $project: {
        invoiceCode: 1,
        billingPeriod: 1,
        totalAmount: 1,
        paidAmount: 1,
        remainingAmount: 1,
        dueDate: 1,
        status: 1,
        publicAccessToken: 1,
        room: { $first: "$room" },
        branch: { $first: "$branch" },
        tenant: { $first: "$tenant" },
      },
    },
  ]);
  return rows
    .map((row) => ({
      ...row,
      overdueDays: Math.max(0, Math.floor((now - row.dueDate) / DAY_MS)),
    }))
    .sort(
      (a, b) =>
        b.overdueDays - a.overdueDays || b.remainingAmount - a.remainingAmount,
    )
    .map((row) => ({
      invoiceId: row._id,
      invoiceCode: row.invoiceCode,
      billingPeriod: row.billingPeriod,
      status: row.status,
      room: row.room && {
        id: row.room._id,
        roomNumber: row.room.roomNumber,
        floor: row.room.floor,
      },
      branch: row.branch && { id: row.branch._id, name: row.branch.name },
      tenant: row.tenant && {
        id: row.tenant._id,
        name: row.tenant.name,
        phoneNumber: row.tenant.phoneNumber,
      },
      totalAmount: row.totalAmount,
      paidAmount: row.paidAmount,
      remainingAmount: row.remainingAmount,
      dueDate: row.dueDate,
      overdueDays: row.overdueDays,
      publicPath: `/i/${row.publicAccessToken}`,
      reminderMessage: reminder(row),
    }));
}

function debtSummary(items) {
  return {
    roomCount: new Set(items.map((i) => String(i.room?.id))).size,
    invoiceCount: items.length,
    overdueCount: items.filter((i) => i.overdueDays > 0).length,
    totalAmount: items.reduce((sum, i) => sum + i.remainingAmount, 0),
  };
}

async function stats(req) {
  const billingPeriod = req.query.billingPeriod
    ? period(req.query.billingPeriod)
    : currentPeriod();
  const match = await scope(req);
  const { start: from, end: to } = periodRange(billingPeriod);
  const now = new Date();
  const [billed, received, rooms, contracts, debts] = await Promise.all([
    Invoice.aggregate([
      {
        $match: {
          ...match,
          isDeleted: false,
          billingPeriod,
          status: { $in: BILLED },
        },
      },
      {
        $group: {
          _id: null,
          expectedAmount: { $sum: "$totalAmount" },
          collectedAmount: { $sum: { $min: ["$paidAmount", "$totalAmount"] } },
          overpaidAmount: { $sum: "$overpaidAmount" },
          invoiceCount: { $sum: 1 },
          paidInvoiceCount: {
            $sum: { $cond: [{ $in: ["$status", ["PAID", "OVERPAID"]] }, 1, 0] },
          },
        },
      },
    ]),
    // Cash flow: money actually received during the month, whatever period it pays for.
    Payment.aggregate([
      {
        $match: {
          ...match,
          isDeleted: false,
          status: "SUCCESS",
          transactionDate: { $gte: from, $lt: to },
        },
      },
      { $group: { _id: "$paymentMethod", amount: { $sum: "$amount" } } },
    ]),
    Room.aggregate([
      { $match: { ...match, isDeleted: false, status: { $ne: "INACTIVE" } } },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]),
    Contract.aggregate([
      {
        $match: {
          ...match,
          isDeleted: false,
          status: { $in: ["ACTIVE", "EXPIRING_SOON", "EXPIRED"] },
        },
      },
      {
        $group: {
          _id: null,
          live: { $sum: { $cond: [{ $gte: ["$endDate", now] }, 1, 0] } },
          expiringSoon: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $gte: ["$endDate", now] },
                    {
                      $lte: ["$endDate", new Date(now.getTime() + 30 * DAY_MS)],
                    },
                  ],
                },
                1,
                0,
              ],
            },
          },
          expired: { $sum: { $cond: [{ $lt: ["$endDate", now] }, 1, 0] } },
        },
      },
    ]),
    debtItems(match, 1000),
  ]);
  const totals = billed[0] || {
    expectedAmount: 0,
    collectedAmount: 0,
    overpaidAmount: 0,
    invoiceCount: 0,
    paidInvoiceCount: 0,
  };
  const byStatus = Object.fromEntries(rooms.map((r) => [r._id, r.count]));
  const totalRooms = rooms.reduce((sum, r) => sum + r.count, 0);
  const receivedByMethod = Object.fromEntries(
    received.map((r) => [r._id, r.amount]),
  );
  return {
    billingPeriod,
    branchId: match.branchId || null,
    collection: {
      expectedAmount: totals.expectedAmount,
      collectedAmount: totals.collectedAmount,
      collectionRate: rate(totals.collectedAmount, totals.expectedAmount),
      outstandingAmount: totals.expectedAmount - totals.collectedAmount,
      overpaidAmount: totals.overpaidAmount,
      invoiceCount: totals.invoiceCount,
      paidInvoiceCount: totals.paidInvoiceCount,
      receivedAmount: received.reduce((sum, r) => sum + r.amount, 0),
      receivedByMethod,
    },
    debts: { ...debtSummary(debts), items: debts.slice(0, 10) },
    occupancy: {
      totalRooms,
      rentedRooms: byStatus.RENTED || 0,
      rate: rate(byStatus.RENTED || 0, totalRooms),
      byStatus: Object.fromEntries(
        ROOM_STATUSES.map((s) => [s, byStatus[s] || 0]),
      ),
    },
    contracts: {
      live: contracts[0]?.live || 0,
      expiringSoon: contracts[0]?.expiringSoon || 0,
      expired: contracts[0]?.expired || 0,
    },
  };
}

async function debts(req) {
  const items = await debtItems(await scope(req), 1000);
  return { ...debtSummary(items), items };
}

module.exports = { stats, debts };
