import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Card } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { expenseApi } from "../../services/api";
import { useToast } from "../../context/ToastContext";
import { useAuth } from "../../context/AuthContext";
import { useLiveRefresh } from "../../hooks/useLiveRefresh";
import { formatCurrency, formatDate } from "../../utils/formatters";

const METHOD_LABELS = { CASH: "Tiền mặt", BANK_TRANSFER: "Chuyển khoản" };
const PAYER_LABELS = { TENANT: "Người thuê trả", LANDLORD: "Chủ trọ chịu", NONE: "Miễn phí" };

// Phiếu chi: money paid out (repair contractors...). Recorded from the incident detail.
export function ExpenseList() {
  const { toast } = useToast();
  const { user } = useAuth();
  const isLandlord = user?.role === "LANDLORD";
  const [rows, setRows] = useState([]);
  const [totals, setTotals] = useState({ all: 0 });
  const [status, setStatus] = useState("RECORDED");
  const [loading, setLoading] = useState(true);

  const load = useCallback(
    async (silent) => {
      try {
        if (silent !== true) setLoading(true);
        const res = await expenseApi.list({ status: status || undefined, limit: 100 });
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
    load();
  }, [load]);
  useLiveRefresh(["expenses"], () => load(true));

  async function voidExpense(e) {
    const reason = window.prompt(`Hủy phiếu chi ${formatCurrency(e.amount)} cho ${e.payee}? Lý do:`);
    if (reason === null) return;
    if (!reason.trim()) {
      toast.error("Vui lòng nhập lý do hủy phiếu chi");
      return;
    }
    try {
      await expenseApi.void(e._id, reason.trim());
      toast.success("Đã hủy phiếu chi");
      load(true);
    } catch (err) {
      toast.error(err.message);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px" }}>
        {[
          ["TỔNG ĐÃ CHI", totals.all],
          ["CHI TIỀN MẶT", totals.CASH || 0],
          ["CHI CHUYỂN KHOẢN", totals.BANK_TRANSFER || 0],
        ].map(([label, value]) => (
          <Card key={label}>
            <div style={{ fontSize: "0.82rem", color: "var(--neutral-500)", fontWeight: "600" }}>{label}</div>
            <div className="tnum" style={{ fontSize: "1.6rem", fontWeight: "700", color: "var(--danger, #b91c1c)", margin: "6px 0 2px" }}>
              −{formatCurrency(value)}
            </div>
            <div style={{ fontSize: "0.78rem", color: "var(--neutral-500)" }}>Không tính phiếu đã hủy</div>
          </Card>
        ))}
      </div>

      <Card style={{ padding: "14px 18px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
          <span style={{ fontSize: "0.85rem", color: "var(--neutral-600)" }}>Trạng thái:</span>
          <select value={status} onChange={(e) => setStatus(e.target.value)} style={{ width: "170px" }}>
            <option value="RECORDED">Đang hiệu lực</option>
            <option value="VOID">Đã hủy</option>
            <option value="">Tất cả</option>
          </select>
          <span style={{ fontSize: "0.8rem", color: "var(--neutral-500)" }}>
            Phiếu chi được ghi trong chi tiết sự cố (mục “Thu – chi sửa chữa”).
          </span>
        </div>
      </Card>

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
                <td colSpan="8" style={{ textAlign: "center", padding: "40px", color: "var(--neutral-500)" }}>
                  ⏳ Đang tải phiếu chi...
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan="8" style={{ textAlign: "center", padding: "48px 20px", color: "var(--neutral-500)" }}>
                  Chưa có phiếu chi nào.
                </td>
              </tr>
            ) : (
              rows.map((e) => (
                <tr key={e._id} style={e.status === "VOID" ? { opacity: 0.6 } : undefined}>
                  <td>{formatDate(e.paidAt)}</td>
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
                      {[e.roomId?.roomNumber && `Phòng ${e.roomId.roomNumber}`, e.branchId?.name].filter(Boolean).join(" · ")}
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
                  <td className="tnum" style={{ textAlign: "right", fontWeight: 700, color: "var(--danger, #b91c1c)" }}>
                    −{formatCurrency(e.amount)}
                  </td>
                  <td>
                    {e.status === "VOID" ? (
                      <>
                        <Badge variant="neutral">Đã hủy</Badge>
                        <div style={{ fontSize: "0.75rem", color: "var(--neutral-500)" }}>{e.voidReason}</div>
                      </>
                    ) : (
                      <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                        <Badge variant="success">Đã chi</Badge>
                        {isLandlord && (
                          <Button variant="outline" size="sm" onClick={() => voidExpense(e)}>
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
    </div>
  );
}
