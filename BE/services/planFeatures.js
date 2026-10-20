const { ForbiddenError } = require("../utils/errors");
const { currentSubscription } = require("./quotaService");
const { PLAN_FEATURES, FEATURE_KEYS, DEFAULT_FLAGS } = require("../utils/planFeatures");

// Plans saved before flags existed (featureFlags unset) keep every feature.
const planHas = (plan, feature) => !Array.isArray(plan?.featureFlags) || plan.featureFlags.includes(feature);

async function hasFeature(landlordId, feature, session = null) {
  const subscription = await currentSubscription(landlordId, session);
  return !!subscription?.planId && planHas(subscription.planId, feature);
}

async function requireFeature(landlordId, feature, session = null) {
  if (!(await hasFeature(landlordId, feature, session)))
    throw new ForbiddenError(
      `Gói hiện tại chưa bao gồm tính năng "${PLAN_FEATURES[feature]}". Vui lòng nâng cấp gói.`,
      "FEATURE_NOT_IN_PLAN",
    );
}

module.exports = { PLAN_FEATURES, FEATURE_KEYS, DEFAULT_FLAGS, planHas, hasFeature, requireFeature };
