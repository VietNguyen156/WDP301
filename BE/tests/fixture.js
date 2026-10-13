const User = require("../models/User");
const Branch = require("../models/Branch");
const Room = require("../models/Room");
const SaaSPlan = require("../models/SaaSPlan");
const Subscription = require("../models/Subscription");
async function fixture() {
  const landlord = await User.create({
    name: "Chủ cơ sở kiểm thử",
    email: "owner@test.local",
    password: "password123",
    role: "LANDLORD",
  });
  const other = await User.create({
    name: "Chủ cơ sở khác",
    email: "other@test.local",
    password: "password123",
    role: "LANDLORD",
  });
  const plan = await SaaSPlan.create({
    name: "Test plan",
    code: "TEST",
    maxBranches: 5,
    maxRooms: 30,
    maxManagers: 2,
  });
  const subscription = await Subscription.create({
    landlordId: landlord._id,
    planId: plan._id,
    endDate: new Date(Date.now() + 86400000),
  });
  landlord.subscriptionId = subscription._id;
  await landlord.save();
  const branch = await Branch.create({
    landlordId: landlord._id,
    name: "Cơ sở Vườn Xanh",
    totalFloors: 4,
    address: { fullAddress: "12 Nguyễn Văn Cừ, TP. Hồ Chí Minh" },
  });
  const hidden = await Branch.create({
    landlordId: landlord._id,
    name: "Cơ sở ngoài phân công",
    totalFloors: 2,
  });
  const foreign = await Branch.create({
    landlordId: other._id,
    name: "Cơ sở chủ khác",
  });
  const manager = await User.create({
    name: "Quản lý kiểm thử",
    email: "manager@test.local",
    password: "password123",
    role: "PROPERTY_MANAGER",
    landlordId: landlord._id,
    assignedBranches: [branch._id],
  });
  const admin = await User.create({
    name: "Admin",
    email: "admin@test.local",
    password: "password123",
    role: "SUPER_ADMIN",
  });
  const room = await Room.create({
    landlordId: landlord._id,
    branchId: branch._id,
    roomNumber: "A.101",
    basePrice: 3000000,
    amenities: ["Điều hòa", "Ban công"],
  });
  return {
    landlord,
    other,
    manager,
    admin,
    branch,
    hidden,
    foreign,
    room,
    plan,
    subscription,
  };
}
module.exports = fixture;
