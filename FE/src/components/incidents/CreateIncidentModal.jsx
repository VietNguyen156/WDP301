import { useState } from "react";
import { Plus, X } from "lucide-react";
import { roomApi, incidentApi, errorMessage } from "../../services/api";
import { useResource } from "../../hooks/useResource";
import { useToast } from "../../context/ToastContext";
import { Modal, Button, Field, SelectField } from "../ui";

export default function CreateIncidentModal({
  isTenant,
  branches,
  triageEnabled,
  onClose,
  onSuccess,
}) {
  const toast = useToast();
  const [branchId, setBranchId] = useState(branches[0]?._id || "");
  const [roomId, setRoomId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("MEDIUM");
  const [imageUrl, setImageUrl] = useState("");
  const [images, setImages] = useState([]);
  const [busy, setBusy] = useState(false);

  // Load rooms of selected branch if staff
  const roomResource = useResource(
    () =>
      !isTenant && branchId ? roomApi.list(branchId, { limit: 100 }) : null,
    [isTenant, branchId],
  );

  function addImage() {
    if (!imageUrl) return;
    if (!/^https?:\/\//.test(imageUrl)) {
      toast.error("Ảnh đính kèm phải là URL http:// hoặc https://");
      return;
    }
    if (images.length >= 10) {
      toast.error("Tối đa 10 ảnh đính kèm.");
      return;
    }
    setImages((prev) => [...prev, imageUrl]);
    setImageUrl("");
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!title.trim() || !description.trim()) {
      toast.error("Vui lòng nhập đầy đủ tiêu đề và mô tả sự cố.");
      return;
    }

    if (!isTenant && (!branchId || !roomId)) {
      toast.error("Vui lòng chọn cơ sở và phòng xảy ra sự cố.");
      return;
    }

    setBusy(true);
    try {
      await incidentApi.create({
        branchId: isTenant ? undefined : branchId,
        roomId: isTenant ? roomId || undefined : roomId,
        title: title.trim(),
        description: description.trim(),
        priority,
        images: images.length > 0 ? images : undefined,
      });

      toast.success("Đã gửi báo cáo sự cố thành công!");
      onSuccess();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="Báo cáo sự cố mới" onClose={onClose} busy={busy} wide>
      <form onSubmit={handleSubmit}>
        <div className="form-section form-grid">
          {!isTenant && (
            <>
              <SelectField
                label="Cơ sở / Tòa nhà"
                required
                value={branchId}
                onChange={(e) => {
                  setBranchId(e.target.value);
                  setRoomId("");
                }}
              >
                <option value="">-- Chọn cơ sở --</option>
                {branches.map((b) => (
                  <option key={b._id} value={b._id}>
                    {b.name}
                  </option>
                ))}
              </SelectField>

              <SelectField
                label="Phòng xảy ra sự cố"
                required
                value={roomId}
                onChange={(e) => setRoomId(e.target.value)}
              >
                <option value="">-- Chọn phòng --</option>
                {roomResource.data?.items?.map((r) => (
                  <option key={r._id} value={r._id}>
                    Phòng {r.roomNumber} (Tầng {r.floor})
                  </option>
                ))}
              </SelectField>
            </>
          )}

          <div className="span-2">
            <Field
              label="Tiêu đề sự cố"
              placeholder="VD: Hỏng vòi nước bồn rửa mặt, rò rỉ đường ống..."
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <SelectField
            label={
              isTenant && triageEnabled
                ? "Mức độ ưu tiên (hệ thống sẽ tự đánh giá lại theo mô tả)"
                : "Mức độ ưu tiên"
            }
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
          >
            <option value="LOW">Thấp (Có thể hoãn lại)</option>
            <option value="MEDIUM">Trung bình (Bình thường)</option>
            <option value="HIGH">Cao (Cần khắc phục sớm)</option>
            <option value="URGENT">Khẩn cấp (Cháy chập, ngập nước)</option>
          </SelectField>

          <div className="span-2">
            <Field label="Mô tả chi tiết tình trạng sự cố">
              <textarea
                rows={3}
                placeholder="Mô tả cụ thể vị trí, hiện tượng, thời gian xảy ra..."
                required
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </Field>
          </div>

          {/* Images Section */}
          <div className="span-2">
            <label
              style={{
                fontSize: "12px",
                fontWeight: 700,
                display: "block",
                marginBottom: "6px",
              }}
            >
              Ảnh chụp hiện trường sự cố (URL http/https)
            </label>
            <div style={{ display: "flex", gap: "8px" }}>
              <input
                type="url"
                placeholder="https://images.example.com/su-co-1.jpg"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                style={{
                  flex: 1,
                  padding: "8px 12px",
                  borderRadius: "8px",
                  border: "1px solid #cbd5e1",
                }}
              />
              <Button type="button" variant="secondary" onClick={addImage}>
                <Plus size={15} /> Thêm ảnh
              </Button>
            </div>

            {images.length > 0 && (
              <div className="inc-thumb-grid">
                {images.map((img, i) => (
                  <div
                    className="inc-thumb-item"
                    key={i}
                    style={{ position: "relative" }}
                  >
                    <img src={img} alt={`ảnh ${i + 1}`} />
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
                        setImages((prev) => prev.filter((_, idx) => idx !== i))
                      }
                    >
                      <X size={12} strokeWidth={2.5} />
                    </button>
                  </div>
                ))}
              </div>
            )}
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
            <Plus size={15} />
            <span>Gửi báo cáo sự cố</span>
          </Button>
        </footer>
      </form>
    </Modal>
  );
}

