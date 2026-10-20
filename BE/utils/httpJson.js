const { AppError } = require("./errors");

// Outbound call to a provider (SePay Bank Hub, payment gateway). A network failure or timeout
// becomes a 502 with the caller's error code; the HTTP status is left for the caller to judge.
async function requestJson(url, { method = "GET", headers, body, timeoutMs = 10000, unavailable }) {
  let response;
  try {
    response = await fetch(url, {
      method,
      headers,
      ...(body !== undefined && { body }),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch {
    throw new AppError(unavailable.message, 502, unavailable.errorCode);
  }
  const text = await response.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  return { ok: response.ok, status: response.status, body: json };
}

const basicAuth = (user, password) => `Basic ${Buffer.from(`${user}:${password}`).toString("base64")}`;

module.exports = { requestJson, basicAuth };
