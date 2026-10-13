import React, { useState, useEffect, useCallback } from "react";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Badge";
import { paymentService } from "../../services/paymentService";
import { useToast } from "../../context/ToastContext";
import { ResolveUnmatchedModal } from "./ResolveUnmatchedModal";
import { formatCurrency, formatDate } from "../../utils/formatters";

export function UnmatchedPaymentList() {
  const { toast } = useToast();
  const [unmatchedList, setUnmatchedList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("PENDING_REVIEW");
  const [selectedUnmatched, setSelectedUnmatched] = useState(null);
  const [isResolveOpen, setIsResolveOpen] = useState(false);

  const loadUnmatched = useCallback(async () => {
    try {
      setLoading(true);
      const res = await paymentService.listUnmatched({ status: statusFilter });
      const list = Array.isArray(res) ? res : res?.data || [];
      setUnmatchedList(list);
    } catch (err) {
      toast.error(err.message || "Không thể tải danh sách giao dịch chưa khớp");
      setUnmatchedList([]);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, toast]);

  useEffect(() => {
    loadUnmatched();
  }, [loadUnmatched]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px" }}>
        <div>
          <h3>Giao dịch Chuyển khoản Chưa khớp (Unmatched Payments)</h3>
          <p style={{ fontSize: "0.85rem", marginTop: "2px" }}>
            Các giao dịch tiền vào từ SePay sai cú pháp, không tìm thấy hóa đơn hoặc chuyển sai số tiền cần kế toán đối soát thủ công.
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{ width: "190px" }}
          >
            <option value="PENDING_REVIEW">Chờ đối soát (PENDING)</option>
            <option value="RESOLVED">Đã đối soát (RESOLVED)</option>
            <option value="IGNORED">Bỏ qua (IGNORED)</option>
          </select>
          <Button variant="outline" size="sm" onClick={loadUnmatched} loading={loading}>
            🔄 Làm mới
          </Button>
        </div>
      </div>

      <div className="table-wrapper">
        <table className="data-table">
          <thead>
            <tr>
              <th>Mã giao dịch / Reference</th>
              <th>Thời gian</th>
              <th>Cổng / Ngân hàng</th>
              <th>Nội dung chuyển khoản thô</th>
              <th style={{ textAlign: "right" }}>Số tiền</th>
              <th>Trạng thái</th>
              <th style={{ textAlign: "right" }}>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="7" style={{ textAlign: "center", padding: "36px", color: "var(--neutral-500)" }}>
                  ⏳ Đang tải danh sách giao dịch chưa khớp...
                </td>
              </tr>
            ) : unmatchedList.length === 0 ? (
              <tr>
                <td colSpan="7" style={{ textAlign: "center", padding: "40px 20px" }}>
                  <div style={{ fontSize: "1.8rem", marginBottom: "6px" }}>✨</div>
                  <div style={{ fontWeight: "600", color: "var(--neutral-700)" }}>
                    Không có giao dịch nào cần xử lý
                  </div>
                  <div style={{ fontSize: "0.82rem", color: "var(--neutral-500)", marginTop: "2px" }}>
                    Toàn bộ giao dịch ngân hàng đã được hệ thống gạch nợ tự động chính xác!
                  </div>
                </td>
              </tr>
            ) : (
              unmatchedList.map((item) => (
                <tr key={item._id || item.id}>
                  <td style={{ fontWeight: "700", fontFamily: "monospace" }}>
                    {item.referenceCode}
                  </td>
                  <td style={{ color: "var(--neutral-600)" }}>
                    {formatDate(item.transactionDate, true)}
                  </td>
                  <td>
                    <Badge variant="info">{item.gateway || "Chuyển khoản"}</Badge>
                  </td>
                  <td>
                    <code
                      style={{
                        backgroundColor: "var(--neutral-100)",
                        padding: "2px 6px",
                        borderRadius: "4px",
                        fontSize: "0.82rem",
                        color: "var(--neutral-800)",
                        maxWidth: "280px",
                        display: "inline-block",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                      title={item.content}
                    >
                      {item.content || "(Trống)"}
                    </code>
                  </td>
                  <td
                    style={{ textAlign: "right", fontWeight: "700", color: "var(--primary)" }}
                    className="tnum"
                  >
                    +{formatCurrency(item.amount)}
                  </td>
                  <td>
                    <Badge
                      variant={
                        item.status === "RESOLVED"
                          ? "success"
                          : item.status === "PENDING_REVIEW"
                          ? "warning"
                          : "neutral"
                      }
                    >
                      {item.status === "RESOLVED"
                        ? "Đã đối soát"
                        : item.status === "PENDING_REVIEW"
                        ? "Chờ xử lý"
                        : "Bỏ qua"}
                    </Badge>
                  </td>
                  <td style={{ textAlign: "right" }}>
                    {item.status === "PENDING_REVIEW" && (
                      <Button
                        size="sm"
                        variant="primary"
                        onClick={() => {
                          setSelectedUnmatched(item);
                          setIsResolveOpen(true);
                        }}
                      >
                        🔗 Gán vào hóa đơn
                      </Button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {isResolveOpen && selectedUnmatched && (
        <ResolveUnmatchedModal
          isOpen={isResolveOpen}
          unmatchedPayment={selectedUnmatched}
          onClose={() => {
            setIsResolveOpen(false);
            setSelectedUnmatched(null);
          }}
          onResolved={loadUnmatched}
        />
      )}
    </div>
  );
}
