// Debt reminders by email, sent on behalf of the landlord: the sender name is the landlord and
// branch, and replies go straight to the landlord's own email (Reply-To).
// Manual: landlord / manager presses "Gửi email nhắc nợ". Automatic: jobs/debtReminders.js.
const { Invoice, DebtReminder } = require("../models");
const User = require("../models/User");
const emailService = require("./emailService");
const { getInvoice } = require("./invoiceService");
const { AppError, ValidationError } = require("../utils/errors");
const { OWING_INVOICE_STATUSES } = require("../utils/statuses");
const { DAY_MS, vnDate } = require("../utils/vnTime");
const { publicAppUrl } = require("../utils/appUrls");

// A second manual email for the same invoice is refused within this gap.
const RESEND_GAP_MS = 10 * 60000;
// Automatic schedule, in days past the due date (negative = before it): 3 days before, on the
// due day, the day after, then every 3 days while it stays unpaid, for up to 60 days.
const shouldRemind = (days) =>
  days === -3 || days === 0 || (days >= 1 && days <= 60 && (days - 1) % 3 === 0);

const money = (value) => `${Math.round(value).toLocaleString("vi-VN")}đ`;
const dayVn = (value) => vnDate(value).split("-").reverse().join("/");
const escapeHtml = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
  );
// Whole Vietnam calendar days from the due day to today (positive = overdue).
const daysPastDue = (dueDate, now) =>
  Math.round((Date.parse(vnDate(now)) - Date.parse(vnDate(dueDate))) / DAY_MS);

const withDetails = (query) =>
  query
    .populate("roomId", "roomNumber")
    .populate("branchId", "name address")
    .populate("tenantId", "name email")
    .populate("landlordId", "name email phoneNumber");

// Brand colours of the web app (primary teal) and one colour per urgency level.
const COLORS = { primary: "#005c55", text: "#0f172a", muted: "#64748b", line: "#e2e8f0", page: "#f1f5f9" };
const URGENCY = {
  overdue: { fg: "#b91c1c", bg: "#fef2f2", border: "#fecaca" },
  today: { fg: "#b45309", bg: "#fffbeb", border: "#fde68a" },
  upcoming: { fg: "#1d4ed8", bg: "#eff6ff", border: "#bfdbfe" },
};

// Landlords sometimes keep their email as display name: sign with the branch instead.
const personName = (name) => (name && !name.includes("@") ? name.trim() : "");

function compose(invoice, now) {
  const tenant = invoice.tenantId || {};
  const landlord = invoice.landlordId || {};
  const branch = invoice.branchId?.name || "Nhà trọ";
  const address = invoice.branchId?.address?.fullAddress || "";
  const room = invoice.roomId?.roomNumber || "";
  const [year, month] = invoice.billingPeriod.split("-");
  const what =
    invoice.invoiceType === "INCIDENT"
      ? "Phí sửa chữa sự cố"
      : invoice.invoiceType === "SETTLEMENT"
        ? "Tiền quyết toán hợp đồng"
        : `Tiền phòng kỳ ${month}/${year}`;
  const days = daysPastDue(invoice.dueDate, now);
  const due = dayVn(invoice.dueDate);
  const level = days > 0 ? "overdue" : days === 0 ? "today" : "upcoming";
  const status =
    level === "overdue"
      ? `Đã quá hạn ${days} ngày`
      : level === "today"
        ? "Đến hạn thanh toán hôm nay"
        : `Còn ${-days} ngày đến hạn thanh toán`;
  const intro =
    level === "overdue"
      ? `Hóa đơn ${what.toLowerCase()} của phòng ${room} đã quá hạn thanh toán ${days} ngày. Anh/chị vui lòng thanh toán sớm để tránh ảnh hưởng đến việc sử dụng dịch vụ.`
      : level === "today"
        ? `Hôm nay là hạn thanh toán hóa đơn ${what.toLowerCase()} của phòng ${room}. Anh/chị vui lòng hoàn tất thanh toán trong ngày.`
        : `Ban quản lý xin nhắc anh/chị hóa đơn ${what.toLowerCase()} của phòng ${room} sẽ đến hạn vào ngày ${due}.`;
  const link = `${publicAppUrl()}/i/${invoice.publicAccessToken}`;
  const owner = personName(landlord.name);
  const signature = owner ? `${owner} - Chủ trọ ${branch}` : `Ban quản lý ${branch}`;
  const bank = invoice.bankSnapshot?.accountNumber ? invoice.bankSnapshot : null;
  const subject = `${level === "overdue" ? "[Quá hạn] " : ""}Thông báo thanh toán ${what.toLowerCase()} - Phòng ${room} | ${branch}`;

  const details = [
    ["Mã hóa đơn", invoice.invoiceCode],
    ["Phòng", `${room} - ${branch}`],
    ["Nội dung", what],
    ["Tổng hóa đơn", money(invoice.totalAmount || 0)],
    ...(invoice.paidAmount > 0 ? [["Đã thanh toán", money(invoice.paidAmount)]] : []),
    ["Hạn thanh toán", due],
  ];
  const transfer = bank
    ? [
        ["Ngân hàng", bank.bankName || bank.bankCode],
        ["Số tài khoản", bank.accountNumber],
        ["Chủ tài khoản", bank.accountName],
        ...(invoice.paymentSyntax ? [["Nội dung chuyển khoản", invoice.paymentSyntax]] : []),
      ].filter(([, value]) => value)
    : [];
  const contact = [landlord.phoneNumber, landlord.email].filter(Boolean);

  const text = [
    `Kính gửi ${tenant.name || "anh/chị"},`,
    "",
    intro,
    "",
    `SỐ TIỀN CẦN THANH TOÁN: ${money(invoice.remainingAmount)} (${status.toLowerCase()})`,
    ...details.map(([label, value]) => `- ${label}: ${value}`),
    "",
    `Xem hóa đơn và thanh toán bằng mã VietQR: ${link}`,
    ...(transfer.length
      ? ["", "Hoặc chuyển khoản:", ...transfer.map(([label, value]) => `- ${label}: ${value}`)]
      : []),
    "",
    "Nếu anh/chị đã thanh toán, vui lòng bỏ qua email này.",
    "",
    "Trân trọng,",
    signature,
    ...contact,
    ...(address ? [address] : []),
  ].join("\n");

  const u = URGENCY[level];
  const e = escapeHtml;
  const row = ([label, value], strong = false) =>
    `<tr><td style="padding:9px 0;border-bottom:1px solid ${COLORS.line};color:${COLORS.muted};font-size:14px">${e(label)}</td>` +
    `<td align="right" style="padding:9px 0;border-bottom:1px solid ${COLORS.line};color:${COLORS.text};font-size:14px;${strong ? "font-weight:700;" : ""}">${e(value)}</td></tr>`;

  const html = `<!doctype html>
<html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${e(subject)}</title></head>
<body style="margin:0;padding:0;background:${COLORS.page}">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${e(`${status} - Phòng ${room} còn ${money(invoice.remainingAmount)} cần thanh toán.`)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${COLORS.page}">
<tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid ${COLORS.line};font-family:'Segoe UI',Roboto,Arial,sans-serif">
  <tr><td style="background:${COLORS.primary};padding:22px 32px">
    <div style="color:#99f6e4;font-size:12px;letter-spacing:1px;text-transform:uppercase;font-weight:600">Thông báo thanh toán</div>
    <div style="color:#ffffff;font-size:20px;font-weight:700;margin-top:4px">${e(branch)}</div>
    ${address ? `<div style="color:#ccfbf1;font-size:13px;margin-top:2px">${e(address)}</div>` : ""}
  </td></tr>
  <tr><td style="padding:28px 32px 8px">
    <div style="display:inline-block;padding:5px 12px;border-radius:999px;background:${u.bg};border:1px solid ${u.border};color:${u.fg};font-size:13px;font-weight:600">${e(status)}</div>
    <p style="margin:18px 0 6px;color:${COLORS.text};font-size:15px">Kính gửi <strong>${e(tenant.name || "anh/chị")}</strong>,</p>
    <p style="margin:0;color:#334155;font-size:15px;line-height:1.6">${e(intro)}</p>
  </td></tr>
  <tr><td style="padding:20px 32px 4px">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${u.bg};border:1px solid ${u.border};border-radius:10px">
      <tr><td align="center" style="padding:18px 16px">
        <div style="color:${COLORS.muted};font-size:13px">Số tiền cần thanh toán</div>
        <div style="color:${u.fg};font-size:30px;font-weight:800;margin-top:4px">${e(money(invoice.remainingAmount))}</div>
        <div style="color:${COLORS.muted};font-size:13px;margin-top:4px">Hạn thanh toán: <strong style="color:${COLORS.text}">${e(due)}</strong></div>
      </td></tr>
    </table>
  </td></tr>
  <tr><td style="padding:16px 32px 0">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      ${details.map((item, i) => row(item, i === 0)).join("\n      ")}
    </table>
  </td></tr>
  <tr><td align="center" style="padding:26px 32px 8px">
    <table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="border-radius:8px;background:${COLORS.primary}">
      <a href="${e(link)}" style="display:inline-block;padding:13px 30px;color:#ffffff;font-size:15px;font-weight:700;text-decoration:none">Xem hóa đơn &amp; thanh toán VietQR</a>
    </td></tr></table>
    <div style="color:${COLORS.muted};font-size:12px;margin-top:10px">Quét mã VietQR trên trang hóa đơn, hệ thống tự động ghi nhận khi nhận được tiền.</div>
  </td></tr>
  ${
    transfer.length
      ? `<tr><td style="padding:18px 32px 0">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border:1px solid ${COLORS.line};border-radius:10px">
      <tr><td style="padding:14px 18px 4px;color:${COLORS.text};font-size:14px;font-weight:700">Hoặc chuyển khoản thủ công</td></tr>
      <tr><td style="padding:0 18px 10px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        ${transfer.map((item) => row(item, true)).join("\n        ")}
      </table></td></tr>
      ${invoice.paymentSyntax ? `<tr><td style="padding:0 18px 14px;color:${COLORS.muted};font-size:12px">Vui lòng ghi đúng nội dung chuyển khoản để hệ thống tự động gạch nợ.</td></tr>` : ""}
    </table>
  </td></tr>`
      : ""
  }
  <tr><td style="padding:24px 32px 28px;color:#334155;font-size:14px;line-height:1.6">
    <p style="margin:0 0 14px;color:${COLORS.muted}">Nếu anh/chị đã thanh toán, vui lòng bỏ qua email này.</p>
    <p style="margin:0">Trân trọng,<br><strong style="color:${COLORS.text}">${e(signature)}</strong></p>
    ${landlord.phoneNumber ? `<div>Điện thoại: <a href="tel:${e(landlord.phoneNumber)}" style="color:${COLORS.primary};text-decoration:none">${e(landlord.phoneNumber)}</a></div>` : ""}
    ${landlord.email ? `<div>Email: <a href="mailto:${e(landlord.email)}" style="color:${COLORS.primary};text-decoration:none">${e(landlord.email)}</a></div>` : ""}
  </td></tr>
  <tr><td style="background:#f8fafc;border-top:1px solid ${COLORS.line};padding:14px 32px;color:#94a3b8;font-size:12px;line-height:1.5">
    Email được gửi tự động thay mặt ${e(signature)} qua hệ thống quản lý nhà trọ DOMUS. Trả lời email này để liên hệ trực tiếp chủ trọ.
  </td></tr>
</table>
</td></tr>
</table>
</body></html>`;

  return {
    to: { email: tenant.email, ...(tenant.name && { name: tenant.name }) },
    subject,
    text,
    html,
    fromName: (owner ? `${branch} - ${owner}` : branch).slice(0, 70),
    ...(landlord.email && { replyTo: { email: landlord.email, ...(owner && { name: owner }) } }),
  };
}

const view = (log) => ({
  id: log._id,
  invoiceId: log.invoiceId,
  to: log.to,
  auto: log.auto,
  status: log.status,
  sentAt: log.createdAt,
});

// Records the attempt first (the unique index stops two job runs mailing the same invoice twice
// on one day), then sends. Returns null when the job already handled this invoice today.
async function deliver(invoice, { auto, sentBy, now }) {
  const to = invoice.tenantId?.email;
  if (!to)
    throw new AppError(
      "Khách thuê chưa có email. Vui lòng cập nhật email trong hồ sơ khách thuê trước khi gửi nhắc nợ",
      422,
      "TENANT_EMAIL_MISSING",
    );
  let log;
  try {
    log = await DebtReminder.create({
      landlordId: invoice.landlordId._id,
      invoiceId: invoice._id,
      tenantId: invoice.tenantId._id,
      to,
      auto,
      sentBy,
      sentDate: vnDate(now),
      remainingAmount: invoice.remainingAmount,
    });
  } catch (error) {
    if (error?.code === 11000) return null;
    throw error;
  }
  try {
    const result = await emailService.send(compose(invoice, now));
    log.status = "SENT";
    log.provider = result.provider;
    log.messageId = result.messageId || undefined;
  } catch (error) {
    log.status = "FAILED";
    log.error = error.message;
    await log.save();
    throw error;
  }
  await log.save();
  return log;
}

async function sendForInvoice(req, invoiceId) {
  const now = new Date();
  const invoice = await getInvoice(req, invoiceId);
  if (!OWING_INVOICE_STATUSES.includes(invoice.status) || !(invoice.remainingAmount > 0))
    throw new AppError("Hóa đơn này không còn khoản nợ cần nhắc", 409, "INVOICE_NOT_OWING");
  const recent = await DebtReminder.exists({
    invoiceId: invoice._id,
    status: "SENT",
    createdAt: { $gte: new Date(now.getTime() - RESEND_GAP_MS) },
  });
  if (recent)
    throw new AppError(
      "Vừa gửi email nhắc nợ cho hóa đơn này, vui lòng đợi vài phút rồi thử lại",
      429,
      "REMINDER_RECENTLY_SENT",
    );
  const full = await withDetails(Invoice.findById(invoice._id));
  return view(await deliver(full, { auto: false, sentBy: req.user._id, now }));
}

// Daily schedule over every landlord that has not turned automatic reminders off.
async function runAutoReminders(now = new Date()) {
  if (!emailService.configured()) return { sent: 0, failed: 0, skipped: "EMAIL_NOT_CONFIGURED" };
  const optedOut = await User.distinct("_id", { role: "LANDLORD", "debtReminder.autoEmail": false });
  const invoices = await withDetails(
    Invoice.find({
      isDeleted: false,
      status: { $in: OWING_INVOICE_STATUSES },
      remainingAmount: { $gt: 0 },
      landlordId: { $nin: optedOut },
      dueDate: { $gte: new Date(now.getTime() - 62 * DAY_MS), $lt: new Date(now.getTime() + 4 * DAY_MS) },
    }),
  );
  const today = vnDate(now);
  let sent = 0;
  let failed = 0;
  for (const invoice of invoices) {
    if (!shouldRemind(daysPastDue(invoice.dueDate, now)) || !invoice.tenantId?.email) continue;
    // Someone already emailed this tenant about it today (button or an earlier run).
    if (await DebtReminder.exists({ invoiceId: invoice._id, sentDate: today })) continue;
    try {
      if (await deliver(invoice, { auto: true, now })) sent += 1;
    } catch (error) {
      failed += 1;
      console.error(`Gửi email nhắc nợ ${invoice.invoiceCode} thất bại:`, error.message);
    }
  }
  return { sent, failed };
}

async function getSettings(req) {
  const landlord = await User.findById(req.user._id).select("debtReminder").lean();
  return {
    autoEmail: landlord?.debtReminder?.autoEmail !== false,
    emailConfigured: emailService.configured(),
    schedule: "3 ngày trước hạn, đúng ngày đến hạn, 1 ngày sau hạn, rồi cứ 3 ngày một lần (tối đa 60 ngày)",
  };
}

async function updateSettings(req) {
  if (typeof req.body?.autoEmail !== "boolean")
    throw new ValidationError("Vui lòng chọn bật hoặc tắt tự động nhắc nợ", "INVALID_AUTO_EMAIL");
  await User.updateOne({ _id: req.user._id }, { $set: { "debtReminder.autoEmail": req.body.autoEmail } });
  return getSettings(req);
}

module.exports = { sendForInvoice, runAutoReminders, getSettings, updateSettings, shouldRemind, compose };
