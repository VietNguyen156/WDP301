// Front-end addresses come from BE/.env; the localhost default exists only for local development.
const trimSlash = (url) => url.replace(/\/+$/, "");

// Where the web app runs (CORS, login origin check, Socket.io, payment return pages).
// All allowed origins (supports comma-separated origins in CLIENT_URL)
const getAllowedOrigins = () => {
  const raw = process.env.CLIENT_URL || "http://localhost:5173";
  return raw
    .split(",")
    .map((u) => trimSlash(u.trim()))
    .filter(Boolean);
};

// Where the web app runs by default (payment return pages, default links, etc.)
const clientUrl = () => getAllowedOrigins()[0] || "http://localhost:5173";

// Address put in links that tenants open from their own phone (No-App invoice, debt reminders).
const publicAppUrl = () => trimSlash(process.env.PUBLIC_APP_URL || clientUrl());

const isAllowedOrigin = (origin) => {
  if (!origin) return true;
  const trimmed = trimSlash(origin);
  const allowed = getAllowedOrigins();
  if (allowed.includes(trimmed)) return true;

  // Vercel preview deployments of this team only, e.g. https://wdp-ptwyyvwxt-he173215s-projects.vercel.app.
  // The production domain goes in CLIENT_URL. VERCEL_PREVIEW_SUFFIX empty = no previews.
  const suffix = process.env.VERCEL_PREVIEW_SUFFIX;
  return !!suffix && /^https:\/\/wdp-[a-z0-9-]+$/i.test(trimmed.slice(0, -suffix.length)) && trimmed.endsWith(suffix);
};

module.exports = {
  clientUrl,
  publicAppUrl,
  getAllowedOrigins,
  isAllowedOrigin,
};
