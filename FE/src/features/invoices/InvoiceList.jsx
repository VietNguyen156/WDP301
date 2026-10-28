import { RefreshCw, Plus } from "lucide-react";
import { Button } from "../../components/ui/Button";
import { useInvoiceList } from "../../hooks/useInvoiceList";
import {
  InvoiceMetricsGrid,
  InvoiceFilterPanel,
  InvoiceLedgerTable,
  InvoiceQuickDrawer,
} from "../../components/invoices";
import { InvoiceDetailModal } from "./InvoiceDetailModal";
import { InvoiceGenerateModal } from "./InvoiceGenerateModal";
import { InvoiceCancelModal } from "./InvoiceCancelModal";
import { CashPaymentModal } from "../payments/CashPaymentModal";
import { formatBillingPeriod } from "../../utils/formatters";

export function InvoiceList({ externalSearchTerm = "" }) {
  const {
    user,
    invoices,
    loading,
    statusFilter,
    setStatusFilter,
    branchFilter,
    billingPeriodFilter,
    setBillingPeriodFilter,
    page,
    setPage,
    pagination,
    selectedInvoice,
    setSelectedInvoice,
    isDetailOpen,
    setIsDetailOpen,
    isGenerateOpen,
    setIsGenerateOpen,
    isCashPaymentOpen,
    setIsCashPaymentOpen,
    cashInvoiceTarget,
    setCashInvoiceTarget,
    isCancelOpen,
    setIsCancelOpen,
    cancelInvoiceTarget,
    setCancelInvoiceTarget,
    perms,
    canGenerateInvoices,
    header,
    statusTabs,
    openPaymentPage,
    loadInvoices,
    filteredInvoices,
    stats,
    copyPublicLink,
  } = useInvoiceList(externalSearchTerm);

  return (
    <div
      className="invoice-workspace"
      style={{ display: "flex", flexDirection: "column", gap: "24px" }}
    >
      {/* SECTION 1: Header & Operational Actions Bar */}
      <div
        className="invoice-page-header"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "16px",
          backgroundColor: "var(--surface-lowest)",
          padding: "20px 24px",
          borderRadius: "var(--radius-lg)",
          border: "1px solid var(--border-color)",
          boxShadow: "var(--shadow-sm)",
        }}
      >
        <div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              marginBottom: "4px",
            }}
          >
            {!perms.isTenant && (
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "2px 8px",
                  borderRadius: "9999px",
                  fontSize: "0.75rem",
                  fontWeight: "700",
                  backgroundColor: "rgba(0, 92, 85, 0.08)",
                  color: "var(--primary)",
                  border: "1px solid rgba(0, 92, 85, 0.2)",
                }}
              >
                <span
                  style={{
                    width: "6px",
                    height: "6px",
                    borderRadius: "50%",
                    backgroundColor: "var(--primary)",
                  }}
                />
                SePay: Theo dõi giao dịch
              </span>
            )}
            {!perms.isTenant && (
              <span style={{ color: "var(--neutral-400)", fontSize: "12px" }}>
                •
              </span>
            )}
            <span
              style={{
                fontSize: "0.82rem",
                color: "var(--neutral-500)",
                fontWeight: "500",
              }}
            >
              Kỳ kế toán:{" "}
              {formatBillingPeriod(billingPeriodFilter) || "Tất cả kỳ"}
            </span>
          </div>

          <h1
            style={{
              fontFamily: "var(--font-heading)",
              fontSize: "1.65rem",
              fontWeight: "700",
              color: "var(--neutral-900)",
              margin: 0,
            }}
          >
            {header.title}
          </h1>
          <p
            style={{
              fontSize: "0.85rem",
              color: "var(--neutral-600)",
              marginTop: "4px",
            }}
          >
            {header.subtitle}
          </p>
        </div>

        {/* Action Toolbar */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            flexWrap: "wrap",
          }}
        >
          <Button
            variant="outline"
            size="md"
            onClick={loadInvoices}
            loading={loading}
          >
            <RefreshCw
              size={16}
              className={loading ? "animate-spin" : ""}
              style={{ marginRight: "6px" }}
            />
            <span>Tải lại dữ liệu</span>
          </Button>

          {canGenerateInvoices && (
            <Button
              variant="primary"
              size="md"
              onClick={() => setIsGenerateOpen(true)}
              style={{ backgroundColor: "var(--primary-container)" }}
            >
              <Plus size={16} style={{ marginRight: "6px" }} />
              <span>Tạo hóa đơn kỳ mới</span>
            </Button>
          )}
        </div>
      </div>

      {/* SECTION 2: 4 Operational Metrics Cards with Progress Bars */}
      <InvoiceMetricsGrid stats={stats} perms={perms} />

      {/* SECTION 3: Content Split Layout - Bảng danh sách & Panel Drawer VietQR */}
      <div
        className="invoice-content-layout"
        style={{
          display: "grid",
          gridTemplateColumns: selectedInvoice ? "1fr 380px" : "1fr",
          gap: "20px",
          alignItems: "start",
        }}
      >
        {/* Left Column: Filter Strip & Core Invoice Table */}
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <InvoiceFilterPanel
            statusTabs={statusTabs}
            statusFilter={statusFilter}
            setStatusFilter={setStatusFilter}
            billingPeriodFilter={billingPeriodFilter}
            setBillingPeriodFilter={setBillingPeriodFilter}
            filteredCount={filteredInvoices.length}
            totalCount={pagination.total || invoices.length}
          />

          <InvoiceLedgerTable
            loading={loading}
            filteredInvoices={filteredInvoices}
            selectedInvoice={selectedInvoice}
            setSelectedInvoice={setSelectedInvoice}
            setIsDetailOpen={setIsDetailOpen}
            setIsGenerateOpen={setIsGenerateOpen}
            canGenerateInvoices={canGenerateInvoices}
            perms={perms}
            openPaymentPage={openPaymentPage}
            onOpenCashPayment={(inv) => {
              setCashInvoiceTarget(inv);
              setIsCashPaymentOpen(true);
            }}
            onOpenCancelInvoice={(inv) => {
              setCancelInvoiceTarget(inv);
              setIsCancelOpen(true);
            }}
            copyPublicLink={copyPublicLink}
            pagination={pagination}
            page={page}
            setPage={setPage}
          />
        </div>

        {/* Right Column: Stitch VietQR Quick Drawer Flyout */}
        <InvoiceQuickDrawer
          selectedInvoice={selectedInvoice}
          setIsDetailOpen={setIsDetailOpen}
          perms={perms}
          openPaymentPage={openPaymentPage}
          onOpenCashPayment={(inv) => {
            setCashInvoiceTarget(inv);
            setIsCashPaymentOpen(true);
          }}
          copyPublicLink={copyPublicLink}
        />
      </div>

      {/* Detail Modal */}
      {isDetailOpen && selectedInvoice && (
        <InvoiceDetailModal
          isOpen={isDetailOpen}
          invoice={selectedInvoice}
          onClose={() => setIsDetailOpen(false)}
          onOpenCashPayment={(inv) => {
            setCashInvoiceTarget(inv);
            setIsCashPaymentOpen(true);
          }}
          onOpenCancelInvoice={(inv) => {
            setCancelInvoiceTarget(inv);
            setIsCancelOpen(true);
          }}
          onInvoiceUpdated={loadInvoices}
          role={user?.role}
        />
      )}

      {/* Batch Generate Modal */}
      {canGenerateInvoices && isGenerateOpen && (
        <InvoiceGenerateModal
          isOpen={isGenerateOpen}
          defaultBranchId={branchFilter}
          onClose={() => setIsGenerateOpen(false)}
          onGenerated={loadInvoices}
        />
      )}

      {/* Cash Payment Modal */}
      {perms.canCollectCash && isCashPaymentOpen && cashInvoiceTarget && (
        <CashPaymentModal
          isOpen={isCashPaymentOpen}
          invoice={cashInvoiceTarget}
          onClose={() => {
            setIsCashPaymentOpen(false);
            setCashInvoiceTarget(null);
          }}
          onPaymentSuccess={loadInvoices}
        />
      )}

      {/* Cancel Modal */}
      {perms.canCancel && isCancelOpen && cancelInvoiceTarget && (
        <InvoiceCancelModal
          isOpen={isCancelOpen}
          invoice={cancelInvoiceTarget}
          onClose={() => {
            setIsCancelOpen(false);
            setCancelInvoiceTarget(null);
          }}
          onInvoiceCancelled={loadInvoices}
        />
      )}
    </div>
  );
}
