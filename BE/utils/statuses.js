// Status groups used across services; one definition so the rules stay in sync.

// Signed by both parties and still occupying the room (EXPIRED = past end date but not yet
// settled). Only these contracts are billed: invoices, utility readings, renewals.
const LIVE_CONTRACT_STATUSES = ["ACTIVE", "EXPIRING_SOON", "EXPIRED"];
// Live contracts plus DRAFT (waiting for both signatures): they hold the room and can take the
// deposit, but nothing is invoiced until the contract is signed.
const OPEN_CONTRACT_STATUSES = ["DRAFT", ...LIVE_CONTRACT_STATUSES];
// Issued invoices that can still receive money.
const OWING_INVOICE_STATUSES = ["ISSUED", "PARTIALLY_PAID", "UNPAID"];

module.exports = { LIVE_CONTRACT_STATUSES, OPEN_CONTRACT_STATUSES, OWING_INVOICE_STATUSES };
