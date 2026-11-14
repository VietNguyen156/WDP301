// What a landlord can switch off for one of their branch managers (PROPERTY_MANAGER).
// Everything is allowed by default: User.deniedPermissions stores only what was switched off,
// so a permission added here later is on for existing managers.
const MANAGER_PERMISSIONS = [
  "UPDATE_ROOMS", // PUT /rooms/:roomId
  "UTILITY_READINGS", // POST, PUT /utility-readings
  "HANDLE_INCIDENTS", // status, cost, quote, triage of incidents
  "RECORD_EXPENSES", // POST /expenses
  "VIEW_FINANCE", // GET invoices, payments, expenses
  "VIEW_CONTRACTS", // GET /contracts, /contracts/:contractId (read only)
  "REPORT_CASH", // POST /payments/cash
  "SEND_REMINDERS", // POST /invoices/:invoiceId/reminders
];

function permissionsOf(user) {
  const denied = user.deniedPermissions || [];
  return Object.fromEntries(MANAGER_PERMISSIONS.map((key) => [key, !denied.includes(key)]));
}

module.exports = { MANAGER_PERMISSIONS, permissionsOf };
