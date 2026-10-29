// Status groups used across services; one definition so the rules stay in sync.

// Contracts that still occupy the room (EXPIRED = past end date but not yet settled).
const LIVE_CONTRACT_STATUSES = ["ACTIVE", "EXPIRING_SOON", "EXPIRED"];
// Issued invoices that can still receive money.
const OWING_INVOICE_STATUSES = ["ISSUED", "PARTIALLY_PAID", "UNPAID"];

module.exports = { LIVE_CONTRACT_STATUSES, OWING_INVOICE_STATUSES };
