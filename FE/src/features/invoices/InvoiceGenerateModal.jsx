import React, { useState, useEffect } from "react";
import { Modal } from "../../components/ui/Modal";
import { Button } from "../../components/ui/Button";
import { Input, Select } from "../../components/ui/Input";
import { invoiceService } from "../../services/invoiceService";
import { branchService } from "../../services/branchService";
import { useToast } from "../../context/ToastContext";

export function InvoiceGenerateModal({ isOpen, onClose, onGenerated, defaultBranchId }) {
  const { toast } = useToast();
  const [branches, setBranches] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  // Default next month or current month
  const now = new Date();
  const currentMonthPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  // Default dueDate is 5th of that month
  const defaultDueDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-05`;

  const [formData, setFormData] = useState({
    branchId: defaultBranchId || "",
    billingPeriod: currentMonthPeriod,
    dueDate: defaultDueDate,
    targetMode: "ALL", // "ALL" or "CUSTOM"
    roomIdsString: "",
  });

  useEffect(() => {
    if (isOpen) {
      branchService.getBranches().then((data) => {
        if (Array.isArray(data)) {
          setBranches(data);
          setFormData((prev) => {
            if (!prev.branchId && data.length > 0) {
              return { ...prev, branchId: data[0]._id || data[0].id };
            }
            return prev;
          });
        }
      });
    }
  }, [isOpen]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.branchId) {
      toast.warning("Vui lòng chọn cơ sở cần tạo hóa đơn!");
      return;
    }
    if (!formData.billingPeriod) {
      toast.warning("Vui lòng chọn kỳ hóa đơn (YYYY-MM)!");
      return;
    }
    if (!formData.dueDate) {
      toast.warning("Vui lòng chọn hạn chót nộp tiền!");
      return;
    }

    const payload = {
      branchId: formData.branchId,
      billingPeriod: formData.billingPeriod,
      dueDate: formData.dueDate,
    };

    if (formData.targetMode === "CUSTOM" && formData.roomIdsString.trim()) {
      payload.roomIds = formData.roomIdsString
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    }

    try {
      setSubmitting(true);
      const res = await invoiceService.generateInvoices(payload);
      toast.success(
        res?.message || `Đã sinh thành công hóa đơn cho kỳ ${formData.billingPeriod}!`
      );
      onGenerated?.();
      onClose();
    } catch (err) {
      toast.error(err.message || "Tạo hóa đơn thất bại. Vui lòng kiểm tra lại dữ liệu chốt số.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Tạo đợt Hóa đơn Hàng tháng"
      subtitle="Hệ thống tự động gom số điện nước đã chốt, tiền phòng và dịch vụ để tính hóa đơn"
      maxWidth="550px"
      footer={
        <div style={{ display: "flex", gap: "10px" }}>
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            Hủy bỏ
          </Button>
          <Button variant="primary" loading={submitting} onClick={handleSubmit}>
            ⚡ Bắt đầu tạo hóa đơn
          </Button>
        </div>
      }
    >
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        <Select
          label="Cơ sở / Tòa nhà áp dụng"
          required
          value={formData.branchId}
          onChange={(e) => setFormData({ ...formData, branchId: e.target.value })}
        >
          <option value="">-- Chọn cơ sở --</option>
          {branches.map((b) => (
            <option key={b._id || b.id} value={b._id || b.id}>
              {b.name || b.branchName || `Cơ sở ${b._id || b.id}`}
            </option>
          ))}
        </Select>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
          <Input
            label="Kỳ tính tiền (Tháng/Năm)"
            type="month"
            required
            value={formData.billingPeriod}
            onChange={(e) => setFormData({ ...formData, billingPeriod: e.target.value })}
            helperText="Định dạng chuẩn YYYY-MM"
          />

          <Input
            label="Hạn thanh toán"
            type="date"
            required
            value={formData.dueDate}
            onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
            helperText="Sau ngày này sẽ cảnh báo Quá hạn"
          />
        </div>

        <Select
          label="Phạm vi phòng áp dụng"
          value={formData.targetMode}
          onChange={(e) => setFormData({ ...formData, targetMode: e.target.value })}
        >
          <option value="ALL">Toàn bộ phòng đang thuê trong cơ sở</option>
          <option value="CUSTOM">Chỉ tạo cho danh sách mã phòng cụ thể</option>
        </Select>

        {formData.targetMode === "CUSTOM" && (
          <Input
            label="Danh sách ID phòng (phân cách bởi dấu phẩy)"
            placeholder="vd: 60d21b4667d0d8992e610c85, 60d21b4967d0d8992e610c86"
            value={formData.roomIdsString}
            onChange={(e) => setFormData({ ...formData, roomIdsString: e.target.value })}
            helperText="Nhập chính xác MongoDB Room ID"
          />
        )}

        <div
          style={{
            padding: "12px 14px",
            backgroundColor: "var(--info-bg)",
            border: "1px solid var(--info-border)",
            borderRadius: "var(--radius-md)",
            fontSize: "0.85rem",
            color: "var(--info-text)",
            lineHeight: 1.4,
          }}
        >
          💡 <strong>Quy chuẩn tài chính:</strong> Sau khi tạo, hóa đơn sẽ ở trạng thái <strong>Bản nháp (DRAFT)</strong> để quản lý rà soát. Bạn có thể bấm <strong>Phát hành (ISSUED)</strong> để kích hoạt mã VietQR và gửi link đến khách thuê.
        </div>
      </form>
    </Modal>
  );
}
