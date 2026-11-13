import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Loader2, RefreshCw } from "lucide-react";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Modal } from "../../components/ui";
import { expenseApi } from "../../services/api";
import { useToast } from "../../context/ToastContext";
import { useAuth } from "../../context/AuthContext";
import { useLiveRefresh } from "../../hooks/useLiveRefresh";
import { formatCurrency, formatDate } from "../../utils/formatters";

const METHOD_LABELS = { CASH: "Tiền mặt", BANK_TRANSFER: "Chuyển khoản" };
const PAYER_LABELS = {
  TENANT: "Người thuê trả",
  LANDLORD: "Chủ trọ chịu",
  NONE: "Miễn phí",
};

// Phiếu chi: money paid out (repair contractors...). Recorded from the incident detail.
export function ExpenseList() {
  const { toast } = useToast();
  const { user } = useAuth();
  const isLandlord = user?.role === "LANDLORD";
  const [rows, setRows] = useState([]);
  const [totals, setTotals] = useState({ all: 0 });
  const [status, setStatus] = useState("RECORDED");
  const [loading, setLoading] = useState(true);

  // Void confirmation modal state
  const [voidingExpense, setVoidingExpense] = useState(null);
  const [voidReason, setVoidReason] = useState("");
  const [voidBusy, setVoidBusy] = useState(false);

  const load = useCallback(
    async (silent) => {
      try {
        if (silent !== true) setLoading(true);
        const res = await expenseApi.list({
          status: status || undefined,
          limit: 100,
        });
        setRows(res?.data || []);
        setTotals(res?.totals || { all: 0 });
      } catch (err) {
        toast.error(err.message || "Không tải được danh sách phiếu chi");
      } finally {
        setLoading(false);
      }
    },
    [status, toast],
  );

  useEffect(() => {
    let active = true;
    Promise.resolve().then(() => {
      if (active) load();
    });
    return () => {
      active = false;
    };
  }, [load]);
  useLiveRefresh(["expenses"], () => load(true));

  async function confirmVoidExpense() {
    if (!voidingExpense || voidBusy) return;
    if (!voidReason.trim()) {
      toast.error("Vui lòng nhập lý do hủy phiếu chi");
      return;
    }
    setVoidBusy(true);
    try {
      await expenseApi.void(voidingExpense._id, voidReason.trim());
      toast.success("Đã hủy phiếu chi");
      setVoidingExpense(null);
      setVoidReason("");
      load(true);
    } catch (err) {
      toast.error(err.message || "Không thể hủy phiếu chi");
    } finally {
      setVoidBusy(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      <div className="payments-kpi-grid">
        {[
          ["Tổng đã chi", totals.all, "#b91c1c"],
          ["Chi tiền mặt", totals.CASH || 0, "#0f172a"],
          ["Chi chuyển khoản", totals.BANK_TRANSFER || 0, "#334155"],
        ].map(([label, value, color]) => (
          <div key={label} className="payments-kpi-card is-static">
            <div className="payments-kpi-label">{label}</div>
            <div className="payments-kpi-value" style={{ color }}>
              −{formatCurrency(value)}
            </div>
            <div className="payments-kpi-sub">Không tính phiếu đã hủy</div>
          </div>
        ))}
      </div>

      <div className="payments-filter-card">
        <div className="payments-filter-row">
          <div className="payments-controls-group">
            <label
              className={`payments-filter-field ${status ? "is-filtered" : ""}`}
            >
              <span className="payments-filter-field-label">Trạng thái:</span>
              <select
                className="payments-select-clean"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                aria-label="Lọc trạng thái phiếu chi"
              >
                <option value="RECORDED">Đang hiệu lực</option>
                <option value="VOID">Đã hủy</option>
                <option value="">Tất cả</option>
              </select>
            </label>
            <span style={{ fontSize: "0.82rem", color: "#64748b" }}>
              Phiếu chi được ghi trong chi tiết sự cố (mục “Thu – chi sửa chữa”).
            </span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => load()}
            loading={loading}
          >
            <RefreshCw size={14} />
            <span>Làm mới</span>
          </Button>
        </div>
      </div>

      <div className="table-wrapper">
        <table className="data-table">
          <thead>
            <tr>
              <th>Ngày chi</th>
              <th>Trả cho</th>
              <th>Sự cố / phòng</th>
              <th>Bên chịu phí</th>
              <th>Hình thức</th>
              <th>Người ghi</th>
              <th style={{ textAlign: "right" }}>Số tiền</th>
              <th>Trạng thái</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="8" className="payments-empty-cell">
                  <div className="payments-loading-inline">
                    <Loader2 size={16} className="animate-spin" />
                    <span>Đang tải phiếu chi...</span>
                  </div>
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan="8" className="payments-empty-cell">
                  <div className="payments-empty-title">Chưa có phiếu chi nào</div>
                  <div className="payments-empty-desc">
                    Các khoản chi sửa chữa được ghi từ trang Sự cố sẽ hiển thị tại đây.
                  </div>
                </td>
              </tr>
            ) : (
              rows.map((e) => (
                <tr
                  key={e._id}
                  style={e.status === "VOID" ? { opacity: 0.6 } : undefined}
                >
                  <td style={{ whiteSpace: "nowrap" }}>{formatDate(e.paidAt)}</td>
                  <td>
                    <div style={{ fontWeight: 600 }}>{e.payee}</div>
                    {(e.note || e.referenceCode) && (
                      <div style={{ fontSize: "0.78rem", color: "var(--neutral-500)" }}>
                        {[e.referenceCode, e.note].filter(Boolean).join(" · ")}
                      </div>
                    )}
                  </td>
                  <td>
                    <Link to="/incidents">{e.incidentId?.title || "—"}</Link>
                    <div style={{ fontSize: "0.78rem", color: "var(--neutral-500)" }}>
                      {[
                        e.roomId?.roomNumber && `Phòng ${e.roomId.roomNumber}`,
                        e.branchId?.name,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </div>
                  </td>
                  <td>
                    {PAYER_LABELS[e.incidentId?.costPayer] || "—"}
                    {e.incidentId?.chargeInvoiceCode && (
                      <div style={{ fontSize: "0.78rem", color: "var(--neutral-500)" }}>
                        Thu qua HĐ {e.incidentId.chargeInvoiceCode}
                      </div>
                    )}
                  </td>
                  <td>{METHOD_LABELS[e.paymentMethod]}</td>
                  <td>{e.createdBy?.name || "—"}</td>
                  <td
                    className="tnum"
                    style={{
                      textAlign: "right",
                      fontWeight: 700,
                      color: "var(--danger, #b91c1c)",
                      whiteSpace: "nowrap",
                    }}
                  >
                    −{formatCurrency(e.amount)}
                  </td>
                  <td>
                    {e.status === "VOID" ? (
                      <>
                        <Badge variant="neutral">Đã hủy</Badge>
                        <div style={{ fontSize: "0.75rem", color: "var(--neutral-500)" }}>
                          {e.voidReason}
                        </div>
                      </>
                    ) : (
                      <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                        <Badge variant="success">Đã chi</Badge>
                        {isLandlord && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setVoidingExpense(e);
                              setVoidReason("");
                            }}
                          >
                            Hủy
                          </Button>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Modal
        padded
        isOpen={Boolean(voidingExpense)}
        onClose={() => !voidBusy && setVoidingExpense(null)}
        title="Hủy phiếu chi"
        maxWidth="460px"
        subtitle={
          voidingExpense
            ? `${voidingExpense.payee} · ${formatCurrency(voidingExpense.amount)}`
            : ""
        }
        footer={
          <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end", width: "100%" }}>
            <Button
              variant="outline"
              disabled={voidBusy}
              onClick={() => setVoidingExpense(null)}
            >
              Đóng
            </Button>
            <Button
              variant="destructive"
              loading={voidBusy}
              disabled={!voidReason.trim()}
              onClick={confirmVoidExpense}
            >
              Xác nhận hủy phiếu chi
            </Button>
          </div>
        }
      >
        <label
          style={{
            display: "block",
            fontSize: "0.85rem",
            fontWeight: 600,
            marginBottom: "6px",
          }}
        >
          Lý do hủy phiếu chi
        </label>
        <textarea
          rows={3}
          maxLength={500}
          value={voidReason}
          onChange={(e) => setVoidReason(e.target.value)}
          placeholder="Nhập lý do hủy phiếu chi..."
          style={{ width: "100%" }}
        />
      </Modal>
    </div>
  );
}
