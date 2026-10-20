import { useEffect, useState, useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  AlertTriangle,
  Clock,
  Wrench,
  CheckCircle2,
  XCircle,
  Plus,
  Building,
  User,
  Image as ImageIcon,
  DollarSign,
  History,
  FileText,
  Trash2,
  ArrowRight,
  ExternalLink,
  ShieldAlert,
} from "lucide-react";
import {
  branchApi,
  roomApi,
  incidentApi,
  staffApi,
  errorMessage,
} from "../../services/api";
import { useResource } from "../../hooks/useResource";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import {
  Badge,
  Button,
  PageHeader,
  LoadingState,
  ErrorState,
  EmptyState,
  Pagination,
  Modal,
  Field,
  SelectField,
} from "../../components/ui";
import { money } from "../../utils/format";
import "./Incidents.css";

const STATUS_LABELS = {
  PENDING: "Chờ tiếp nhận",
  IN_PROGRESS: "Đang xử lý",
  SOLVED: "Đã khắc phục",
  CLOSED: "Hoàn tất đóng",
  REJECTED: "Đã từ chối",
};

const PRIORITY_LABELS = {
  LOW: "Thấp",
  MEDIUM: "Trung bình",
  HIGH: "Cao",
  URGENT: "Khẩn cấp",
};

const COST_PAYER_LABELS = {
  LANDLORD: "Chủ trọ thanh toán",
  TENANT: "Khách thuê chi trả",
  NONE: "Miễn phí / Bảo hành",
};

export default function IncidentsPage() {
  const { user, selectedBranchId, setSelectedBranchId } = useAuth();
  const isTenant = user?.role === "TENANT";
  const isLandlord = user?.role === "LANDLORD";
  const isManager = user?.role === "PROPERTY_MANAGER";
  const isStaff = isLandlord || isManager;

  const [params, setParams] = useSearchParams();
  const toast = useToast();

  const branchOptions = useResource(isStaff ? branchApi.options : () => Promise.resolve([]));
  const branches = branchOptions.data || [];
  const requestedBranchId = selectedBranchId || params.get("branchId") || "";
  const isValidBranch = branches.some((b) => b._id === requestedBranchId);
  const branchId = isStaff ? (isValidBranch ? requestedBranchId : "") : "";

  useEffect(() => {
    if (isStaff && branches.length > 0 && selectedBranchId) {
      const exists = branches.some((b) => b._id === selectedBranchId);
      if (!exists) {
        setSelectedBranchId(branches[0]._id);
      }
    }
  }, [isStaff, branches, selectedBranchId, setSelectedBranchId]);

  const [status, setStatus] = useState(params.get("status") || "");
  const [priority, setPriority] = useState("");
  const [page, setPage] = useState(1);

  // Modals
  const [creating, setCreating] = useState(false);
  const [viewingDetail, setViewingDetail] = useState(null); // incident detail
  const [transitioning, setTransitioning] = useState(null); // { incident, targetStatus }
  const [editingCost, setEditingCost] = useState(null); // incident for cost

  // Fetch incidents list
  const incidentResource = useResource(
    () =>
      incidentApi.list({
        branchId: branchId || undefined,
        status: status || undefined,
        priority: priority || undefined,
        page,
        limit: 15,
      }),
    [branchId, status, priority, page],
  );

  const items = incidentResource.data?.items || [];
  const stats = incidentResource.data?.stats || {};
  const total = incidentResource.data?.total || 0;

  return (
    <div className="inc-container">
      <PageHeader
        title={isTenant ? "Phản ánh & Báo sự cố" : "Quản lý Sự cố & Bảo trì"}
        description={
          isTenant
            ? "Gửi báo cáo hư hỏng thiết bị, điện nước trong phòng để ban quản lý hỗ trợ xử lý kịp thời."
            : "Theo dõi phản ánh của cư dân, điều phối thợ sửa chữa và ghi nhận chi phí nghiệm thu."
        }
      />

      {/* 5 KPI Metric Cards */}
      <div className="inc-kpi-grid">
        <div
          className={`inc-kpi-card ${status === "PENDING" ? "is-active" : ""}`}
          onClick={() => {
            setStatus(status === "PENDING" ? "" : "PENDING");
            setPage(1);
          }}
        >
          <div className="inc-kpi-top">
            <span className="inc-kpi-label">Chờ tiếp nhận</span>
            <Clock size={16} color="#d97706" />
          </div>
          <div className="inc-kpi-val" style={{ color: "#d97706" }}>
            {stats.PENDING || 0}
          </div>
          <span style={{ fontSize: "11px", color: "var(--inc-text-muted)" }}>
            Sự cố mới báo
          </span>
        </div>

        <div
          className={`inc-kpi-card ${status === "IN_PROGRESS" ? "is-active" : ""}`}
          onClick={() => {
            setStatus(status === "IN_PROGRESS" ? "" : "IN_PROGRESS");
            setPage(1);
          }}
        >
          <div className="inc-kpi-top">
            <span className="inc-kpi-label">Đang xử lý</span>
            <Wrench size={16} color="#4f46e5" />
          </div>
          <div className="inc-kpi-val" style={{ color: "#4f46e5" }}>
            {stats.IN_PROGRESS || 0}
          </div>
          <span style={{ fontSize: "11px", color: "var(--inc-text-muted)" }}>
            Đang sửa chữa
          </span>
        </div>

        <div
          className={`inc-kpi-card ${status === "SOLVED" ? "is-active" : ""}`}
          onClick={() => {
            setStatus(status === "SOLVED" ? "" : "SOLVED");
            setPage(1);
          }}
        >
          <div className="inc-kpi-top">
            <span className="inc-kpi-label">Đã khắc phục</span>
            <CheckCircle2 size={16} color="#16a34a" />
          </div>
          <div className="inc-kpi-val" style={{ color: "#16a34a" }}>
            {stats.SOLVED || 0}
          </div>
          <span style={{ fontSize: "11px", color: "var(--inc-text-muted)" }}>
            Chờ nghiệm thu & chi phí
          </span>
        </div>

        <div
          className={`inc-kpi-card ${status === "CLOSED" ? "is-active" : ""}`}
          onClick={() => {
            setStatus(status === "CLOSED" ? "" : "CLOSED");
            setPage(1);
          }}
        >
          <div className="inc-kpi-top">
            <span className="inc-kpi-label">Hoàn tất đóng</span>
            <CheckCircle2 size={16} color="#475569" />
          </div>
          <div className="inc-kpi-val" style={{ color: "#475569" }}>
            {stats.CLOSED || 0}
          </div>
          <span style={{ fontSize: "11px", color: "var(--inc-text-muted)" }}>
            Đã thanh toán/đóng hồ sơ
          </span>
        </div>

        <div
          className={`inc-kpi-card ${status === "REJECTED" ? "is-active" : ""}`}
          onClick={() => {
            setStatus(status === "REJECTED" ? "" : "REJECTED");
            setPage(1);
          }}
        >
          <div className="inc-kpi-top">
            <span className="inc-kpi-label">Từ chối</span>
            <XCircle size={16} color="#dc2626" />
          </div>
          <div className="inc-kpi-val" style={{ color: "#dc2626" }}>
            {stats.REJECTED || 0}
          </div>
          <span style={{ fontSize: "11px", color: "var(--inc-text-muted)" }}>
            Không giải quyết
          </span>
        </div>
      </div>

      {/* Toolbar */}
      <div className="inc-toolbar">
        <div className="inc-toolbar-left">
          {/* Branch select for staff */}
          {isStaff && branchOptions.data && (
            <select
              className="inc-select"
              value={branchId}
              onChange={(e) => {
                setParams(e.target.value ? { branchId: e.target.value } : {});
                setPage(1);
              }}
            >
              <option value="">Tất cả cơ sở</option>
              {branchOptions.data.map((b) => (
                <option key={b._id} value={b._id}>
                  {b.name}
                </option>
              ))}
            </select>
          )}

          {/* Status select */}
          <select
            className="inc-select"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
          >
            <option value="">Tất cả trạng thái</option>
            {Object.entries(STATUS_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>

          {/* Priority select */}
          <select
            className="inc-select"
            value={priority}
            onChange={(e) => {
              setPriority(e.target.value);
              setPage(1);
            }}
          >
            <option value="">Tất cả mức ưu tiên</option>
            {Object.entries(PRIORITY_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                Ưu tiên {v}
              </option>
            ))}
          </select>
        </div>

        <Button onClick={() => setCreating(true)}>
          <Plus size={16} /> Báo cáo sự cố mới
        </Button>
      </div>

      {/* Incident List */}
      {incidentResource.loading ? (
        <LoadingState />
      ) : incidentResource.error ? (
        <ErrorState
          message={incidentResource.error}
          retry={incidentResource.reload}
        />
      ) : !items.length ? (
        <EmptyState
          title="Không có sự cố nào"
          description="Chưa có báo cáo sự cố hoặc bảo trì phù hợp với bộ lọc."
          action={
            <Button onClick={() => setCreating(true)}>
              <Plus size={16} /> Tạo báo cáo sự cố
            </Button>
          }
        />
      ) : (
        <div className="inc-cards-grid">
          {items.map((inc) => (
            <article className="inc-card" key={inc._id}>
              {/* Header: Priority & Status */}
              <div className="inc-card-header">
                <span
                  className={`inc-priority-chip priority-${inc.priority.toLowerCase()}`}
                >
                  {PRIORITY_LABELS[inc.priority] || inc.priority}
                </span>

                <span
                  style={{
                    fontSize: "12px",
                    fontWeight: 600,
                    padding: "2px 8px",
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
                  }}
                >
                  {STATUS_LABELS[inc.status] || inc.status}
                </span>
              </div>

              {/* Title & Description */}
              <div>
                <h4 className="inc-card-title">{inc.title}</h4>
                <p className="inc-card-desc">{inc.description}</p>
              </div>

              {/* Location & Room */}
              <div style={{ fontSize: "12px", color: "var(--inc-text-muted)" }}>
                <strong>
                  Phòng {inc.roomId?.roomNumber || "—"} (Tầng{" "}
                  {inc.roomId?.floor || "1"})
                </strong>{" "}
                · {inc.branchId?.name || "Cơ sở"}
              </div>

              {/* Photos attached */}
              {inc.images?.length > 0 && (
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <ImageIcon size={14} color="var(--inc-text-muted)" />
                  <span style={{ fontSize: "12px", color: "var(--inc-text-muted)" }}>
                    {inc.images.length} ảnh đính kèm
                  </span>
                </div>
              )}

              {/* Cost summary if present */}
              {inc.repairCost !== undefined && (
                <div
                  style={{
                    padding: "6px 10px",
                    background: "#f8fafc",
                    borderRadius: "6px",
                    fontSize: "12px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <span>Chi phí sửa:</span>
                  <strong>{money(inc.repairCost)}</strong>
                  <span style={{ fontSize: "11px", color: "#64748b" }}>
                    ({COST_PAYER_LABELS[inc.costPayer] || inc.costPayer})
                  </span>
                </div>
              )}

              {/* Meta row: Reporter & Assignee */}
              <div className="inc-meta-row">
                <span>Báo bởi: {inc.reportedBy?.name || "Người dùng"}</span>
                <span>
                  Phụ trách: <strong>{inc.assignedTo?.name || "Chưa gán"}</strong>
                </span>
              </div>

              {/* Footer Actions */}
              <div className="inc-card-footer">
                <Button
                  variant="secondary"
                  compact
                  onClick={() => setViewingDetail(inc)}
                >
                  Chi tiết & Lịch sử
                </Button>

                {isStaff && inc.status === "PENDING" && (
                  <Button
                    compact
                    onClick={() =>
                      setTransitioning({
                        incident: inc,
                        targetStatus: "IN_PROGRESS",
                      })
                    }
                  >
                    Tiếp nhận
                  </Button>
                )}

                {isStaff && inc.status === "IN_PROGRESS" && (
                  <Button
                    compact
                    onClick={() =>
                      setTransitioning({
                        incident: inc,
                        targetStatus: "SOLVED",
                      })
                    }
                  >
                    Nghiệm thu
                  </Button>
                )}

                {isStaff && inc.status === "SOLVED" && (
                  <Button
                    compact
                    onClick={() =>
                      setTransitioning({
                        incident: inc,
                        targetStatus: "CLOSED",
                      })
                    }
                  >
                    Đóng sự cố
                  </Button>
                )}
              </div>
            </article>
          ))}
        </div>
      )}

      {/* Pagination */}
      {incidentResource.data && total > 15 && (
        <Pagination {...incidentResource.data} onChange={setPage} />
      )}

      {/* 1. Modal Create Incident */}
      {creating && (
        <CreateIncidentModal
          isTenant={isTenant}
          branches={branchOptions.data || []}
          onClose={() => setCreating(false)}
          onSuccess={() => {
            setCreating(false);
            incidentResource.reload();
          }}
        />
      )}

      {/* 2. Modal View Detail & History */}
      {viewingDetail && (
        <IncidentDetailModal
          incident={viewingDetail}
          isStaff={isStaff}
          onClose={() => setViewingDetail(null)}
          onEditCost={(inc) => {
            setEditingCost(inc);
          }}
          onTransition={(inc, target) => {
            setTransitioning({ incident: inc, targetStatus: target });
          }}
        />
      )}

      {/* 3. Modal Status Transition */}
      {transitioning && (
        <TransitionModal
          incident={transitioning.incident}
          targetStatus={transitioning.targetStatus}
          onClose={() => setTransitioning(null)}
          onSuccess={() => {
            setTransitioning(null);
            setViewingDetail(null);
            incidentResource.reload();
          }}
        />
      )}

      {/* 4. Modal Edit Cost */}
      {editingCost && (
        <UpdateCostModal
          incident={editingCost}
          isLandlord={isLandlord}
          onClose={() => setEditingCost(null)}
          onSuccess={() => {
            setEditingCost(null);
            setViewingDetail(null);
            incidentResource.reload();
          }}
        />
      )}
    </div>
  );
}

// =============================================================================
// SUB-MODAL 1: CREATE INCIDENT
// =============================================================================
function CreateIncidentModal({ isTenant, branches, onClose, onSuccess }) {
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
    () => (!isTenant && branchId ? roomApi.list(branchId, { limit: 100 }) : null),
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
        roomId: isTenant ? (roomId || undefined) : roomId,
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
            label="Mức độ ưu tiên"
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
            <label style={{ fontSize: "12px", fontWeight: 700, display: "block", marginBottom: "6px" }}>
              Ảnh chụp hiện trường sự cố (URL http/https)
            </label>
            <div style={{ display: "flex", gap: "8px" }}>
              <input
                type="url"
                placeholder="https://images.example.com/su-co-1.jpg"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                style={{ flex: 1, padding: "8px 12px", borderRadius: "8px", border: "1px solid #cbd5e1" }}
              />
              <Button type="button" variant="secondary" onClick={addImage}>
                <Plus size={15} /> Thêm ảnh
              </Button>
            </div>

            {images.length > 0 && (
              <div className="inc-thumb-grid">
                {images.map((img, i) => (
                  <div className="inc-thumb-item" key={i} style={{ position: "relative" }}>
                    <img src={img} alt={`ảnh ${i + 1}`} />
                    <button
                      type="button"
                      style={{
                        position: "absolute",
                        top: 2,
                        right: 2,
                        background: "rgba(0,0,0,0.6)",
                        color: "#fff",
                        border: "none",
                        borderRadius: "50%",
                        width: 18,
                        height: 18,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        cursor: "pointer",
                      }}
                      onClick={() => setImages((prev) => prev.filter((_, idx) => idx !== i))}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <footer className="modal-footer" style={{ marginTop: "20px" }}>
          <Button type="button" variant="secondary" onClick={onClose}>
            Hủy bỏ
          </Button>
          <Button busy={busy}>Gửi báo cáo sự cố</Button>
        </footer>
      </form>
    </Modal>
  );
}

// =============================================================================
// SUB-MODAL 2: INCIDENT DETAIL & TIMELINE
// =============================================================================
function IncidentDetailModal({ incident, isStaff, onClose, onEditCost, onTransition }) {
  const detailResource = useResource(() => incidentApi.get(incident._id), [incident._id]);
  const data = detailResource.data || incident;

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

            <p style={{ fontSize: "14px", lineHeight: 1.6, color: "var(--inc-text-main)" }}>
              {data.description}
            </p>

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
                {isStaff && (data.status === "IN_PROGRESS" || data.status === "SOLVED") && (
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
                  <span style={{ fontSize: "16px", fontWeight: 700, color: "var(--inc-primary-container)" }}>
                    {money(data.repairCost)}
                  </span>
                  <span style={{ fontSize: "13px", color: "#64748b", marginLeft: "8px" }}>
                    • Chịu phí: {COST_PAYER_LABELS[data.costPayer] || data.costPayer}
                  </span>
                  {data.notes && (
                    <p style={{ margin: "6px 0 0 0", fontSize: "12px", color: "#64748b" }}>
                      Ghi chú: {data.notes}
                    </p>
                  )}
                </div>
              ) : (
                <span style={{ fontSize: "12px", color: "#64748b", fontStyle: "italic" }}>
                  Chưa ghi nhận chi phí sửa chữa.
                </span>
              )}
            </div>
          </div>

          {/* Right Column: Timeline history */}
          <div>
            <strong style={{ fontSize: "13px", display: "flex", alignItems: "center", gap: "6px" }}>
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
                    {h.changedAt ? new Date(h.changedAt).toLocaleString("vi-VN") : "—"}
                  </span>
                  {h.note && (
                    <p style={{ margin: "4px 0 0 0", fontSize: "12px", color: "#334155" }}>
                      "{h.note}"
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <footer className="modal-footer" style={{ marginTop: "24px" }}>
        <Button variant="secondary" onClick={onClose}>
          Đóng
        </Button>

        {/* Transition Buttons */}
        {isStaff && data.status === "PENDING" && (
          <>
            <Button
              variant="danger"
              onClick={() => onTransition(data, "REJECTED")}
            >
              Từ chối
            </Button>
            <Button onClick={() => onTransition(data, "IN_PROGRESS")}>
              Tiếp nhận sự cố
            </Button>
          </>
        )}

        {isStaff && data.status === "IN_PROGRESS" && (
          <Button onClick={() => onTransition(data, "SOLVED")}>
            Nghiệm thu hoàn tất
          </Button>
        )}

        {isStaff && data.status === "SOLVED" && (
          <>
            <Button
              variant="secondary"
              onClick={() => onTransition(data, "IN_PROGRESS")}
            >
              Mở lại sự cố
            </Button>
            <Button onClick={() => onTransition(data, "CLOSED")}>
              Đóng hồ sơ sự cố
            </Button>
          </>
        )}
      </footer>
    </Modal>
  );
}

// =============================================================================
// SUB-MODAL 3: TRANSITION STATUS
// =============================================================================
function TransitionModal({ incident, targetStatus, onClose, onSuccess }) {
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

    if (targetStatus === "CLOSED" && incident.costUpdatedAt === undefined && incident.repairCost === undefined) {
      toast.error("Vui lòng ghi nhận chi phí sửa chữa trước khi đóng hồ sơ sự cố.");
      return;
    }

    setBusy(true);
    try {
      await incidentApi.updateStatus(incident._id, {
        status: targetStatus,
        note: note.trim() || undefined,
        resolvedImages: resolvedImages.length > 0 ? resolvedImages : undefined,
      });

      toast.success(`Đã chuyển trạng thái sự cố sang: ${STATUS_LABELS[targetStatus]}`);
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
            <label style={{ fontSize: "12px", fontWeight: 700, display: "block", marginBottom: "6px" }}>
              Ảnh nghiệm thu kết quả sửa chữa (Bắt buộc ít nhất 1 ảnh) *
            </label>
            <div style={{ display: "flex", gap: "8px" }}>
              <input
                type="url"
                placeholder="https://images.example.com/nghiem-thu.jpg"
                value={resolvedImageUrl}
                onChange={(e) => setResolvedImageUrl(e.target.value)}
                style={{ flex: 1, padding: "8px 12px", borderRadius: "8px", border: "1px solid #cbd5e1" }}
              />
              <Button type="button" variant="secondary" onClick={addResolvedImage}>
                Thêm ảnh
              </Button>
            </div>

            {resolvedImages.length > 0 && (
              <div className="inc-thumb-grid">
                {resolvedImages.map((img, i) => (
                  <div className="inc-thumb-item" key={i}>
                    <img src={img} alt="Nghiệm thu" />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <Field label={targetStatus === "REJECTED" ? "Lý do từ chối (Bắt buộc) *" : "Ghi chú quá trình xử lý"}>
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
          <Button type="button" variant="secondary" onClick={onClose}>
            Hủy bỏ
          </Button>
          <Button
            busy={busy}
            variant={targetStatus === "REJECTED" ? "danger" : undefined}
          >
            Xác nhận
          </Button>
        </footer>
      </form>
    </Modal>
  );
}

// =============================================================================
// SUB-MODAL 4: UPDATE REPAIR COST
// =============================================================================
function UpdateCostModal({ incident, isLandlord, onClose, onSuccess }) {
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
          <Button type="button" variant="secondary" onClick={onClose}>
            Hủy bỏ
          </Button>
          <Button busy={busy}>Lưu chi phí</Button>
        </footer>
      </form>
    </Modal>
  );
}
