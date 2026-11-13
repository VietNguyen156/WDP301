// Outbound email.
// - smtp: any SMTP server, e.g. Gmail (SMTP_USER = Gmail address, SMTP_PASS = an App Password).
//   Fine locally; Render free instances block SMTP ports, so use brevo there.
// - brevo: Brevo's HTTP API (BREVO_API_KEY), works on any host. EMAIL_FROM_ADDRESS only has to
//   be verified as a single sender in Brevo (a Gmail address is fine, no domain needed).
// EMAIL_PROVIDER picks one; when empty it is inferred from whichever keys are set.
// Nothing configured -> 503 EMAIL_NOT_CONFIGURED (and the daily reminder job does nothing).
const nodemailer = require("nodemailer");
const { requestJson } = require("../utils/httpJson");
const { AppError } = require("../utils/errors");

const env = (key) => (process.env[key] || "").trim();

function provider() {
  const chosen = env("EMAIL_PROVIDER").toLowerCase();
  if (chosen) return chosen;
  if (env("BREVO_API_KEY")) return "brevo";
  if (env("SMTP_USER")) return "smtp";
  return "";
}

const fromAddress = () => env("EMAIL_FROM_ADDRESS") || env("SMTP_USER");

function configured() {
  const name = provider();
  if (name === "brevo") return Boolean(env("BREVO_API_KEY") && env("EMAIL_FROM_ADDRESS"));
  if (name === "smtp") return Boolean(env("SMTP_USER") && env("SMTP_PASS"));
  return false;
}

let transport;
function smtpTransport() {
  if (!transport) {
    const port = Number(env("SMTP_PORT")) || 465;
    transport = nodemailer.createTransport({
      host: env("SMTP_HOST") || "smtp.gmail.com",
      port,
      secure: port === 465,
      auth: { user: env("SMTP_USER"), pass: env("SMTP_PASS") },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 15000,
    });
  }
  return transport;
}

const unavailable = () =>
  new AppError("Gửi email thất bại, vui lòng thử lại sau", 502, "EMAIL_UNAVAILABLE");

async function sendSmtp({ from, to, replyTo, subject, html, text }) {
  const named = (who) => (who.name ? { name: who.name, address: who.email } : who.email);
  try {
    const info = await smtpTransport().sendMail({
      from: named(from),
      to: named(to),
      ...(replyTo && { replyTo: named(replyTo) }),
      subject,
      html,
      text,
    });
    return { provider: "SMTP", messageId: info.messageId || null };
  } catch (error) {
    console.error("SMTP từ chối email:", error.code, error.response || error.message);
    throw unavailable();
  }
}

async function sendBrevo({ from, to, replyTo, subject, html, text }) {
  const { ok, status, body } = await requestJson("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "api-key": env("BREVO_API_KEY"),
      "content-type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify({
      sender: from,
      to: [to],
      ...(replyTo && { replyTo }),
      subject,
      htmlContent: html,
      textContent: text,
      tags: ["nhac-no"],
    }),
    unavailable: { message: "Không kết nối được dịch vụ email, vui lòng thử lại sau", errorCode: "EMAIL_UNAVAILABLE" },
  });
  if (!ok) {
    console.error("Brevo từ chối email:", status, body?.code, body?.message);
    throw unavailable();
  }
  return { provider: "BREVO", messageId: body?.messageId || null };
}

// to / replyTo: { email, name }. fromName is shown as the sender; the address is always the
// configured sender because providers only send from addresses they have verified.
async function send({ to, subject, html, text, fromName, replyTo }) {
  if (!configured())
    throw new AppError("Hệ thống chưa được cấu hình gửi email", 503, "EMAIL_NOT_CONFIGURED");
  const message = {
    from: { email: fromAddress(), name: fromName || env("EMAIL_FROM_NAME") || "DOMUS" },
    to,
    replyTo,
    subject,
    html,
    text,
  };
  return provider() === "brevo" ? sendBrevo(message) : sendSmtp(message);
}

module.exports = { send, configured, provider };
