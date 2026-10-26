const { test } = require("node:test");
const assert = require("node:assert/strict");
const {
  getTenantScope,
  getBranchScope,
  scoped,
  validId,
} = require("../utils/scope");
const { bulk, room, branch } = require("../services/propertyValidation");
const {
  displayStatus,
} = require("../services/contractService");
const { calculateSettlement } = require("../services/contractSettlementService");
const { search, pagination } = require("../utils/validation");
test("scopes separate branch IDs from child scopes and deny platform access", () => {
  const req = {
    user: {
      _id: "m",
      role: "PROPERTY_MANAGER",
      landlordId: "l",
      assignedBranches: ["a"],
    },
  };
  assert.deepEqual(getTenantScope(req), {
    landlordId: "l",
    branchId: { $in: ["a"] },
  });
  assert.deepEqual(getBranchScope(req), {
    landlordId: "l",
    _id: { $in: ["a"] },
  });
  assert.deepEqual(scoped(getBranchScope(req), { _id: "b" }).$and[0]._id, {
    $in: ["a"],
  });
  assert.throws(() => getTenantScope({ user: { role: "SUPER_ADMIN" } }), {
    errorCode: "FORBIDDEN",
  });
  assert.throws(() => validId("bad"), { errorCode: "INVALID_ID" });
});
test("bulk generation maps 101–105 across four floors to 20 distinct rooms", () => {
  const result = bulk({
    fromFloor: 1,
    toFloor: 4,
    fromRoomNumber: 101,
    toRoomNumber: 105,
    prefix: "P.",
  });
  assert.equal(result.length, 20);
  assert.equal(result[0].roomNumber, "P.101");
  assert.equal(result.at(-1).roomNumber, "P.405");
  assert.throws(
    () =>
      bulk({
        fromFloor: 1,
        toFloor: 4,
        fromRoomNumber: 101,
        toRoomNumber: 205,
      }),
    { errorCode: "VALIDATION_ERROR" },
  );
});
test("validation rejects injected ownership, fractional VND and manager pricing", () => {
  assert.throws(() => room({ landlordId: "x" }), {
    errorCode: "VALIDATION_ERROR",
  });
  assert.throws(() => room({ basePrice: 1.1 }), {
    errorCode: "VALIDATION_ERROR",
  });
  assert.throws(() => room({ basePrice: 10 }, false, true), {
    errorCode: "VALIDATION_ERROR",
  });
  assert.throws(
    () =>
      branch({
        defaultServices: [{ name: "Wifi", price: -1, billingType: "PER_ROOM" }],
      }),
    { errorCode: "VALIDATION_ERROR" },
  );
  assert.throws(() => pagination({ limit: 1000 }), {
    errorCode: "VALIDATION_ERROR",
  });
  assert.equal(search("P.1").test("Px1"), false);
});
test("status derives expiration at query time without a scheduled job", () => {
  const now = new Date("2026-10-01T00:00:00Z");
  assert.equal(
    displayStatus({ status: "ACTIVE", endDate: "2026-10-20" }, now),
    "EXPIRING_SOON",
  );
  assert.equal(
    displayStatus({ status: "ACTIVE", endDate: "2026-09-30" }, now),
    "EXPIRED",
  );
  assert.equal(
    displayStatus({ status: "TERMINATED", endDate: "2026-09-30" }, now),
    "TERMINATED",
  );
});
test("settlement uses received deposit, meter deltas, integer deductions and evidence", () => {
  const input = {
    contract: { depositAmount: 3000000, depositStatus: "PAID" },
    room: { currentElectricIndex: 100, currentWaterIndex: 10 },
    branch: {
      defaultElectricityPrice: 3500,
      defaultWaterPrice: 30000,
      waterBillingType: "METER",
    },
    body: {
      finalElectricIndex: 120,
      finalWaterIndex: 12,
      deductions: [
        {
          reason: "Sửa khóa",
          amount: 100000,
          evidenceImage: "https://example.com/evidence.jpg",
        },
      ],
    },
  };
  assert.equal(calculateSettlement(input).refundedDepositAmount, 2770000);
  assert.equal(
    calculateSettlement({
      ...input,
      contract: { ...input.contract, depositStatus: "UNPAID" },
    }).remainingDue,
    230000,
  );
  assert.throws(
    () =>
      calculateSettlement({
        ...input,
        body: { ...input.body, finalElectricIndex: 99 },
      }),
    { errorCode: "READING_LOWER_THAN_PREVIOUS" },
  );
});

test("settlement prorates unbilled rent/water/services and does not recharge invoiced periods", () => {
  const input = {
    contract: { startDate: "2026-10-01", rentalPrice: 3100000, initialElectricIndex: 100,
      initialWaterIndex: 10, depositAmount: 3000000, depositStatus: "PAID", roommates: [{}],
      serviceQuantities: { "Giữ xe": 2 } },
    room: { currentElectricIndex: 100, currentWaterIndex: 10, electricityPrice: 4000,
      waterBillingType: "PER_PERSON", waterPrice: 310000 },
    branch: { defaultElectricityPrice: 3500, defaultWaterPrice: 30000, waterBillingType: "METER",
      defaultServices: [{ name: "Giữ xe", price: 310000, billingType: "PER_UNIT" }] },
    body: { actualEndDate: "2026-10-10", finalElectricIndex: 120, finalWaterIndex: 10, deductions: [] },
  };
  const result = calculateSettlement(input);
  assert.equal(result.roomAmount, 1000000);
  assert.equal(result.waterAmount, 200000);
  assert.equal(result.serviceAmount, 200000);
  assert.equal(result.electricAmount, 80000);
  const billed = calculateSettlement({ ...input, debt: 50000, invoices: [{ billingPeriod: "2026-10",
    electricDetail: { newIndex: 115 }, waterDetail: { newIndex: 10 } }] });
  assert.equal(billed.roomAmount, 0);
  assert.equal(billed.waterAmount, 0);
  assert.equal(billed.serviceAmount, 0);
  assert.equal(billed.electricAmount, 20000);
  assert.equal(billed.totalCharges, 70000);
});
