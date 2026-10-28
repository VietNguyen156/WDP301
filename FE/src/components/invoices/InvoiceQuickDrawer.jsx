import { ExternalLink, QrCode, Banknote, Copy } from "lucide-react";
import { Button } from "../ui/Button";
import { formatCurrency } from "../../utils/formatters";
import { canSharePublicInvoice } from "../../utils/publicLink";
import { PAYABLE_STATUSES } from "../../utils/invoicePermissions";

export default function InvoiceQuickDrawer({
  selectedInvoice,
  setIsDetailOpen,
  perms,
  openPaymentPage,
  onOpenCashPayment,
  copyPublicLink,
}) {
  if (!selectedInvoice) return null;

  return (
    <div
      className="invoice-quick-drawer"
      style={{
        backgroundColor: "var(--surface-lowest)",
        borderRadius: "var(--radius-lg)",
        border: "1px solid var(--border-color)",
        boxShadow: "var(--shadow-md)",
        padding: "20px",
        display: "flex",
        flexDirection: "column",
        gap: "16px",
        position: "sticky",
        top: "84px",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div>
          <span
            style={{
              fontSize: "0.72rem",
              color: "var(--neutral-500)",
              textTransform: "uppercase",
              fontWeight: "700",
            }}
          >
            CHI TIẾT NHANH (DRAWER)
          </span>
          <h3 style={{ margin: "2px 0 0 0", color: "var(--primary)" }}>
            {selectedInvoice.invoiceCode}
          </h3>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setIsDetailOpen(true)}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "4px",
          }}
        >
          <span>Mở rộng</span>
          <ExternalLink size={13} />
        </Button>
      </div>

      {/* Dynamic VietQR Preview Card */}
      {selectedInvoice.vietQrUrl && selectedInvoice.status !== "CANCELLED" ? (
        <div
          style={{
            textAlign: "center",
            backgroundColor: "var(--neutral-50)",
            padding: "16px",
            borderRadius: "var(--radius-md)",
            border: "1px solid var(--border-color)",
          }}
        >
          <img
            src={selectedInvoice.vietQrUrl}
            alt="VietQR QuickLink"
            style={{
              width: "180px",
              height: "180px",
              borderRadius: "8px",
              border: "1px solid var(--border-color)",
              backgroundColor: "#ffffff",
              padding: "4px",
              margin: "0 auto",
              display: "block",
            }}
          />
          <div
            style={{
              marginTop: "10px",
              fontSize: "0.82rem",
              fontWeight: "700",
              color: "var(--primary)",
            }}
          >
            NAPAS 247 QuickLink
          </div>
          <div
            style={{
              fontSize: "0.78rem",
              color: "var(--neutral-500)",
              marginTop: "2px",
            }}
          >
            Quét mã gạch nợ tự động trong 2s
          </div>
        </div>
      ) : null}

      {/* Bill Summary */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "8px",
          fontSize: "0.85rem",
          padding: "12px",
          backgroundColor: "var(--surface-container)",
          borderRadius: "8px",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span style={{ color: "var(--neutral-600)" }}>Tổng số tiền:</span>
          <span style={{ fontWeight: "700" }} className="tnum">
            {formatCurrency(selectedInvoice.totalAmount)}
          </span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span style={{ color: "var(--neutral-600)" }}>Đã thanh toán:</span>
          <span
            style={{ fontWeight: "600", color: "var(--success)" }}
            className="tnum"
          >
            {formatCurrency(selectedInvoice.paidAmount)}
          </span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span style={{ color: "var(--neutral-600)" }}>Còn nợ:</span>
          <span
            style={{
              fontWeight: "700",
              color:
                (selectedInvoice.remainingAmount || 0) > 0
                  ? "var(--error)"
                  : "var(--neutral-700)",
            }}
            className="tnum"
          >
            {formatCurrency(selectedInvoice.remainingAmount)}
          </span>
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            paddingTop: "4px",
            borderTop: "1px dashed var(--border-color)",
          }}
        >
          <span style={{ color: "var(--neutral-600)" }}>Cú pháp:</span>
          <code
            style={{
              fontSize: "0.82rem",
              fontWeight: "700",
              color: "var(--primary)",
            }}
          >
            {selectedInvoice.paymentSyntax || selectedInvoice.invoiceCode}
          </code>
        </div>
      </div>

      {/* Quick Actions inside Drawer */}
      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        {perms.canPayOnline &&
          PAYABLE_STATUSES.includes(selectedInvoice.status) && (
            <Button
              variant="primary"
              size="md"
              onClick={(e) => openPaymentPage(selectedInvoice, e)}
              style={{
                width: "100%",
                display: "inline-flex",
                justifyContent: "center",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <QrCode size={16} />
              <span>Mở trang thanh toán VietQR</span>
            </Button>
          )}

        {perms.canCollectCash &&
          PAYABLE_STATUSES.includes(selectedInvoice.status) && (
            <Button
              variant="primary"
              size="md"
              onClick={() => onOpenCashPayment(selectedInvoice)}
              style={{
                width: "100%",
                display: "inline-flex",
                justifyContent: "center",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <Banknote size={16} />
              <span>{perms.cashActionLabel}</span>
            </Button>
          )}

        {perms.canShareLink && canSharePublicInvoice(selectedInvoice.status) && (
          <Button
            variant="outline"
            size="md"
            onClick={() => copyPublicLink(selectedInvoice)}
            style={{
              width: "100%",
              display: "inline-flex",
              justifyContent: "center",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <Copy size={16} />
            <span>Sao chép link khách xem No-App</span>
          </Button>
        )}
      </div>
    </div>
  );
}

