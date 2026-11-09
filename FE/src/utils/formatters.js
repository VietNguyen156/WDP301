/**
 * Unified Formatting Utilities for DOMUS ERP
 * Combines core currency/date/label helpers and finance module formatters
 */

export const labels = {
  ACTIVE: "Đang hoạt động",
  INACTIVE: "Ngừng hoạt động",
  EMPTY: "Phòng trống",
  RENTED: "Đang thuê",
  CLEANING: "Cần dọn dẹp",
  MAINTENANCE: "Đang bảo trì",
  EXPIRING_SOON: "Sắp hết hạn",
  EXPIRED: "Đã hết hạn",
  TERMINATED: "Đã thanh lý",
  DRAFT: "Bản nháp",
  PAID: "Đã nhận cọc",
  UNPAID: "Chưa nhận cọc",
  REFUNDED: "Đã hoàn cọc",
  PARTIALLY_REFUNDED: "Đã quyết toán cọc",
};

export function formatCurrency(amount) {
  const numeric =
    typeof amount === "number" ? amount : parseInt(amount, 10) || 0;
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(numeric);
}

export const money = (value) => formatCurrency(value || 0);

export const date = (value) =>
  value
    ? new Intl.DateTimeFormat("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" }).format(
        new Date(value),
      )
    : "—";

export const today = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

export function formatDate(value, includeTime = false) {
  if (!value) return "-";
  const d = new Date(value);
  if (isNaN(d.getTime())) return "-";

  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();

  if (includeTime) {
    const hours = String(d.getHours()).padStart(2, "0");
    const minutes = String(d.getMinutes()).padStart(2, "0");
    return `${hours}:${minutes} ${day}/${month}/${year}`;
  }

  return `${day}/${month}/${year}`;
}

export function formatBillingPeriod(period) {
  if (!period) return "-";
  const parts = period.split("-");
  if (parts.length === 2) {
    return `Tháng ${parseInt(parts[1], 10)}/${parts[0]}`;
  }
  return period;
}

export function getInvoiceStatusMeta(status, isOverdue = false) {
  if (isOverdue && ["ISSUED", "PARTIALLY_PAID", "UNPAID"].includes(status)) {
    return {
      label: "Quá hạn",
      className: "badge-error",
      variant: "error",
    };
  }

  switch (status) {
    case "PAID":
      return {
        label: "Đã thanh toán",
        className: "badge-success",
        variant: "success",
      };
    case "PARTIALLY_PAID":
      return {
        label: "Thanh toán 1 phần",
        className: "badge-warning",
        variant: "warning",
      };
    case "OVERPAID":
      return {
        label: "Thanh toán thừa",
        className: "badge-info",
        variant: "info",
      };
    case "ISSUED":
    case "UNPAID":
      return {
        label: "Chờ thanh toán",
        className: "badge-warning",
        variant: "warning",
      };
    case "DRAFT":
      return {
        label: "Bản nháp",
        className: "badge-neutral",
        variant: "neutral",
      };
    case "CANCELLED":
      return {
        label: "Đã hủy",
        className: "badge-neutral",
        variant: "neutral",
      };
    default:
      return {
        label: status || "Không rõ",
        className: "badge-neutral",
        variant: "neutral",
      };
  }
}

export function getPaymentMethodMeta(method) {
  switch (method) {
    case "CASH":
      return { label: "Tiền mặt", className: "badge-neutral", short: "TM" };
    case "VIETQR":
      return { label: "VietQR (Tự động)", className: "badge-info", short: "QR" };
    case "BANK_TRANSFER":
      return { label: "Chuyển khoản", className: "badge-info", short: "CK" };
    case "DEPOSIT":
      return { label: "Trừ tiền cọc", className: "badge-warning", short: "CỌC" };
    default:
      return {
        label: method || "Khác",
        className: "badge-neutral",
        short: "-",
      };
  }
}

// Payment.status: only SUCCESS has reached the invoice; the others must not look like money in.
export function getPaymentStatusMeta(status) {
  switch (status) {
    case "SUCCESS":
      return { label: "Thành công", variant: "success", counted: true };
    case "PENDING_CONFIRMATION":
      return { label: "Chờ chủ trọ duyệt", variant: "warning", counted: false };
    case "FAILED":
      return { label: "Đã từ chối", variant: "error", counted: false };
    case "REFUNDED":
      return { label: "Đã hoàn tiền", variant: "neutral", counted: false };
    default:
      return { label: status || "-", variant: "neutral", counted: false };
  }
}

const STAFF_ROLE = { LANDLORD: "Chủ trọ", PROPERTY_MANAGER: "Quản lý", SUPER_ADMIN: "Quản trị" };
const person = (u) =>
  u && typeof u === "object" && u.name
    ? `${u.name}${STAFF_ROLE[u.role] ? ` (${STAFF_ROLE[u.role]})` : ""}`
    : null;
const sameUser = (a, b) => a && b && String(a._id || a) === String(b._id || b);

// Who paid: the name written on the receipt, else the tenant of the invoice / contract.
export function paymentPayer(p) {
  const tenant = p.invoiceId?.tenantId || p.contractId?.tenantId;
  const tenantName = tenant && typeof tenant === "object" ? tenant.name : null;
  const room = p.invoiceId?.roomId?.roomNumber || p.contractId?.roomId?.roomNumber;
  const branch = p.invoiceId?.branchId?.name || p.contractId?.branchId?.name || p.branchId?.name;
  return {
    name: p.payerName || tenantName || "Người thuê",
    // Someone else paid on the tenant's behalf: still say whose bill it was.
    onBehalfOf: p.payerName && tenantName && p.payerName !== tenantName ? tenantName : null,
    phone: tenant?.phoneNumber || null,
    place: [room && `Phòng ${room}`, branch].filter(Boolean).join(" · ") || null,
  };
}

// Who handled the money, line by line: who collected the cash, who approved / rejected it,
// or which bank channel it came through.
export function paymentHandlers(p) {
  if (p.paymentMethod === "DEPOSIT")
    return [{ label: "Nguồn", value: "Trừ từ tiền cọc khi quyết toán" }, ...(person(p.confirmedBy) ? [{ label: "Người lập", value: person(p.confirmedBy) }] : [])];
  if (p.paymentMethod !== "CASH") {
    const lines = [{ label: "Kênh", value: `Chuyển khoản${p.gateway ? ` qua ${p.gateway}` : ""}` }];
    lines.push(
      person(p.confirmedBy)
        ? { label: "Gán hóa đơn", value: person(p.confirmedBy) }
        : { label: "Đối soát", value: "Tự động theo nội dung chuyển khoản" },
    );
    return lines;
  }
  const collector = p.reportedBy || p.confirmedBy;
  const lines = [{ label: "Người thu", value: person(collector) || "Không rõ" }];
  if (p.cashCollectionPoint) lines.push({ label: "Nơi thu", value: p.cashCollectionPoint });
  if (p.status === "PENDING_CONFIRMATION") lines.push({ label: "Duyệt", value: "Đang chờ chủ trọ duyệt" });
  else if (p.status === "FAILED")
    lines.push({
      label: "Từ chối",
      value: [person(p.reviewedBy), p.reviewedAt && formatDate(p.reviewedAt, true)].filter(Boolean).join(" · ") || "Đã từ chối",
    });
  else if (p.confirmedBy && !sameUser(p.confirmedBy, collector))
    lines.push({
      label: "Người duyệt",
      value: [person(p.confirmedBy), p.reviewedAt && formatDate(p.reviewedAt, true)].filter(Boolean).join(" · "),
    });
  else lines.push({ label: "Xác nhận", value: "Chủ trọ tự thu, không cần duyệt" });
  return lines;
}

// One-line version (receipts, compact places).
export function paymentHandledBy(p) {
  return paymentHandlers(p)
    .map((line) => `${line.label}: ${line.value}`)
    .join(" · ");
}

export function generateReceiptNumber() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `CASH-${yyyy}${mm}${dd}-${rand}`;
}
