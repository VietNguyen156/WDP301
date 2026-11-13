// What each role may do on invoice screens; mirrors the backend routes
// (generate/issue/cancel: LANDLORD; cash: LANDLORD confirms, PROPERTY_MANAGER reports
// for approval; TENANT only reads issued invoices and pays through the public page).
export const PAYABLE_STATUSES = ["ISSUED", "PARTIALLY_PAID", "UNPAID"];

// `permissions`: the manager's switches from the landlord (user.permissions); missing = allowed.
export function invoicePermissions(role, permissions = {}) {
  const isLandlord = role === "LANDLORD";
  const isManager = role === "PROPERTY_MANAGER";
  const isTenant = role === "TENANT";
  return {
    isLandlord,
    isManager,
    isTenant,
    canGenerate: isLandlord,
    canIssue: isLandlord,
    canCancel: isLandlord,
    canCollectCash: isLandlord || (isManager && permissions.REPORT_CASH !== false),
    cashActionLabel: isManager ? "Báo cáo đã thu tiền mặt" : "Xác nhận thu tiền mặt",
    canShareLink: isLandlord || isManager,
    canPayOnline: isTenant,
    // Tenants never receive drafts or cancelled invoices from the API.
    canSeeDraftsAndCancelled: !isTenant,
  };
}
