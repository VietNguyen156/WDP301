import {
  CheckCircle2,
  Eye,
  QrCode,
  Banknote,
  Trash2,
  Link2,
  ChevronLeft,
  ChevronRight,
  Inbox,
  Loader2,
  Plus,
} from "lucide-react";
import { Button } from "../ui/Button";
import { Badge } from "../ui/Badge";
import {
  formatCurrency,
  formatBillingPeriod,
  getInvoiceStatusMeta,
} from "../../utils/formatters";
import { canSharePublicInvoice } from "../../utils/publicLink";
import { PAYABLE_STATUSES } from "../../utils/invoicePermissions";

export default function InvoiceLedgerTable({
  loading,
  filteredInvoices,
  selectedInvoice,
  setSelectedInvoice,
  setIsDetailOpen,
  setIsGenerateOpen,
  canGenerateInvoices,
  perms,
  openPaymentPage,
  onOpenCashPayment,
  onOpenCancelInvoice,
  copyPublicLink,
  pagination,
  page,
  setPage,
}) {
  return (
    <>
      <div className="table-wrapper invoice-table-wrapper">
        <table className="data-table">
          <thead>
            <tr>
              <th>Mã HĐ</th>
              <th>{perms.isTenant ? "Phòng" : "Phòng & Khách thuê"}</th>
              <th style={{ textAlign: "right" }}>Bóc tách chi phí</th>
              <th style={{ textAlign: "right" }}>Tổng thanh toán</th>
              <th style={{ textAlign: "center" }}>Trạng thái</th>
              <th>
                {perms.isTenant ? "Nội dung chuyển khoản" : "Cú pháp SePay"}
              </th>
              <th style={{ textAlign: "right" }}>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td
                  colSpan="7"
                  style={{
                    textAlign: "center",
                    padding: "40px",
                    color: "var(--neutral-500)",
                  }}
                >
                  <div
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "8px",
                    }}
                  >
                    <Loader2 size={18} className="animate-spin" />
                    <span>Đang nạp dữ liệu hóa đơn...</span>
                  </div>
                </td>
              </tr>
            ) : filteredInvoices.length === 0 ? (
              <tr>
                <td
                  colSpan="7"
                  style={{ textAlign: "center", padding: "48px 20px" }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "center",
                      marginBottom: "10px",
                      color: "var(--neutral-400)",
                    }}
                  >
                    <Inbox size={40} strokeWidth={1.5} />
                  </div>
                  <div
                    style={{ fontWeight: "600", color: "var(--neutral-700)" }}
                  >
                    Không có hóa đơn nào khớp với bộ lọc
                  </div>
                  <div style={{ marginTop: "12px" }}>
                    {canGenerateInvoices && (
                      <Button
                        size="sm"
                        variant="primary"
                        onClick={() => setIsGenerateOpen(true)}
                      >
                        <Plus size={15} style={{ marginRight: "6px" }} />
                        <span>Tạo hóa đơn kỳ mới</span>
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            ) : (
              filteredInvoices.map((inv) => {
                const isSelected =
                  selectedInvoice?._id === inv._id ||
                  selectedInvoice?.id === inv.id;
                const statusMeta = getInvoiceStatusMeta(
                  inv.status,
                  inv.isOverdue,
                );
                const roomName =
                  inv.roomId?.roomNumber ||
                  inv.roomId?.name ||
                  (typeof inv.roomId === "string" ? inv.roomId : "Phòng");
                const tenantName =
                  inv.tenantId?.name ||
                  (typeof inv.tenantId === "string"
                    ? inv.tenantId
                    : "Khách thuê");

                return (
                  <tr
                    key={inv._id || inv.id}
                    className={isSelected ? "active-row" : ""}
                    style={{ cursor: "pointer" }}
                    onClick={() => setSelectedInvoice(inv)}
                  >
                    <td>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "6px",
                        }}
                      >
                        <span
                          style={{
                            fontWeight: "700",
                            fontFamily: "monospace",
                            color: "var(--primary)",
                          }}
                        >
                          {inv.invoiceCode}
                        </span>
                        {inv.status === "PAID" && (
                          <CheckCircle2
                            size={14}
                            style={{ color: "var(--success)" }}
                          />
                        )}
                      </div>
                      <span
                        style={{
                          fontSize: "0.72rem",
                          color: "var(--neutral-500)",
                        }}
                      >
                        {formatBillingPeriod(inv.billingPeriod)}
                      </span>
                    </td>
                    <td>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "6px",
                        }}
                      >
                        <span
                          style={{
                            fontSize: "0.78rem",
                            fontWeight: "700",
                            backgroundColor: "var(--surface-container)",
                            padding: "2px 6px",
                            borderRadius: "4px",
                            color: "var(--neutral-800)",
                          }}
                        >
                          {roomName}
                        </span>
                        {!perms.isTenant && (
                          <span
                            style={{
                              fontWeight: "600",
                              color: "var(--neutral-900)",
                            }}
                          >
                            {tenantName}
                          </span>
                        )}
                      </div>
                      {!perms.isTenant && (
                        <div
                          style={{
                            fontSize: "0.75rem",
                            color: "var(--neutral-500)",
                            marginTop: "2px",
                          }}
                        >
                          {inv.tenantId?.phoneNumber || "Khách thuê"}
                        </div>
                      )}
                    </td>
                    <td style={{ textAlign: "right", fontSize: "0.78rem" }}>
                      <div>Phòng: {formatCurrency(inv.roomAmount)}</div>
                      <div style={{ color: "var(--neutral-500)" }}>
                        Điện: {formatCurrency(inv.electricDetail?.amount || 0)}{" "}
                        | Nước: {formatCurrency(inv.waterDetail?.amount || 0)}
                      </div>
                    </td>
                    <td
                      style={{ textAlign: "right", fontWeight: "700" }}
                      className="tnum"
                    >
                      {formatCurrency(inv.totalAmount)}
                    </td>
                    <td style={{ textAlign: "center" }}>
                      <Badge variant={statusMeta.variant}>
                        {statusMeta.label}
                      </Badge>
                    </td>
                    <td>
                      <code
                        style={{
                          fontSize: "0.78rem",
                          fontWeight: "600",
                          backgroundColor: "var(--surface-container)",
                          padding: "3px 6px",
                          borderRadius: "4px",
                        }}
                      >
                        {inv.paymentSyntax || inv.invoiceCode}
                      </code>
                    </td>
                    <td
                      style={{ textAlign: "right" }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="invoice-row-actions">
                        <Button
                          size="sm"
                          variant="outline"
                          title="Xem chi tiết"
                          aria-label={`Xem chi tiết ${inv.invoiceCode}`}
                          onClick={() => {
                            setSelectedInvoice(inv);
                            setIsDetailOpen(true);
                          }}
                        >
                          <Eye size={15} />
                        </Button>
                        {perms.canPayOnline &&
                          PAYABLE_STATUSES.includes(inv.status) && (
                            <Button
                              size="sm"
                              variant="primary"
                              title="Thanh toán qua VietQR"
                              aria-label={`Thanh toán ${inv.invoiceCode}`}
                              onClick={(e) => openPaymentPage(inv, e)}
                            >
                              <QrCode size={15} />
                            </Button>
                          )}
                        {perms.canCollectCash &&
                          PAYABLE_STATUSES.includes(inv.status) && (
                            <Button
                              size="sm"
                              variant="primary"
                              title={perms.cashActionLabel}
                              onClick={() => onOpenCashPayment(inv)}
                              aria-label={`Thu tiền mặt ${inv.invoiceCode}`}
                            >
                              <Banknote size={15} />
                            </Button>
                          )}
                        {perms.canCancel &&
                          (!inv.paidAmount || inv.paidAmount === 0) &&
                          inv.status !== "CANCELLED" && (
                            <Button
                              size="sm"
                              variant="ghost"
                              title="Hủy"
                              style={{ color: "var(--error)" }}
                              onClick={() => onOpenCancelInvoice(inv)}
                              aria-label={`Hủy hóa đơn ${inv.invoiceCode}`}
                            >
                              <Trash2 size={15} />
                            </Button>
                          )}
                        {perms.canShareLink &&
                          canSharePublicInvoice(inv.status) && (
                            <Button
                              size="sm"
                              variant="ghost"
                              title="Sao chép link khách"
                              aria-label={`Sao chép link khách ${inv.invoiceCode}`}
                              onClick={(e) => copyPublicLink(inv, e)}
                            >
                              <Link2 size={15} />
                            </Button>
                          )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Controls */}
      {pagination.total > 0 && (
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "8px 4px",
            fontSize: "0.85rem",
            color: "var(--neutral-600)",
          }}
        >
          <div>
            Trang <strong>{pagination.page}</strong> /{" "}
            <strong>
              {Math.ceil(pagination.total / (pagination.limit || 20)) || 1}
            </strong>{" "}
            (Tổng cộng <strong>{pagination.total}</strong> hóa đơn)
          </div>
          <div style={{ display: "flex", gap: "8px" }}>
            <Button
              size="sm"
              variant="outline"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              <ChevronLeft size={15} style={{ marginRight: "4px" }} />
              <span>Trang trước</span>
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={page * (pagination.limit || 20) >= pagination.total}
              onClick={() => setPage((p) => p + 1)}
            >
              <span>Trang sau</span>
              <ChevronRight size={15} style={{ marginLeft: "4px" }} />
            </Button>
          </div>
        </div>
      )}
    </>
  );
}

