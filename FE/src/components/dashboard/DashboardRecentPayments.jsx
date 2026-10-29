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
                <th>Mã giao dịch</th>
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
                return (
                  <tr key={p._id}>
                    <td style={{ whiteSpace: "nowrap" }}>
                      {formatDate(p.paidAt || p.createdAt, true)}
                    </td>
                    <td>
                      <code className="stitch-code-chip">
                        {p.transactionCode || p._id?.slice(-8)}
                      </code>
                    </td>
                    <td>
                      <strong>
                        {p.invoiceId?.roomId?.roomNumber ||
                          p.roomNumber ||
                          "P.?"}
                      </strong>
                      <span
                        style={{
                          color: "#64748b",
                          fontSize: "12px",
                          marginLeft: "4px",
                        }}
                      >
                        ({p.branchId?.name || "Tòa nhà"})
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

