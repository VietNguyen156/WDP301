export const money = (value) =>
  new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(value || 0);
export const date = (value) =>
  value
    ? new Intl.DateTimeFormat("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" }).format(
        new Date(value),
      )
    : "—";
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
export const today = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
