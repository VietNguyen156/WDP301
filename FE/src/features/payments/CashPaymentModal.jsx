import React, { useState, useEffect } from "react";
import { Modal } from "../../components/ui/Modal";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { paymentService } from "../../services/paymentService";
import { useToast } from "../../context/ToastContext";
import { formatCurrency, generateReceiptNumber } from "../../utils/formatters";

export function CashPaymentModal({ isOpen, onClose, invoice, onPaymentSuccess }) {
  const { toast } = useToast();
  const [amount, setAmount] = useState(0);
  const [receiptNumber, setReceiptNumber] = useState("");
  const [payerName, setPayerName] = useState("");
  const [cashCollectionPoint, setCashCollectionPoint] = useState("Văn phòng Ban quản lý");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen && invoice) {
      const remaining =
        typeof invoice.remainingAmount === "number"
          ? invoice.remainingAmount
          : (invoice.totalAmount || 0) - (invoice.paidAmount || 0);

      setAmount(remaining > 0 ? remaining : 0);
      setReceiptNumber(generateReceiptNumber());
      setPayerName(
        invoice.tenantId?.name ||
          invoice.tenantName ||
          invoice.payerName ||
          (typeof invoice.tenantId === "string" ? "Khách thuê" : "")
      );
      setCashCollectionPoint("Văn phòng Ban quản lý cơ sở");
      setNote(`Thu tiền mặt hóa đơn ${invoice.invoiceCode || ""}`);
    }
  }, [isOpen, invoice]);

  if (!invoice) return null;

  const invoiceId = invoice.id || invoice._id;
  const currentRemaining =
    typeof invoice.remainingAmount === "number"
      ? invoice.remainingAmount
      : (invoice.totalAmount || 0) - (invoice.paidAmount || 0);

  const numAmount = parseInt(amount, 10) || 0;
  const newRemaining = Math.max(0, currentRemaining - numAmount);
  const isOverpaid = numAmount > currentRemaining;

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (invoice.status === "PAID") {
      toast.warning("Hóa đơn này đã được thanh toán đủ (PAID). Không thể thu thêm.");
      return;
    }
    if (invoice.status === "CANCELLED") {
      toast.error("Hóa đơn đã bị hủy (CANCELLED). Không được phép thu tiền.");
      return;
    }
    if (numAmount <= 0) {
      toast.warning("Số tiền thu phải lớn hơn 0 VNĐ.");
      return;
    }
    if (!receiptNumber.trim()) {
      toast.warning("Mã biên nhận không được để trống.");
      return;
    }

    const payload = {
      invoiceId,
      amount: numAmount,
      receiptNumber: receiptNumber.trim(),
      transactionDate: new Date().toISOString(),
      payerName: payerName.trim(),
      cashCollectionPoint: cashCollectionPoint.trim(),
      note: note.trim(),
    };

    try {
      setSubmitting(true);
      const res = await paymentService.recordCashPayment(payload);
      toast.success(
        res?.message || `Đã xác nhận thu tiền mặt ${formatCurrency(numAmount)} thành công!`
      );
      onPaymentSuccess?.(res?.data || res);
      onClose();
    } catch (err) {
      toast.error(err.message || "Xác nhận thu tiền mặt thất bại");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Xác nhận Thu tiền mặt (Cash Payment)"
      subtitle={`Hóa đơn ${invoice.invoiceCode || ""} • Khách thuê nộp tiền trực tiếp`}
      maxWidth="560px"
      footer={
        <div style={{ display: "flex", gap: "10px", width: "100%", justifyContent: "flex-end" }}>
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            Hủy bỏ
          </Button>
          <Button variant="primary" loading={submitting} onClick={handleSubmit}>
            💰 Xác nhận đã nhận tiền mặt
          </Button>
        </div>
      }
    >
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        {/* Invoice Brief Card */}
        <div
          style={{
            padding: "12px 16px",
            backgroundColor: "var(--neutral-50)",
            border: "1px solid var(--border-color)",
            borderRadius: "var(--radius-md)",
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "10px",
          }}
        >
          <div>
            <div style={{ fontSize: "0.8rem", color: "var(--neutral-500)" }}>Tổng hóa đơn:</div>
            <div style={{ fontWeight: "700", fontSize: "1rem" }} className="tnum">
              {formatCurrency(invoice.totalAmount)}
            </div>
          </div>
          <div>
            <div style={{ fontSize: "0.8rem", color: "var(--neutral-500)" }}>Đã thanh toán trước:</div>
            <div style={{ fontWeight: "600", fontSize: "1rem", color: "var(--success)" }} className="tnum">
              {formatCurrency(invoice.paidAmount)}
            </div>
          </div>
          <div>
            <div style={{ fontSize: "0.8rem", color: "var(--neutral-500)" }}>Còn nợ hiện tại:</div>
            <div
              style={{ fontWeight: "700", fontSize: "1.05rem", color: "var(--error)" }}
              className="tnum"
            >
              {formatCurrency(currentRemaining)}
            </div>
          </div>
          <div>
            <div style={{ fontSize: "0.8rem", color: "var(--neutral-500)" }}>Còn lại sau khi thu:</div>
            <div
              style={{
                fontWeight: "700",
                fontSize: "1.05rem",
                color: newRemaining === 0 ? "var(--success)" : "var(--warning)",
              }}
              className="tnum"
            >
              {isOverpaid ? `Thừa +${formatCurrency(numAmount - currentRemaining)}` : formatCurrency(newRemaining)}
            </div>
          </div>
        </div>

        {/* Amount Input */}
        <div>
          <Input
            label="Số tiền thực thu (VNĐ)"
            type="number"
            required
            step="1000"
            min="1000"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            helperText={`Đọc số: ${formatCurrency(numAmount)}`}
          />
          <div style={{ display: "flex", gap: "6px", marginTop: "6px" }}>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setAmount(currentRemaining)}
              style={{ fontSize: "0.78rem" }}
            >
              Thu đủ ({formatCurrency(currentRemaining)})
            </Button>
            {currentRemaining > 1000000 && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setAmount(Math.floor(currentRemaining / 2))}
                style={{ fontSize: "0.78rem" }}
              >
                Thu 50%
              </Button>
            )}
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
          <Input
            label="Mã biên nhận (Unique Receipt)"
            required
            value={receiptNumber}
            onChange={(e) => setReceiptNumber(e.target.value)}
            helperText="Được mã hóa vào AuditLog"
          />

          <Input
            label="Họ tên người nộp"
            placeholder="Tên khách thuê hoặc người đại diện"
            value={payerName}
            onChange={(e) => setPayerName(e.target.value)}
          />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
          <Input
            label="Địa điểm thu tiền"
            value={cashCollectionPoint}
            onChange={(e) => setCashCollectionPoint(e.target.value)}
            helperText="vd: Quầy lễ tân, Trực tiếp tại phòng"
          />

          <Input
            label="Ghi chú giao dịch"
            placeholder="Ghi chú thêm nếu có"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>

        <div
          style={{
            padding: "10px 14px",
            backgroundColor: "var(--warning-bg)",
            border: "1px solid var(--warning-border)",
            borderRadius: "var(--radius-md)",
            fontSize: "0.82rem",
            color: "var(--warning-text)",
          }}
        >
          ⚠️ Giao dịch thu tiền mặt sẽ tự động tạo bản ghi <strong>Payment (CASH)</strong>, cập nhật trạng thái hóa đơn và ghi nhận vào <strong>AuditLog</strong> của hệ thống.
        </div>
      </form>
    </Modal>
  );
}
