// Sandbox-only "pretend the tenant transferred the money" button on the public invoice page.
// Never available in production; can also be switched off with PAYMENT_SIMULATOR=false.
const simulatorEnabled = () =>
  process.env.NODE_ENV !== "production" &&
  process.env.PAYMENT_SIMULATOR !== "false";

module.exports = { simulatorEnabled };
