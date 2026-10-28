import { useState } from "react";
import { X, Banknote } from "lucide-react";
import { incidentApi, errorMessage } from "../../services/api";
import { useToast } from "../../context/ToastContext";
import { Modal, Button, Field, SelectField } from "../ui";

export default function UpdateCostModal({
  incident,
  isLandlord,
  onClose,
  onSuccess,
}) {
  const toast = useToast();
  const [repairCost, setRepairCost] = useState(incident.repairCost ?? 0);
  const [costPayer, setCostPayer] = useState(incident.costPayer || "LANDLORD");
  const [note, setNote] = useState(incident.notes || "");
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (repairCost > 0 && costPayer === "NONE") {
      toast.error("Chi phí lớn hơn 0 thì không thể chọn hình thức Miễn phí.");
      return;
    }

    setBusy(true);
    try {
      await incidentApi.updateCost(incident._id, {
        repairCost: Number(repairCost),
        costPayer,
        note: note.trim() || undefined,
      });

      toast.success("Đã ghi nhận chi phí sửa chữa thành công!");
      onSuccess();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="Ghi nhận chi phí sửa chữa" onClose={onClose} busy={busy}>
      <form onSubmit={handleSubmit}>
        <div className="form-section form-grid">
          <Field
            label="Chi phí sửa chữa (VNĐ)"
            type="number"
            min="0"
            required
            value={repairCost}
            onChange={(e) => setRepairCost(e.target.value)}
          />

          <SelectField
            label="Bên chi trả chi phí"
            value={costPayer}
            onChange={(e) => setCostPayer(e.target.value)}
          >
            <option value="LANDLORD">Chủ trọ thanh toán</option>
            {isLandlord && incident.contractId && (
              <option value="TENANT">Khách thuê chi trả</option>
            )}
            <option value="NONE">Miễn phí / Bảo hành (0đ)</option>
          </SelectField>

          <div className="span-2">
            <Field label="Ghi chú chi phí / hóa đơn đính kèm">
              <textarea
                rows={2}
                placeholder="VD: Thay vòi Inax chính hãng, khách làm vỡ..."
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </Field>
          </div>
        </div>

        <footer className="modal-footer" style={{ marginTop: "20px" }}>
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            <X size={14} />
            <span>Hủy bỏ</span>
          </Button>
          <Button
            busy={busy}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            <Banknote size={15} />
            <span>Lưu chi phí</span>
          </Button>
        </footer>
      </form>
    </Modal>
  );
}

