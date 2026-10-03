const AppError = require("./AppError");

function getTenantScope(req) {
  const user = req.user;
  if (!user) throw new AppError(401, "AUTH_REQUIRED", "Vui lòng đăng nhập");
  if (user.role === "LANDLORD") return { landlordId: user._id };
  if (user.role === "PROPERTY_MANAGER" && user.landlordId) {
    return { landlordId: user.landlordId, branchId: { $in: user.assignedBranches || [] } };
  }
  if (user.role === "TENANT" && user.landlordId) {
    return { landlordId: user.landlordId, tenantId: user._id };
  }
  throw new AppError(403, "FORBIDDEN", "Không có quyền truy cập dữ liệu tiền phòng");
}

function getBranchScope(req) {
  const scope = getTenantScope(req);
  if (req.user.role === "TENANT") throw new AppError(403, "FORBIDDEN", "Không có quyền truy cập cơ sở");
  if (scope.branchId) return { landlordId: scope.landlordId, _id: scope.branchId };
  return scope;
}

module.exports = { getTenantScope, getBranchScope };
