import {
  Flame,
  AlertTriangle,
  Info,
  Tags,
  DoorOpen,
  Building2,
  Image as ImageIcon,
  Banknote,
  User,
  Wrench,
  Eye,
  CheckCircle2,
  CheckCheck,
} from "lucide-react";
import { Button } from "../ui";
import { money } from "../../utils/format";
import {
  STATUS_LABELS,
  PRIORITY_LABELS,
  CATEGORY_LABELS,
  COST_PAYER_LABELS,
} from "../../hooks/useIncidentsPage";

export default function IncidentsCardGrid({
  items,
  isStaff,
  onViewDetail,
  onTransition,
}) {
  return (
    <div className="inc-cards-grid">
      {items.map((inc) => (
        <article className="inc-card" key={inc._id}>
          {/* Header: Priority & Status */}
          <div className="inc-card-header">
            <span
              className={`inc-priority-chip priority-${inc.priority?.toLowerCase()}`}
            >
              {inc.priority === "URGENT" && <Flame size={12} />}
              {inc.priority === "HIGH" && <AlertTriangle size={12} />}
              {inc.priority === "MEDIUM" && <Info size={12} />}
              <span>{PRIORITY_LABELS[inc.priority] || inc.priority}</span>
            </span>

            <span
              style={{
                fontSize: "12px",
                fontWeight: 600,
                padding: "3px 10px",
                borderRadius: "9999px",
                background:
                  inc.status === "SOLVED"
                    ? "#ecfdf5"
                    : inc.status === "IN_PROGRESS"
                      ? "#f0fdf4"
                      : inc.status === "PENDING"
                        ? "#fffbeb"
                        : inc.status === "REJECTED"
                          ? "#fef2f2"
                          : "#f1f5f9",
                color:
                  inc.status === "SOLVED"
                    ? "#047857"
                    : inc.status === "IN_PROGRESS"
                      ? "#15803d"
                      : inc.status === "PENDING"
                        ? "#b45309"
                        : inc.status === "REJECTED"
                          ? "#b91c1c"
                          : "#475569",
                border: "1px solid currentColor",
                borderColor:
                  inc.status === "SOLVED"
                    ? "#a7f3d0"
                    : inc.status === "IN_PROGRESS"
                      ? "#bbf7d0"
                      : inc.status === "PENDING"
                        ? "#fde68a"
                        : inc.status === "REJECTED"
                          ? "#fecaca"
                          : "#e2e8f0",
              }}
            >
              {STATUS_LABELS[inc.status] || inc.status}
            </span>
          </div>

          {(inc.category || inc.triage?.needsReview) && (
            <div className="inc-triage-row">
              {inc.category && (
                <span className="inc-category-chip">
                  <Tags size={12} />
                  {CATEGORY_LABELS[inc.category] || inc.category}
                </span>
              )}
              {isStaff && inc.triage?.needsReview && (
                <span
                  className="inc-review-chip"
                  title="Phân loại tự động chưa chắc chắn, nên kiểm tra lại"
                >
                  <AlertTriangle size={12} />
                  Cần xem lại
                </span>
              )}
            </div>
          )}

          {/* Title & Description */}
          <div>
            <h4 className="inc-card-title">{inc.title}</h4>
            <p className="inc-card-desc">{inc.description}</p>
          </div>

          {/* Location & Room */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              fontSize: "12.5px",
              color: "var(--inc-text-muted)",
            }}
          >
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "4px",
                color: "var(--neutral-800)",
                fontWeight: "600",
              }}
            >
              <DoorOpen
                size={14}
                style={{ color: "var(--primary, #005c55)" }}
              />
              Phòng {inc.roomId?.roomNumber || "—"} (Tầng{" "}
              {inc.roomId?.floor || "1"})
            </span>
            <span>•</span>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "4px",
              }}
            >
              <Building2 size={13} />
              {inc.branchId?.name || "Cơ sở"}
            </span>
          </div>

          {/* Photos attached with thumbnail preview */}
          {inc.images?.length > 0 && (
            <div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  marginBottom: "6px",
                }}
              >
                <ImageIcon size={14} color="var(--inc-text-muted)" />
                <span
                  style={{
                    fontSize: "12px",
                    color: "var(--inc-text-muted)",
                  }}
                >
                  {inc.images.length} ảnh đính kèm
                </span>
              </div>
              <div style={{ display: "flex", gap: "6px", overflowX: "auto" }}>
                {inc.images.slice(0, 3).map((img, idx) => (
                  <div
                    key={idx}
                    style={{
                      width: "56px",
                      height: "44px",
                      borderRadius: "6px",
                      overflow: "hidden",
                      border: "1px solid #e2e8f0",
                      flexShrink: 0,
                    }}
                  >
                    <img
                      src={img}
                      alt="Đính kèm"
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                      }}
                    />
                  </div>
                ))}
                {inc.images.length > 3 && (
                  <div
                    style={{
                      width: "44px",
                      height: "44px",
                      borderRadius: "6px",
                      background: "#f1f5f9",
                      border: "1px solid #e2e8f0",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "11px",
                      fontWeight: 700,
                      color: "#64748b",
                      flexShrink: 0,
                    }}
                  >
                    +{inc.images.length - 3}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Cost summary if present */}
          {inc.repairCost !== undefined && (
            <div
              style={{
                padding: "8px 12px",
                background: "#f8fafc",
                borderRadius: "8px",
                fontSize: "12px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                border: "1px solid #e2e8f0",
              }}
            >
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "5px",
                }}
              >
                <Banknote size={14} style={{ color: "#059669" }} />
                <span>Chi phí:</span>
              </span>
              <strong>{money(inc.repairCost)}</strong>
              <span style={{ fontSize: "11px", color: "#64748b" }}>
                ({COST_PAYER_LABELS[inc.costPayer] || inc.costPayer})
              </span>
            </div>
          )}

          {/* Meta row: Reporter & Assignee */}
          <div className="inc-meta-row">
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "4px",
              }}
            >
              <User size={13} />
              <span>{inc.reportedBy?.name || "Người dùng"}</span>
            </span>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "4px",
              }}
            >
              <Wrench size={13} />
              <span>{inc.assignedTo?.name || "Chưa phân công"}</span>
            </span>
          </div>

          {/* Footer Actions */}
          <div className="inc-card-footer">
            <Button
              variant="secondary"
              compact
              onClick={() => onViewDetail(inc)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "5px",
              }}
            >
              <Eye size={14} />
              <span>Chi tiết & Lịch sử</span>
            </Button>

            {isStaff && inc.status === "PENDING" && (
              <Button
                compact
                onClick={() =>
                  onTransition({
                    incident: inc,
                    targetStatus: "IN_PROGRESS",
                  })
                }
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "5px",
                }}
              >
                <Wrench size={14} />
                <span>Tiếp nhận</span>
              </Button>
            )}

            {isStaff && inc.status === "IN_PROGRESS" && (
              <Button
                compact
                onClick={() =>
                  onTransition({
                    incident: inc,
                    targetStatus: "SOLVED",
                  })
                }
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "5px",
                }}
              >
                <CheckCircle2 size={14} />
                <span>Nghiệm thu</span>
              </Button>
            )}

            {isStaff && inc.status === "SOLVED" && (
              <Button
                compact
                onClick={() =>
                  onTransition({
                    incident: inc,
                    targetStatus: "CLOSED",
                  })
                }
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "5px",
                }}
              >
                <CheckCheck size={14} />
                <span>Đóng sự cố</span>
              </Button>
            )}
          </div>
        </article>
      ))}
    </div>
  );
}

