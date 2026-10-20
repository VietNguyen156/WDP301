import { useState, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Plus,
  ArrowUpRight,
  Search,
  Building,
  FileCheck2,
  Calendar,
  AlertTriangle,
  Clock,
  ShieldCheck,
  ShieldAlert,
  UserCheck,
  Printer,
  ChevronRight,
  X,
  FileText,
  BadgePercent,
  RefreshCw,
  Phone,
  Mail,
  Home,
  CheckCircle2,
  AlertCircle,
  Share2,
} from "lucide-react";
import { contractApi } from "../../services/api";
import { useResource, useDebounced } from "../../hooks/useResource";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import {
  LoadingState,
  ErrorState,
  EmptyState,
  Pagination,
} from "../../components/ui";
import { money, date, labels } from "../../utils/format";
import ContractForm from "./ContractForm";
import ContractDetail from "./ContractDetail";
import "./Contracts.css";

export default function ContractsPage() {
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const { user, selectedBranchId, branches } = useAuth();
  const landlord = user.role === "LANDLORD";

  const [creating, setCreating] = useState(params.get("create") === "1" && landlord);
  const [selectedId, setSelectedId] = useState(null);
  const [detailModalId, setDetailModalId] = useState(null);

  const [status, setStatus] = useState("");
  const [branchFilter, setBranchFilter] = useState(selectedBranchId || "");
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const debounced = useDebounced(search);

  const isValidSelected = branches?.some((b) => b._id === selectedBranchId);
  const activeBranchId = branchFilter
    ? (branches?.some((b) => b._id === branchFilter) ? branchFilter : "")
    : (isValidSelected ? selectedBranchId : "");

  const resource = useResource(
    () =>
      contractApi.list({
        status,
        branchId: activeBranchId,
        page,
        limit: 10,
        search: debounced,
      }),
    [status, activeBranchId, page, debounced],
  );

  const items = resource.data?.items || [];
  const total = resource.data?.total || 0;

  // Selected contract for Inspector panel
  const selectedContract = useMemo(() => {
    if (!selectedId && items.length > 0) return items[0];
    return items.find((c) => c._id === selectedId) || items[0] || null;
  }, [items, selectedId]);

  // Derived KPI metrics
  const activeCount = useMemo(() => items.filter((c) => c.displayStatus === "ACTIVE").length, [items]);
  const expiringCount = useMemo(() => items.filter((c) => c.displayStatus === "EXPIRING_SOON").length, [items]);
  const expiredCount = useMemo(() => items.filter((c) => c.displayStatus === "EXPIRED").length, [items]);
  const totalDeposit = useMemo(
    () => items.reduce((acc, c) => acc + (c.depositAmount || 0), 0),
    [items],
  );

  function closeCreate() {
    setCreating(false);
    setParams({});
  }

  // Calculate remaining days for duration bar
  function getContractProgress(startDate, endDate) {
    if (!startDate || !endDate) return { percent: 0, daysLeft: 0 };
    const start = new Date(startDate).getTime();
    const end = new Date(endDate).getTime();
    const now = Date.now();
    const totalDuration = end - start;
    if (totalDuration <= 0) return { percent: 100, daysLeft: 0 };
    const elapsed = now - start;
    const percent = Math.min(100, Math.max(0, Math.round((elapsed / totalDuration) * 100)));
    const daysLeft = Math.max(0, Math.ceil((end - now) / 86400000));
    return { percent, daysLeft };
  }

  return (
    <div className="contracts-wrapper animate-fade-in">
      {/* 1. Header Section */}
      <div className="contracts-header-bar">
        <div>
          <h1 className="contracts-header-title">
            {landlord ? "Quản lý Hợp đồng & Khách thuê" : "Hợp đồng Thuê phòng của tôi"}
          </h1>
          <p className="contracts-header-subtext">
            Theo dõi thời hạn thuê phòng trên toàn hệ thống, tự động cảnh báo gia hạn 30 ngày và định danh thông tin cư dân.
          </p>
        </div>

        <div className="contracts-header-actions">
          {landlord && (
            <>
              <button
                type="button"
                className="contracts-btn-outline"
                onClick={() => toast.success("Đang xuất danh sách khai báo tạm trú theo chuẩn Bộ Công an (CSV)...")}
              >
                <Share2 size={15} />
                <span>Xuất tạm trú (Công an)</span>
              </button>
              <button
                type="button"
                className="contracts-btn-primary"
                onClick={() => setCreating(true)}
              >
                <Plus size={16} />
                <span>+ Tạo hợp đồng mới</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* 2. Metric KPI Cards (Stitch Screen 507f368d) */}
      <div className="contracts-kpi-ribbon">
        <div className="contracts-kpi-card">
          <div className="contracts-kpi-top">
            <span className="contracts-kpi-label">Tổng hợp đồng hiệu lực</span>
            <div className="contracts-kpi-icon primary">
              <FileCheck2 size={18} />
            </div>
          </div>
          <div className="contracts-kpi-num">{total || items.length}</div>
          <div className="contracts-kpi-sub">
            <span style={{ color: "var(--contracts-primary)", fontWeight: 600 }}>
              {activeCount} đang thuê ổn định
            </span>
          </div>
        </div>

        <div className="contracts-kpi-card warning">
          <div className="contracts-kpi-top">
            <span className="contracts-kpi-label" style={{ color: "#92400e" }}>Sắp hết hạn (30 ngày)</span>
            <div className="contracts-kpi-icon warning">
              <Clock size={18} />
            </div>
          </div>
          <div className="contracts-kpi-num" style={{ color: "#92400e" }}>{expiringCount}</div>
          <div className="contracts-kpi-sub" style={{ color: "#b45309" }}>
            <span>Cần liên hệ gia hạn hoặc báo trả</span>
          </div>
        </div>

        <div className="contracts-kpi-card danger">
          <div className="contracts-kpi-top">
            <span className="contracts-kpi-label" style={{ color: "#991b1b" }}>Quá hạn chưa ký lại</span>
            <div className="contracts-kpi-icon danger">
              <AlertTriangle size={18} />
            </div>
          </div>
          <div className="contracts-kpi-num" style={{ color: "#991b1b" }}>{expiredCount}</div>
          <div className="contracts-kpi-sub" style={{ color: "#dc2626" }}>
            <span>Cần xử lý quyết toán hoặc ký mới</span>
          </div>
        </div>

        <div className="contracts-kpi-card">
          <div className="contracts-kpi-top">
            <span className="contracts-kpi-label">Tổng tiền cọc đang giữ</span>
            <div className="contracts-kpi-icon teal">
              <ShieldCheck size={18} />
            </div>
          </div>
          <div className="contracts-kpi-num" style={{ color: "var(--contracts-primary)" }}>
            {money(totalDeposit)}
          </div>
          <div className="contracts-kpi-sub">
            <span>An toàn quỹ bảo lãnh tài sản</span>
          </div>
        </div>
      </div>

      {/* 3. Filter Toolbar & Search */}
      <div className="contracts-filter-card">
        {/* Quick Filter Tabs */}
        <div className="contracts-tabs-row">
          <div className="contracts-quick-tabs">
            <button
              type="button"
              className={`contracts-tab-btn ${status === "" ? "is-active" : ""}`}
              onClick={() => { setStatus(""); setPage(1); }}
            >
              Tất cả hợp đồng
              <span className="badge-count">{total || items.length}</span>
            </button>
            <button
              type="button"
              className={`contracts-tab-btn ${status === "ACTIVE" ? "is-active" : ""}`}
              onClick={() => { setStatus("ACTIVE"); setPage(1); }}
            >
              Đang hiệu lực
              <span className="badge-count">{activeCount}</span>
            </button>
            <button
              type="button"
              className={`contracts-tab-btn ${status === "EXPIRING_SOON" ? "is-active" : ""}`}
              onClick={() => { setStatus("EXPIRING_SOON"); setPage(1); }}
            >
              Sắp hết hạn (30 ngày)
              <span className="badge-count" style={{ background: "#fef3c7", color: "#92400e" }}>
                {expiringCount}
              </span>
            </button>
            <button
              type="button"
              className={`contracts-tab-btn ${status === "EXPIRED" ? "is-active" : ""}`}
              onClick={() => { setStatus("EXPIRED"); setPage(1); }}
            >
              Quá hạn
              <span className="badge-count" style={{ background: "#fee2e2", color: "#991b1b" }}>
                {expiredCount}
              </span>
            </button>
            <button
              type="button"
              className={`contracts-tab-btn ${status === "TERMINATED" ? "is-active" : ""}`}
              onClick={() => { setStatus("TERMINATED"); setPage(1); }}
            >
              Đã thanh lý
            </button>
          </div>

          <span style={{ fontSize: 12, color: "#64748b" }}>
            Trang <strong>{page}</strong> / <strong>{Math.ceil((total || 1) / 10)}</strong>
          </span>
        </div>

        {/* Search & Branch Select Row */}
        <div className="contracts-filter-inputs">
          <div style={{ position: "relative", flex: 1, minWidth: 260 }}>
            <Search
              size={15}
              style={{ position: "absolute", left: 10, top: 10, color: "#94a3b8" }}
            />
            <input
              type="text"
              className="contracts-search-input"
              placeholder="Tìm theo mã hợp đồng, số phòng, họ tên khách..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>

          {branches && branches.length > 0 && (
            <select
              className="contracts-select"
              value={branchFilter}
              onChange={(e) => {
                setBranchFilter(e.target.value);
                setPage(1);
              }}
            >
              <option value="">Tất cả cơ sở ({branches.length})</option>
              {branches.map((b) => (
                <option key={b._id} value={b._id}>
                  {b.name}
                </option>
              ))}
            </select>
          )}

          <button
            type="button"
            className="contracts-btn-outline"
            onClick={() => {
              setSearch("");
              setStatus("");
              setBranchFilter("");
              setPage(1);
            }}
            title="Đặt lại bộ lọc"
          >
            <RefreshCw size={14} />
            <span>Đặt lại</span>
          </button>
        </div>
      </div>

      {/* 4. Split Layout: Table (Left) + Inspector Panel (Right) */}
      <div className={`contracts-split-layout ${selectedContract ? "has-inspector" : ""}`}>
        {/* Table Canvas */}
        <div className="contracts-table-card">
          {resource.loading && !items.length ? (
            <LoadingState />
          ) : resource.error && !items.length ? (
            <ErrorState message={resource.error} retry={resource.reload} />
          ) : !items.length ? (
            <EmptyState
              title="Không tìm thấy hợp đồng nào"
              description="Thử thay đổi bộ lọc hoặc thêm hợp đồng mới cho phòng trống."
              action={
                landlord && (
                  <button
                    type="button"
                    className="contracts-btn-primary"
                    onClick={() => setCreating(true)}
                  >
                    <Plus size={16} />
                    <span>Lập hợp đồng ngay</span>
                  </button>
                )
              }
            />
          ) : (
            <>
              <div className="contracts-table-wrap">
                <table className="contracts-table">
                  <thead>
                    <tr>
                      <th>Mã HĐ</th>
                      <th>Phòng & Cơ sở</th>
                      <th>Khách đại diện</th>
                      <th>Thời hạn & Tiến độ</th>
                      <th>Giá thuê & Cọc</th>
                      <th>Trạng thái HĐ</th>
                      <th style={{ textAlign: "right" }}>Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((c) => {
                      const isSelected = selectedContract?._id === c._id;
                      const { percent, daysLeft } = getContractProgress(c.startDate, c.endDate);
                      const isExpiring = c.displayStatus === "EXPIRING_SOON";
                      const isExpired = c.displayStatus === "EXPIRED";

                      return (
                        <tr
                          key={c._id}
                          className={isSelected ? "is-selected" : ""}
                          onClick={() => setSelectedId(c._id)}
                        >
                          {/* Mã HĐ */}
                          <td>
                            <span style={{ fontFamily: "monospace", fontWeight: 700, color: "var(--contracts-primary)", fontSize: 13 }}>
                              {c.contractCode}
                            </span>
                            <span style={{ fontSize: 11, color: "#64748b", display: "block" }}>
                              Ký: {date(c.createdAt)}
                            </span>
                          </td>

                          {/* Phòng & Cơ sở */}
                          <td>
                            <div className="room-cell">
                              <span
                                className="room-dot"
                                style={{
                                  background:
                                    c.displayStatus === "ACTIVE"
                                      ? "#10b981"
                                      : isExpiring
                                      ? "#f59e0b"
                                      : isExpired
                                      ? "#ef4444"
                                      : "#94a3b8",
                                }}
                              />
                              <div>
                                <span className="room-number-text">
                                  {c.roomId?.roomNumber || "Phòng"}
                                </span>
                                <span className="room-subtext">
                                  {c.branchId?.name || "Cơ sở"}
                                </span>
                              </div>
                            </div>
                          </td>

                          {/* Khách đại diện */}
                          <td>
                            <div className="tenant-cell">
                              <div className="tenant-avatar-chip">
                                {c.tenantId?.name?.slice(0, 2).toUpperCase() || "KT"}
                              </div>
                              <div>
                                <div className="tenant-name-text">
                                  {c.tenantId?.name || "Khách thuê"}
                                </div>
                                <div className="tenant-contact-text">
                                  <Phone size={10} color="#64748b" />
                                  <span>{c.tenantId?.phoneNumber || c.tenantId?.citizenId || "—"}</span>
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Thời hạn & Tiến độ */}
                          <td>
                            <div style={{ fontSize: 12, fontWeight: 500, color: "var(--contracts-on-surface)" }}>
                              {date(c.startDate)} – {date(c.endDate)}
                            </div>
                            <div className="duration-bar-wrap">
                              <div
                                className={`duration-bar-fill ${
                                  isExpiring ? "warning" : isExpired ? "danger" : ""
                                }`}
                                style={{ width: `${percent}%` }}
                              />
                            </div>
                            <span
                              style={{
                                fontSize: 11,
                                fontWeight: isExpiring || isExpired ? 600 : 400,
                                color: isExpired ? "#dc2626" : isExpiring ? "#b45309" : "#64748b",
                              }}
                            >
                              {isExpired
                                ? "Đã hết hạn"
                                : isExpiring
                                ? `Còn ${daysLeft} ngày hết hạn`
                                : `Hiệu lực (${daysLeft} ngày)`}
                            </span>
                          </td>

                          {/* Giá thuê & Cọc */}
                          <td>
                            <div className="price-text">{money(c.rentalPrice)}</div>
                            <div className="deposit-text">
                              Cọc: <strong>{money(c.depositAmount)}</strong>
                            </div>
                          </td>

                          {/* Trạng thái HĐ (Dual-coding) */}
                          <td>
                            {c.displayStatus === "ACTIVE" ? (
                              <span className="status-pill-dual active">
                                <span className="dot" /> Hiệu lực
                              </span>
                            ) : c.displayStatus === "EXPIRING_SOON" ? (
                              <span className="status-pill-dual expiring">
                                <span className="dot" /> Sắp hết hạn
                              </span>
                            ) : c.displayStatus === "EXPIRED" ? (
                              <span className="status-pill-dual expired">
                                <span className="dot" /> Quá hạn
                              </span>
                            ) : (
                              <span className="status-pill-dual terminated">
                                <span className="dot" /> Đã thanh lý
                              </span>
                            )}
                          </td>

                          {/* Thao tác */}
                          <td style={{ textAlign: "right" }} onClick={(e) => e.stopPropagation()}>
                            <div style={{ display: "inline-flex", gap: 6 }}>
                              <button
                                type="button"
                                className="contracts-action-btn"
                                title="Mở chi tiết & quyết toán"
                                onClick={() => setDetailModalId(c._id)}
                              >
                                <ArrowUpRight size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div style={{ padding: "10px 16px", borderTop: "1px solid var(--contracts-border-subtle)" }}>
                <Pagination {...resource.data} onChange={setPage} />
              </div>
            </>
          )}
        </div>

        {/* Right Inspector Panel (Stitch Screen 507f368d) */}
        {selectedContract && (
          <aside className="contracts-inspector-panel">
            <div className="inspector-header">
              <div>
                <h3 className="inspector-title">Hồ sơ Hợp đồng Chi tiết</h3>
                <span className="inspector-subtitle">
                  {selectedContract.contractCode} · {selectedContract.roomId?.roomNumber || "Phòng"}
                </span>
              </div>
              <button
                type="button"
                className="contracts-action-btn"
                onClick={() => setDetailModalId(selectedContract._id)}
                title="Mở toàn màn hình"
              >
                <ArrowUpRight size={14} />
              </button>
            </div>

            <div className="inspector-body">
              {/* Expiry alert */}
              {selectedContract.displayStatus === "EXPIRING_SOON" && (
                <div className="inspector-alert-banner warning">
                  <Clock size={16} style={{ flexShrink: 0, marginTop: 2 }} />
                  <div>
                    <strong>Cảnh báo gia hạn hợp đồng:</strong>
                    <br />
                    Hợp đồng sắp hết hiệu lực vào ngày {date(selectedContract.endDate)}. Vui lòng liên hệ khách thuê để xác nhận gia hạn hoặc chuẩn bị thủ tục trả cọc.
                  </div>
                </div>
              )}

              {selectedContract.displayStatus === "EXPIRED" && (
                <div className="inspector-alert-banner danger">
                  <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: 2 }} />
                  <div>
                    <strong>Hợp đồng đã quá hạn thuê:</strong>
                    <br />
                    Thời hạn thuê đã kết thúc ({date(selectedContract.endDate)}). Vui lòng chốt số điện nước để thanh lý hoặc ký hợp đồng mới.
                  </div>
                </div>
              )}

              {/* Section 1: Đại diện thuê */}
              <div className="inspector-section">
                <div className="inspector-section-title">
                  <span>Đại diện pháp lý ký kết</span>
                  <span style={{ fontSize: 10, color: "#059669", fontWeight: 700 }}>CCCD ĐÃ XÁC THỰC</span>
                </div>
                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <div className="tenant-avatar-chip" style={{ width: 40, height: 40, fontSize: 14 }}>
                    {selectedContract.tenantId?.name?.slice(0, 2).toUpperCase() || "KT"}
                  </div>
                  <div>
                    <strong style={{ fontSize: 14, color: "var(--contracts-on-surface)" }}>
                      {selectedContract.tenantId?.name}
                    </strong>
                    <div style={{ fontSize: 12, color: "#64748b", display: "flex", alignItems: "center", gap: 4 }}>
                      <Phone size={11} />
                      {selectedContract.tenantId?.phoneNumber || "Chưa có SĐT"}
                    </div>
                    <div style={{ fontSize: 11, color: "#64748b", fontFamily: "monospace" }}>
                      CCCD: {selectedContract.tenantId?.citizenId || "—"}
                    </div>
                  </div>
                </div>
              </div>

              {/* Section 2: Tài chính & Tiền cọc (Bento boxes) */}
              <div className="inspector-section">
                <div className="inspector-section-title">
                  <span>Tài chính & Tiền cọc đảm bảo</span>
                </div>
                <div className="inspector-bento-grid">
                  <div className="inspector-bento-box highlight">
                    <span className="inspector-bento-label">Tiền cọc giữ:</span>
                    <span className="inspector-bento-value" style={{ color: "#065f46" }}>
                      {money(selectedContract.depositAmount)}
                    </span>
                    <span style={{ fontSize: 10, color: "#059669" }}>
                      {labels[selectedContract.depositStatus] || "Đã thu đủ"}
                    </span>
                  </div>

                  <div className="inspector-bento-box">
                    <span className="inspector-bento-label">Giá thuê / tháng:</span>
                    <span className="inspector-bento-value">
                      {money(selectedContract.rentalPrice)}
                    </span>
                    <span style={{ fontSize: 10, color: "#64748b" }}>Thu ngày 05 hàng tháng</span>
                  </div>
                </div>
              </div>

              {/* Section 3: Thời hạn thuê */}
              <div className="inspector-section">
                <div className="inspector-section-title">
                  <span>Thời hạn & Chỉ số ban đầu</span>
                </div>
                <div style={{ fontSize: 12.5, lineHeight: 1.5 }}>
                  <div>
                    Thời hạn: <strong>{date(selectedContract.startDate)}</strong> đến <strong>{date(selectedContract.endDate)}</strong>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4, paddingTop: 4, borderTop: "1px dashed #e2e8f0" }}>
                    <span>Điện ban đầu: <strong>{selectedContract.initialElectricIndex} kWh</strong></span>
                    <span>Nước ban đầu: <strong>{selectedContract.initialWaterIndex} m³</strong></span>
                  </div>
                </div>
              </div>

              {/* Section 4: Người ở cùng */}
              {selectedContract.roommates && selectedContract.roommates.length > 0 && (
                <div className="inspector-section">
                  <div className="inspector-section-title">
                    <span>Thành viên ở cùng ({selectedContract.roommates.length} người)</span>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12 }}>
                    {selectedContract.roommates.map((r, i) => (
                      <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "4px 8px", background: "#ffffff", borderRadius: 6, border: "1px solid #e2e8f0" }}>
                        <span><strong>{r.fullName}</strong></span>
                        <span style={{ color: "#64748b" }}>{r.phoneNumber || r.citizenId || "Đã khai báo"}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Inspector Footer Actions */}
            <div className="inspector-footer">
              <div className="inspector-footer-grid">
                <button
                  type="button"
                  className="contracts-btn-primary"
                  onClick={() => setDetailModalId(selectedContract._id)}
                  style={{ justifyContent: "center" }}
                >
                  <FileText size={15} />
                  <span>Chi tiết hợp đồng</span>
                </button>
                <button
                  type="button"
                  className="contracts-btn-outline"
                  onClick={() => toast.success(`Đã chuẩn bị bản in PDF chuẩn cho HĐ ${selectedContract.contractCode}.`)}
                  style={{ justifyContent: "center" }}
                >
                  <Printer size={15} />
                  <span>In bản PDF</span>
                </button>
              </div>
            </div>
          </aside>
        )}
      </div>

      {/* Contract Creation Stepper Modal */}
      {creating && (
        <ContractForm
          branchId={params.get("branchId") || branchFilter || selectedBranchId || ""}
          roomId={params.get("roomId") || ""}
          onClose={closeCreate}
          onSaved={() => {
            closeCreate();
            resource.reload();
          }}
        />
      )}

      {/* Contract Detail & Settlement Modal */}
      {detailModalId && (
        <ContractDetail
          id={detailModalId}
          onClose={() => setDetailModalId(null)}
          onSaved={() => {
            setDetailModalId(null);
            resource.reload();
          }}
        />
      )}
    </div>
  );
}
