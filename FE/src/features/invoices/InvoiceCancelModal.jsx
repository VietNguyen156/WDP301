import React, { useState } from "react";
import { Modal } from "../../components/ui/Modal";
import { Button } from "../../components/ui/Button";
import { invoiceService } from "../../services/invoiceService";
import { useToast } from "../../context/ToastContext";

export function InvoiceCancelModal({ isOpen, onClose, invoice, onInvoiceCancelled }) {
  const { toast } = useToast();
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (!invoice) return null;

  const invoiceId = invoice.id || invoice._id;

  const handleCancel = async (e) => {
    e.preventDefault();
    if (!reason.trim()) {
      toast.warning("Vui lòng nhập lý do hủy hóa đơn!");
      return;
    }

    try {
      setSubmitting(true);
      await invoiceService.cancelInvoice(invoiceId, reason.trim());
      toast.success(`Đã hủy hóa đơn ${invoice.invoiceCode || ""} thành công!`);
      onInvoiceCancelled?.();
      onClose();
    } catch (err) {
      toast.error(err.message || "Hủy hóa đơn thất bại");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Xác nhận Hủy hóa đơn ${invoice.invoiceCode || ""}`}
      subtitle="Thao tác này sẽ hủy hóa đơn và ghi nhận lý do vào hệ thống kiểm toán (AuditLog)"
      maxWidth="500px"
      footer={
        <div style={{ display: "flex", gap: "10px", width: "100%", justifyContent: "flex-end" }}>
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            Quay lại
          </Button>
          <Button variant="destructive" loading={submitting} onClick={handleCancel}>
            🗑️ Xác nhận hủy hóa đơn
          </Button>
        </div>
      }
    >
      <form onSubmit={handleCancel} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
        <div
          style={{
            padding: "12px 14px",
            backgroundColor: "var(--error-bg)",
            border: "1px solid var(--error-border)",
            borderRadius: "var(--radius-md)",
            fontSize: "0.85rem",
            color: "var(--error-text)",
            lineHeight: 1.4,
          }}
        >
          ⚠️ <strong>Lưu ý:</strong> Chỉ được hủy hóa đơn chưa phát sinh thanh toán (đã thu = 0 VNĐ). Sau khi hủy, hóa đơn sẽ chuyển sang trạng thái <strong>CANCELLED</strong> và mã QR thanh toán sẽ bị vô hiệu hóa.
        </div>

        <div>
          <label
            htmlFor="cancel-reason"
            style={{ fontSize: "0.85rem", fontWeight: "600", color: "var(--neutral-700)" }}
          >
            Lý do hủy hóa đơn <span style={{ color: "var(--error)" }}>*</span>
          </label>
          <textarea
            id="cancel-reason"
            rows="3"
            placeholder="Nhập lý do cụ thể (vd: Sai số điện nước, khách dọn đi trước kỳ, lập lại hóa đơn mới...)"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            style={{ marginTop: "4px", width: "100%", resize: "vertical" }}
            maxLength={1000}
            required
          />
          <div style={{ fontSize: "0.75rem", color: "var(--neutral-500)", marginTop: "2px", textAlign: "right" }}>
            {reason.length}/1000 ký tự
          </div>
        </div>
      </form>
    </Modal>
  );
}
