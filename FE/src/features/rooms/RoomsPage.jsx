import { useState, useMemo, useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  DoorOpen,
  Users,
  Wrench,
  Plus,
  Grid2X2,
  List,
  Layers,
  Settings2,
  Trash2,
  FilePlus2,
  ArrowRight,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Building,
  Search,
  Download,
  Brush,
  FileText,
  SlidersHorizontal,
} from "lucide-react";
import { branchApi, roomApi, errorMessage } from "../../services/api";
import { useResource, useDebounced } from "../../hooks/useResource";
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
  FormError,
} from "../../components/ui";
import { money, labels } from "../../utils/format";
import RoomForm from "./RoomForm";
import "./Rooms.css";

export default function RoomsPage() {
  const options = useResource(branchApi.options);
  const [params, setParams] = useSearchParams();
  const { user, selectedBranchId, setSelectedBranchId } = useAuth();
  const requestedBranchId = selectedBranchId || params.get("branchId");
  const branchId =
    options.data?.some((item) => item._id === requestedBranchId)
      ? requestedBranchId
      : options.data?.[0]?._id || "";
  const branch = options.data?.find((b) => b._id === branchId);

  useEffect(() => {
    if (options.data?.length > 0) {
      const exists = options.data.some((item) => item._id === selectedBranchId);
      if (!exists) {
        setSelectedBranchId(options.data[0]._id);
      }
    }
  }, [options.data, selectedBranchId, setSelectedBranchId]);

  function selectBranch(event) {
    const nextBranchId = event.target.value;
    setSelectedBranchId(nextBranchId);
    setParams(nextBranchId ? { branchId: nextBranchId } : {});
  }

  return (
    <div className="rooms-container">
      <PageHeader
        title="Quản lý Phòng & Căn hộ"
        description="Nắm bắt tình trạng mặt bằng phòng, sắp xếp không gian và điều phối đón khách thuê."
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
              ? "Tạo cơ sở đầu tiên để bắt đầu thêm phòng và quản lý khách thuê."
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
          <div className="rooms-branch-switcher">
            <label htmlFor="rooms-branch-select">Cơ sở đang xem</label>
            <select
              id="rooms-branch-select"
              value={branchId}
              onChange={selectBranch}
              aria-label="Chọn cơ sở để xem phòng"
            >
              {options.data.map((item) => (
                <option key={item._id} value={item._id}>
                  {item.name}
                </option>
              ))}
            </select>
          </div>
          {branch ? (
            <RoomList key={branchId} branch={branch} />
          ) : (
            <ErrorState
              message="Cơ sở không tồn tại hoặc bạn không có quyền truy cập."
              retry={() => setParams({})}
            />
          )}
        </>
      )}
    </div>
  );
}

function RoomList({ branch }) {
  const { user } = useAuth();
  const canEdit = user.role === "LANDLORD" || user.role === "PROPERTY_MANAGER";
  const isLandlord = user.role === "LANDLORD";
  const toast = useToast();

  const [params] = useSearchParams();
  const [status, setStatus] = useState("");
  const [floor, setFloor] = useState("");
  const [search, setSearch] = useState(params.get("search") || "");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);
  const [view, setView] = useState("grid");

  useEffect(() => {
    const q = params.get("search");
    if (q !== null && q !== search) {
      setSearch(q);
      setPage(1);
    }
  }, [params]);

  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const debounced = useDebounced(search);
  const resource = useResource(
    () =>
      roomApi.list(branch._id, {
        status,
        floor,
        search: debounced,
        page,
        limit,
      }),
    [branch._id, status, floor, debounced, page, limit],
  );

  const stats = resource.data?.stats || {};
  const total = Object.values(stats).reduce((a, b) => a + b, 0);
  const occupancyRate = total
    ? Math.round(((stats.RENTED || 0) / total) * 100)
    : 0;
  const maintenanceCount =
    (stats.MAINTENANCE || 0) + (stats.CLEANING || 0);

  // Group rooms by floor for Grid View
  const items = resource.data?.items || [];
  const roomsByFloor = useMemo(() => {
    const map = {};
    items.forEach((room) => {
      const f = room.floor || 1;
      if (!map[f]) map[f] = [];
      map[f].push(room);
    });
    // Sort floor keys ascending
    return Object.keys(map)
      .map(Number)
      .sort((a, b) => a - b)
      .map((f) => ({ floor: f, rooms: map[f] }));
  }, [items]);

  // Quick 1-click status update (e.g. CLEANING -> EMPTY, MAINTENANCE -> EMPTY)
  async function quickStatusChange(room, newStatus, actionName) {
    try {
      await roomApi.update(room._id, { status: newStatus });
      toast.success(
        `Phòng ${room.roomNumber}: ${actionName} thành công, sẵn sàng đón khách!`,
      );
      resource.reload();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  // Delete handler
  async function remove() {
    if (deleting?.status === "RENTED" || deleting?.currentContractId) {
      setError("Phòng đang có hợp đồng thuê chưa thanh lý, không thể xóa.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await roomApi.remove(deleting._id);
      toast.success(`Đã xóa phòng ${deleting.roomNumber}`);
      setDeleting(null);
      resource.reload();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  // Export CSV
  function handleExportCsv() {
    if (!items.length) {
      toast.error("Không có dữ liệu phòng để xuất.");
      return;
    }
    const headers = [
      "Số phòng",
      "Tầng",
      "Trạng thái",
      "Khách thuê",
      "Sức chứa",
      "Giá thuê (VND)",
      "Tiện nghi",
      "Ghi chú",
    ];
    const rows = items.map((r) => [
      `"${r.roomNumber}"`,
      r.floor,
      `"${labels[r.status] || r.status}"`,
      `"${r.currentTenantName || "Trống"}"`,
      r.maxOccupants,
      r.basePrice,
      `"${(r.amenities || []).join(", ")}"`,
      `"${(r.notes || "").replace(/"/g, '""')}"`,
    ]);

    const csvContent =
      "\uFEFF" +
      [headers.join(","), ...rows.map((row) => row.join(","))].join("\r\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Danh_sach_phong_${branch.name.replace(/\s+/g, "_")}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success("Đã xuất danh sách phòng ra tệp CSV thành công.");
  }

  return (
    <>
      {/* Branch Context Banner */}
      <div className="rooms-branch-banner">
        <div className="rooms-branch-info">
          <div className="rooms-branch-icon">
            <Building size={24} />
          </div>
          <div className="rooms-branch-details">
            <h3>
              {branch.name}
              <span className="rooms-branch-badge">
                {branch.totalFloors} tầng · {total} phòng
              </span>
            </h3>
            <p className="rooms-branch-address">
              {branch.address?.fullAddress || "Chưa cập nhật địa chỉ"}
            </p>
          </div>
        </div>

        {canEdit && branch.status === "ACTIVE" && (
          <div className="rooms-header-actions">
            <Button
              variant="secondary"
              onClick={handleExportCsv}
              title="Xuất danh sách phòng Excel/CSV"
            >
              <Download size={16} />
              Xuất CSV
            </Button>
            {isLandlord && (
              <>
                <Button
                  variant="secondary"
                  onClick={() => setEditing({ bulk: true })}
                >
                  <Layers size={16} />
                  Sinh phòng nhanh
                </Button>
                <Button onClick={() => setEditing({})}>
                  <Plus size={16} />
                  Thêm phòng mới
                </Button>
              </>
            )}
          </div>
        )}
      </div>

      {/* 5 Quick Status Metric Cards (Bento Metric Strip) */}
      <div className="rooms-metrics-grid">
        {/* Card 1: Tổng số phòng */}
        <div
          className={`rooms-metric-card tone-neutral ${status === "" ? "is-active" : ""}`}
          onClick={() => {
            setStatus("");
            setPage(1);
          }}
          title="Xem tất cả các phòng"
        >
          <div className="rooms-metric-card-top">
            <span className="rooms-metric-label">Tổng số phòng</span>
            <div className="rooms-metric-icon-box">
              <DoorOpen size={18} />
            </div>
          </div>
          <div className="rooms-metric-val">{resource.data ? total : "—"}</div>
          <div className="rooms-metric-detail">
            <span>100% quỹ phòng cơ sở</span>
          </div>
        </div>

        {/* Card 2: Đang cho thuê */}
        <div
          className={`rooms-metric-card tone-emerald ${status === "RENTED" ? "is-active" : ""}`}
          onClick={() => {
            setStatus("RENTED");
            setPage(1);
          }}
          title="Lọc các phòng đang cho thuê"
        >
          <div className="rooms-metric-card-top">
            <span className="rooms-metric-label">Đang cho thuê</span>
            <div className="rooms-metric-icon-box">
              <Users size={18} />
            </div>
          </div>
          <div className="rooms-metric-val">
            {resource.data ? stats.RENTED || 0 : "—"}
          </div>
          <div className="rooms-metric-detail">
            <span>{occupancyRate}% tỷ lệ lấp đầy</span>
          </div>
          <div className="rooms-progress-bar">
            <div
              className="rooms-progress-fill fill-emerald"
              style={{ width: `${occupancyRate}%` }}
            />
          </div>
        </div>

        {/* Card 3: Phòng trống đón khách */}
        <div
          className={`rooms-metric-card tone-cyan ${status === "EMPTY" ? "is-active" : ""}`}
          onClick={() => {
            setStatus("EMPTY");
            setPage(1);
          }}
          title="Lọc các phòng đang trống"
        >
          <div className="rooms-metric-card-top">
            <span className="rooms-metric-label">Phòng trống</span>
            <div className="rooms-metric-icon-box">
              <Sparkles size={18} />
            </div>
          </div>
          <div className="rooms-metric-val">
            {resource.data ? stats.EMPTY || 0 : "—"}
          </div>
          <div className="rooms-metric-detail">
            <span>Sẵn sàng ký hợp đồng mới</span>
          </div>
        </div>

        {/* Card 4: Dọn dẹp & Bảo trì */}
        <div
          className={`rooms-metric-card tone-amber ${status === "MAINTENANCE" || status === "CLEANING" ? "is-active" : ""}`}
          onClick={() => {
            setStatus(status === "CLEANING" ? "MAINTENANCE" : "CLEANING");
            setPage(1);
          }}
          title="Lọc phòng cần dọn dẹp hoặc bảo trì"
        >
          <div className="rooms-metric-card-top">
            <span className="rooms-metric-label">Dọn dẹp & Sửa chữa</span>
            <div className="rooms-metric-icon-box">
              <Wrench size={18} />
            </div>
          </div>
          <div className="rooms-metric-val">
            {resource.data ? maintenanceCount : "—"}
          </div>
          <div className="rooms-metric-detail">
            <span>
              {stats.CLEANING || 0} cần dọn · {stats.MAINTENANCE || 0} bảo trì
            </span>
          </div>
        </div>

        {/* Card 5: Tạm ngừng hoạt động */}
        <div
          className={`rooms-metric-card tone-rose ${status === "INACTIVE" ? "is-active" : ""}`}
          onClick={() => {
            setStatus("INACTIVE");
            setPage(1);
          }}
          title="Lọc phòng ngừng hoạt động"
        >
          <div className="rooms-metric-card-top">
            <span className="rooms-metric-label">Tạm dừng</span>
            <div className="rooms-metric-icon-box">
              <AlertCircle size={18} />
            </div>
          </div>
          <div className="rooms-metric-val">
            {resource.data ? stats.INACTIVE || 0 : "—"}
          </div>
          <div className="rooms-metric-detail">
            <span>Kho hoặc ngừng kinh doanh</span>
          </div>
        </div>
      </div>

      {/* Interactive Floor Filter Pills */}
      <div className="rooms-floor-tabs-bar">
        <button
          className={`rooms-floor-pill ${floor === "" ? "is-active" : ""}`}
          onClick={() => {
            setFloor("");
            setPage(1);
          }}
        >
          <Layers size={14} />
          <span>Tất cả các tầng</span>
          <span className="rooms-floor-pill-count">{total}</span>
        </button>
        {Array.from({ length: branch.totalFloors }, (_, i) => {
          const f = i + 1;
          return (
            <button
              key={f}
              className={`rooms-floor-pill ${floor === String(f) ? "is-active" : ""}`}
              onClick={() => {
                setFloor(floor === String(f) ? "" : String(f));
                setPage(1);
              }}
            >
              <span>Tầng {f}</span>
            </button>
          );
        })}
      </div>

      {/* Filter & Search Toolbar */}
      <div className="rooms-toolbar">
        <div className="rooms-toolbar-left">
          <div className="rooms-search-box">
            <Search size={16} color="var(--room-text-muted)" />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Tìm theo số phòng..."
            />
          </div>

          <select
            className="rooms-select"
            aria-label="Lọc trạng thái"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
          >
            <option value="">Tất cả trạng thái</option>
            <option value="RENTED">Đang cho thuê</option>
            <option value="EMPTY">Phòng trống</option>
            <option value="CLEANING">Cần dọn dẹp</option>
            <option value="MAINTENANCE">Đang bảo trì</option>
            <option value="INACTIVE">Tạm dừng hoạt động</option>
          </select>

          <select
            className="rooms-select"
            aria-label="Lọc tầng"
            value={floor}
            onChange={(e) => {
              setFloor(e.target.value);
              setPage(1);
            }}
          >
            <option value="">Tất cả các tầng</option>
            {Array.from({ length: branch.totalFloors }, (_, i) => (
              <option key={i} value={i + 1}>
                Tầng {i + 1}
              </option>
            ))}
          </select>
        </div>

        <div className="rooms-toolbar-right">
          <select
            className="rooms-select"
            aria-label="Số bản ghi hiển thị"
            value={limit}
            onChange={(e) => {
              setLimit(Number(e.target.value));
              setPage(1);
            }}
          >
            <option value={20}>20 phòng / trang</option>
            <option value={50}>50 phòng / trang</option>
            <option value={100}>100 phòng / trang</option>
          </select>

          <div className="rooms-view-toggle">
            <button
              className={`rooms-view-btn ${view === "grid" ? "is-active" : ""}`}
              onClick={() => setView("grid")}
              title="Sơ đồ mặt bằng phòng trực quan (Grid Matrix)"
            >
              <Grid2X2 size={16} />
            </button>
            <button
              className={`rooms-view-btn ${view === "list" ? "is-active" : ""}`}
              onClick={() => setView("list")}
              title="Danh sách bảng (Table View)"
            >
              <List size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      {resource.loading ? (
        <LoadingState />
      ) : resource.error ? (
        <ErrorState message={resource.error} retry={resource.reload} />
      ) : !items.length ? (
        <EmptyState
          title="Chưa có phòng phù hợp"
          description={
            isLandlord
              ? "Thử thay đổi bộ lọc hoặc thêm phòng mới cho cơ sở."
              : "Cơ sở này hiện chưa có phòng nào hoặc không khớp bộ lọc. Vui lòng liên hệ Chủ trọ nếu cần tạo thêm phòng mới."
          }
          action={
            isLandlord &&
            branch.status === "ACTIVE" && (
              <Button onClick={() => setEditing({})}>
                <Plus size={17} />
                Thêm phòng
              </Button>
            )
          }
        />
      ) : view === "grid" ? (
        /* Unit Grid Matrix Grouped by Floor */
        <div className="rooms-matrix">
          {roomsByFloor.map(({ floor: f, rooms }) => {
            const floorRented = rooms.filter(
              (r) => r.status === "RENTED" || r.currentContractId,
            ).length;
            const floorEmpty = rooms.filter((r) => r.status === "EMPTY").length;
            const floorRate = rooms.length
              ? Math.round((floorRented / rooms.length) * 100)
              : 0;

            return (
              <section className="rooms-floor-section" key={f}>
                <div className="rooms-floor-header">
                  <div className="rooms-floor-title">
                    <Layers size={18} color="var(--room-primary-container)" />
                    <h3>Tầng {f}</h3>
                  </div>
                  <div className="rooms-floor-meta">
                    <span>
                      {rooms.length} phòng ({floorRented} đang thuê ·{" "}
                      {floorEmpty} trống)
                    </span>
                    <span className="rooms-floor-occupancy-pill">
                      {floorRate}% lấp đầy
                    </span>
                  </div>
                </div>

                <div className="rooms-unit-grid">
                  {rooms.map((room) => {
                    const isRented =
                      room.status === "RENTED" ||
                      Boolean(room.currentContractId);

                    return (
                      <article
                        key={room._id}
                        className={`unit-card status-${room.status.toLowerCase()}`}
                      >
                        {/* Header: Room Number + Dual Status Badge */}
                        <div className="unit-card-header">
                          <span className="unit-card-room-num">
                            {room.roomNumber}
                          </span>
                          <span className="unit-card-badge">
                            <span className="unit-card-badge-dot" />
                            {labels[room.status] || room.status}
                          </span>
                        </div>

                        {/* Body: Tenant, Capacity, Price */}
                        <div className="unit-card-body">
                          {isRented ? (
                            <div className="unit-card-tenant">
                              <div className="unit-card-tenant-avatar">
                                {(room.currentTenantName || "U")
                                  .slice(0, 1)
                                  .toUpperCase()}
                              </div>
                              <span>
                                {room.currentTenantName || "Đang thuê"}
                              </span>
                            </div>
                          ) : room.status === "CLEANING" ? (
                            <div className="unit-card-tenant is-empty">
                              <Brush size={14} color="var(--status-cleaning-dot)" />
                              <span>Cần dọn vệ sinh phòng</span>
                            </div>
                          ) : room.status === "MAINTENANCE" ? (
                            <div className="unit-card-tenant is-empty">
                              <Wrench size={14} color="var(--status-maint-dot)" />
                              <span>Đang bảo trì thiết bị</span>
                            </div>
                          ) : (
                            <div className="unit-card-tenant is-empty">
                              <Sparkles size={14} color="#0284c7" />
                              <span>Sẵn sàng đón khách mới</span>
                            </div>
                          )}

                          <div className="unit-card-meta">
                            <span className="unit-card-capacity">
                              <Users size={13} />
                              {isRented
                                ? `Tối đa ${room.maxOccupants} người`
                                : `Tối đa ${room.maxOccupants} người`}
                            </span>
                            <span>Tầng {room.floor}</span>
                          </div>

                          <div className="unit-card-price-row">
                            <span className="unit-card-price">
                              {money(room.basePrice)}
                            </span>
                            <span className="unit-card-price-sub">/ tháng</span>
                          </div>

                          {room.amenities?.length > 0 && (
                            <div
                              className="unit-card-amenities"
                              title={room.amenities.join(", ")}
                            >
                              {room.amenities.join(" · ")}
                            </div>
                          )}
                        </div>

                        {/* Footer: Quick Actions */}
                        <div className="unit-card-footer">
                          <div className="unit-card-primary-action">
                            {canEdit &&
                              room.status === "EMPTY" &&
                              branch.status === "ACTIVE" && (
                                <Link
                                  className="unit-btn-quick primary"
                                  to={`/contracts?create=1&branchId=${branch._id}&roomId=${room._id}`}
                                >
                                  <FilePlus2 size={14} />
                                  Lập hợp đồng
                                </Link>
                              )}

                            {canEdit && room.status === "CLEANING" && (
                              <button
                                type="button"
                                className="unit-btn-quick outline-teal"
                                onClick={() =>
                                  quickStatusChange(
                                    room,
                                    "EMPTY",
                                    "Dọn dẹp xong",
                                  )
                                }
                              >
                                <CheckCircle2 size={14} />
                                Đã dọn xong
                              </button>
                            )}

                            {canEdit && room.status === "MAINTENANCE" && (
                              <button
                                type="button"
                                className="unit-btn-quick outline-amber"
                                onClick={() =>
                                  quickStatusChange(
                                    room,
                                    "EMPTY",
                                    "Bảo trì xong",
                                  )
                                }
                              >
                                <CheckCircle2 size={14} />
                                Xong bảo trì
                              </button>
                            )}

                            {isRented && (
                              <Link
                                className="unit-btn-quick outline-teal"
                                to={`/contracts?search=${encodeURIComponent(room.roomNumber)}`}
                              >
                                <FileText size={14} />
                                Xem hợp đồng
                              </Link>
                            )}
                          </div>

                          {canEdit && (
                            <div className="unit-card-icon-actions">
                              <button
                                type="button"
                                className="unit-btn-icon"
                                aria-label={`Sửa phòng ${room.roomNumber}`}
                                title="Cấu hình & tiện nghi phòng"
                                onClick={() => setEditing({ room })}
                              >
                                <Settings2 size={15} />
                              </button>
                              {isLandlord && (
                                <button
                                  type="button"
                                  className="unit-btn-icon danger-hover"
                                  aria-label={`Xóa phòng ${room.roomNumber}`}
                                  disabled={isRented}
                                  title={
                                    isRented
                                      ? "Không thể xóa phòng đang có hợp đồng thuê"
                                      : `Xóa phòng ${room.roomNumber}`
                                  }
                                  onClick={() => {
                                    if (isRented) {
                                      toast.error(
                                        "Không thể xóa phòng đang có hợp đồng thuê.",
                                      );
                                      return;
                                    }
                                    setDeleting(room);
                                    setError("");
                                  }}
                                >
                                  <Trash2 size={15} />
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      ) : (
        /* List / Table View */
        <div className="rooms-table-wrap">
          <table className="rooms-table">
            <thead>
              <tr>
                <th>Số phòng</th>
                <th>Tầng</th>
                <th>Trạng thái</th>
                <th>Khách thuê hiện tại</th>
                <th>Sức chứa</th>
                <th>Giá thuê / tháng</th>
                <th>Tiện nghi</th>
                <th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {items.map((room) => {
                const isRented =
                  room.status === "RENTED" || Boolean(room.currentContractId);
                return (
                  <tr key={room._id}>
                    <td>
                      <span className="rooms-table-room-num">
                        {room.roomNumber}
                      </span>
                    </td>
                    <td>Tầng {room.floor}</td>
                    <td>
                      <Badge status={room.status} />
                    </td>
                    <td>
                      {room.currentTenantName ? (
                        <strong>{room.currentTenantName}</strong>
                      ) : (
                        <span className="muted">Trống</span>
                      )}
                    </td>
                    <td>{room.maxOccupants} người</td>
                    <td>
                      <span className="rooms-table-price">
                        {money(room.basePrice)}
                      </span>
                    </td>
                    <td>
                      {room.amenities?.length ? (
                        <span className="muted" style={{ fontSize: "12px" }}>
                          {room.amenities.join(", ")}
                        </span>
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </td>
                    <td>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                        }}
                      >
                        {isLandlord &&
                          room.status === "EMPTY" &&
                          branch.status === "ACTIVE" && (
                            <Link
                              className="text-link"
                              to={`/contracts?create=1&branchId=${branch._id}&roomId=${room._id}`}
                            >
                              <FilePlus2 size={15} /> Lập HĐ
                            </Link>
                          )}
                        {canEdit && (
                          <button
                            type="button"
                            className="unit-btn-icon"
                            onClick={() => setEditing({ room })}
                            title="Sửa phòng"
                          >
                            <Settings2 size={14} />
                          </button>
                        )}
                        {isLandlord && (
                          <button
                            type="button"
                            className="unit-btn-icon danger-hover"
                            disabled={isRented}
                            onClick={() => {
                              if (isRented) {
                                toast.error(
                                  "Không thể xóa phòng đang có hợp đồng thuê.",
                                );
                                return;
                              }
                              setDeleting(room);
                              setError("");
                            }}
                            title="Xóa phòng"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {resource.data && resource.data.total > limit && (
        <Pagination {...resource.data} onChange={setPage} />
      )}

      {/* Room Modal Form (Single or Bulk) */}
      {editing && (
        <RoomForm
          branch={branch}
          {...editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            resource.reload();
          }}
        />
      )}

      {/* Delete Confirmation Modal */}
      {deleting && (
        <Modal
          title={`Xác nhận xóa phòng ${deleting.roomNumber}?`}
          onClose={() => setDeleting(null)}
          busy={busy}
        >
          <p className="modal-copy">
            Hành động này sẽ xóa phòng <strong>{deleting.roomNumber}</strong> khỏi
            danh mục cơ sở. Dữ liệu hợp đồng và hóa đơn cũ trong lịch sử vẫn được
            bảo toàn.
          </p>
          <FormError error={error} />
          <footer className="modal-footer">
            <Button
              variant="secondary"
              disabled={busy}
              onClick={() => setDeleting(null)}
            >
              Hủy bỏ
            </Button>
            <Button variant="danger" busy={busy} onClick={remove}>
              Xác nhận xóa phòng
            </Button>
          </footer>
        </Modal>
      )}
    </>
  );
}
