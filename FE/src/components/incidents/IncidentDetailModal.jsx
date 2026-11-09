import { useState } from "react";
import {
  Sparkles,
  RefreshCw,
  History,
  X,
  Ban,
  Wrench,
  CheckCircle2,
  CheckCheck,
  Building2,
  DoorOpen,
  User,
} from "lucide-react";
import { incidentApi, errorMessage } from "../../services/api";
import { useResource } from "../../hooks/useResource";
import { useLiveRefresh } from "../../hooks/useLiveRefresh";
import { useAuth } from "../../context/AuthContext";
import IncidentChargePanel from "./IncidentChargePanel";
import IncidentExpensePanel from "./IncidentExpensePanel";
import { useToast } from "../../context/ToastContext";
import { Modal, Button, LoadingState } from "../ui";
import {
  STATUS_LABELS,
  PRIORITY_LABELS,
  CATEGORY_LABELS,
  formatRoomLabel,
} from "../../hooks/useIncidentsPage";

function TriagePanel({ data, isStaff, onRetriage, retriaging }) {
  const triage = data.triage;
  const canRetriage =
    isStaff && ["PENDING", "IN_PROGRESS"].includes(data.status);
  if (!triage && !canRetriage) return null;
  return (
    <div className="inc-triage-panel">
      <div className="inc-triage-head">
        <span className="inc-triage-head-title">
          <Sparkles size={15} />
          <strong>Phân loại tự động (TypeSafe)</strong>
        </span>
        {canRetriage && (
          <Button
            compact
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
  const { user } = useAuth();
  const isTenant = user?.role === "TENANT";
  useLiveRefresh(["incidents"], detailResource.refresh);
  const tenantPays = data.costPayer === "TENANT";
  const waitingForQuote = tenantPays && data.quote?.status !== "ACCEPTED";
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

  const roomNumber = data.roomId?.roomNumber || data.room?.roomNumber;
  const branchName = data.branchId?.name || data.branch?.name;
  const reporterName = data.reportedBy?.name;

  return (
    <Modal title={`Chi tiết sự cố: ${data.title}`} onClose={onClose} wide>
      <div className="inc-detail-body">
        {detailResource.loading ? (
          <LoadingState />
        ) : (
          <div className="inc-detail-grid">
            {/* Left Column: Details & Images */}
            <div className="inc-detail-main">
              <div className="inc-detail-badges">
                <span
                  className={`inc-priority-chip priority-${data.priority?.toLowerCase()}`}
                >
                  Ưu tiên {PRIORITY_LABELS[data.priority] || data.priority}
                </span>
                <span className="inc-status-pill">
                  {STATUS_LABELS[data.status] || data.status}
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

              <div className="inc-desc-box">
                <span className="inc-desc-label">Mô tả sự cố</span>
                <p className="inc-desc-text">
                  {data.description || "Không có mô tả chi tiết."}
                </p>
              </div>

              <TriagePanel
                data={data}
                isStaff={isStaff}
                onRetriage={handleRetriage}
                retriaging={retriaging}
              />

              {/* Initial Images */}
              {data.images?.length > 0 && (
                <div>
                  <strong style={{ fontSize: "13px" }}>
                    Ảnh khi báo sự cố:
                  </strong>
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

              {/* Resolved Images (older incidents may still have them) */}
              {data.resolvedImages?.length > 0 && (
                <div>
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

              {/* Unified Cost & Quote Panel */}
              <IncidentChargePanel
                data={data}
                isStaff={isStaff}
                isTenant={isTenant}
                onEditCost={onEditCost}
                onChanged={detailResource.reload}
              />

              {isStaff && (
                <IncidentExpensePanel
                  data={data}
                  isLandlord={user?.role === "LANDLORD"}
                  onChanged={detailResource.reload}
                />
              )}
            </div>

            {/* Right Column: Timeline history */}
            <aside className="inc-history-card">
              <div className="inc-history-title">
                <History size={15} style={{ color: "var(--inc-primary)" }} />
                <span>Lịch sử luồng trạng thái</span>
              </div>

              <div className="inc-history-timeline">
                {data.statusHistory?.map((h, idx) => (
                  <div className="inc-timeline-item" key={idx}>
                    <span className="inc-timeline-dot" />
                    <strong style={{ display: "block", color: "#0f172a" }}>
                      {STATUS_LABELS[h.status] || h.status}
                    </strong>
                    <span style={{ fontSize: "11.5px", color: "#64748b" }}>
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
            </aside>
          </div>
        )}
      </div>

      <footer className="modal-footer">
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
              disabled={waitingForQuote}
              title={
                waitingForQuote
                  ? "Cần người thuê đồng ý báo giá trước khi bắt đầu xử lý"
                  : undefined
              }
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              <Wrench size={14} />
              <span>
                {waitingForQuote ? "Chờ người thuê duyệt giá" : "Tiếp nhận sự cố"}
              </span>
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
            {!tenantPays && (
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
            )}
          </>
        )}
      </footer>
    </Modal>
  );
}
