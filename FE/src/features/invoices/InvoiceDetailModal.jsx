import React, { useEffect, useState } from "react";
import { Modal } from "../../components/ui/Modal";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Badge";
import { invoiceService } from "../../services/invoiceService";
import { useToast } from "../../context/ToastContext";
import {
  formatCurrency,
  formatDate,
  formatBillingPeriod,
  getInvoiceStatusMeta,
  getPaymentMethodMeta,
} from "../../utils/formatters";

export function InvoiceDetailModal({
  isOpen,
  onClose,
  invoice,
  onOpenCashPayment,
  onOpenCancelInvoice,
  onInvoiceUpdated,
}) {
  const { toast } = useToast();
  const [payments, setPayments] = useState([]);
  const [loadingPayments, setLoadingPayments] = useState(false);
  const [issuing, setIssuing] = useState(false);

  useEffect(() => {
    if (invoice?.id || invoice?._id) {
      const invoiceId = invoice.id || invoice._id;
      setLoadingPayments(true);
      invoiceService
        .getInvoicePayments(invoiceId)
        .then((res) => {
          setPayments(Array.isArray(res) ? res : res?.data || []);
        })
        .catch(() => {
          setPayments([]);
        })
        .finally(() => {
          setLoadingPayments(false);
        });
    }
  }, [invoice]);

  if (!invoice) return null;

  const statusMeta = getInvoiceStatusMeta(invoice.status, invoice.isOverdue);
  const invoiceId = invoice.id || invoice._id;
  const canCancel =
    (!invoice.paidAmount || invoice.paidAmount === 0) &&
    invoice.status !== "CANCELLED";

  const publicLink = `${window.location.origin}/#public/${invoice.publicAccessToken}`;

  const copyPublicLink = () => {
    navigator.clipboard.writeText(publicLink);
    toast.success("Đã sao chép liên kết hóa đơn công khai của khách thuê!");
  };

  const copyPaymentSyntax = () => {
    if (invoice.paymentSyntax) {
      navigator.clipboard.writeText(invoice.paymentSyntax);
      toast.success(`Đã chép cú pháp: ${invoice.paymentSyntax}`);
    }
  };

  const handleIssueInvoice = async () => {
    try {
      setIssuing(true);
      await invoiceService.issueInvoice(invoiceId);
      toast.success("Đã phát hành hóa đơn thành công!");
      onInvoiceUpdated?.();
      onClose();
    } catch (err) {
      toast.error(err.message || "Phát hành hóa đơn thất bại");
    } finally {
      setIssuing(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Hóa đơn ${invoice.invoiceCode || "Chi tiết"}`}
      subtitle={`${formatBillingPeriod(invoice.billingPeriod)} • Hạn thanh toán: ${formatDate(
        invoice.dueDate
      )}`}
      maxWidth="840px"
      footer={
        <div style={{ display: "flex", gap: "10px", width: "100%", justifyContent: "space-between" }}>
          <div style={{ display: "flex", gap: "8px" }}>
            {invoice.status !== "CANCELLED" && (
              <Button variant="outline" size="sm" onClick={copyPublicLink}>
                🔗 Sao chép link khách
              </Button>
            )}
            {canCancel && (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => {
                  onClose();
                  onOpenCancelInvoice?.(invoice);
                }}
              >
                🗑️ Hủy hóa đơn
              </Button>
            )}
          </div>
          <div style={{ display: "flex", gap: "10px" }}>
            {invoice.status === "DRAFT" && (
              <Button
                variant="secondary"
                size="md"
                loading={issuing}
                onClick={handleIssueInvoice}
              >
                🚀 Phát hành hóa đơn
              </Button>
            )}
            {["ISSUED", "PARTIALLY_PAID", "UNPAID"].includes(invoice.status) && (
              <Button
                variant="primary"
                size="md"
                onClick={() => {
                  onClose();
                  onOpenCashPayment?.(invoice);
                }}
              >
                💵 Thu tiền mặt ngay
              </Button>
            )}
            <Button variant="outline" size="md" onClick={onClose}>
              Đóng
            </Button>
          </div>
        </div>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
        {invoice.status === "CANCELLED" && (
          <div
            style={{
              padding: "12px 16px",
              backgroundColor: "var(--error-bg)",
              border: "1px solid var(--error-border)",
              borderRadius: "var(--radius-md)",
              color: "var(--error-text)",
              fontSize: "0.88rem",
            }}
          >
            ⚠️ <strong>Hóa đơn này đã bị hủy:</strong> {invoice.cancellationReason || "Không có lý do cụ thể"}
          </div>
        )}

        {/* Top Summary Banner */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "14px 18px",
            backgroundColor: "var(--neutral-50)",
            borderRadius: "var(--radius-md)",
            border: "1px solid var(--border-color)",
          }}
        >
          <div>
            <div style={{ fontSize: "0.82rem", color: "var(--neutral-500)" }}>Trạng thái</div>
            <div style={{ marginTop: "4px" }}>
              <Badge variant={statusMeta.variant}>{statusMeta.label}</Badge>
            </div>
          </div>
          <div>
            <div style={{ fontSize: "0.82rem", color: "var(--neutral-500)" }}>Tổng số tiền</div>
            <div
              className="tnum"
              style={{
                fontSize: "1.25rem",
                fontWeight: "700",
                color: "var(--neutral-900)",
                fontFamily: "var(--font-heading)",
              }}
            >
              {formatCurrency(invoice.totalAmount)}
            </div>
          </div>
          <div>
            <div style={{ fontSize: "0.82rem", color: "var(--neutral-500)" }}>Đã thanh toán</div>
            <div
              className="tnum"
              style={{ fontSize: "1.1rem", fontWeight: "600", color: "var(--success)" }}
            >
              {formatCurrency(invoice.paidAmount)}
            </div>
          </div>
          <div>
            <div style={{ fontSize: "0.82rem", color: "var(--neutral-500)" }}>Còn lại cần thu</div>
            <div
              className="tnum"
              style={{
                fontSize: "1.1rem",
                fontWeight: "700",
                color: (invoice.remainingAmount || 0) > 0 ? "var(--error)" : "var(--neutral-700)",
              }}
            >
              {formatCurrency(invoice.remainingAmount)}
            </div>
          </div>
        </div>

        {/* Breakdown Items Table */}
        <div>
          <h4 style={{ marginBottom: "10px", color: "var(--neutral-800)" }}>
            Bảng kê chi tiết chi phí
          </h4>
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Khoản mục</th>
                  <th>Chỉ số / Chi tiết</th>
                  <th style={{ textAlign: "right" }}>Đơn giá</th>
                  <th style={{ textAlign: "right" }}>Thành tiền</th>
                </tr>
              </thead>
              <tbody>
                {/* 1. Tiền phòng */}
                <tr>
                  <td style={{ fontWeight: "600" }}>Tiền thuê phòng</td>
                  <td style={{ color: "var(--neutral-500)" }}>Tháng {invoice.month || "-"}</td>
                  <td style={{ textAlign: "right" }}>-</td>
                  <td style={{ textAlign: "right", fontWeight: "600" }} className="tnum">
                    {formatCurrency(invoice.roomAmount)}
                  </td>
                </tr>

                {/* 2. Tiền điện */}
                {invoice.electricDetail && (
                  <tr>
                    <td style={{ fontWeight: "600" }}>Tiền điện sinh hoạt</td>
                    <td style={{ color: "var(--neutral-600)" }}>
                      Cũ: {invoice.electricDetail.oldIndex} → Mới: {invoice.electricDetail.newIndex} (
                      <strong>{invoice.electricDetail.consumed} kWh</strong>)
                    </td>
                    <td style={{ textAlign: "right" }} className="tnum">
                      {formatCurrency(invoice.electricDetail.unitPrice)}/kWh
                    </td>
                    <td style={{ textAlign: "right", fontWeight: "600" }} className="tnum">
                      {formatCurrency(invoice.electricDetail.amount)}
                    </td>
                  </tr>
                )}

                {/* 3. Tiền nước */}
                {invoice.waterDetail && (
                  <tr>
                    <td style={{ fontWeight: "600" }}>Tiền nước sinh hoạt</td>
                    <td style={{ color: "var(--neutral-600)" }}>
                      {invoice.waterDetail.billingType === "PER_PERSON" ? (
                        <>Tính theo đầu người: {invoice.waterDetail.headCount || 1} người</>
                      ) : invoice.waterDetail.billingType === "FIXED" ? (
                        <>Khoán cố định theo phòng</>
                      ) : (
                        <>
                          Cũ: {invoice.waterDetail.oldIndex} → Mới: {invoice.waterDetail.newIndex} (
                          <strong>{invoice.waterDetail.consumed} m³</strong>)
                        </>
                      )}
                    </td>
                    <td style={{ textAlign: "right" }} className="tnum">
                      {formatCurrency(invoice.waterDetail.unitPrice)}
                    </td>
                    <td style={{ textAlign: "right", fontWeight: "600" }} className="tnum">
                      {formatCurrency(invoice.waterDetail.amount)}
                    </td>
                  </tr>
                )}

                {/* 4. Dịch vụ cố định */}
                {invoice.servicesDetail?.map((srv, idx) => (
                  <tr key={idx}>
                    <td style={{ fontWeight: "500" }}>{srv.serviceName}</td>
                    <td style={{ color: "var(--neutral-500)" }}>Số lượng: {srv.quantity || 1}</td>
                    <td style={{ textAlign: "right" }} className="tnum">
                      {formatCurrency(srv.unitPrice)}
                    </td>
                    <td style={{ textAlign: "right", fontWeight: "600" }} className="tnum">
                      {formatCurrency(srv.amount)}
                    </td>
                  </tr>
                ))}

                {/* 5. Phí phát sinh */}
                {invoice.additionalFees?.map((fee, idx) => (
                  <tr key={`fee-${idx}`}>
                    <td style={{ color: "var(--warning-text)", fontWeight: "500" }}>
                      ⚠️ Phát sinh: {fee.reason}
                    </td>
                    <td style={{ color: "var(--neutral-500)" }}>Khoản bổ sung</td>
                    <td style={{ textAlign: "right" }}>-</td>
                    <td style={{ textAlign: "right", fontWeight: "600", color: "var(--warning-text)" }} className="tnum">
                      +{formatCurrency(fee.amount)}
                    </td>
                  </tr>
                ))}

                {/* 6. Giảm giá */}
                {invoice.discount?.amount > 0 && (
                  <tr>
                    <td style={{ color: "var(--success-text)", fontWeight: "500" }}>
                      🎁 Khấu trừ: {invoice.discount.reason || "Ưu đãi"}
                    </td>
                    <td style={{ color: "var(--neutral-500)" }}>Giảm trừ trực tiếp</td>
                    <td style={{ textAlign: "right" }}>-</td>
                    <td style={{ textAlign: "right", fontWeight: "600", color: "var(--success-text)" }} className="tnum">
                      -{formatCurrency(invoice.discount.amount)}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* VietQR Dynamic Payment Card & Quick Link */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: invoice.vietQrUrl ? "200px 1fr" : "1fr",
            gap: "16px",
            backgroundColor: "var(--neutral-50)",
            padding: "16px",
            borderRadius: "var(--radius-md)",
            border: "1px solid var(--border-color)",
          }}
        >
          {invoice.vietQrUrl && (
            <div style={{ textAlign: "center" }}>
              <img
                src={invoice.vietQrUrl}
                alt="VietQR Code"
                style={{
                  width: "180px",
                  height: "180px",
                  borderRadius: "8px",
                  border: "1px solid var(--border-color)",
                  objectFit: "contain",
                  backgroundColor: "#ffffff",
                  padding: "4px",
                }}
              />
              <div style={{ fontSize: "0.75rem", color: "var(--neutral-500)", marginTop: "4px" }}>
                Quét mã VietQR để thanh toán
              </div>
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", gap: "8px" }}>
            <div>
              <span style={{ fontSize: "0.82rem", color: "var(--neutral-500)", fontWeight: "500" }}>
                Cú pháp chuyển khoản tự động gạch nợ:
              </span>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  marginTop: "4px",
                }}
              >
                <code
                  style={{
                    fontSize: "0.95rem",
                    fontWeight: "700",
                    color: "var(--primary)",
                    backgroundColor: "var(--white)",
                    padding: "6px 12px",
                    borderRadius: "6px",
                    border: "1px solid var(--border-color)",
                    letterSpacing: "0.05em",
                  }}
                >
                  {invoice.paymentSyntax || invoice.invoiceCode}
                </code>
                <Button size="sm" variant="outline" onClick={copyPaymentSyntax}>
                  📋 Chép cú pháp
                </Button>
              </div>
            </div>

            <div style={{ fontSize: "0.82rem", color: "var(--neutral-600)" }}>
              Hệ thống tự động ghi nhận thanh toán và gửi thông báo biên nhận ngay sau khi ngân hàng xử lý.
            </div>

            <div
              style={{
                marginTop: "6px",
                paddingTop: "8px",
                borderTop: "1px dashed var(--border-color)",
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <span style={{ fontSize: "0.82rem", color: "var(--neutral-500)" }}>
                Link khách thuê xem No-App:
              </span>
              <a
                href={`/#public/${invoice.publicAccessToken}`}
                target="_blank"
                rel="noreferrer"
                style={{
                  fontSize: "0.82rem",
                  color: "var(--secondary)",
                  textDecoration: "underline",
                  wordBreak: "break-all",
                }}
              >
                {publicLink}
              </a>
            </div>
          </div>
        </div>

        {/* Payment History Audit Section */}
        <div>
          <h4 style={{ marginBottom: "10px", color: "var(--neutral-800)" }}>
            Lịch sử giao dịch thanh toán của hóa đơn ({payments.length})
          </h4>
          {loadingPayments ? (
            <div style={{ padding: "16px", textAlign: "center", color: "var(--neutral-500)" }}>
              Đang tải lịch sử giao dịch...
            </div>
          ) : payments.length === 0 ? (
            <div
              style={{
                padding: "16px",
                textAlign: "center",
                color: "var(--neutral-500)",
                backgroundColor: "var(--neutral-50)",
                borderRadius: "var(--radius-md)",
                border: "1px dashed var(--border-color)",
                fontSize: "0.88rem",
              }}
            >
              Chưa có giao dịch thanh toán nào được ghi nhận cho hóa đơn này.
            </div>
          ) : (
            <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Mã giao dịch</th>
                    <th>Thời gian</th>
                    <th>Phương thức</th>
                    <th>Người thu / Gateway</th>
                    <th style={{ textAlign: "right" }}>Số tiền</th>
                    <th>Trạng thái</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((p) => {
                    const methodMeta = getPaymentMethodMeta(p.paymentMethod);
                    return (
                      <tr key={p._id || p.id}>
                        <td style={{ fontWeight: "600", fontFamily: "monospace" }}>
                          {p.referenceCode}
                        </td>
                        <td style={{ color: "var(--neutral-600)" }}>{formatDate(p.createdAt, true)}</td>
                        <td>
                          <Badge variant={methodMeta.className.replace("badge-", "")}>
                            {methodMeta.label}
                          </Badge>
                        </td>
                        <td style={{ color: "var(--neutral-600)" }}>
                          {p.confirmedBy ? `Thu ngân (${p.confirmedBy})` : p.gateway || "-"}
                        </td>
                        <td
                          style={{ textAlign: "right", fontWeight: "600", color: "var(--success)" }}
                          className="tnum"
                        >
                          +{formatCurrency(p.amount)}
                        </td>
                        <td>
                          <Badge variant="success">Thành công</Badge>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
