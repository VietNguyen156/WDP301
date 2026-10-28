// How long audit entries live, and what an entry stores.
const DAY_MS = 86400000;

// Money-related history is kept much longer (accounting records): invoices, SaaS billing,
// payments, bank accounts, deposits, settlements, prices and repair costs.
const FINANCE_ENTITY_TYPES = ["INVOICE", "PLATFORM_INVOICE", "SUBSCRIPTION"];
const FINANCE_ACTION_PATTERN = "PAYMENT|BANK|DEPOSIT|SETTLE|PRICING|COST";
const FINANCE_ACTION_RE = new RegExp(FINANCE_ACTION_PATTERN);

const isFinance = (entityType, action) =>
  FINANCE_ENTITY_TYPES.includes(entityType) || FINANCE_ACTION_RE.test(action || "");

// Days from BE/.env; 0 keeps entries forever.
const days = (name, fallback) => {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value >= 0 ? value : fallback;
};
const retentionDays = (finance) =>
  finance ? days("AUDIT_FINANCE_RETENTION_DAYS", 3650) : days("AUDIT_RETENTION_DAYS", 365);

function expiresAt(entityType, action, from = new Date()) {
  const keep = retentionDays(isFinance(entityType, action));
  return keep ? new Date(new Date(from).getTime() + keep * DAY_MS) : undefined;
}

// Bookkeeping fields that change on every save and say nothing about the business change.
const IGNORED = new Set(["_id", "__v", "createdAt", "updatedAt", "mutationVersion", "quotaVersion", "authVersion"]);
const plain = (value) => (value && typeof value.toObject === "function" ? value.toObject() : value);
const same = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

// Keep only top-level fields whose value changed. Creations (no before) and deletions
// (no after) are stored as given.
function changedFields(before, after) {
  const b = plain(before);
  const a = plain(after);
  if (!b || !a || typeof b !== "object" || typeof a !== "object") return { before: b, after: a };
  const out = { before: {}, after: {} };
  for (const key of new Set([...Object.keys(b), ...Object.keys(a)])) {
    if (IGNORED.has(key) || same(b[key], a[key])) continue;
    if (key in b) out.before[key] = b[key];
    if (key in a) out.after[key] = a[key];
  }
  return out;
}

module.exports = {
  FINANCE_ENTITY_TYPES,
  FINANCE_ACTION_PATTERN,
  isFinance,
  retentionDays,
  expiresAt,
  changedFields,
};
