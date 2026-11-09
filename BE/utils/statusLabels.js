// Vietnamese names for status codes that appear inside user-facing messages and notes.
const CONTRACT = {
  DRAFT: "nháp (chờ hai bên ký)",
  ACTIVE: "đang hiệu lực",
  EXPIRING_SOON: "sắp hết hạn",
  EXPIRED: "đã hết hạn",
  TERMINATED: "đã thanh lý",
};
const INVOICE = {
  DRAFT: "bản nháp, chưa phát hành",
  ISSUED: "chờ thanh toán",
  PARTIALLY_PAID: "đã thanh toán một phần",
  UNPAID: "chưa thanh toán",
  PAID: "đã thanh toán đủ",
  OVERPAID: "đã thanh toán thừa",
  CANCELLED: "đã hủy",
};
const INCIDENT = {
  PENDING: "Chờ xử lý",
  IN_PROGRESS: "Đang xử lý",
  SOLVED: "Đã xử lý",
  CLOSED: "Đã đóng",
  REJECTED: "Từ chối",
};
const ACCOUNT = {
  ACTIVE: "đang hoạt động",
  INACTIVE: "tạm khóa",
  SUSPENDED: "bị đình chỉ",
  PENDING_APPROVAL: "chờ duyệt",
  PENDING_ACTIVATION: "chờ kích hoạt",
  REJECTED: "bị từ chối",
};

const pick = (labels) => (status) => labels[status] || "không xác định";

module.exports = {
  contractStatusLabel: pick(CONTRACT),
  invoiceStatusLabel: pick(INVOICE),
  incidentStatusLabel: pick(INCIDENT),
  accountStatusLabel: pick(ACCOUNT),
};
