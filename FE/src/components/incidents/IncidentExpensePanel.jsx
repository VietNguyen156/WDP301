import { useState } from "react";
import { Link } from "react-router-dom";
import { Wallet, Plus, Ban } from "lucide-react";
import { expenseApi, errorMessage } from "../../services/api";
import { useToast } from "../../context/ToastContext";
import { Button } from "../ui";
import { money } from "../../utils/format";

const METHOD_LABELS = { CASH: "Tiền mặt", BANK_TRANSFER: "Chuyển khoản" };
const INVOICE_STATUS = {
  ISSUED: "chưa thanh toán",
  UNPAID: "chưa thanh toán",
  PARTIALLY_PAID: "đã thanh toán một phần",
  PAID: "đã thanh toán đủ",
  OVERPAID: "đã thanh toán đủ",
  CANCELLED: "đã hủy",
};
const today = () => new Date().toISOString().slice(0, 10);

// Staff-only money view of a repair: what the tenant was billed / paid (thu) and what was paid
// out to the contractor (chi, phiếu chi). Tenants never get this panel.
export default function IncidentExpensePanel({ data, isLandlord, onChanged }) {
  const toast = useToast();
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ payee: "", amount: "", paymentMethod: "CASH", referenceCode: "", paidAt: today(), note: "" });
  const finance = data.finance;
  const expenses = data.expenses || [];
  const canRecord = ["IN_PROGRESS", "SOLVED", "CLOSED"].includes(data.status);
  if (!finance || (!expenses.length && !canRecord)) return null;
  const tenantPays = finance.payer === "TENANT";
  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    const amount = Number(form.amount);
    if (!Number.isSafeInteger(amount) || amount < 1) {
      toast.error("Số tiền chi phải lớn hơn 0");
      return;
    }
    setBusy(true);
    try {
      await expenseApi.create({
        incidentId: data._id,
        payee: form.payee.trim(),
        amount,
        paymentMethod: form.paymentMethod,
        referenceCode: form.referenceCode.trim() || undefined,
        paidAt: form.paidAt,
        note: form.note.trim() || undefined,
      });
      toast.success("Đã ghi phiếu chi");
      setAdding(false);
      setForm({ payee: "", amount: "", paymentMethod: "CASH", referenceCode: "", paidAt: today(), note: "" });
      onChanged();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function voidExpense(expense) {
    const reason = window.prompt(`Hủy phiếu chi ${money(expense.amount)} cho ${expense.payee}? Lý do:`);
    if (reason === null) return;
    if (!reason.trim()) {
      toast.error("Vui lòng nhập lý do hủy phiếu chi");
      return;
    }
    try {
      await expenseApi.void(expense._id, reason.trim());
      toast.success("Đã hủy phiếu chi");
      onChanged();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  return (
    <div className="inc-expense-panel">
      <div className="inc-charge-head">
        <Wallet size={15} />
        <strong>Thu – chi sửa chữa</strong>
        <span className="inc-charge-chip muted">Nội bộ, người thuê không thấy</span>
      </div>

      <dl className="inc-charge-grid">
        {tenantPays && (
          <>
            <dt>Thu từ người thuê</dt>
            <dd>
              {finance.invoice ? (
                <>
                  <strong>{money(finance.collected)}</strong> / {money(finance.billed)} ·{" "}
                  <Link to={`/invoices?search=${encodeURIComponent(finance.invoice.invoiceCode)}`}>
                    {finance.invoice.invoiceCode}
                  </Link>{" "}
                  ({INVOICE_STATUS[finance.invoice.status] || "đang xử lý"})
                </>
              ) : (
                "Chưa xuất hóa đơn (chờ người thuê nghiệm thu)"
              )}
            </dd>
          </>
        )}
        <dt>Đã chi cho thợ / đơn vị sửa</dt>
        <dd>
          <strong>{money(finance.paidOut)}</strong>
        </dd>
        <dt>{tenantPays ? "Chênh lệch thu – chi" : "Chi phí chủ trọ chịu"}</dt>
        <dd className={tenantPays && finance.net < 0 ? "negative" : ""}>
          <strong>{money(tenantPays ? finance.net : finance.paidOut)}</strong>
        </dd>
      </dl>

      {expenses.length > 0 && (
        <ul className="inc-expense-list">
          {expenses.map((e) => (
            <li key={e._id} className={e.status === "VOID" ? "void" : ""}>
              <div>
                <strong>{money(e.amount)}</strong> → {e.payee} · {METHOD_LABELS[e.paymentMethod]}
                {e.referenceCode ? ` · ${e.referenceCode}` : ""}
                <div className="inc-expense-meta">
                  {new Date(e.paidAt).toLocaleDateString("vi-VN")} · {e.createdBy?.name || "Nhân viên"}
                  {e.note ? ` · ${e.note}` : ""}
                  {e.status === "VOID" && ` · Đã hủy: ${e.voidReason}`}
                </div>
              </div>
              {isLandlord && e.status !== "VOID" && (
                <Button compact variant="secondary" onClick={() => voidExpense(e)} title="Hủy phiếu chi">
                  <Ban size={13} />
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}

      {canRecord &&
        (adding ? (
          <form className="inc-charge-form" onSubmit={submit}>
            <div className="inc-expense-form-grid">
              <label>
                Trả cho (thợ / đơn vị)
                <input required maxLength={200} value={form.payee} onChange={set("payee")} disabled={busy} placeholder="VD: Thợ điện Anh Tuấn" />
              </label>
              <label>
                Số tiền chi (VNĐ)
                <input type="number" min="1" required value={form.amount} onChange={set("amount")} disabled={busy} />
              </label>
              <label>
                Hình thức chi
                <select value={form.paymentMethod} onChange={set("paymentMethod")} disabled={busy}>
                  <option value="CASH">Tiền mặt</option>
                  <option value="BANK_TRANSFER">Chuyển khoản</option>
                </select>
              </label>
              <label>
                Ngày chi
                <input type="date" required max={today()} value={form.paidAt} onChange={set("paidAt")} disabled={busy} />
              </label>
              <label>
                Mã giao dịch / số phiếu (nếu có)
                <input maxLength={100} value={form.referenceCode} onChange={set("referenceCode")} disabled={busy} />
              </label>
              <label>
                Ghi chú
                <input maxLength={500} value={form.note} onChange={set("note")} disabled={busy} placeholder="VD: Vật tư + công" />
              </label>
            </div>
            <div className="inc-charge-actions">
              <Button type="button" variant="secondary" compact onClick={() => setAdding(false)} disabled={busy}>
                Hủy
              </Button>
              <Button compact busy={busy}>
                Lưu phiếu chi
              </Button>
            </div>
          </form>
        ) : (
          <div className="inc-charge-actions">
            <span className="inc-charge-hint">
              {tenantPays
                ? "Người thuê trả tiền sửa cho chủ trọ; tiền chủ trọ trả cho thợ ghi ở phiếu chi."
                : "Ghi lại số tiền thực tế đã trả cho thợ / đơn vị sửa chữa."}
            </span>
            <Button compact variant="secondary" onClick={() => setAdding(true)}>
              <Plus size={13} />
              <span>Ghi phiếu chi</span>
            </Button>
          </div>
        ))}
    </div>
  );
}
