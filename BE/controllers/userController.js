const User = require("../models/User");
const { NotFoundError } = require("../utils/errors");
const { validId } = require("../utils/scope");
const { pagination } = require("../utils/validation");
const respond = require("../utils/response");
const fields = "name email username role status createdAt";

exports.getUsers = async (req, res) => {
  const { page, limit, skip } = pagination(req.query);
  const filter = { isDeleted: false };
  const [items, total] = await Promise.all([
    User.find(filter).select(fields).sort({ createdAt: -1, _id: -1 }).skip(skip).limit(limit).lean(),
    User.countDocuments(filter),
  ]);
  respond(res, { items, total, page, limit });
};

exports.getUserById = async (req, res) => {
  const user = await User.findOne({ _id: validId(req.params.id), isDeleted: false }).select(fields).lean();
  if (!user) throw new NotFoundError("Không tìm thấy tài khoản");
  respond(res, user);
};
