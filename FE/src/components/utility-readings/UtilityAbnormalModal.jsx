import { AlertTriangle } from "lucide-react";
import { Modal, Button } from "../ui";

export default function UtilityAbnormalModal({
  abnormalWarning,
  setAbnormalWarning,
  submitting,
  submitReading,
}) {
  if (!abnormalWarning) return null;

  return (
    <Modal
      title="Cảnh báo: Tiêu thụ tăng bất thường!"
      onClose={() => setAbnormalWarning(null)}
      busy={submitting}
    >
      <div className="util-abnormal-box">
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            color: "#dc2626",
            fontWeight: 700,
            marginBottom: "8px",
          }}
        >
          <AlertTriangle size={20} />
          Phát hiện mức tăng vượt quá 2.5 lần trung bình 3 kỳ gần nhất
        </div>
        <p
          style={{
            fontSize: "13px",
            color: "#475569",
            margin: "0 0 12px 0",
          }}
        >
          Hệ thống nhận thấy mức tiêu thụ phòng{" "}
          <strong>{abnormalWarning.item?.room?.roomNumber}</strong> cao đột biến.
          Vui lòng kiểm tra lại công tơ trước khi xác nhận.
        </p>

        {abnormalWarning.details.warnings?.map((w, i) => (
          <div className="util-abnormal-item" key={i}>
            <span>
              {w.type === "ELECTRIC" ? "⚡ Điện năng:" : "💧 Nước sạch:"}
            </span>
            <span>
              Tiêu thụ: <strong>{w.consumed}</strong> | Trung bình:{" "}
              <strong>{w.average}</strong> (Tăng{" "}
              <strong style={{ color: "#dc2626" }}>{w.ratio}x</strong>)
            </span>
          </div>
        ))}
      </div>

      <footer className="modal-footer">
        <Button
          variant="secondary"
          disabled={submitting}
          onClick={() => setAbnormalWarning(null)}
        >
          Kiểm tra lại số liệu
        </Button>
        <Button
          variant="danger"
          busy={submitting}
          onClick={() => submitReading(abnormalWarning.item, true)}
        >
          Xác nhận đúng, tiếp tục lưu
        </Button>
      </footer>
    </Modal>
  );
}

