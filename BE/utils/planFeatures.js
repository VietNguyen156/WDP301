// Every SaaS plan includes every feature; plans differ only in quotas
// (maxBranches, maxRooms, maxManagers) and price.
// Features the backend checks for (still need an active subscription).
const PLAN_FEATURES = {
  SEPAY_WEBHOOK: "Đối soát ngân hàng SePay tự động",
  INCIDENTS: "Quản lý sự cố & bảo trì",
};
const FEATURE_KEYS = Object.keys(PLAN_FEATURES);

// What every plan includes, shown to admins and landlords.
const INCLUDED_FEATURES = [
  "Quản lý cơ sở, phòng và khách thuê",
  "Hợp đồng điện tử xác nhận 2 chiều",
  "Chốt số điện nước và tự lập hóa đơn",
  "Hóa đơn VietQR và link xem không cần ứng dụng",
  "Đối soát ngân hàng SePay / Bank Hub tự động (hóa đơn và tiền cọc)",
  "Thu tiền mặt và giao dịch chưa khớp",
  "Quản lý sự cố & bảo trì",
  "Quyết toán, cấn cọc và thanh lý hợp đồng",
  "Dashboard công nợ, doanh thu và tỷ lệ lấp đầy realtime",
  "Phân quyền nhân viên quản lý theo cơ sở",
];

module.exports = { PLAN_FEATURES, FEATURE_KEYS, INCLUDED_FEATURES };
