// Permissions a landlord can switch off per branch manager; mirrors BE utils/managerPermissions.js.
export const MANAGER_PERMISSIONS = [
  {
    key: "UPDATE_ROOMS",
    label: "Cập nhật thông tin phòng",
    hint: "Sửa giá thuê, trạng thái, tiện nghi của phòng",
  },
  {
    key: "UTILITY_READINGS",
    label: "Chốt số điện nước",
    hint: "Ghi và sửa chỉ số điện nước hằng tháng",
  },
  {
    key: "HANDLE_INCIDENTS",
    label: "Xử lý sự cố",
    hint: "Đổi trạng thái, báo giá, ghi chi phí sửa chữa",
  },
  {
    key: "RECORD_EXPENSES",
    label: "Lập phiếu chi",
    hint: "Ghi nhận khoản chi trả thợ, đơn vị sửa chữa",
  },
  {
    key: "VIEW_FINANCE",
    label: "Xem hóa đơn & thanh toán",
    hint: "Tắt thì ẩn mục Hóa đơn và Lịch sử thanh toán",
  },
  {
    key: "REPORT_CASH",
    label: "Báo cáo thu tiền mặt",
    hint: "Báo đã thu tiền mặt để chủ trọ xác nhận",
  },
  {
    key: "SEND_REMINDERS",
    label: "Gửi email nhắc nợ",
    hint: "Gửi email nhắc thanh toán cho khách thuê",
  },
];

// Landlords are never limited; a manager is allowed unless the landlord switched the key off.
export function can(user, key) {
  return user?.role !== "PROPERTY_MANAGER" || user.permissions?.[key] !== false;
}
