// Front-end addresses come from BE/.env; the localhost default exists only for local development.
const trimSlash = (url) => url.replace(/\/+$/, "");

// Where the web app runs (CORS, login origin check, Socket.io, payment return pages).
const clientUrl = () => trimSlash(process.env.CLIENT_URL || "http://localhost:5173");

// Address put in links that tenants open from their own phone (No-App invoice, debt reminders).
const publicAppUrl = () => trimSlash(process.env.PUBLIC_APP_URL || clientUrl());

module.exports = { clientUrl, publicAppUrl };
