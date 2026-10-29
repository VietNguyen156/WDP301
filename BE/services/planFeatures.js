const { ForbiddenError } = require("../utils/errors");
const { currentSubscription } = require("./quotaService");
const {
  PLAN_FEATURES,
  FEATURE_KEYS,
  INCLUDED_FEATURES,
} = require("../utils/planFeatures");

// Every plan includes every feature; only a landlord without a current subscription is blocked.
async function hasFeature(landlordId, feature, session = null) {
  const subscription = await currentSubscription(landlordId, session);
  return !!subscription?.planId;
}

async function requireFeature(landlordId, feature, session = null) {
  if (!(await hasFeature(landlordId, feature, session)))
    throw new ForbiddenError(
      `Cần có gói dịch vụ đang hoạt động để dùng tính năng "${PLAN_FEATURES[feature]}".`,
      "FEATURE_NOT_IN_PLAN",
    );
}

module.exports = {
  PLAN_FEATURES,
  FEATURE_KEYS,
  INCLUDED_FEATURES,
  hasFeature,
  requireFeature,
};
