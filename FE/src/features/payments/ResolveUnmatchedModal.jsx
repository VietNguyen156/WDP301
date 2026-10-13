import React, { useState } from "react";
import { Modal } from "../../components/ui/Modal";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { paymentService } from "../../services/paymentService";
import { useToast } from "../../context/ToastContext";
import { formatCurrency, formatDate } from "../../utils/formatters";

export function ResolveUnmatchedModal({ isOpen, onClose, unmatchedPayment, onResolved }) {
  const { toast } = useToast();
  const [invoiceId, setInvoiceId] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (!unmatchedPayment) return null;

  const unmatchedId = unmatchedPayment.id || unmatchedPayment._id;

  const handleResolve = async (e) => {
    e.preventDefault();
    if (!invoiceId.trim()) {
      toast.warning("Vui lòng nhập MongoDB ID hoặc chọn Hóa đơn cần gán!");
      return;
    }

    try {
      setSubmitting(true);
      const res = await paymentService.resolveUnmatched(unmatchedId, invoiceId.trim());
      toast.success(
        res?.message ||
          `Đã đối soát và gán thành công giao dịch ${unmatchedPayment.referenceCode} vào hóa đơn!`
      );
      onResolved?.();
      onClose();
    } catch (err) {
      toast.error(err.message || "Gán giao dịch thất bại. Vui lòng kiểm tra lại ID hóa đơn.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Đối soát Giao dịch Chưa khớp (Resolve Unmatched)"
      subtitle={`Mã tham chiếu ngân hàng: ${unmatchedPayment.referenceCode}`}
      maxWidth="550px"
      footer={
        <div style={{ display: "flex", gap: "10px", width: "100%", justifyContent: "flex-end" }}>
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            Hủy bỏ
          </Button>
          <Button variant="primary" loading={submitting} onClick={handleResolve}>
            🔗 Xác nhận gán vào hóa đơn
          </Button>
        </div>
      }
    >
      <form onSubmit={handleResolve} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
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
            <span style={{ fontSize: "0.82rem", color: "var(--neutral-500)" }}>Số tiền chuyển:</span>
            <span style={{ fontWeight: "700", color: "var(--primary)", fontSize: "1.05rem" }} className="tnum">
              +{formatCurrency(unmatchedPayment.amount)}
            </span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ fontSize: "0.82rem", color: "var(--neutral-500)" }}>Ngân hàng / Cổng:</span>
            <span style={{ fontWeight: "600" }}>{unmatchedPayment.gateway || "Chuyển khoản"}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ fontSize: "0.82rem", color: "var(--neutral-500)" }}>Thời gian giao dịch:</span>
            <span>{formatDate(unmatchedPayment.transactionDate, true)}</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "2px", marginTop: "4px" }}>
            <span style={{ fontSize: "0.82rem", color: "var(--neutral-500)" }}>Nội dung chuyển khoản thô:</span>
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

        <Input
          label="ID Hóa đơn cần gán (Invoice ID)"
          required
          placeholder="Nhập MongoDB ObjectId của hóa đơn (vd: 6701...)"
          value={invoiceId}
          onChange={(e) => setInvoiceId(e.target.value)}
          helperText="Mở danh sách Hóa đơn để lấy ID hoặc mã hóa đơn cần khớp nợ"
        />

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
          💡 Sau khi gán, hệ thống sẽ tự động tạo bản ghi thanh toán chính thức, cập nhật số tiền đã nộp trên hóa đơn và đổi trạng thái giao dịch này thành <strong>RESOLVED</strong>.
        </div>
      </form>
    </Modal>
  );
}
