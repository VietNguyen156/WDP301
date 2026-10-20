const { AppError, ForbiddenError, ValidationError } = require("./errors");
const mongoose = require("mongoose");
const validId = (id) => {
  if (typeof id !== "string" || !mongoose.isObjectIdOrHexString(id))
    throw new ValidationError("Mã định danh không hợp lệ", "INVALID_ID");
  return id;
};
function getTenantScope({ user }) {
  if (!user) throw new AppError("Vui lòng đăng nhập", 401, "AUTH_REQUIRED");
  if (user.role === "LANDLORD") return { landlordId: user._id };
  if (user.role === "PROPERTY_MANAGER" && user.landlordId)
    return {
      landlordId: user.landlordId,
      branchId: { $in: user.assignedBranches || [] },
    };
  if (user.role === "TENANT" && user.landlordId)
    return { landlordId: user.landlordId, tenantId: user._id };
  throw new ForbiddenError();
}
function getBranchScope(req) {
  const scope = getTenantScope(req);
  if (req.user.role === "TENANT") throw new ForbiddenError();
  if (scope.branchId) {
    scope._id = scope.branchId;
    delete scope.branchId;
  }
  return scope;
}
function assertBranchScope(req, branchId) {
  validId(branchId);
  if (
    req.user.role === "PROPERTY_MANAGER" &&
    !req.user.assignedBranches.some((id) => String(id) === branchId)
  )
    throw new ForbiddenError(
      "Cơ sở không thuộc phạm vi được phân công",
      "BRANCH_SCOPE_FORBIDDEN",
    );
}
const scoped = (scope, filter = {}) => ({
  $and: [scope, filter, { isDeleted: false }],
});
module.exports = {
  getTenantScope,
  getBranchScope,
  assertBranchScope,
  scoped,
  validId,
};
