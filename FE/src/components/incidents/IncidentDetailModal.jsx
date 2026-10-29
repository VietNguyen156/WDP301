import { useState } from "react";
import {
  Sparkles,
  RefreshCw,
  DollarSign,
  History,
  X,
  Ban,
  Wrench,
  CheckCircle2,
  CheckCheck,
} from "lucide-react";
import { incidentApi, errorMessage } from "../../services/api";
import { useResource } from "../../hooks/useResource";
import { useToast } from "../../context/ToastContext";
import { Modal, Button, LoadingState } from "../ui";
import { money } from "../../utils/format";
import {
  STATUS_LABELS,
  PRIORITY_LABELS,
  CATEGORY_LABELS,
  COST_PAYER_LABELS,
} from "../../hooks/useIncidentsPage";

function TriagePanel({ data, isStaff, onRetriage, retriaging }) {
  const triage = data.triage;
  const canRetriage =
    isStaff && ["PENDING", "IN_PROGRESS"].includes(data.status);
  if (!triage && !canRetriage) return null;
  return (
    <div className="inc-triage-panel">
      <div className="inc-triage-head">
        <Sparkles size={15} />
        <strong>Phân loại tự động (TypeSafe)</strong>
        {canRetriage && (
          <Button
            size="sm"
            variant="secondary"
            onClick={onRetriage}
            disabled={retriaging}
          >
            <RefreshCw size={13} className={retriaging ? "spin" : ""} />
            <span>{triage ? "Phân loại lại" : "Phân loại"}</span>
          </Button>
        )}
      </div>
      {!triage ? (
        <p className="inc-triage-note">Sự cố này chưa được phân loại.</p>
      ) : triage.status === "FAILED" ? (
        <p className="inc-triage-note error">
          Lần phân loại gần nhất thất bại: {triage.error}
        </p>
      ) : (
        <>
          <dl className="inc-triage-grid">
            <dt>Loại sự cố</dt>
            <dd>{CATEGORY_LABELS[data.category] || "Chưa phân loại"}</dd>
            <dt>Mức ưu tiên gợi ý</dt>
            <dd>{PRIORITY_LABELS[triage.suggestedPriority] || "—"}</dd>
          </dl>
          {triage.reasons?.length > 0 && (
            <ul className="inc-triage-reasons">
              {triage.reasons.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          )}
          {triage.needsReview && (
            <p className="inc-triage-note warn">
              Kết quả chưa chắc chắn, người quản lý nên kiểm tra lại.
            </p>
          )}
        </>
      )}
    </div>
  );
}

export default function IncidentDetailModal({
  incident,
  isStaff,
  onClose,
  onEditCost,
  onTransition,
}) {
  const detailResource = useResource(
    () => incidentApi.get(incident._id),
    [incident._id],
  );
  const data = detailResource.data || incident;
  const toast = useToast();
  const [retriaging, setRetriaging] = useState(false);

  async function handleRetriage() {
    setRetriaging(true);
    try {
      await incidentApi.retriage(data._id);
      toast.success("Đã phân loại lại sự cố");
      detailResource.reload();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setRetriaging(false);
    }
  }

  return (
    <Modal title={`Chi tiết sự cố: ${data.title}`} onClose={onClose} wide>
      {detailResource.loading ? (
        <LoadingState />
      ) : (
        <div className="inc-detail-grid">
          {/* Left Column: Details & Images */}
          <div>
            <div style={{ marginBottom: "14px" }}>
              <span
                className={`inc-priority-chip priority-${data.priority?.toLowerCase()}`}
                style={{ marginRight: "8px" }}
              >
                Ưu tiên {PRIORITY_LABELS[data.priority] || data.priority}
              </span>
              <span
                style={{
                  fontSize: "12px",
                  fontWeight: 600,
                  padding: "2px 8px",
                  borderRadius: "9999px",
                  background: "#f1f5f9",
                }}
              >
                {STATUS_LABELS[data.status] || data.status}
              </span>
            </div>

            <p
              style={{
                fontSize: "14px",
                lineHeight: 1.6,
                color: "var(--inc-text-main)",
              }}
            >
              {data.description}
            </p>

            <TriagePanel
              data={data}
              isStaff={isStaff}
              onRetriage={handleRetriage}
              retriaging={retriaging}
            />

            {/* Initial Images */}
            {data.images?.length > 0 && (
              <div style={{ marginTop: "16px" }}>
                <strong style={{ fontSize: "13px" }}>Ảnh khi báo sự cố:</strong>
                <div className="inc-thumb-grid">
                  {data.images.map((img, i) => (
                    <a
                      className="inc-thumb-item"
                      key={i}
                      href={img}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <img src={img} alt="Hiện trường" />
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* Resolved Images */}
            {data.resolvedImages?.length > 0 && (
              <div style={{ marginTop: "16px" }}>
                <strong style={{ fontSize: "13px", color: "#059669" }}>
                  Ảnh nghiệm thu sau sửa chữa:
                </strong>
                <div className="inc-thumb-grid">
                  {data.resolvedImages.map((img, i) => (
                    <a
                      className="inc-thumb-item"
                      key={i}
                      href={img}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <img src={img} alt="Nghiệm thu" />
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* Repair Cost Box */}
            <div
              style={{
                marginTop: "20px",
                padding: "14px",
                background: "#f8fafc",
                borderRadius: "8px",
                border: "1px solid var(--inc-border)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: "6px",
                }}
              >
                <strong style={{ fontSize: "13px" }}>Chi phí sửa chữa:</strong>
                {isStaff &&
                  (data.status === "IN_PROGRESS" ||
                    data.status === "SOLVED") && (
                    <Button
                      variant="secondary"
                      compact
                      onClick={() => onEditCost(data)}
                    >
                      <DollarSign size={13} /> Ghi nhận chi phí
                    </Button>
                  )}
              </div>
              {data.repairCost !== undefined ? (
                <div>
                  <span
                    style={{
                      fontSize: "16px",
                      fontWeight: 700,
                      color: "var(--inc-primary-container)",
                    }}
                  >
                    {money(data.repairCost)}
                  </span>
                  <span
                    style={{
                      fontSize: "13px",
                      color: "#64748b",
                      marginLeft: "8px",
                    }}
                  >
                    • Chịu phí:{" "}
                    {COST_PAYER_LABELS[data.costPayer] || data.costPayer}
                  </span>
                  {data.notes && (
                    <p
                      style={{
                        margin: "6px 0 0 0",
                        fontSize: "12px",
                        color: "#64748b",
                      }}
                    >
                      Ghi chú: {data.notes}
                    </p>
                  )}
                </div>
              ) : (
                <span
                  style={{
                    fontSize: "12px",
                    color: "#64748b",
                    fontStyle: "italic",
                  }}
                >
                  Chưa ghi nhận chi phí sửa chữa.
                </span>
              )}
            </div>
          </div>

          {/* Right Column: Timeline history */}
          <div>
            <strong
              style={{
                fontSize: "13px",
                display: "flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              <History size={15} /> Lịch sử luồng trạng thái
            </strong>

            <div className="inc-history-timeline">
              {data.statusHistory?.map((h, idx) => (
                <div className="inc-timeline-item" key={idx}>
                  <span className="inc-timeline-dot" />
                  <strong style={{ display: "block" }}>
                    {STATUS_LABELS[h.status] || h.status}
                  </strong>
                  <span style={{ fontSize: "11px", color: "#64748b" }}>
                    {h.changedAt
                      ? new Date(h.changedAt).toLocaleString("vi-VN")
                      : "—"}
                  </span>
                  {h.note && (
                    <p
                      style={{
                        margin: "4px 0 0 0",
                        fontSize: "12px",
                        color: "#334155",
                      }}
                    >
                      &ldquo;{h.note}&rdquo;
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <footer className="modal-footer" style={{ marginTop: "24px" }}>
        <Button
          variant="secondary"
          onClick={onClose}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
          }}
        >
          <X size={14} />
          <span>Đóng</span>
        </Button>

        {/* Transition Buttons */}
        {isStaff && data.status === "PENDING" && (
          <>
            <Button
              variant="danger"
              onClick={() => onTransition(data, "REJECTED")}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              <Ban size={14} />
              <span>Từ chối</span>
            </Button>
            <Button
              onClick={() => onTransition(data, "IN_PROGRESS")}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              <Wrench size={14} />
              <span>Tiếp nhận sự cố</span>
            </Button>
          </>
        )}

        {isStaff && data.status === "IN_PROGRESS" && (
          <Button
            onClick={() => onTransition(data, "SOLVED")}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            <CheckCircle2 size={14} />
            <span>Nghiệm thu hoàn tất</span>
          </Button>
        )}

        {isStaff && data.status === "SOLVED" && (
          <>
            <Button
              variant="secondary"
              onClick={() => onTransition(data, "IN_PROGRESS")}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              <RefreshCw size={14} />
              <span>Mở lại sự cố</span>
            </Button>
            <Button
              onClick={() => onTransition(data, "CLOSED")}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              <CheckCheck size={14} />
              <span>Đóng hồ sơ sự cố</span>
            </Button>
          </>
        )}
      </footer>
    </Modal>
  );
}

