import { useState, useMemo, useEffect } from "react";
import { useSearchParams, Link } from "react-router-dom";
import {
  Zap,
  Droplets,
  CheckCircle2,
  Clock,
  Lock,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  Building,
  Calendar,
  Grid2X2,
  List,
  Edit2,
  Camera,
  ExternalLink,
  Layers,
  ArrowRight,
} from "lucide-react";
import { branchApi, utilityReadingApi, errorMessage } from "../../services/api";
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
  Modal,
} from "../../components/ui";
import "./UtilityReadings.css";

// Vietnam UTC+7 current period YYYY-MM
const getCurrentPeriod = () =>
  new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 7);

export default function UtilityReadingsPage() {
  const { user, selectedBranchId, setSelectedBranchId } = useAuth();
  const options = useResource(branchApi.options);
  const [params, setParams] = useSearchParams();
  const toast = useToast();

  const branches = options.data || [];
  const requestedBranchId = selectedBranchId || params.get("branchId") || "";
  const isValidBranch = branches.some((item) => item._id === requestedBranchId);
  const branchId = isValidBranch ? requestedBranchId : branches[0]?._id || "";
  const branch = branches.find((b) => b._id === branchId);

  useEffect(() => {
    if (branches.length > 0) {
      const exists = branches.some((item) => item._id === selectedBranchId);
      if (!exists) {
        setSelectedBranchId(branches[0]._id);
      }
    }
  }, [branches, selectedBranchId, setSelectedBranchId]);

  const [billingPeriod, setBillingPeriod] = useState(
    params.get("billingPeriod") || getCurrentPeriod(),
  );
  const [filterStatus, setFilterStatus] = useState("ALL"); // ALL | PENDING | RECORDED
  const [viewMode, setViewMode] = useState("wizard"); // wizard (nhập 1 tay) | table (danh sách)
  const [currentIndex, setCurrentIndex] = useState(0);

  // Resource for reading list
  const readingResource = useResource(
    () => (branchId ? utilityReadingApi.list(branchId, { billingPeriod }) : null),
    [branchId, billingPeriod],
  );

  // Abnormal confirmation state
  const [abnormalWarning, setAbnormalWarning] = useState(null); // { payload, details }

  // Quick form input states for current room
  const [inputValues, setInputValues] = useState({});
  const [submitting, setSubmitting] = useState(false);

  const items = readingResource.data?.items || [];
  const stats = readingResource.data?.stats || {
    total: 0,
    recorded: 0,
    pending: 0,
    billed: 0,
  };

  // Filtered items based on filterStatus
  const filteredItems = useMemo(() => {
    if (filterStatus === "PENDING") return items.filter((i) => !i.reading);
    if (filterStatus === "RECORDED") return items.filter((i) => Boolean(i.reading));
    return items;
  }, [items, filterStatus]);

  // Current active item for wizard mode
  const activeItem = filteredItems[currentIndex] || filteredItems[0] || null;

  // Periods for dropdown selector (current month and last 5 months)
  const availablePeriods = useMemo(() => {
    const list = [];
    const now = new Date();
    for (let i = 0; i < 6; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      list.push(d.toISOString().slice(0, 7));
    }
    return list;
  }, []);

  // Handle input change for a room
  function handleInputChange(roomId, field, value) {
    setInputValues((prev) => ({
      ...prev,
      [roomId]: {
        ...prev[roomId],
        [field]: value,
      },
    }));
  }

  // Get current working values for an item
  function getItemValues(item) {
    if (!item) return {};
    const local = inputValues[item.room.id] || {};
    return {
      electricNewIndex:
        local.electricNewIndex !== undefined
          ? local.electricNewIndex
          : item.reading?.newElectricIndex !== undefined
          ? item.reading.newElectricIndex
          : "",
      waterNewIndex:
        local.waterNewIndex !== undefined
          ? local.waterNewIndex
          : item.reading?.newWaterIndex !== undefined
          ? item.reading.newWaterIndex
          : "",
      electricImage:
        local.electricImage !== undefined
          ? local.electricImage
          : item.reading?.electricImage || "",
      waterImage:
        local.waterImage !== undefined
          ? local.waterImage
          : item.reading?.waterImage || "",
    };
  }

  // Submit reading (create or update)
  async function submitReading(item, confirmAbnormal = false) {
    if (!item) return;
    const vals = getItemValues(item);

    if (vals.electricNewIndex === "") {
      toast.error("Vui lòng nhập chỉ số điện mới.");
      return;
    }

    const isMeterWater = item.waterBillingType === "METER";
    if (isMeterWater && vals.waterNewIndex === "") {
      toast.error("Phòng tính nước theo đồng hồ, vui lòng nhập chỉ số nước mới.");
      return;
    }

    setSubmitting(true);
    const payload = {
      branchId,
      roomId: item.room.id,
      billingPeriod,
      electricNewIndex: Number(vals.electricNewIndex),
      waterNewIndex:
        vals.waterNewIndex !== "" ? Number(vals.waterNewIndex) : undefined,
      electricImage: vals.electricImage || undefined,
      waterImage: vals.waterImage || undefined,
      confirmAbnormal,
    };

    try {
      if (item.reading) {
        // PUT update
        await utilityReadingApi.update(item.reading.id, {
          electricNewIndex: payload.electricNewIndex,
          waterNewIndex: payload.waterNewIndex,
          electricImage: payload.electricImage,
          waterImage: payload.waterImage,
          confirmAbnormal,
        });
        toast.success(`Đã cập nhật chỉ số phòng ${item.room.roomNumber}!`);
      } else {
        // POST create
        await utilityReadingApi.create(payload);
        toast.success(`Đã chốt số phòng ${item.room.roomNumber} thành công!`);
      }

      setAbnormalWarning(null);
      await readingResource.reload();

      // In wizard mode, automatically advance to next pending room
      if (viewMode === "wizard" && currentIndex < filteredItems.length - 1) {
        setCurrentIndex((prev) => prev + 1);
      }
    } catch (err) {
      const resp = err.response?.data;
      if (err.response?.status === 409 && resp?.errorCode === "READING_ABNORMAL_INCREASE") {
        // Show abnormal modal
        setAbnormalWarning({
          item,
          payload,
          details: resp.data || {},
        });
      } else {
        toast.error(errorMessage(err));
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="util-container">
      <PageHeader
        title="Chốt số Điện & Nước theo kỳ"
        description="Ghi nhận chỉ số công tơ, phát hiện tiêu thụ bất thường và đồng bộ hóa đơn hàng tháng."
      />

      {options.loading ? (
        <LoadingState />
      ) : options.error ? (
        <ErrorState message={options.error} retry={options.reload} />
      ) : !options.data.length ? (
        <EmptyState
          title={user?.role === "LANDLORD" ? "Bạn chưa có cơ sở nào" : "Bạn chưa được phân công cơ sở nào"}
          description={
            user?.role === "LANDLORD"
              ? "Tạo cơ sở đầu tiên để bắt đầu chốt số điện nước."
              : "Vui lòng liên hệ Chủ trọ để được cấp quyền quản lý cơ sở."
          }
          action={
            user?.role === "LANDLORD" ? (
              <Link className="button primary" to="/branches">
                Quản lý cơ sở <ArrowRight size={17} />
              </Link>
            ) : null
          }
        />
      ) : (
        <>
          {/* Header Bar */}
          <div className="util-header-bar">
            <div className="util-header-left">
              <div className="util-header-icon">
                <Zap size={22} />
              </div>
              <div>
                <h3 className="util-header-title">
                  {branch?.name}
                  <span
                    style={{
                      fontSize: "12px",
                      padding: "2px 8px",
                      borderRadius: "9999px",
                      background: "#e0f2fe",
                      color: "#0369a1",
                    }}
                  >
                    Kỳ: {billingPeriod}
                  </span>
                </h3>
                <p className="util-header-sub">
                  {branch?.address?.fullAddress || "Chuỗi căn hộ DOMUS ERP"}
                </p>
              </div>
            </div>

            <div className="util-header-controls">
              {/* Period Dropdown */}
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <Calendar size={16} color="var(--util-text-muted)" />
                <select
                  className="util-period-select"
                  value={billingPeriod}
                  onChange={(e) => {
                    setBillingPeriod(e.target.value);
                    setCurrentIndex(0);
                  }}
                >
                  {availablePeriods.map((p) => (
                    <option key={p} value={p}>
                      Kỳ {p} {p === getCurrentPeriod() ? "(Hiện tại)" : ""}
                    </option>
                  ))}
                </select>
              </div>

              {/* View Switcher */}
              <div
                style={{
                  display: "flex",
                  background: "#f1f5f9",
                  padding: "3px",
                  borderRadius: "8px",
                }}
              >
                <button
                  type="button"
                  style={{
                    padding: "6px 10px",
                    borderRadius: "6px",
                    border: "none",
                    background: viewMode === "wizard" ? "#ffffff" : "transparent",
                    color:
                      viewMode === "wizard"
                        ? "var(--util-primary-container)"
                        : "var(--util-text-muted)",
                    boxShadow:
                      viewMode === "wizard" ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    fontSize: "12px",
                    fontWeight: 600,
                  }}
                  onClick={() => setViewMode("wizard")}
                >
                  <Grid2X2 size={14} /> Duyệt 1 tay
                </button>
                <button
                  type="button"
                  style={{
                    padding: "6px 10px",
                    borderRadius: "6px",
                    border: "none",
                    background: viewMode === "table" ? "#ffffff" : "transparent",
                    color:
                      viewMode === "table"
                        ? "var(--util-primary-container)"
                        : "var(--util-text-muted)",
                    boxShadow:
                      viewMode === "table" ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    fontSize: "12px",
                    fontWeight: 600,
                  }}
                  onClick={() => setViewMode("table")}
                >
                  <List size={14} /> Bảng chi tiết
                </button>
              </div>
            </div>
          </div>

          {/* 4 KPI Cards */}
          <div className="util-kpi-grid">
            <div
              className={`util-kpi-card ${filterStatus === "ALL" ? "is-active" : ""}`}
              onClick={() => {
                setFilterStatus("ALL");
                setCurrentIndex(0);
              }}
            >
              <div className="util-kpi-top">
                <span className="util-kpi-label">Tổng phòng kỳ này</span>
                <div
                  className="util-kpi-icon"
                  style={{ background: "#f1f5f9", color: "#475569" }}
                >
                  <Layers size={17} />
                </div>
              </div>
              <div className="util-kpi-val">{stats.total}</div>
              <div className="util-kpi-sub">Bao gồm phòng thuê & đã chốt</div>
            </div>

            <div
              className={`util-kpi-card ${filterStatus === "RECORDED" ? "is-active" : ""}`}
              onClick={() => {
                setFilterStatus("RECORDED");
                setCurrentIndex(0);
              }}
            >
              <div className="util-kpi-top">
                <span className="util-kpi-label">Đã chốt số</span>
                <div
                  className="util-kpi-icon"
                  style={{ background: "#ecfdf5", color: "#059669" }}
                >
                  <CheckCircle2 size={17} />
                </div>
              </div>
              <div className="util-kpi-val" style={{ color: "#059669" }}>
                {stats.recorded}
              </div>
              <div className="util-kpi-sub">
                {stats.total ? Math.round((stats.recorded / stats.total) * 100) : 0}%
                tiến độ hoàn thành
              </div>
            </div>

            <div
              className={`util-kpi-card ${filterStatus === "PENDING" ? "is-active" : ""}`}
              onClick={() => {
                setFilterStatus("PENDING");
                setCurrentIndex(0);
              }}
            >
              <div className="util-kpi-top">
                <span className="util-kpi-label">Chưa chốt số</span>
                <div
                  className="util-kpi-icon"
                  style={{ background: "#fffbeb", color: "#d97706" }}
                >
                  <Clock size={17} />
                </div>
              </div>
              <div className="util-kpi-val" style={{ color: "#d97706" }}>
                {stats.pending}
              </div>
              <div className="util-kpi-sub">Cần nhập số đo tháng này</div>
            </div>

            <div className="util-kpi-card">
              <div className="util-kpi-top">
                <span className="util-kpi-label">Đã lập hóa đơn</span>
                <div
                  className="util-kpi-icon"
                  style={{ background: "#f5f3ff", color: "#7c3aed" }}
                >
                  <Lock size={17} />
                </div>
              </div>
              <div className="util-kpi-val" style={{ color: "#7c3aed" }}>
                {stats.billed}
              </div>
              <div className="util-kpi-sub">Chỉ số đã khóa sổ hóa đơn</div>
            </div>
          </div>

          {/* Filter Pills */}
          <div className="util-filter-bar">
            <div className="util-filter-tabs">
              <button
                type="button"
                className={`util-tab-btn ${filterStatus === "ALL" ? "is-active" : ""}`}
                onClick={() => {
                  setFilterStatus("ALL");
                  setCurrentIndex(0);
                }}
              >
                Tất cả phòng ({items.length})
              </button>
              <button
                type="button"
                className={`util-tab-btn ${filterStatus === "PENDING" ? "is-active" : ""}`}
                onClick={() => {
                  setFilterStatus("PENDING");
                  setCurrentIndex(0);
                }}
              >
                Chưa chốt ({stats.pending})
              </button>
              <button
                type="button"
                className={`util-tab-btn ${filterStatus === "RECORDED" ? "is-active" : ""}`}
                onClick={() => {
                  setFilterStatus("RECORDED");
                  setCurrentIndex(0);
                }}
              >
                Đã chốt ({stats.recorded})
              </button>
            </div>

            <span style={{ fontSize: "13px", color: "var(--util-text-muted)" }}>
              {filteredItems.length} phòng đang hiển thị
            </span>
          </div>

          {/* Content Views */}
          {readingResource.loading ? (
            <LoadingState />
          ) : readingResource.error ? (
            <ErrorState
              message={readingResource.error}
              retry={readingResource.reload}
            />
          ) : !filteredItems.length ? (
            <EmptyState
              title="Không có phòng nào trong danh sách"
              description="Hãy kiểm tra lại cơ sở, kỳ chốt số hoặc bộ lọc trạng thái."
            />
          ) : viewMode === "wizard" && activeItem ? (
            /* =================================================================
               1. HANDHELD QUICK ENTRY CAROUSEL / STEP WIZARD
               ================================================================= */
            <div className="util-wizard-box">
              <div className="util-wizard-header">
                <div>
                  <div className="util-wizard-room-title">
                    Phòng {activeItem.room.roomNumber}
                    <span
                      style={{
                        fontSize: "12px",
                        fontWeight: 600,
                        padding: "2px 10px",
                        borderRadius: "9999px",
                        background: "#f1f5f9",
                        color: "#475569",
                      }}
                    >
                      Tầng {activeItem.room.floor}
                    </span>
                    {activeItem.reading?.isBilled ? (
                      <span
                        style={{
                          fontSize: "12px",
                          fontWeight: 600,
                          padding: "2px 10px",
                          borderRadius: "9999px",
                          background: "#f5f3ff",
                          color: "#7c3aed",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "4px",
                        }}
                      >
                        <Lock size={12} /> Đã khóa sổ HĐ
                      </span>
                    ) : activeItem.reading ? (
                      <span
                        style={{
                          fontSize: "12px",
                          fontWeight: 600,
                          padding: "2px 10px",
                          borderRadius: "9999px",
                          background: "#ecfdf5",
                          color: "#059669",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "4px",
                        }}
                      >
                        <CheckCircle2 size={12} /> Đã ghi số
                      </span>
                    ) : (
                      <span
                        style={{
                          fontSize: "12px",
                          fontWeight: 600,
                          padding: "2px 10px",
                          borderRadius: "9999px",
                          background: "#fffbeb",
                          color: "#d97706",
                        }}
                      >
                        Chưa chốt
                      </span>
                    )}
                  </div>
                  <span style={{ fontSize: "13px", color: "var(--util-text-muted)" }}>
                    Phòng {currentIndex + 1} / {filteredItems.length}
                  </span>
                </div>

                {/* Pagination Controls */}
                <div style={{ display: "flex", gap: "8px" }}>
                  <Button
                    variant="secondary"
                    compact
                    disabled={currentIndex === 0}
                    onClick={() => setCurrentIndex((prev) => Math.max(0, prev - 1))}
                  >
                    <ChevronLeft size={16} /> Phòng trước
                  </Button>
                  <Button
                    variant="secondary"
                    compact
                    disabled={currentIndex === filteredItems.length - 1}
                    onClick={() =>
                      setCurrentIndex((prev) =>
                        Math.min(filteredItems.length - 1, prev + 1),
                      )
                    }
                  >
                    Phòng kế tiếp <ChevronRight size={16} />
                  </Button>
                </div>
              </div>

              {/* Meter Input Cards */}
              {(() => {
                const vals = getItemValues(activeItem);
                const isMeterWater = activeItem.waterBillingType === "METER";

                const elecDiff =
                  vals.electricNewIndex !== ""
                    ? Number(vals.electricNewIndex) -
                      activeItem.previousElectricIndex
                    : null;
                const waterDiff =
                  isMeterWater && vals.waterNewIndex !== ""
                    ? Number(vals.waterNewIndex) - activeItem.previousWaterIndex
                    : null;

                const isLocked = activeItem.reading?.isBilled;

                return (
                  <div>
                    <div className="util-meter-card-grid">
                      {/* 1. Electric Meter Card */}
                      <div className="util-meter-card electric">
                        <div className="util-meter-title">
                          <span
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "6px",
                            }}
                          >
                            <Zap size={18} color="#d97706" />
                            Đồng hồ Điện (kWh)
                          </span>
                          {elecDiff !== null && (
                            <span
                              className={`util-consumed-badge ${
                                elecDiff >= 0 ? "positive" : "warning"
                              }`}
                            >
                              Tiêu thụ: {elecDiff >= 0 ? `+${elecDiff}` : elecDiff}{" "}
                              kWh
                            </span>
                          )}
                        </div>

                        <div className="util-index-row">
                          <div className="util-index-box">
                            <span className="util-index-label">Chỉ số cũ</span>
                            <div className="util-old-val">
                              {activeItem.previousElectricIndex}
                            </div>
                          </div>
                          <div className="util-index-box">
                            <span className="util-index-label">Chỉ số mới</span>
                            <input
                              type="number"
                              min={activeItem.previousElectricIndex}
                              className="util-new-input"
                              placeholder="Nhập số mới..."
                              disabled={isLocked || submitting}
                              value={vals.electricNewIndex}
                              onChange={(e) =>
                                handleInputChange(
                                  activeItem.room.id,
                                  "electricNewIndex",
                                  e.target.value,
                                )
                              }
                            />
                          </div>
                        </div>

                        {/* Image Link Input */}
                        <div className="util-image-field">
                          <Camera size={16} color="var(--util-text-muted)" />
                          <input
                            type="url"
                            placeholder="Link ảnh công tơ điện (http://...)"
                            disabled={isLocked || submitting}
                            value={vals.electricImage}
                            onChange={(e) =>
                              handleInputChange(
                                activeItem.room.id,
                                "electricImage",
                                e.target.value,
                              )
                            }
                          />
                          {vals.electricImage && (
                            <a
                              href={vals.electricImage}
                              target="_blank"
                              rel="noreferrer"
                              title="Xem ảnh"
                              style={{ color: "var(--util-primary-container)" }}
                            >
                              <ExternalLink size={16} />
                            </a>
                          )}
                        </div>
                      </div>

                      {/* 2. Water Meter Card */}
                      <div className="util-meter-card water">
                        <div className="util-meter-title">
                          <span
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "6px",
                            }}
                          >
                            <Droplets size={18} color="#0284c7" />
                            Đồng hồ Nước (m³)
                          </span>
                          {isMeterWater ? (
                            waterDiff !== null && (
                              <span
                                className={`util-consumed-badge ${
                                  waterDiff >= 0 ? "positive" : "warning"
                                }`}
                              >
                                Tiêu thụ:{" "}
                                {waterDiff >= 0 ? `+${waterDiff}` : waterDiff} m³
                              </span>
                            )
                          ) : (
                            <span
                              style={{
                                fontSize: "11px",
                                padding: "2px 8px",
                                borderRadius: "4px",
                                background: "#f1f5f9",
                                color: "#475569",
                              }}
                            >
                              {activeItem.waterBillingType === "PER_PERSON"
                                ? "Tính theo đầu người"
                                : "Khoán trọn gói"}
                            </span>
                          )}
                        </div>

                        {isMeterWater ? (
                          <>
                            <div className="util-index-row">
                              <div className="util-index-box">
                                <span className="util-index-label">Chỉ số cũ</span>
                                <div className="util-old-val">
                                  {activeItem.previousWaterIndex}
                                </div>
                              </div>
                              <div className="util-index-box">
                                <span className="util-index-label">Chỉ số mới</span>
                                <input
                                  type="number"
                                  min={activeItem.previousWaterIndex}
                                  className="util-new-input"
                                  placeholder="Nhập số mới..."
                                  disabled={isLocked || submitting}
                                  value={vals.waterNewIndex}
                                  onChange={(e) =>
                                    handleInputChange(
                                      activeItem.room.id,
                                      "waterNewIndex",
                                      e.target.value,
                                    )
                                  }
                                />
                              </div>
                            </div>

                            <div className="util-image-field">
                              <Camera size={16} color="var(--util-text-muted)" />
                              <input
                                type="url"
                                placeholder="Link ảnh công tơ nước (http://...)"
                                disabled={isLocked || submitting}
                                value={vals.waterImage}
                                onChange={(e) =>
                                  handleInputChange(
                                    activeItem.room.id,
                                    "waterImage",
                                    e.target.value,
                                  )
                                }
                              />
                              {vals.waterImage && (
                                <a
                                  href={vals.waterImage}
                                  target="_blank"
                                  rel="noreferrer"
                                  title="Xem ảnh"
                                  style={{
                                    color: "var(--util-primary-container)",
                                  }}
                                >
                                  <ExternalLink size={16} />
                                </a>
                              )}
                            </div>
                          </>
                        ) : (
                          <div
                            style={{
                              padding: "24px 16px",
                              background: "#ffffff",
                              borderRadius: "8px",
                              textAlign: "center",
                              fontSize: "13px",
                              color: "var(--util-text-muted)",
                              border: "1px dashed var(--util-border)",
                            }}
                          >
                            Phòng này áp dụng hình thức{" "}
                            <strong>
                              {activeItem.waterBillingType === "PER_PERSON"
                                ? "thu tiền nước theo đầu người"
                                : "thu khoán trọn gói theo phòng"}
                            </strong>
                            . Không cần chốt chỉ số đồng hồ nước.
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Action Bar */}
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        paddingTop: "14px",
                        borderTop: "1px solid var(--util-border)",
                      }}
                    >
                      <div style={{ fontSize: "13px", color: "var(--util-text-muted)" }}>
                        {isLocked ? (
                          <span style={{ color: "#7c3aed" }}>
                            Bản chốt số này đã lập hóa đơn, không thể chỉnh sửa.
                          </span>
                        ) : (
                          <span>
                            Dữ liệu sẽ tự động đồng bộ sang hóa đơn nháp kỳ{" "}
                            {billingPeriod}.
                          </span>
                        )}
                      </div>

                      {!isLocked && (
                        <div style={{ display: "flex", gap: "10px" }}>
                          <Button
                            busy={submitting}
                            onClick={() => submitReading(activeItem)}
                          >
                            {activeItem.reading
                              ? "Cập nhật chỉ số"
                              : "Lưu & Sang phòng tiếp"}
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}
            </div>
          ) : (
            /* =================================================================
               2. FULL OVERVIEW TABLE VIEW
               ================================================================= */
            <div className="util-table-wrap">
              <table className="util-table">
                <thead>
                  <tr>
                    <th>Số phòng</th>
                    <th>Tầng</th>
                    <th>Trạng thái chốt</th>
                    <th>Điện (Cũ → Mới)</th>
                    <th>Tiêu thụ điện</th>
                    <th>Nước (Cũ → Mới)</th>
                    <th>Tiêu thụ nước</th>
                    <th>Ảnh công tơ</th>
                    <th>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredItems.map((item, idx) => {
                    const vals = getItemValues(item);
                    const isMeterWater = item.waterBillingType === "METER";
                    const isLocked = item.reading?.isBilled;

                    return (
                      <tr key={item.room.id}>
                        <td>
                          <strong style={{ fontSize: "14px" }}>
                            {item.room.roomNumber}
                          </strong>
                        </td>
                        <td>Tầng {item.room.floor}</td>
                        <td>
                          {isLocked ? (
                            <span
                              style={{
                                fontSize: "11px",
                                padding: "2px 8px",
                                borderRadius: "9999px",
                                background: "#f5f3ff",
                                color: "#7c3aed",
                                fontWeight: 600,
                              }}
                            >
                              Đã khóa sổ HĐ
                            </span>
                          ) : item.reading ? (
                            <span
                              style={{
                                fontSize: "11px",
                                padding: "2px 8px",
                                borderRadius: "9999px",
                                background: "#ecfdf5",
                                color: "#059669",
                                fontWeight: 600,
                              }}
                            >
                              Đã chốt ({item.reading.readingDate ? item.reading.readingDate.slice(0, 10) : "Đạt"})
                            </span>
                          ) : (
                            <span
                              style={{
                                fontSize: "11px",
                                padding: "2px 8px",
                                borderRadius: "9999px",
                                background: "#fffbeb",
                                color: "#d97706",
                                fontWeight: 600,
                              }}
                            >
                              Chưa chốt
                            </span>
                          )}
                        </td>
                        <td>
                          <span style={{ color: "var(--util-text-muted)" }}>
                            {item.previousElectricIndex}
                          </span>{" "}
                          →{" "}
                          <strong>
                            {item.reading?.newElectricIndex ?? (
                              <span style={{ color: "#d97706" }}>—</span>
                            )}
                          </strong>
                        </td>
                        <td>
                          {item.reading ? (
                            <strong style={{ color: "#059669" }}>
                              {item.reading.consumedElectric} kWh
                            </strong>
                          ) : (
                            <span style={{ color: "var(--util-text-muted)" }}>—</span>
                          )}
                        </td>
                        <td>
                          {isMeterWater ? (
                            <>
                              <span style={{ color: "var(--util-text-muted)" }}>
                                {item.previousWaterIndex}
                              </span>{" "}
                              →{" "}
                              <strong>
                                {item.reading?.newWaterIndex ?? (
                                  <span style={{ color: "#0284c7" }}>—</span>
                                )}
                              </strong>
                            </>
                          ) : (
                            <span
                              style={{
                                fontSize: "11px",
                                color: "var(--util-text-muted)",
                              }}
                            >
                              Theo người/khoán
                            </span>
                          )}
                        </td>
                        <td>
                          {item.reading && isMeterWater ? (
                            <strong style={{ color: "#0284c7" }}>
                              {item.reading.consumedWater} m³
                            </strong>
                          ) : (
                            <span style={{ color: "var(--util-text-muted)" }}>—</span>
                          )}
                        </td>
                        <td>
                          <div style={{ display: "flex", gap: "6px" }}>
                            {item.reading?.electricImage && (
                              <a
                                href={item.reading.electricImage}
                                target="_blank"
                                rel="noreferrer"
                                title="Xem ảnh điện"
                                style={{ color: "#f59e0b" }}
                              >
                                <Camera size={15} />
                              </a>
                            )}
                            {item.reading?.waterImage && (
                              <a
                                href={item.reading.waterImage}
                                target="_blank"
                                rel="noreferrer"
                                title="Xem ảnh nước"
                                style={{ color: "#0284c7" }}
                              >
                                <Camera size={15} />
                              </a>
                            )}
                            {!item.reading?.electricImage &&
                              !item.reading?.waterImage && (
                                <span style={{ color: "#cbd5e1" }}>—</span>
                              )}
                          </div>
                        </td>
                        <td>
                          <Button
                            variant="secondary"
                            compact
                            onClick={() => {
                              setCurrentIndex(idx);
                              setViewMode("wizard");
                            }}
                          >
                            <Edit2 size={13} />{" "}
                            {item.reading ? "Sửa / Xem" : "Ghi số"}
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Abnormal Consumption Warning Modal */}
          {abnormalWarning && (
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
                <p style={{ fontSize: "13px", color: "#475569", margin: "0 0 12px 0" }}>
                  Hệ thống nhận thấy mức tiêu thụ phòng{" "}
                  <strong>{abnormalWarning.item?.room?.roomNumber}</strong> cao đột
                  biến. Vui lòng kiểm tra lại công tơ trước khi xác nhận.
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
          )}
        </>
      )}
    </div>
  );
}
