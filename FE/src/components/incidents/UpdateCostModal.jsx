import { useState } from "react";
import { X, Banknote, DoorOpen, Building2 } from "lucide-react";
import { incidentApi, errorMessage } from "../../services/api";
import { useToast } from "../../context/ToastContext";
import { Modal, Button, Field, SelectField } from "../ui";
import {
  STATUS_LABELS,
  PRIORITY_LABELS,
  formatRoomLabel,
} from "../../hooks/useIncidentsPage";

export default function UpdateCostModal({
  incident,
  onClose,
  onSuccess,
}) {
  const toast = useToast();
  const [repairCost, setRepairCost] = useState(
    incident.costPayer === "TENANT" ? 0 : (incident.repairCost ?? 0),
  );
  const [costPayer, setCostPayer] = useState(
    incident.costPayer === "TENANT"
      ? "LANDLORD"
      : incident.costPayer || "LANDLORD",
  );
  const [note, setNote] = useState(incident.notes || "");
  const [busy, setBusy] = useState(false);

  const roomNumber = incident.roomId?.roomNumber || incident.room?.roomNumber;
  const branchName = incident.branchId?.name || incident.branch?.name;

  async function handleSubmit(e) {
    e.preventDefault();
    if (Number(repairCost) > 0 && costPayer === "NONE") {
      toast.error("Chi phí lớn hơn 0 thì không thể chọn hình thức Miễn phí.");
      return;
    }

    setBusy(true);
    try {
      await incidentApi.updateCost(incident._id, {
        repairCost: Number(repairCost) || 0,
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
    <Modal
      title={`Ghi nhận chi phí sửa chữa: ${incident.title}`}
      onClose={onClose}
      busy={busy}
    >
      <form onSubmit={handleSubmit}>
        <div
          className="form-section"
          style={{ display: "flex", flexDirection: "column", gap: "14px" }}
        >
          <div className="inc-detail-badges">
            <span
              className={`inc-priority-chip priority-${incident.priority?.toLowerCase()}`}
            >
              Ưu tiên {PRIORITY_LABELS[incident.priority] || incident.priority}
            </span>
            <span className="inc-status-pill">
              {STATUS_LABELS[incident.status] || incident.status}
            </span>
            {roomNumber && (
              <span className="inc-meta-pill">
                <DoorOpen size={13} />
                {formatRoomLabel(roomNumber)}
              </span>
            )}
            {branchName && (
              <span className="inc-meta-pill">
                <Building2 size={13} />
                {branchName}
              </span>
            )}
          </div>

          <div className="form-grid">
            <Field
              label="Chi phí sửa chữa thực tế (VNĐ)"
              type="number"
              min="0"
              required
              value={repairCost}
              onChange={(e) => {
                const val = e.target.value;
                setRepairCost(val);
                if (Number(val) > 0 && costPayer === "NONE") {
                  setCostPayer("LANDLORD");
                }
              }}
            />

            <SelectField
              label="Bên chi trả chi phí"
              value={costPayer}
              onChange={(e) => {
                const next = e.target.value;
                setCostPayer(next);
                if (next === "NONE") setRepairCost(0);
              }}
            >
              <option value="LANDLORD">Chủ trọ thanh toán</option>
              <option value="NONE">Miễn phí / Bảo hành (0đ)</option>
            </SelectField>

            <div className="span-2">
              <Field label="Ghi chú chi phí / hóa đơn vật tư">
                <textarea
                  rows={2}
                  placeholder="VD: Thay thiết bị mới chính hãng, công thợ sửa chữa..."
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
              </Field>
            </div>
          </div>
        </div>

        <footer className="modal-footer">
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
