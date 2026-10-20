// Machine-readable features a plan can unlock; SaaSPlan.features stays free text for display.
const PLAN_FEATURES = {
  SEPAY_WEBHOOK: "Đối soát ngân hàng SePay tự động",
  INCIDENTS: "Quản lý sự cố & bảo trì",
};
const FEATURE_KEYS = Object.keys(PLAN_FEATURES);
// Starting flags for the standard plan codes, used when seeding and backfilling.
const DEFAULT_FLAGS = {
  FREE_TRIAL: [],
  STARTER: ["SEPAY_WEBHOOK"],
  PRO: FEATURE_KEYS,
  ENTERPRISE: FEATURE_KEYS,
};
module.exports = { PLAN_FEATURES, FEATURE_KEYS, DEFAULT_FLAGS };
