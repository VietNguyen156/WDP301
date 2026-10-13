import React, { useState, useEffect, useCallback } from "react";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Badge";
import { Card } from "../../components/ui/Card";
import { invoiceService } from "../../services/invoiceService";
import { useToast } from "../../context/ToastContext";
import {
  formatCurrency,
  formatDate,
  formatBillingPeriod,
  getInvoiceStatusMeta,
} from "../../utils/formatters";

export function PublicInvoicePage({ token: initialToken }) {
  const { toast } = useToast();
  const [tokenInput, setTokenInput] = useState(initialToken || "");
  const [invoice, setInvoice] = useState(null);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const fetchPublicInvoice = useCallback(
    async (tokenToFetch) => {
      const activeToken = tokenToFetch || tokenInput;
      if (!activeToken || !activeToken.trim()) return;

      try {
        setLoading(true);
        setHasSearched(true);
        const data = await invoiceService.getPublicInvoice(activeToken.trim());
        setInvoice(data);
      } catch (err) {
        setInvoice(null);
        toast.error(
          err.message || "Không tìm thấy hóa đơn hoặc liên kết hóa đơn không hợp lệ"
        );
      } finally {
        setLoading(false);
      }
    },
    [tokenInput, toast]
  );

  useEffect(() => {
    if (initialToken) {
      setTokenInput(initialToken);
      fetchPublicInvoice(initialToken);
    }
  }, [initialToken, fetchPublicInvoice]);

  const copyToClipboard = (text, message) => {
    navigator.clipboard.writeText(text);
    toast.success(message || `Đã sao chép: ${text}`);
  };

  const statusMeta = invoice ? getInvoiceStatusMeta(invoice.status, invoice.isOverdue) : null;
  const isPaid = invoice?.status === "PAID";
  const remaining =
    invoice && typeof invoice.remainingAmount === "number"
      ? invoice.remainingAmount
      : (invoice?.totalAmount || 0) - (invoice?.paidAmount || 0);

  return (
    <div
      style={{
        maxWidth: "680px",
        margin: "0 auto",
        padding: "16px 12px 60px 12px",
        display: "flex",
        flexDirection: "column",
        gap: "16px",
      }}
    >
      {/* Token Search Bar (if not preloaded or wanting to switch) */}
      {!initialToken && (
        <Card style={{ padding: "14px 18px" }}>
          <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
            <input
              type="text"
              placeholder="Nhập mã truy cập hóa đơn (Public Access Token)..."
              value={tokenInput}
              onChange={(e) => setTokenInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && fetchPublicInvoice(tokenInput)}
            />
            <Button
              variant="primary"
              size="md"
              loading={loading}
              onClick={() => fetchPublicInvoice(tokenInput)}
            >
              Tra cứu
            </Button>
          </div>
        </Card>
      )}

      {loading ? (
        <div style={{ padding: "60px 20px", textAlign: "center", color: "var(--neutral-500)" }}>
          <div style={{ fontSize: "2rem", marginBottom: "12px" }}>⏳</div>
          <div style={{ fontWeight: "600", fontSize: "1.1rem" }}>Đang tải hóa đơn phòng...</div>
          <div style={{ fontSize: "0.85rem", marginTop: "4px" }}>Vui lòng đợi trong giây lát</div>
        </div>
      ) : !invoice ? (
        hasSearched && (
          <Card style={{ textAlign: "center", padding: "40px 20px" }}>
            <div style={{ fontSize: "2.5rem", marginBottom: "12px" }}>🔍</div>
            <h3>Không tìm thấy hóa đơn</h3>
            <p style={{ marginTop: "6px" }}>
              Liên kết hóa đơn có thể đã hết hạn hoặc mã truy cập không chính xác.
            </p>
          </Card>
        )
      ) : (
        <div className="animate-fade-in" style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {/* Header Card */}
          <Card
            style={{
              padding: "20px",
              background: "linear-gradient(135deg, #0F766E 0%, #005C55 100%)",
              color: "#ffffff",
              border: "none",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <span
                  style={{
                    fontSize: "0.75rem",
                    fontWeight: "700",
                    letterSpacing: "0.06em",
                    backgroundColor: "rgba(255, 255, 255, 0.2)",
                    padding: "3px 8px",
                    borderRadius: "4px",
                  }}
                >
                  DOMUS NO-APP BILLING
                </span>
                <h2 style={{ color: "#ffffff", marginTop: "8px", fontSize: "1.4rem" }}>
                  Hóa đơn {invoice.invoiceCode} {invoice.roomNumber ? `• Phòng ${invoice.roomNumber}` : ""}
                </h2>
                <div style={{ fontSize: "0.88rem", opacity: 0.9, marginTop: "2px" }}>
                  {formatBillingPeriod(invoice.billingPeriod)} • Hạn nộp: {formatDate(invoice.dueDate)}
                  {(invoice.maskedTenantName || invoice.tenantName) && (
                    <span style={{ marginLeft: "8px" }}>
                      ({invoice.maskedTenantName || invoice.tenantName})
                    </span>
                  )}
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <Badge variant={statusMeta.variant}>{statusMeta.label}</Badge>
              </div>
            </div>

            <div
              style={{
                marginTop: "20px",
                paddingTop: "16px",
                borderTop: "1px solid rgba(255, 255, 255, 0.2)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-end",
              }}
            >
              <div>
                <div style={{ fontSize: "0.8rem", opacity: 0.85 }}>SỐ TIỀN CẦN THANH TOÁN</div>
                <div
                  className="tnum"
                  style={{
                    fontSize: "2rem",
                    fontWeight: "800",
                    fontFamily: "var(--font-heading)",
                    color: "#ffffff",
                    marginTop: "2px",
                  }}
                >
                  {isPaid ? "0 ₫" : formatCurrency(remaining)}
                </div>
              </div>
              {invoice.paidAmount > 0 && (
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: "0.78rem", opacity: 0.85 }}>Đã thanh toán</div>
                  <div className="tnum" style={{ fontWeight: "600", fontSize: "1rem" }}>
                    {formatCurrency(invoice.paidAmount)}
                  </div>
                </div>
              )}
            </div>
          </Card>

          {/* VietQR Quick Payment Card (5-Second Pay) */}
          {!isPaid && (
            <Card style={{ padding: "20px", textAlign: "center" }}>
              <div style={{ display: "inline-flex", alignItems: "center", gap: "6px", color: "var(--primary)", fontWeight: "700", fontSize: "0.95rem" }}>
                ⚡ THANH TOÁN SIÊU TỐC TRONG 5 GIÂY (VIETQR)
              </div>
              <p style={{ fontSize: "0.85rem", marginTop: "4px" }}>
                Mở ứng dụng ngân hàng bất kỳ (Vietcombank, MBBank, Techcombank, MoMo...) quét mã bên dưới
              </p>

              {invoice.vietQrUrl ? (
                <div style={{ margin: "16px auto", display: "inline-block" }}>
                  <img
                    src={invoice.vietQrUrl}
                    alt="VietQR Code"
                    style={{
                      width: "220px",
                      height: "220px",
                      borderRadius: "12px",
                      border: "1px solid var(--border-color)",
                      padding: "8px",
                      backgroundColor: "#ffffff",
                      boxShadow: "var(--shadow-md)",
                    }}
                  />
                  <div style={{ fontSize: "0.75rem", color: "var(--neutral-500)", marginTop: "6px" }}>
                    Mã QR tự động chứa đúng số tiền và cú pháp
                  </div>
                </div>
              ) : (
                <div
                  style={{
                    padding: "24px",
                    backgroundColor: "var(--neutral-50)",
                    borderRadius: "var(--radius-md)",
                    margin: "16px 0",
                  }}
                >
                  Chưa cấu hình QR tự động cho hóa đơn này. Vui lòng chuyển khoản theo thông tin bên dưới:
                </div>
              )}

              {/* Fast Copy Buttons */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "10px",
                  marginTop: "8px",
                  textAlign: "left",
                }}
              >
                <div
                  style={{
                    padding: "10px 12px",
                    backgroundColor: "var(--neutral-50)",
                    border: "1px solid var(--border-color)",
                    borderRadius: "var(--radius-md)",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <div>
                    <div style={{ fontSize: "0.72rem", color: "var(--neutral-500)" }}>Số tiền nộp</div>
                    <div className="tnum" style={{ fontWeight: "700", fontSize: "0.95rem" }}>
                      {formatCurrency(remaining)}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => copyToClipboard(String(remaining), "Đã chép số tiền!")}
                  >
                    Chép
                  </Button>
                </div>

                <div
                  style={{
                    padding: "10px 12px",
                    backgroundColor: "var(--neutral-50)",
                    border: "1px solid var(--border-color)",
                    borderRadius: "var(--radius-md)",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <div>
                    <div style={{ fontSize: "0.72rem", color: "var(--neutral-500)" }}>Nội dung CK</div>
                    <div
                      style={{
                        fontWeight: "700",
                        fontSize: "0.9rem",
                        color: "var(--primary)",
                        fontFamily: "monospace",
                      }}
                    >
                      {invoice.paymentSyntax || invoice.invoiceCode}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      copyToClipboard(
                        invoice.paymentSyntax || invoice.invoiceCode,
                        "Đã chép cú pháp chuyển khoản!"
                      )
                    }
                  >
                    Chép
                  </Button>
                </div>
              </div>

              <div style={{ marginTop: "14px", display: "flex", justifyContent: "center" }}>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => fetchPublicInvoice(invoice.publicAccessToken)}
                >
                  🔄 Kiểm tra lại trạng thái thanh toán
                </Button>
              </div>
            </Card>
          )}

          {/* Paid Confirmation Card */}
          {isPaid && (
            <Card
              style={{
                padding: "20px",
                textAlign: "center",
                backgroundColor: "var(--success-bg)",
                borderColor: "var(--success-border)",
              }}
            >
              <div style={{ fontSize: "2.5rem" }}>🎉</div>
              <h3 style={{ color: "var(--success-text)", marginTop: "6px" }}>
                Hóa đơn đã được thanh toán hoàn tất
              </h3>
              <p style={{ color: "var(--success-text)", fontSize: "0.9rem", marginTop: "4px" }}>
                Cảm ơn bạn đã thanh toán đúng hạn. Chúc bạn có trải nghiệm lưu trú tuyệt vời!
              </p>
            </Card>
          )}

          {/* Detailed Financial Breakdown */}
          <Card style={{ padding: "20px" }}>
            <h4 style={{ marginBottom: "12px", color: "var(--neutral-900)" }}>
              Chi tiết các khoản phí tháng này
            </h4>

            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {/* Room Rent */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  paddingBottom: "8px",
                  borderBottom: "1px dashed var(--border-color)",
                }}
              >
                <div>
                  <div style={{ fontWeight: "600" }}>Tiền thuê phòng</div>
                  <div style={{ fontSize: "0.78rem", color: "var(--neutral-500)" }}>
                    Kỳ {formatBillingPeriod(invoice.billingPeriod)}
                  </div>
                </div>
                <div className="tnum" style={{ fontWeight: "600" }}>
                  {formatCurrency(invoice.roomAmount)}
                </div>
              </div>

              {/* Electricity */}
              {invoice.electricDetail && (
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    paddingBottom: "8px",
                    borderBottom: "1px dashed var(--border-color)",
                  }}
                >
                  <div>
                    <div style={{ fontWeight: "600" }}>Tiền điện sinh hoạt</div>
                    <div style={{ fontSize: "0.78rem", color: "var(--neutral-500)" }}>
                      Chỉ số: {invoice.electricDetail.oldIndex} → {invoice.electricDetail.newIndex} (
                      {invoice.electricDetail.consumed} kWh ×{" "}
                      {formatCurrency(invoice.electricDetail.unitPrice)})
                    </div>
                  </div>
                  <div className="tnum" style={{ fontWeight: "600" }}>
                    {formatCurrency(invoice.electricDetail.amount)}
                  </div>
                </div>
              )}

              {/* Water */}
              {invoice.waterDetail && (
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    paddingBottom: "8px",
                    borderBottom: "1px dashed var(--border-color)",
                  }}
                >
                  <div>
                    <div style={{ fontWeight: "600" }}>Tiền nước sinh hoạt</div>
                    <div style={{ fontSize: "0.78rem", color: "var(--neutral-500)" }}>
                      {invoice.waterDetail.billingType === "PER_PERSON"
                        ? `Tính theo đầu người: ${invoice.waterDetail.headCount || 1} người`
                        : `Chỉ số: ${invoice.waterDetail.oldIndex} → ${invoice.waterDetail.newIndex} (${invoice.waterDetail.consumed} m³)`}
                    </div>
                  </div>
                  <div className="tnum" style={{ fontWeight: "600" }}>
                    {formatCurrency(invoice.waterDetail.amount)}
                  </div>
                </div>
              )}

              {/* Services */}
              {invoice.servicesDetail?.map((srv, idx) => (
                <div
                  key={idx}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    paddingBottom: "8px",
                    borderBottom: "1px dashed var(--border-color)",
                  }}
                >
                  <div>
                    <div style={{ fontWeight: "500" }}>{srv.serviceName}</div>
                    <div style={{ fontSize: "0.78rem", color: "var(--neutral-500)" }}>
                      {srv.quantity || 1} gói × {formatCurrency(srv.unitPrice)}
                    </div>
                  </div>
                  <div className="tnum" style={{ fontWeight: "600" }}>
                    {formatCurrency(srv.amount)}
                  </div>
                </div>
              ))}

              {/* Additional Fees */}
              {invoice.additionalFees?.map((fee, idx) => (
                <div
                  key={`add-${idx}`}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    paddingBottom: "8px",
                    borderBottom: "1px dashed var(--border-color)",
                  }}
                >
                  <div>
                    <div style={{ color: "var(--warning-text)", fontWeight: "500" }}>
                      ⚠️ {fee.reason}
                    </div>
                    <div style={{ fontSize: "0.78rem", color: "var(--neutral-500)" }}>
                      Phí bổ sung
                    </div>
                  </div>
                  <div className="tnum" style={{ fontWeight: "600", color: "var(--warning-text)" }}>
                    +{formatCurrency(fee.amount)}
                  </div>
                </div>
              ))}

              {/* Discount */}
              {invoice.discount?.amount > 0 && (
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    paddingBottom: "8px",
                    borderBottom: "1px dashed var(--border-color)",
                  }}
                >
                  <div>
                    <div style={{ color: "var(--success-text)", fontWeight: "500" }}>
                      🎁 {invoice.discount.reason || "Ưu đãi"}
                    </div>
                    <div style={{ fontSize: "0.78rem", color: "var(--neutral-500)" }}>Giảm trừ</div>
                  </div>
                  <div className="tnum" style={{ fontWeight: "600", color: "var(--success-text)" }}>
                    -{formatCurrency(invoice.discount.amount)}
                  </div>
                </div>
              )}

              {/* Total Calculation */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  paddingTop: "10px",
                  fontSize: "1.05rem",
                  fontWeight: "700",
                }}
              >
                <div>TỔNG CỘNG</div>
                <div className="tnum" style={{ color: "var(--primary)" }}>
                  {formatCurrency(invoice.totalAmount)}
                </div>
              </div>
            </div>
          </Card>

          {/* Footer Assistance */}
          <div style={{ textAlign: "center", color: "var(--neutral-500)", fontSize: "0.8rem" }}>
            🔒 Hóa đơn bảo mật điện tử cung cấp bởi DOMUS ERP PropTech. Mọi thắc mắc vui lòng liên hệ Ban quản lý tòa nhà.
          </div>
        </div>
      )}
    </div>
  );
}
