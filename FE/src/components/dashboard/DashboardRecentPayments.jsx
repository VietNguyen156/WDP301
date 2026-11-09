import { Link } from "react-router-dom";
import { CreditCard, ArrowRight, CheckCircle2 } from "lucide-react";
import { formatCurrency, formatDate } from "../../utils/formatters";
import { DetailsPlaceholder } from "./DashboardWatchlistsRow";

export default function DashboardRecentPayments({
  detailsLoading,
  activePayments,
}) {
  return (
    <div className="stitch-dash-card" style={{ marginBottom: "24px" }}>
      <div className="stitch-dash-card-header">
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <div className="stitch-badge-icon teal">
            <CreditCard size={16} />
          </div>
          <div>
            <h2 className="stitch-dash-card-title">
              Dòng Tiền Thực Tế &amp; Giao Dịch Mới Nhất
            </h2>
            <p className="stitch-dash-card-sub">
              Các khoản tiền thuê đã thu qua VietQR SePay tự động và thu tiền
              mặt
            </p>
          </div>
        </div>
        <Link to="/payments" className="stitch-dash-card-link">
          Xem toàn bộ lịch sử thanh toán <ArrowRight size={14} />
        </Link>
      </div>

      {detailsLoading ? (
        <DetailsPlaceholder />
      ) : activePayments.length === 0 ? (
        <div
          className="stitch-dash-empty-box"
          style={{ padding: "32px 16px" }}
        >
          <CreditCard size={36} color="#94a3b8" />
          <p>Chưa có giao dịch thu tiền nào được ghi nhận.</p>
        </div>
      ) : (
        <div className="stitch-table-wrapper">
          <table className="stitch-dash-table">
            <thead>
              <tr>
                <th>Thời gian</th>
                <th>Loại giao dịch</th>
                <th>Phòng / Chi nhánh</th>
                <th>Phương thức</th>
                <th>Số tiền</th>
                <th style={{ textAlign: "right" }}>Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {activePayments.slice(0, 5).map((p) => {
                const isVietQR =
                  p.paymentMethod === "VIETQR" ||
                  p.paymentMethod === "BANK_TRANSFER";
                const isDeposit =
                  p.purpose === "CONTRACT_DEPOSIT" ||
                  (!p.invoiceId && !p.invoiceCode && !!(p.contractId || p.contractCode));
                const isSettlement =
                  !isDeposit && p.invoiceId?.invoiceType === "SETTLEMENT";
                const transactionTypeLabel = isDeposit
                  ? "Đóng cọc"
                  : isSettlement
                    ? "Tất toán hợp đồng"
                    : "Thanh toán hóa đơn";
                const rawRoom =
                  p.invoiceId?.roomId?.roomNumber ||
                  p.contractId?.roomId?.roomNumber ||
                  p.room?.roomNumber ||
                  p.roomId?.roomNumber ||
                  p.roomNumber;
                const roomDisplay = rawRoom
                  ? /^(P\.|Phòng)/i.test(String(rawRoom))
                    ? rawRoom
                    : `P.${rawRoom}`
                  : "Chưa rõ phòng";
                const branchDisplay =
                  p.branchId?.name ||
                  p.invoiceId?.branchId?.name ||
                  p.contractId?.branchId?.name ||
                  p.branchName ||
                  "Chưa gán chi nhánh";
                return (
                  <tr key={p._id}>
                    <td style={{ whiteSpace: "nowrap" }}>
                      {formatDate(
                        p.transactionDate || p.paidAt || p.createdAt,
                        true,
                      )}
                    </td>
                    <td>
                      <span
                        className="stitch-payment-method-chip"
                        style={{
                          backgroundColor: isDeposit ? "#fffbeb" : "#f0fdfa",
                          color: isDeposit ? "#b45309" : "#0f766e",
                          border: isDeposit
                            ? "1px solid #fde68a"
                            : "1px solid #99f6e4",
                          fontWeight: 600,
                        }}
                      >
                        {transactionTypeLabel}
                      </span>
                    </td>
                    <td>
                      <strong>{roomDisplay}</strong>
                      <span
                        style={{
                          color: "#64748b",
                          fontSize: "12px",
                          marginLeft: "4px",
                        }}
                      >
                        ({branchDisplay})
                      </span>
                    </td>
                    <td>
                      <span
                        className="stitch-payment-method-chip"
                        style={{
                          backgroundColor: isVietQR ? "#eff6ff" : "#f1f5f9",
                          color: isVietQR ? "#1d4ed8" : "#475569",
                          border: isVietQR
                            ? "1px solid #bfdbfe"
                            : "1px solid #cbd5e1",
                        }}
                      >
                        {isVietQR
                          ? "VietQR (SePay Tự động)"
                          : "Tiền mặt xác nhận"}
                      </span>
                    </td>
                    <td>
                      <strong style={{ color: "#047857", fontSize: "14px" }}>
                        +{formatCurrency(p.amount)}
                      </strong>
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <span
                        className="stitch-tag-pill primary"
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "4px",
                        }}
                      >
                        <CheckCircle2 size={13} /> Khớp 100%
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

