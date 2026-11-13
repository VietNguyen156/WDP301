import React, { useState, useEffect, useCallback } from "react";
import { RefreshCw, Link2, Loader2 } from "lucide-react";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Badge";
import { paymentService } from "../../services/paymentService";
import { useToast } from "../../context/ToastContext";
import { ResolveUnmatchedModal } from "./ResolveUnmatchedModal";
import { formatCurrency, formatDate } from "../../utils/formatters";
import { useLiveRefresh } from "../../hooks/useLiveRefresh";

export function UnmatchedPaymentList() {
  const { toast } = useToast();
  const [unmatchedList, setUnmatchedList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("PENDING_REVIEW");
  const [selectedUnmatched, setSelectedUnmatched] = useState(null);
  const [isResolveOpen, setIsResolveOpen] = useState(false);

  const loadUnmatched = useCallback(
    async (silent) => {
      try {
        if (silent !== true) setLoading(true);
        const res = await paymentService.listUnmatched({ status: statusFilter });
        const list = Array.isArray(res) ? res : res?.data || [];
        setUnmatchedList(list);
      } catch (err) {
        toast.error(err.message || "Không thể tải danh sách giao dịch chưa khớp");
        setUnmatchedList([]);
      } finally {
        setLoading(false);
      }
    },
    [statusFilter, toast],
  );
  useLiveRefresh(["unmatched"], () => loadUnmatched(true));

  useEffect(() => {
    let active = true;
    Promise.resolve().then(() => {
      if (active) loadUnmatched();
    });
    return () => {
      active = false;
    };
  }, [loadUnmatched]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      <div className="payments-filter-card">
        <div className="payments-filter-row">
          <div>
            <h3 style={{ margin: 0, fontSize: "1rem", color: "#0f172a" }}>
              Đối soát giao dịch chưa khớp
            </h3>
            <p style={{ fontSize: "0.84rem", color: "#64748b", margin: "4px 0 0 0" }}>
              Khoản chuyển khoản vào tài khoản nhận tiền nhưng sai nội dung,
              không tìm thấy hóa đơn hoặc lệch số tiền.
            </p>
          </div>
          <div className="payments-controls-group">
            <label className="payments-filter-field">
              <span className="payments-filter-field-label">Trạng thái:</span>
              <select
                className="payments-select-clean"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                aria-label="Lọc trạng thái đối soát"
              >
                <option value="PENDING_REVIEW">Chờ đối soát</option>
                <option value="RESOLVED">Đã đối soát</option>
                <option value="IGNORED">Bỏ qua</option>
              </select>
            </label>
            <Button
              variant="outline"
              size="sm"
              onClick={() => loadUnmatched()}
              loading={loading}
            >
              <RefreshCw size={14} />
              <span>Làm mới</span>
            </Button>
          </div>
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
                <td colSpan="7" className="payments-empty-cell">
                  <div className="payments-loading-inline">
                    <Loader2 size={16} className="animate-spin" />
                    <span>Đang tải danh sách giao dịch chưa khớp...</span>
                  </div>
                </td>
              </tr>
            ) : unmatchedList.length === 0 ? (
              <tr>
                <td colSpan="7" className="payments-empty-cell">
                  <div className="payments-empty-title">
                    Không có giao dịch nào cần xử lý
                  </div>
                  <div className="payments-empty-desc">
                    Toàn bộ giao dịch ngân hàng đã được hệ thống gạch nợ tự động chính xác.
                  </div>
                </td>
              </tr>
            ) : (
              unmatchedList.map((item) => (
                <tr key={item._id || item.id}>
                  <td className="payments-ref-code">{item.referenceCode}</td>
                  <td style={{ color: "var(--neutral-600)", whiteSpace: "nowrap" }}>
                    {formatDate(item.transactionDate, true)}
                  </td>
                  <td>
                    <Badge variant="info">{item.gateway || "Chuyển khoản"}</Badge>
                  </td>
                  <td>
                    <code
                      style={{
                        backgroundColor: "var(--neutral-100)",
                        padding: "3px 7px",
                        borderRadius: "5px",
                        fontSize: "0.8rem",
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
                    style={{
                      textAlign: "right",
                      fontWeight: "700",
                      color: "var(--primary)",
                    }}
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
                        <Link2 size={14} />
                        <span>Gán vào hóa đơn</span>
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
