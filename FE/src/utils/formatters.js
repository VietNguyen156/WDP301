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
    default:
      return {
        label: method || "Khác",
        className: "badge-neutral",
        short: "-",
      };
  }
}

export function generateReceiptNumber() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `CASH-${yyyy}${mm}${dd}-${rand}`;
}
