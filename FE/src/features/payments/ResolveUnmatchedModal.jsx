import React, { useMemo, useState } from "react";
import { Modal } from "../../components/ui";
import { Button } from "../../components/ui/Button";
import { paymentService } from "../../services/paymentService";
import { invoiceService } from "../../services/invoiceService";
import { useToast } from "../../context/ToastContext";
import { useResource } from "../../hooks/useResource";
import {
  formatBillingPeriod,
  formatCurrency,
  formatDate,
} from "../../utils/formatters";

// Invoices that can still receive money (same rule as the server's assertPayable).
const PAYABLE_STATUSES = ["ISSUED", "PARTIALLY_PAID", "UNPAID"];

// "Lê Hoàng Cường" / "P.202" -> "lehoangcuong" / "p202", to compare with transfer contents.
const normalize = (value = "") =>
  String(value)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/gi, "d")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

async function loadPayableInvoices() {
  const pages = await Promise.all(
    PAYABLE_STATUSES.map((status) =>
      invoiceService.getInvoices({ status, limit: 100 }),
    ),
  );
  return pages.flatMap((res) => (Array.isArray(res) ? res : res?.data || []));
}

// Why an invoice probably belongs to this transfer (empty = no hint).
function matchReasons(inv, content, amount) {
  const reasons = [];
  if (inv.invoiceCode && content.includes(normalize(inv.invoiceCode)))
    reasons.push("đúng mã hóa đơn");
  const room = normalize(inv.roomId?.roomNumber);
  if (room && content.includes(room)) reasons.push("đúng số phòng");
  const tenant = normalize(inv.tenantId?.name);
  if (tenant && content.includes(tenant)) reasons.push("đúng tên khách");
  if (amount > 0 && amount === inv.remainingAmount) reasons.push("đúng số tiền");
  return reasons;
}

export function ResolveUnmatchedModal({
  isOpen,
  onClose,
  unmatchedPayment,
  onResolved,
}) {
  const { toast } = useToast();
  const [invoiceId, setInvoiceId] = useState("");
  const [search, setSearch] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const invoicesResource = useResource(
    () => (isOpen ? loadPayableInvoices() : Promise.resolve([])),
    [isOpen],
  );

  const candidates = useMemo(() => {
    const content = normalize(unmatchedPayment?.content);
    const amount = unmatchedPayment?.amount || 0;
    const term = normalize(search);
    return (invoicesResource.data || [])
      .map((inv) => ({ inv, reasons: matchReasons(inv, content, amount) }))
      .filter(
        ({ inv }) =>
          !term ||
          [
            inv.invoiceCode,
            inv.roomId?.roomNumber,
            inv.tenantId?.name,
            inv.tenantId?.phoneNumber,
            inv.branchId?.name,
          ].some((value) => normalize(value).includes(term)),
      )
      .sort(
        (a, b) =>
          b.reasons.length - a.reasons.length ||
          new Date(a.inv.dueDate) - new Date(b.inv.dueDate),
      );
  }, [invoicesResource.data, unmatchedPayment, search]);

  if (!unmatchedPayment) return null;

  const unmatchedId = unmatchedPayment.id || unmatchedPayment._id;
  const selected = (invoicesResource.data || []).find(
    (inv) => (inv._id || inv.id) === invoiceId,
  );

  const handleResolve = async (e) => {
    e.preventDefault();
    if (!invoiceId) {
      toast.warning("Vui lòng chọn hóa đơn cần gán giao dịch này vào.");
      return;
    }

    try {
      setSubmitting(true);
      const res = await paymentService.resolveUnmatched(unmatchedId, invoiceId);
      toast.success(
        res?.message ||
          `Đã đối soát và gán thành công giao dịch ${unmatchedPayment.referenceCode} vào hóa đơn!`,
      );
      onResolved?.();
      onClose();
    } catch (err) {
      toast.error(
        err.message ||
          "Gán giao dịch thất bại. Vui lòng kiểm tra lại hóa đơn đã chọn.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      padded
      isOpen={isOpen}
      onClose={onClose}
      title="Gán giao dịch vào hóa đơn"
      subtitle={`Mã tham chiếu ngân hàng: ${unmatchedPayment.referenceCode}`}
      maxWidth="550px"
      footer={
        <div
          style={{
            display: "flex",
            gap: "10px",
            width: "100%",
            justifyContent: "flex-end",
          }}
        >
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            Hủy bỏ
          </Button>
          <Button
            variant="primary"
            loading={submitting}
            onClick={handleResolve}
          >
            🔗 Xác nhận gán vào hóa đơn
          </Button>
        </div>
      }
    >
      <form
        onSubmit={handleResolve}
        style={{ display: "flex", flexDirection: "column", gap: "16px" }}
      >
        {/* Unmatched Transaction Info Card */}
        <div
          style={{
            padding: "14px 16px",
            backgroundColor: "var(--neutral-50)",
            border: "1px solid var(--border-color)",
            borderRadius: "var(--radius-md)",
            display: "flex",
            flexDirection: "column",
            gap: "8px",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ fontSize: "0.82rem", color: "var(--neutral-500)" }}>
              Số tiền chuyển:
            </span>
            <span
              style={{
                fontWeight: "700",
                color: "var(--primary)",
                fontSize: "1.05rem",
              }}
              className="tnum"
            >
              +{formatCurrency(unmatchedPayment.amount)}
            </span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ fontSize: "0.82rem", color: "var(--neutral-500)" }}>
              Ngân hàng / Cổng:
            </span>
            <span style={{ fontWeight: "600" }}>
              {unmatchedPayment.gateway || "Chuyển khoản"}
            </span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ fontSize: "0.82rem", color: "var(--neutral-500)" }}>
              Thời gian giao dịch:
            </span>
            <span>{formatDate(unmatchedPayment.transactionDate, true)}</span>
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "2px",
              marginTop: "4px",
            }}
          >
            <span style={{ fontSize: "0.82rem", color: "var(--neutral-500)" }}>
              Nội dung chuyển khoản thô:
            </span>
            <code
              style={{
                backgroundColor: "var(--white)",
                padding: "6px 8px",
                border: "1px solid var(--border-color)",
                borderRadius: "4px",
                fontSize: "0.85rem",
                color: "var(--neutral-900)",
                wordBreak: "break-all",
              }}
            >
              {unmatchedPayment.content || "(Không có nội dung)"}
            </code>
          </div>
        </div>

        <div className="resolve-invoice-picker">
          <label htmlFor="resolve-invoice-search">
            Hóa đơn cần gán <span className="required">*</span>
          </label>
          <input
            id="resolve-invoice-search"
            type="search"
            placeholder="Tìm theo mã hóa đơn, phòng, tên hoặc SĐT khách, cơ sở..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="resolve-invoice-list" role="listbox">
            {invoicesResource.loading ? (
              <div className="resolve-invoice-empty">
                Đang tải hóa đơn còn nợ...
              </div>
            ) : candidates.length === 0 ? (
              <div className="resolve-invoice-empty">
                {search
                  ? "Không có hóa đơn còn nợ khớp từ khóa."
                  : "Không có hóa đơn nào đang chờ thanh toán. Hãy phát hành hóa đơn trước rồi quay lại gán."}
              </div>
            ) : (
              candidates.map(({ inv, reasons }) => {
                const id = inv._id || inv.id;
                const active = id === invoiceId;
                return (
                  <button
                    type="button"
                    key={id}
                    role="option"
                    aria-selected={active}
                    className={`resolve-invoice-item${active ? " active" : ""}`}
                    onClick={() => setInvoiceId(id)}
                  >
                    <div className="resolve-invoice-row">
                      <strong>
                        {inv.roomId?.roomNumber
                          ? `Phòng ${inv.roomId.roomNumber}`
                          : "Phòng"}{" "}
                        · {inv.tenantId?.name || "Khách thuê"}
                      </strong>
                      <span className="resolve-invoice-amount">
                        {formatCurrency(inv.remainingAmount)}
                      </span>
                    </div>
                    <div className="resolve-invoice-meta">
                      {inv.invoiceCode} · Kỳ{" "}
                      {formatBillingPeriod(inv.billingPeriod)}
                      {inv.branchId?.name ? ` · ${inv.branchId.name}` : ""} ·
                      Hạn {formatDate(inv.dueDate)}
                    </div>
                    {reasons.length > 0 && (
                      <div className="resolve-invoice-hint">
                        Gợi ý: {reasons.join(", ")}
                      </div>
                    )}
                  </button>
                );
              })
            )}
          </div>
          {selected && (
            <div className="resolve-invoice-selected">
              Gán {formatCurrency(unmatchedPayment.amount)} vào hóa đơn{" "}
              <strong>{selected.invoiceCode}</strong> (còn nợ{" "}
              {formatCurrency(selected.remainingAmount)}).
              {unmatchedPayment.amount > selected.remainingAmount &&
                " Số tiền chuyển lớn hơn số còn nợ, phần dư sẽ được ghi nhận là trả thừa."}
            </div>
          )}
        </div>

        <div
          style={{
            padding: "10px 14px",
            backgroundColor: "var(--info-bg)",
            border: "1px solid var(--info-border)",
            borderRadius: "var(--radius-md)",
            fontSize: "0.82rem",
            color: "var(--info-text)",
          }}
        >
          💡 Sau khi gán, hệ thống sẽ tự động tạo bản ghi thanh toán chính thức,
          cập nhật số tiền đã nộp trên hóa đơn và đổi trạng thái giao dịch này
          thành <strong>Đã đối soát</strong>.
        </div>
      </form>
    </Modal>
  );
}
