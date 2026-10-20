const { AppError } = require("../utils/errors");
const { requestJson, basicAuth } = require("../utils/httpJson");

// Thin server-side client for SePay Bank Hub. client_secret never leaves the backend.
const BASE_URLS = {
  sandbox: "https://bankhub-api-sandbox.sepay.vn",
  production: "https://bankhub-api.sepay.vn",
};

function config() {
  const env = process.env.SEPAY_BANKHUB_ENV || "sandbox";
  return {
    env,
    baseUrl: (process.env.SEPAY_BANKHUB_BASE_URL || BASE_URLS[env] || BASE_URLS.sandbox).replace(/\/$/, ""),
    clientId: process.env.SEPAY_BANKHUB_CLIENT_ID,
    clientSecret: process.env.SEPAY_BANKHUB_CLIENT_SECRET,
  };
}

const isConfigured = () => !!(config().clientId && config().clientSecret);

let cached = null; // { token, expiresAt, key }

async function accessToken(force = false) {
  const { baseUrl, clientId, clientSecret } = config();
  if (!clientId || !clientSecret)
    throw new AppError("Máy chủ chưa cấu hình SePay Bank Hub", 503, "BANKHUB_NOT_CONFIGURED");
  const key = `${baseUrl}|${clientId}`;
  if (!force && cached?.key === key && cached.expiresAt > Date.now()) return cached.token;
  const response = await send(`${baseUrl}/v1/token`, {
    method: "POST",
    headers: {
      Authorization: basicAuth(clientId, clientSecret),
      "Content-Type": "application/x-www-form-urlencoded",
    },
  });
  if (!response.ok || !response.body?.access_token)
    throw new AppError("Không lấy được access token SePay Bank Hub", 502, "BANKHUB_UNAVAILABLE");
  // The unit of `ttl` is not documented; cache at most an hour and refresh on any 401.
  const ttlSeconds = Math.min(Number(response.body.ttl) || 300, 3600);
  cached = { token: response.body.access_token, expiresAt: Date.now() + (ttlSeconds - 30) * 1000, key };
  return cached.token;
}

const send = (url, options) =>
  requestJson(url, {
    ...options,
    unavailable: { message: "Không kết nối được SePay Bank Hub", errorCode: "BANKHUB_UNAVAILABLE" },
  });

// Authenticated call; retries once with a fresh token when Bank Hub answers 401.
async function request(method, path, payload) {
  const { baseUrl } = config();
  for (const force of [false, true]) {
    const response = await send(`${baseUrl}${path}`, {
      method,
      headers: { Authorization: `Bearer ${await accessToken(force)}`, "Content-Type": "application/json" },
      ...(payload && { body: JSON.stringify(payload) }),
    });
    if (response.status === 401 && !force) continue;
    if (!response.ok) {
      const detail = response.body?.message || response.body?.error || `HTTP ${response.status}`;
      throw new AppError(`SePay Bank Hub từ chối yêu cầu: ${detail}`, 502, "BANKHUB_REQUEST_FAILED");
    }
    return response.body;
  }
}

const createCompany = (fullName) =>
  request("POST", "/v1/company/create", { full_name: fullName, status: "Active" }).then((body) => body?.data);

const createLinkToken = (payload) => request("POST", "/v1/link-token/create", payload);

const listBankAccounts = (companyXid) =>
  request("GET", `/v1/bank-account?company_xid=${encodeURIComponent(companyXid)}&per_page=50`).then((body) => body?.data || []);

const getBankAccount = (xid) =>
  request("GET", `/v1/bank-account/${encodeURIComponent(xid)}`).then((body) => body?.data ?? body);

const resetTokenCache = () => {
  cached = null;
};

module.exports = {
  config,
  isConfigured,
  createCompany,
  createLinkToken,
  listBankAccounts,
  getBankAccount,
  resetTokenCache,
};
