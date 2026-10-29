import { useState } from "react";
import { Plus, X, Ban, Check } from "lucide-react";
import { incidentApi, errorMessage } from "../../services/api";
import { useToast } from "../../context/ToastContext";
import { Modal, Button, Field } from "../ui";
import { STATUS_LABELS } from "../../hooks/useIncidentsPage";

export default function TransitionModal({
  incident,
  targetStatus,
  onClose,
  onSuccess,
}) {
  const toast = useToast();
  const [note, setNote] = useState("");
  const [resolvedImageUrl, setResolvedImageUrl] = useState("");
  const [resolvedImages, setResolvedImages] = useState([]);
  const [busy, setBusy] = useState(false);

  function addResolvedImage() {
    if (!resolvedImageUrl) return;
    if (!/^https?:\/\//.test(resolvedImageUrl)) {
      toast.error("Ảnh nghiệm thu phải là URL http:// hoặc https://");
      return;
    }
    setResolvedImages((prev) => [...prev, resolvedImageUrl]);
    setResolvedImageUrl("");
  }

  async function handleConfirm(e) {
    e.preventDefault();

    if (targetStatus === "REJECTED" && !note.trim()) {
      toast.error("Vui lòng nhập lý do từ chối sự cố.");
      return;
    }

    if (targetStatus === "SOLVED" && resolvedImages.length === 0) {
      toast.error("Nghiệm thu sự cố bắt buộc có ít nhất 1 ảnh nghiệm thu.");
      return;
    }

    if (
      targetStatus === "CLOSED" &&
      incident.costUpdatedAt === undefined &&
      incident.repairCost === undefined
    ) {
      toast.error(
        "Vui lòng ghi nhận chi phí sửa chữa trước khi đóng hồ sơ sự cố.",
      );
      return;
    }

    setBusy(true);
    try {
      await incidentApi.updateStatus(incident._id, {
        status: targetStatus,
        note: note.trim() || undefined,
        resolvedImages: resolvedImages.length > 0 ? resolvedImages : undefined,
      });

      toast.success(
        `Đã chuyển trạng thái sự cố sang: ${STATUS_LABELS[targetStatus]}`,
      );
      onSuccess();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      title={`Xác nhận chuyển trạng thái: ${STATUS_LABELS[targetStatus]}`}
      onClose={onClose}
      busy={busy}
    >
      <form onSubmit={handleConfirm}>
        <p style={{ fontSize: "14px", color: "#334155", margin: "0 0 16px 0" }}>
          Bạn đang cập nhật sự cố <strong>{incident.title}</strong> sang trạng
          thái <strong>{STATUS_LABELS[targetStatus]}</strong>.
        </p>

        {targetStatus === "SOLVED" && (
          <div style={{ marginBottom: "16px" }}>
            <label
              style={{
                fontSize: "12px",
                fontWeight: 700,
                display: "block",
                marginBottom: "6px",
              }}
            >
              Ảnh nghiệm thu kết quả sửa chữa (Bắt buộc ít nhất 1 ảnh) *
            </label>
            <div style={{ display: "flex", gap: "8px" }}>
              <input
                type="url"
                placeholder="https://images.example.com/nghiem-thu.jpg"
                value={resolvedImageUrl}
                onChange={(e) => setResolvedImageUrl(e.target.value)}
                style={{
                  flex: 1,
                  padding: "8px 12px",
                  borderRadius: "8px",
                  border: "1px solid #cbd5e1",
                }}
              />
              <Button
                type="button"
                variant="secondary"
                onClick={addResolvedImage}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                <Plus size={15} />
                <span>Thêm ảnh</span>
              </Button>
            </div>

            {resolvedImages.length > 0 && (
              <div className="inc-thumb-grid">
                {resolvedImages.map((img, i) => (
                  <div
                    className="inc-thumb-item"
                    key={i}
                    style={{ position: "relative" }}
                  >
                    <img src={img} alt="Nghiệm thu" />
                    <button
                      type="button"
                      style={{
                        position: "absolute",
                        top: 3,
                        right: 3,
                        background: "rgba(15, 23, 42, 0.75)",
                        color: "#fff",
                        border: "none",
                        borderRadius: "50%",
                        width: 20,
                        height: 20,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        cursor: "pointer",
                        transition: "all 0.15s ease",
                      }}
                      title="Xóa ảnh này"
                      onClick={() =>
                        setResolvedImages((prev) =>
                          prev.filter((_, idx) => idx !== i),
                        )
                      }
                    >
                      <X size={12} strokeWidth={2.5} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <Field
          label={
            targetStatus === "REJECTED"
              ? "Lý do từ chối (Bắt buộc) *"
              : "Ghi chú quá trình xử lý"
          }
        >
          <textarea
            rows={3}
            placeholder={
              targetStatus === "REJECTED"
                ? "Giải thích lý do không tiếp nhận sự cố này..."
                : "Ghi chú thợ sửa, linh kiện thay thế..."
            }
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </Field>

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
            variant={targetStatus === "REJECTED" ? "danger" : undefined}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            {targetStatus === "REJECTED" ? (
              <Ban size={14} />
            ) : (
              <Check size={14} />
            )}
            <span>Xác nhận</span>
          </Button>
        </footer>
      </form>
    </Modal>
  );
}

