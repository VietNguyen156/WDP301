import { useState } from "react";
import { Link } from "react-router-dom";
import {
  Receipt,
  Send,
  ThumbsUp,
  ThumbsDown,
  ClipboardCheck,
  DollarSign,
  Wrench,
} from "lucide-react";
import { incidentApi, errorMessage } from "../../services/api";
import { useToast } from "../../context/ToastContext";
import { Button } from "../ui";
import { money } from "../../utils/format";
import { COST_PAYER_LABELS } from "../../hooks/useIncidentsPage";

const QUOTE_STATUS = {
  PENDING: { label: "Chờ người thuê duyệt", tone: "warn" },
  ACCEPTED: { label: "Người thuê đã đồng ý", tone: "ok" },
  DECLINED: { label: "Người thuê từ chối", tone: "bad" },
  CANCELLED: { label: "Đã hủy báo giá", tone: "muted" },
};
const when = (d) => (d ? new Date(d).toLocaleString("vi-VN") : "");

export default function IncidentChargePanel({
  data,
  isStaff,
  isTenant,
  onEditCost,
  onChanged,
}) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [quoting, setQuoting] = useState(false);
  const [amount, setAmount] = useState("");
  const [quoteNote, setQuoteNote] = useState("");
  const [reply, setReply] = useState(null); // "quote" | "acceptance" while typing a refusal
  const [reason, setReason] = useState("");

  const quote = data.quote;
  const activeQuote = quote && quote.status !== "CANCELLED" ? quote : null;
  const tenantPays = data.costPayer === "TENANT";
  const canQuote =
    isStaff &&
    data.status === "PENDING" &&
    Boolean(data.contractId) &&
    quote?.status !== "ACCEPTED" &&
    // Payer is decided once: recorded as landlord-paid / free means no quote to the tenant.
    !(data.costUpdatedAt && !tenantPays);
  const awaitingQuoteReply =
    isTenant && quote?.status === "PENDING" && data.status === "PENDING";
  const awaitingAcceptance = tenantPays && data.status === "SOLVED";
  const hasRecordedCost =
    Boolean(data.costUpdatedAt) || Number(data.repairCost || 0) > 0;

  async function run(action, success) {
    if (busy) return;
    setBusy(true);
    try {
      await action();
      toast.success(success);
      setQuoting(false);
      setReply(null);
      setReason("");
      onChanged();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const submitQuote = (e) => {
    e.preventDefault();
    const value = Number(amount);
    if (!Number.isSafeInteger(value) || value < 1) {
      toast.error("Số tiền báo giá phải lớn hơn 0");
      return;
    }
    run(
      () =>
        incidentApi.sendQuote(data._id, {
          amount: value,
          note: quoteNote.trim() || undefined,
        }),
      "Đã gửi báo giá cho người thuê",
    );
  };

  const answer = (kind, accept) => {
    if (!accept && !reason.trim()) {
      toast.error(
        kind === "quote"
          ? "Vui lòng nhập lý do từ chối báo giá"
          : "Vui lòng nêu điểm chưa đạt",
      );
      return;
    }
    const body = { accept, note: reason.trim() || undefined };
    run(
      () =>
        kind === "quote"
          ? incidentApi.respondQuote(data._id, body)
          : incidentApi.tenantAcceptance(data._id, body),
      kind === "quote"
        ? accept
          ? "Đã đồng ý báo giá. Bên quản lý sẽ bắt đầu sửa chữa."
          : "Đã từ chối báo giá"
        : accept
          ? "Đã xác nhận nghiệm thu. Hóa đơn sửa chữa đã được gửi cho bạn."
          : "Đã báo chưa đạt, bên quản lý sẽ sửa lại",
    );
  };

  const status = activeQuote && QUOTE_STATUS[activeQuote.status];
  const showTenantQuoteFlow =
    quoting || tenantPays || Boolean(activeQuote) || Boolean(data.chargeInvoiceCode);

  if (showTenantQuoteFlow) {
    return (
      <div className="inc-charge-panel">
        <div className="inc-charge-head">
          <Receipt size={15} />
          <strong>Chi phí &amp; Báo giá người thuê chi trả</strong>
          {status && (
            <span className={`inc-charge-chip ${status.tone}`}>
              {status.label}
            </span>
          )}
        </div>

        {activeQuote && (
          <dl className="inc-charge-grid">
            <dt>Mức phí báo giá</dt>
            <dd className="amount">{money(activeQuote.amount)}</dd>
            <dt>Trách nhiệm</dt>
            <dd style={{ fontWeight: 600 }}>Khách thuê chi trả</dd>
            {activeQuote.note && (
              <>
                <dt>Hạng mục</dt>
                <dd>{activeQuote.note}</dd>
              </>
            )}
            <dt>Người báo giá</dt>
            <dd>
              {activeQuote.quotedBy?.name || "Quản lý"} ·{" "}
              {when(activeQuote.quotedAt)}
            </dd>
            {activeQuote.respondedAt && (
              <>
                <dt>Phản hồi cư dân</dt>
                <dd>
                  {when(activeQuote.respondedAt)}
                  {activeQuote.responseNote
                    ? ` · “${activeQuote.responseNote}”`
                    : ""}
                </dd>
              </>
            )}
          </dl>
        )}

        {tenantPays &&
          (data.acceptance?.staffAt || data.acceptance?.tenantAt) && (
            <ul className="inc-charge-steps">
              <li className={data.acceptance?.staffAt ? "done" : ""}>
                Quản lý nghiệm thu
                {data.acceptance?.staffAt &&
                  `: ${data.acceptance.staffBy?.name || "Quản lý"} · ${when(data.acceptance.staffAt)}`}
              </li>
              <li className={data.acceptance?.tenantAt ? "done" : ""}>
                Người thuê nghiệm thu
                {data.acceptance?.tenantAt
                  ? `: ${when(data.acceptance.tenantAt)}`
                  : ": đang chờ xác nhận"}
              </li>
            </ul>
          )}

        {data.chargeInvoiceCode && (
          <p className="inc-charge-note">
            Hóa đơn sửa chữa:{" "}
            <Link
              to={`/invoices?search=${encodeURIComponent(data.chargeInvoiceCode)}`}
            >
              {data.chargeInvoiceCode}
            </Link>
          </p>
        )}

        {/* Staff: send or update quote */}
        {canQuote &&
          (quoting ? (
            <form className="inc-charge-form" onSubmit={submitQuote}>
              <label>
                Số tiền người thuê phải trả (VNĐ)
                <input
                  type="number"
                  min="1"
                  required
                  placeholder="VD: 250000"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  disabled={busy}
                />
              </label>
              <label>
                Hạng mục / lý do người thuê chịu phí
                <textarea
                  rows={2}
                  maxLength={2000}
                  value={quoteNote}
                  onChange={(e) => setQuoteNote(e.target.value)}
                  placeholder="VD: Thay vòi sen do va đập, vật tư + công thợ"
                  disabled={busy}
                />
              </label>
              <div className="inc-charge-actions">
                <Button
                  type="button"
                  variant="secondary"
                  compact
                  onClick={() => setQuoting(false)}
                  disabled={busy}
                >
                  Hủy
                </Button>
                <Button compact busy={busy}>
                  <Send size={13} />
                  <span>Gửi báo giá</span>
                </Button>
              </div>
            </form>
          ) : (
            <div className="inc-charge-actions">
              <span className="inc-charge-hint">
                {activeQuote?.status === "PENDING"
                  ? "Đang chờ người thuê duyệt báo giá trước khi bắt đầu sửa."
                  : "Người thuê đã từ chối báo giá. Có thể gửi lại báo giá mới hoặc chuyển sang chủ trọ chịu phí."}
              </span>
              {/* Only a refused quote may be taken over by the landlord (BE: INCIDENT_PAYER_LOCKED). */}
              {onEditCost && activeQuote?.status === "DECLINED" && (
                <Button
                  compact
                  variant="secondary"
                  onClick={() => onEditCost(data)}
                >
                  <DollarSign size={13} />
                  <span>Chủ trọ nhận chịu phí</span>
                </Button>
              )}
              <Button
                compact
                variant="secondary"
                onClick={() => {
                  setAmount(activeQuote?.amount ? String(activeQuote.amount) : "");
                  setQuoteNote(activeQuote?.note || "");
                  setQuoting(true);
                }}
              >
                <Send size={13} />
                <span>{activeQuote ? "Báo giá lại" : "Báo giá cho người thuê"}</span>
              </Button>
            </div>
          ))}

        {/* Tenant: approve quote or confirm acceptance */}
        {(awaitingQuoteReply || (isTenant && awaitingAcceptance)) && (
          <div className="inc-charge-reply">
            <p className="inc-charge-hint">
              {awaitingQuoteReply
                ? `Bạn cần đồng ý mức phí ${money(activeQuote.amount)} thì việc sửa chữa mới được bắt đầu.`
                : `Bên quản lý báo đã sửa xong. Xác nhận nghiệm thu đạt thì hệ thống xuất hóa đơn ${money(data.repairCost)} cho bạn.`}
            </p>
            {reply && (
              <textarea
                rows={2}
                maxLength={2000}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder={
                  reply === "quote"
                    ? "Lý do từ chối báo giá"
                    : "Điểm chưa đạt cần sửa lại"
                }
                disabled={busy}
              />
            )}
            <div className="inc-charge-actions">
              {reply ? (
                <>
                  <Button
                    type="button"
                    variant="secondary"
                    compact
                    onClick={() => setReply(null)}
                    disabled={busy}
                  >
                    Quay lại
                  </Button>
                  <Button
                    compact
                    variant="danger"
                    busy={busy}
                    onClick={() => answer(reply, false)}
                  >
                    <ThumbsDown size={13} />
                    <span>Gửi phản hồi</span>
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    compact
                    variant="secondary"
                    onClick={() =>
                      setReply(awaitingQuoteReply ? "quote" : "acceptance")
                    }
                    disabled={busy}
                  >
                    <ThumbsDown size={13} />
                    <span>
                      {awaitingQuoteReply ? "Từ chối báo giá" : "Chưa đạt"}
                    </span>
                  </Button>
                  <Button
                    compact
                    busy={busy}
                    onClick={() =>
                      answer(awaitingQuoteReply ? "quote" : "acceptance", true)
                    }
                  >
                    {awaitingQuoteReply ? (
                      <ThumbsUp size={13} />
                    ) : (
                      <ClipboardCheck size={13} />
                    )}
                    <span>
                      {awaitingQuoteReply ? "Đồng ý báo giá" : "Nghiệm thu đạt"}
                    </span>
                  </Button>
                </>
              )}
            </div>
          </div>
        )}

        {isStaff && awaitingAcceptance && (
          <p className="inc-charge-hint">
            Đã nghiệm thu phía quản lý, đang chờ người thuê xác nhận.
          </p>
        )}
      </div>
    );
  }

  // Standard Landlord-paid / Warranty flow: unified single panel
  return (
    <div className="inc-cost-box">
      <div className="inc-cost-head">
        <strong
          style={{
            fontSize: "13px",
            color: "#0f172a",
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
          }}
        >
          <Wrench size={14} style={{ color: "var(--inc-primary)" }} />
          <span>Chi phí &amp; Trách nhiệm thanh toán</span>
        </strong>

        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
          {canQuote && (
            <Button
              variant="secondary"
              compact
              onClick={() => {
                setAmount("");
                setQuoteNote("");
                setQuoting(true);
              }}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "5px",
              }}
            >
              <Send size={13} />
              <span>Báo giá người thuê</span>
            </Button>
          )}

          {isStaff &&
            (data.status === "IN_PROGRESS" ||
              data.status === "SOLVED" ||
              (data.status === "PENDING" && hasRecordedCost)) &&
            onEditCost && (
              <Button
                variant="secondary"
                compact
                onClick={() => onEditCost(data)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "5px",
                }}
              >
                <DollarSign size={13} />
                <span>
                  {hasRecordedCost ? "Cập nhật chi phí" : "Ghi nhận chi phí"}
                </span>
              </Button>
            )}
        </div>
      </div>

      {hasRecordedCost || ["SOLVED", "CLOSED"].includes(data.status) ? (
        <div>
          <span
            style={{
              fontSize: "16px",
              fontWeight: 700,
              color: "var(--inc-primary-container)",
            }}
          >
            {money(data.repairCost || 0)}
          </span>
          <span
            style={{
              fontSize: "13px",
              color: "#64748b",
              marginLeft: "8px",
            }}
          >
            • Chịu phí:{" "}
            {COST_PAYER_LABELS[data.costPayer] || data.costPayer || "Chủ trọ thanh toán"}
          </span>
          {data.notes && (
            <p
              style={{
                margin: "6px 0 0 0",
                fontSize: "12px",
                color: "#64748b",
              }}
            >
              Ghi chú: {data.notes}
            </p>
          )}
        </div>
      ) : data.status === "PENDING" ? (
        <p
          style={{
            margin: 0,
            fontSize: "12.5px",
            color: "#475569",
            lineHeight: 1.5,
          }}
        >
          Chưa phát sinh chi phí. Nếu thuộc trách nhiệm bảo trì của tòa nhà, bấm{" "}
          <strong>Tiếp nhận sự cố</strong> để xử lý và ghi nhận chi phí thực tế sau khi sửa.
          {canQuote
            ? " Nếu hư hỏng do lỗi người thuê, bấm Báo giá người thuê để cư dân duyệt trước khi sửa."
            : ""}
        </p>
      ) : (
        <span
          style={{
            fontSize: "12.5px",
            color: "#64748b",
            fontStyle: "italic",
          }}
        >
          Chưa ghi nhận chi phí sửa chữa thực tế.
        </span>
      )}
    </div>
  );
}
