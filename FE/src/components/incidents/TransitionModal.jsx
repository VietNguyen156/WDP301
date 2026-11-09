import { useState } from "react";
import {
  Plus,
  X,
  Ban,
  Check,
  Wrench,
  Send,
  Sparkles,
  DoorOpen,
  Building2,
  User,
  ArrowRight,
} from "lucide-react";
import { incidentApi, errorMessage } from "../../services/api";
import { useToast } from "../../context/ToastContext";
import { Modal, Button, Field, SelectField } from "../ui";
import {
  STATUS_LABELS,
  PRIORITY_LABELS,
  CATEGORY_LABELS,
  formatRoomLabel,
} from "../../hooks/useIncidentsPage";

export default function TransitionModal({
  incident,
  targetStatus,
  onClose,
  onSuccess,
}) {
  const toast = useToast();
  const isReceiving =
    incident.status === "PENDING" && targetStatus === "IN_PROGRESS";
  const canSendTenantQuote =
    isReceiving &&
    Boolean(incident.contractId) &&
    incident.quote?.status !== "ACCEPTED" &&
    // Already recorded as landlord-paid / free: the tenant cannot be quoted any more.
    !(incident.costUpdatedAt && incident.costPayer !== "TENANT");

  // "ACCEPT" = Tiếp nhận sửa ngay (Chủ trọ/Bảo hành), "QUOTE" = Gửi báo giá người thuê duyệt trước
  const [receiveMode, setReceiveMode] = useState("ACCEPT");
  const [quoteAmount, setQuoteAmount] = useState(
    incident.quote?.amount ? String(incident.quote.amount) : "",
  );
  const [note, setNote] = useState("");
  // Optional photos of the finished repair (SOLVED); none is fine.
  const [resolvedImageUrl, setResolvedImageUrl] = useState("");
  const [resolvedImages, setResolvedImages] = useState(
    incident.resolvedImages || [],
  );

  // Allow recording repair cost directly during SOLVED or CLOSED if not tenant-quoted
  const isTenantQuoted = incident.costPayer === "TENANT";
  const showCostInputs =
    !isTenantQuoted &&
    (targetStatus === "SOLVED" ||
      (targetStatus === "CLOSED" && !incident.costUpdatedAt));
  const [repairCost, setRepairCost] = useState(incident.repairCost ?? 0);
  const [costPayer, setCostPayer] = useState(
    incident.costPayer === "TENANT"
      ? "LANDLORD"
      : incident.costPayer || "LANDLORD",
  );

  const [busy, setBusy] = useState(false);

  const roomNumber = incident.roomId?.roomNumber || incident.room?.roomNumber;
  const branchName = incident.branchId?.name || incident.branch?.name;
  const reporterName = incident.reportedBy?.name;

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

    if (isReceiving && receiveMode === "QUOTE") {
      const val = Number(quoteAmount);
      if (!Number.isSafeInteger(val) || val < 1) {
        toast.error("Vui lòng nhập số tiền báo giá hợp lệ lớn hơn 0.");
        return;
      }
      setBusy(true);
      try {
        await incidentApi.sendQuote(incident._id, {
          amount: val,
          note: note.trim() || undefined,
        });
        toast.success(
          "Đã gửi báo giá cho người thuê! Sự cố sẽ bắt đầu xử lý sau khi người thuê duyệt.",
        );
        onSuccess();
      } catch (err) {
        toast.error(errorMessage(err));
      } finally {
        setBusy(false);
      }
      return;
    }

    if (targetStatus === "REJECTED" && !note.trim()) {
      toast.error("Vui lòng nhập lý do từ chối sự cố.");
      return;
    }

    if (showCostInputs && Number(repairCost) > 0 && costPayer === "NONE") {
      toast.error("Chi phí lớn hơn 0 thì không thể chọn Miễn phí / Bảo hành.");
      return;
    }

    setBusy(true);
    try {
      if (showCostInputs) {
        await incidentApi.updateCost(incident._id, {
          repairCost: Number(repairCost) || 0,
          costPayer: Number(repairCost) === 0 ? costPayer : "LANDLORD",
          note: note.trim() || undefined,
        });
      }

      await incidentApi.updateStatus(incident._id, {
        status: targetStatus,
        note: note.trim() || undefined,
        resolvedImages:
          targetStatus === "SOLVED" && resolvedImages.length > 0
            ? resolvedImages
            : undefined,
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

  const modalTitle = isReceiving
    ? `Tiếp nhận & Điều phối sự cố: ${incident.title}`
    : targetStatus === "SOLVED"
      ? `Nghiệm thu kết quả sửa chữa: ${incident.title}`
      : targetStatus === "REJECTED"
        ? `Từ chối tiếp nhận sự cố: ${incident.title}`
        : `Xác nhận ${STATUS_LABELS[targetStatus]}: ${incident.title}`;

  return (
    <Modal title={modalTitle} onClose={onClose} busy={busy} wide>
      <form onSubmit={handleConfirm}>
        <div className="form-section" style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          {/* Context Header Badges matching IncidentDetailModal */}
          <div className="inc-detail-badges">
            <span
              className={`inc-priority-chip priority-${incident.priority?.toLowerCase()}`}
            >
              Ưu tiên {PRIORITY_LABELS[incident.priority] || incident.priority}
            </span>
            <span className="inc-status-pill" style={{ display: "inline-flex", alignItems: "center", gap: "5px" }}>
              <span>{STATUS_LABELS[incident.status] || incident.status}</span>
              <ArrowRight size={12} />
              <strong style={{ color: "var(--inc-primary)" }}>
                {isReceiving && receiveMode === "QUOTE"
                  ? "Chờ cư dân duyệt báo giá"
                  : STATUS_LABELS[targetStatus]}
              </strong>
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
            {reporterName && (
              <span className="inc-meta-pill">
                <User size={13} />
                {reporterName}
              </span>
            )}
          </div>

          {/* Incident Description Box matching IncidentDetailModal */}
          <div className="inc-desc-box">
            <span className="inc-desc-label">Mô tả sự cố từ người báo</span>
            <p className="inc-desc-text">
              {incident.description || "Không có mô tả chi tiết."}
            </p>
          </div>

          {/* TypeSafe Triage Summary if available */}
          {incident.triage && incident.triage.status !== "FAILED" && (
            <div className="inc-triage-panel">
              <div className="inc-triage-head" style={{ borderBottom: "none", paddingBottom: 0 }}>
                <span className="inc-triage-head-title">
                  <Sparkles size={15} />
                  <strong>
                    Phân loại tự động:{" "}
                    {CATEGORY_LABELS[incident.category] || "Chưa phân loại"} • Gợi
                    ý ưu tiên:{" "}
                    {PRIORITY_LABELS[incident.triage.suggestedPriority] || "—"}
                  </strong>
                </span>
              </div>
            </div>
          )}

          {/* Mode Selection when Receiving PENDING incident */}
          {canSendTenantQuote && (
            <div className="inc-cost-box" style={{ background: "#ffffff" }}>
              <span className="inc-desc-label" style={{ marginBottom: "8px" }}>
                Phương án xử lý &amp; Trách nhiệm chi phí
              </span>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "10px",
                }}
              >
                <label
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "8px",
                    padding: "10px 12px",
                    borderRadius: "8px",
                    border:
                      receiveMode === "ACCEPT"
                        ? "2px solid var(--inc-primary)"
                        : "1px solid #cbd5e1",
                    background:
                      receiveMode === "ACCEPT" ? "#f0fdfa" : "#f8fafc",
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="radio"
                    name="receiveMode"
                    checked={receiveMode === "ACCEPT"}
                    onChange={() => setReceiveMode("ACCEPT")}
                    style={{ width: "16px", height: "16px", marginTop: "2px", accentColor: "#005c55" }}
                  />
                  <div>
                    <strong style={{ display: "block", fontSize: "13px", color: "#0f172a" }}>
                      Tiếp nhận sửa ngay (Chủ trọ / Bảo hành)
                    </strong>
                    <span style={{ fontSize: "12px", color: "#64748b" }}>
                      Chuyển sang Đang xử lý, ghi nhận chi phí sau khi sửa xong.
                    </span>
                  </div>
                </label>

                <label
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "8px",
                    padding: "10px 12px",
                    borderRadius: "8px",
                    border:
                      receiveMode === "QUOTE"
                        ? "2px solid #d97706"
                        : "1px solid #cbd5e1",
                    background:
                      receiveMode === "QUOTE" ? "#fffbeb" : "#f8fafc",
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="radio"
                    name="receiveMode"
                    checked={receiveMode === "QUOTE"}
                    onChange={() => setReceiveMode("QUOTE")}
                    style={{ width: "16px", height: "16px", marginTop: "2px", accentColor: "#d97706" }}
                  />
                  <div>
                    <strong style={{ display: "block", fontSize: "13px", color: "#78350f" }}>
                      Lỗi do người thuê (Gửi báo giá trước)
                    </strong>
                    <span style={{ fontSize: "12px", color: "#92400e" }}>
                      Báo giá để cư dân đồng ý mức phí trước khi bắt đầu sửa.
                    </span>
                  </div>
                </label>
              </div>
            </div>
          )}

          {/* Quote Amount Input when QUOTE mode is selected */}
          {isReceiving && receiveMode === "QUOTE" && (
            <Field
              label="Số tiền báo giá người thuê chi trả (VNĐ)"
              type="number"
              min="1"
              required
              placeholder="VD: 250000"
              value={quoteAmount}
              onChange={(e) => setQuoteAmount(e.target.value)}
            />
          )}

          {/* Evidence Images when SOLVED */}
          {targetStatus === "SOLVED" && (
            <div>
              <label
                style={{
                  fontSize: "13px",
                  fontWeight: 600,
                  color: "#131b2e",
                  display: "block",
                  marginBottom: "6px",
                }}
              >
                Ảnh nghiệm thu kết quả sửa chữa{" "}
                <span style={{ fontWeight: 400, color: "#64748b" }}>(không bắt buộc)</span>
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

          {/* Inline Repair Cost fields during SOLVED or CLOSED (if not yet recorded) */}
          {showCostInputs && (
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
                onChange={(e) => setCostPayer(e.target.value)}
              >
                <option value="LANDLORD">Chủ trọ thanh toán</option>
                <option value="NONE">Miễn phí / Bảo hành (0đ)</option>
              </SelectField>
            </div>
          )}

          <Field
            label={
              targetStatus === "REJECTED"
                ? "Lý do từ chối tiếp nhận"
                : isReceiving && receiveMode === "QUOTE"
                  ? "Hạng mục hư hỏng / Lý do người thuê chịu phí"
                  : targetStatus === "SOLVED"
                    ? "Ghi chú kết quả nghiệm thu / Linh kiện thay thế"
                    : "Ghi chú điều phối & xử lý"
            }
            required={targetStatus === "REJECTED"}
          >
            <textarea
              rows={3}
              placeholder={
                targetStatus === "REJECTED"
                  ? "Giải thích rõ lý do không tiếp nhận sự cố này..."
                  : isReceiving && receiveMode === "QUOTE"
                    ? "VD: Thay mới thiết bị do va đập mạnh, bao gồm vật tư và công thợ..."
                    : "Ghi chú phân công kỹ thuật viên, lịch hẹn kiểm tra hoặc phương án xử lý..."
              }
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </Field>
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
            variant={targetStatus === "REJECTED" ? "danger" : undefined}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            {targetStatus === "REJECTED" ? (
              <Ban size={14} />
            ) : isReceiving && receiveMode === "QUOTE" ? (
              <Send size={14} />
            ) : isReceiving ? (
              <Wrench size={14} />
            ) : (
              <Check size={14} />
            )}
            <span>
              {targetStatus === "REJECTED"
                ? "Xác nhận từ chối"
                : isReceiving && receiveMode === "QUOTE"
                  ? "Gửi báo giá cho cư dân"
                  : isReceiving
                    ? "Xác nhận tiếp nhận"
                    : "Xác nhận hoàn tất"}
            </span>
          </Button>
        </footer>
      </form>
    </Modal>
  );
}
