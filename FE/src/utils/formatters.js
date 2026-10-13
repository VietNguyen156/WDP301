/**
 * Utility Formatters for DOMUS ERP Finance Module
 */

/**
 * Format currency to Vietnamese Dong (VND) with thousands separator
 * Must be integer, no decimal places
 * @param {number|string} amount
 * @returns {string} e.g. "3.850.000 ₫"
 */
export function formatCurrency(amount) {
  const numeric = typeof amount === "number" ? amount : parseInt(amount, 10) || 0;
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(numeric);
}

/**
 * Format date to Vietnamese format
 * @param {string|Date} date
 * @param {boolean} includeTime
 * @returns {string} e.g. "05/10/2026" or "14:30 05/10/2026"
 */
export function formatDate(date, includeTime = false) {
  if (!date) return "-";
  const d = new Date(date);
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

/**
 * Format month-year billing period
 * @param {string} period e.g. "2026-10"
 * @returns {string} e.g. "Tháng 10/2026"
 */
export function formatBillingPeriod(period) {
  if (!period) return "-";
  const parts = period.split("-");
  if (parts.length === 2) {
    return `Tháng ${parseInt(parts[1], 10)}/${parts[0]}`;
  }
  return period;
}

/**
 * Map Invoice Status to display label & badge style
 * @param {string} status
 * @param {boolean} isOverdue
 */
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
      return { label: "Đã thanh toán", className: "badge-success", variant: "success" };
    case "PARTIALLY_PAID":
      return { label: "Thanh toán 1 phần", className: "badge-warning", variant: "warning" };
    case "OVERPAID":
      return { label: "Thanh toán thừa", className: "badge-info", variant: "info" };
    case "ISSUED":
    case "UNPAID":
      return { label: "Chờ thanh toán", className: "badge-warning", variant: "warning" };
    case "DRAFT":
      return { label: "Bản nháp", className: "badge-neutral", variant: "neutral" };
    case "CANCELLED":
      return { label: "Đã hủy", className: "badge-neutral", variant: "neutral" };
    default:
      return { label: status || "Không rõ", className: "badge-neutral", variant: "neutral" };
  }
}

/**
 * Map Payment Method to display label & icon
 * @param {string} method
 */
export function getPaymentMethodMeta(method) {
  switch (method) {
    case "CASH":
      return { label: "Tiền mặt", className: "badge-neutral", short: "TM" };
    case "VIETQR":
      return { label: "VietQR (Tự động)", className: "badge-info", short: "QR" };
    case "BANK_TRANSFER":
      return { label: "Chuyển khoản", className: "badge-info", short: "CK" };
    default:
      return { label: method || "Khác", className: "badge-neutral", short: "-" };
  }
}

/**
 * Generate unique Cash Receipt Number
 * Format: CASH-YYYYMMDD-XXXX
 */
export function generateReceiptNumber() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `CASH-${yyyy}${mm}${dd}-${rand}`;
}
