// Business dates (billing periods, due days, bank timestamps) are Vietnam time: UTC+7, no DST.
const VN_OFFSET_MS = 7 * 3600000;
const DAY_MS = 86400000;

// Calendar day in Vietnam as "YYYY-MM-DD".
const vnDate = (date = new Date()) =>
  new Date(new Date(date).getTime() + VN_OFFSET_MS).toISOString().slice(0, 10);

// Current billing period in Vietnam as "YYYY-MM".
const currentPeriod = () => vnDate().slice(0, 7);

// UTC instants bounding a "YYYY-MM" period in Vietnam time: [start, end).
function periodRange(billingPeriod) {
  const [year, month] = billingPeriod.split("-").map(Number);
  return {
    start: new Date(Date.UTC(year, month - 1, 1) - VN_OFFSET_MS),
    end: new Date(Date.UTC(year, month, 1) - VN_OFFSET_MS),
  };
}

// "YYYY-MM-DD HH:mm:ss" as sent by SePay / banks (Vietnam local time); null for anything else,
// including impossible dates such as 2026-02-30 (callers then fall back to strict validation).
function parseVnDateTime(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value)) return null;
  const parsed = new Date(`${value.replace(" ", "T")}+07:00`);
  if (!Number.isFinite(parsed.getTime())) return null;
  // JS rolls 2026-02-30 over to March; reject instead of accepting a different day.
  return vnDate(parsed) === value.slice(0, 10) ? parsed : null;
}

module.exports = { VN_OFFSET_MS, DAY_MS, vnDate, currentPeriod, periodRange, parseVnDateTime };
