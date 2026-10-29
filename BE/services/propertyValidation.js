const v = require("../utils/validation");
const { ValidationError } = require("../utils/errors");
const branchFields = [
  "name",
  "totalFloors",
  "address",
  "defaultElectricityPrice",
  "waterBillingType",
  "defaultWaterPrice",
  "defaultServices",
  "billingCycleDay",
  "paymentDueDays",
  "status",
];
function branch(body, creating = false) {
  v.fields(body, branchFields);
  if (creating || body.name !== undefined) v.text(body.name, "Tên cơ sở");
  for (const key of ["defaultElectricityPrice", "defaultWaterPrice"])
    if (body[key] !== undefined) v.number(body[key], key);
  if (body.totalFloors !== undefined)
    v.number(body.totalFloors, "Số tầng", 1, 100);
  if (body.billingCycleDay !== undefined)
    v.number(body.billingCycleDay, "Ngày chốt", 1, 28);
  if (body.paymentDueDays !== undefined)
    v.number(body.paymentDueDays, "Hạn thanh toán", 1, 90);
  if (body.waterBillingType !== undefined)
    v.choice(
      body.waterBillingType,
      ["METER", "PER_PERSON", "FIXED"],
      "Cách tính nước",
    );
  if (body.status !== undefined)
    v.choice(body.status, ["ACTIVE", "INACTIVE"], "Trạng thái");
  if (body.address !== undefined) {
    v.fields(body.address, [
      "street",
      "ward",
      "district",
      "city",
      "fullAddress",
    ]);
    Object.values(body.address).forEach((x) => v.text(x, "Địa chỉ", false));
  }
  if (body.defaultServices !== undefined) {
    if (
      !Array.isArray(body.defaultServices) ||
      body.defaultServices.length > 30
    )
      throw new ValidationError("Danh sách dịch vụ không hợp lệ");
    body.defaultServices.forEach((s) => {
      v.fields(s, ["name", "price", "billingType"]);
      v.text(s.name, "Tên dịch vụ");
      if (
        /[.$]/.test(s.name) ||
        ["__proto__", "prototype", "constructor"].includes(s.name)
      )
        throw new ValidationError("Tên dịch vụ không hợp lệ");
      v.number(s.price, "Giá dịch vụ");
      v.choice(
        s.billingType,
        ["PER_ROOM", "PER_PERSON", "PER_UNIT"],
        "Cách tính dịch vụ",
      );
    });
    if (
      new Set(body.defaultServices.map((s) => s.name.trim())).size !==
      body.defaultServices.length
    )
      throw new ValidationError("Tên dịch vụ không được trùng nhau");
  }
  return body;
}
function room(body, creating = false, manager = false) {
  v.fields(
    body,
    manager
      ? ["status"]
      : [
          "roomNumber",
          "floor",
          "basePrice",
          "maxOccupants",
          "status",
          "amenities",
          "notes",
          "electricityPrice",
          "waterPrice",
          "waterBillingType",
          "services",
        ],
  );
  if (creating || body.roomNumber !== undefined)
    v.text(body.roomNumber, "Số phòng");
  if (body.floor !== undefined) v.number(body.floor, "Tầng", 1, 100);
  // Rent is required when the landlord creates a room and can never be set back to 0.
  if (creating && !manager && body.basePrice === undefined)
    throw new ValidationError("Vui lòng nhập giá thuê niêm yết");
  if (body.basePrice !== undefined) v.number(body.basePrice, "Giá thuê", 1);
  for (const key of ["electricityPrice", "waterPrice"])
    if (body[key] !== undefined) v.number(body[key], key);
  if (body.waterBillingType !== undefined)
    v.choice(
      body.waterBillingType,
      ["METER", "PER_PERSON", "FIXED"],
      "Cách tính nước",
    );
  if (body.services !== undefined) branch({ defaultServices: body.services });
  if (body.maxOccupants !== undefined)
    v.number(body.maxOccupants, "Số người tối đa", 1, 30);
  if (body.status !== undefined)
    v.choice(
      body.status,
      manager
        ? ["EMPTY", "CLEANING", "MAINTENANCE"]
        : ["EMPTY", "CLEANING", "MAINTENANCE", "INACTIVE"],
      "Trạng thái phòng",
    );
  if (body.notes !== undefined) v.text(body.notes, "Ghi chú", false);
  if (body.amenities !== undefined) {
    if (!Array.isArray(body.amenities) || body.amenities.length > 30)
      throw new ValidationError("Tiện nghi không hợp lệ");
    body.amenities.forEach((a) => v.text(a, "Tiện nghi"));
  }
  return body;
}
function bulk(body) {
  v.fields(body, [
    "fromFloor",
    "toFloor",
    "fromRoomNumber",
    "toRoomNumber",
    "prefix",
    "basePrice",
    "maxOccupants",
  ]);
  v.number(body.fromFloor, "Tầng bắt đầu", 1, 100);
  v.number(body.toFloor, "Tầng kết thúc", body.fromFloor, 100);
  v.number(body.fromRoomNumber, "Phòng bắt đầu", 1, 9999);
  v.number(body.toRoomNumber, "Phòng kết thúc", body.fromRoomNumber, 9999);
  if (
    Math.floor(body.fromRoomNumber / 100) !==
      Math.floor(body.toRoomNumber / 100) ||
    body.toRoomNumber % 100 < body.fromRoomNumber % 100
  )
    throw new ValidationError(
      "Khoảng số phòng phải cùng một tầng, ví dụ 101–105",
    );
  if (body.prefix !== undefined) v.text(body.prefix, "Tiền tố", false);
  if (body.basePrice === undefined) throw new ValidationError("Vui lòng nhập giá thuê niêm yết");
  v.number(body.basePrice, "Giá thuê", 1);
  if (body.maxOccupants !== undefined)
    v.number(body.maxOccupants, "Số người tối đa", 1, 30);
  const rooms = [];
  for (let floor = body.fromFloor; floor <= body.toFloor; floor++) {
    for (let n = body.fromRoomNumber % 100; n <= body.toRoomNumber % 100; n++) {
      rooms.push({
        floor,
        roomNumber: `${body.prefix || ""}${floor}${String(n).padStart(2, "0")}`,
        basePrice: body.basePrice,
        maxOccupants: body.maxOccupants || 2,
      });
    }
  }
  if (rooms.length > 500)
    throw new ValidationError("Mỗi lần tạo tối đa 500 phòng");
  return rooms;
}
module.exports = { branch, room, bulk };
