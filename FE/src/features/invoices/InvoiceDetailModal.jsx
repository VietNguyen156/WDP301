import React, { useEffect, useState } from "react";
import {
  Link2,
  Trash2,
  Send,
  QrCode,
  Banknote,
  AlertTriangle,
  Tag,
  Copy,
} from "lucide-react";
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
import { publicInvoiceUrl, canSharePublicInvoice } from "../../utils/publicLink";
import { invoicePermissions, PAYABLE_STATUSES } from "../../utils/invoicePermissions";

export function InvoiceDetailModal({
  isOpen,
  onClose,
  invoice,
  onOpenCashPayment,
  onOpenCancelInvoice,
  onInvoiceUpdated,
  role,
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

  const perms = invoicePermissions(role);
  const isPayable = PAYABLE_STATUSES.includes(invoice.status);
  const statusMeta = getInvoiceStatusMeta(invoice.status, invoice.isOverdue);
  const invoiceId = invoice.id || invoice._id;
  const canCancel =
    perms.canCancel &&
    (!invoice.paidAmount || invoice.paidAmount === 0) &&
    invoice.status !== "CANCELLED";

  const publicLink = publicInvoiceUrl(invoice.publicAccessToken);

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
      const errorCode = err.response?.data?.errorCode;
      const isLandlord = role === "LANDLORD";
      const message =
        errorCode === "BANK_NOT_CONFIGURED"
          ? isLandlord
            ? "Chưa thể phát hành: Bạn cần thiết lập tài khoản ngân hàng nhận tiền tại mục Hồ sơ cá nhân trước khi phát hành hóa đơn."
            : "Chưa thể phát hành: Chủ trọ chưa cấu hình tài khoản ngân hàng nhận tiền VietQR cho cơ sở này."
          : err.response?.data?.message ||
            err.message ||
            "Phát hành hóa đơn thất bại";
      toast.error(message);
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
        <div style={{ display: "flex", gap: "10px", width: "100%", justifyContent: "space-between", flexWrap: "wrap" }}>
          <div style={{ display: "flex", gap: "8px" }}>
            {perms.canShareLink && canSharePublicInvoice(invoice.status) && (
              <Button variant="outline" size="sm" onClick={copyPublicLink} style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                <Link2 size={15} />
                <span>Sao chép link khách</span>
              </Button>
            )}
            {perms.canCancel && (!invoice.paidAmount || invoice.paidAmount === 0) && invoice.status !== "CANCELLED" && (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => {
                  onClose();
                  onOpenCancelInvoice?.(invoice);
                }}
                style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
              >
                <Trash2 size={15} />
                <span>Hủy hóa đơn</span>
              </Button>
            )}
          </div>
          <div style={{ display: "flex", gap: "10px" }}>
            {perms.canIssue && invoice.status === "DRAFT" && (
              <Button
                variant="secondary"
                size="md"
                loading={issuing}
                onClick={handleIssueInvoice}
                style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
              >
                <Send size={15} />
                <span>Phát hành hóa đơn</span>
              </Button>
            )}
            {perms.canPayOnline && isPayable && (
              <Button
                variant="primary"
                size="md"
                onClick={() => window.open(publicLink, "_blank", "noopener")}
                style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
              >
                <QrCode size={15} />
                <span>Thanh toán qua VietQR</span>
              </Button>
            )}
            {perms.canCollectCash && isPayable && (
              <Button
                variant="primary"
                size="md"
                onClick={() => {
                  onClose();
                  onOpenCashPayment?.(invoice);
                }}
                style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
              >
                <Banknote size={15} />
                <span>{perms.isManager ? "Báo cáo thu tiền mặt" : "Thu tiền mặt ngay"}</span>
              </Button>
            )}
            <Button variant="outline" size="md" onClick={onClose}>
              Đóng
            </Button>
          </div>
        </div>
      }
    >
      <div className="invoice-detail-content" style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
        {invoice.status === "CANCELLED" && (
          <div
            style={{
              padding: "12px 16px",
              backgroundColor: "var(--error-bg)",
              border: "1px solid var(--error-border)",
              borderRadius: "var(--radius-md)",
              color: "var(--error-text)",
              fontSize: "0.88rem",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <AlertTriangle size={16} style={{ flexShrink: 0 }} />
            <div>
              <strong>Hóa đơn này đã bị hủy:</strong> {invoice.cancellationReason || "Không có lý do cụ thể"}
            </div>
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
                      <span style={{ display: "inline-flex", alignItems: "center", gap: "5px" }}>
                        <AlertTriangle size={13} />
                        <span>Phát sinh: {fee.reason}</span>
                      </span>
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
                      <span style={{ display: "inline-flex", alignItems: "center", gap: "5px" }}>
                        <Tag size={13} />
                        <span>Khấu trừ: {invoice.discount.reason || "Ưu đãi"}</span>
                      </span>
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
                <Button size="sm" variant="outline" onClick={copyPaymentSyntax} style={{ display: "inline-flex", alignItems: "center", gap: "5px" }}>
                  <Copy size={13} />
                  <span>Chép cú pháp</span>
                </Button>
              </div>
            </div>

            <div style={{ fontSize: "0.82rem", color: "var(--neutral-600)" }}>
              Hệ thống tự động ghi nhận thanh toán và gửi thông báo biên nhận ngay sau khi ngân hàng xử lý.
            </div>

            {perms.canShareLink && (
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
              {canSharePublicInvoice(invoice.status) ? (
              <a
                href={publicLink}
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
              ) : (
                <span style={{ fontSize: "0.82rem", color: "var(--neutral-500)", fontStyle: "italic" }}>
                  {invoice.status === "DRAFT"
                    ? "Phát hành hóa đơn để tạo link cho khách thuê."
                    : "Hóa đơn đã hủy, không chia sẻ cho khách thuê."}
                </span>
              )}
            </div>
            )}
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
