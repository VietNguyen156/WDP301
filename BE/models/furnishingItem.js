// One piece of furniture/equipment handed over with a room (Branch, Room, Contract).
// price: agreed unit value, charged to the tenant if the item is lost or broken.
const mongoose = require("mongoose");

module.exports = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true }, // vd: "Điều hòa Daikin 9000BTU"
    quantity: { type: Number, required: true, min: 1, default: 1 },
    price: { type: Number, required: true, min: 0 }, // VNĐ / 1 cái
    note: { type: String, trim: true }, // tình trạng khi bàn giao, vd: "Mới 100%"
  },
  { _id: false },
);
