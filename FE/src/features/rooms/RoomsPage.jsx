import { useState } from "react";
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
} from "lucide-react";
import { branchApi, roomApi, errorMessage } from "../../services/api";
import { useResource, useDebounced } from "../../hooks/useResource";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import {
  Badge,
  Button,
  PageHeader,
  SearchBox,
  LoadingState,
  ErrorState,
  EmptyState,
  Pagination,
  Metric,
  Modal,
  FormError,
} from "../../components/ui";
import { money, labels } from "../../utils/format";
import RoomForm from "./RoomForm";
export default function RoomsPage() {
  const options = useResource(branchApi.options);
  const [params, setParams] = useSearchParams();
  const branchId = params.get("branchId") || options.data?.[0]?._id || "";
  const branch = options.data?.find((b) => b._id === branchId);
  return (
    <>
      <PageHeader
        title="Sơ đồ phòng"
        description="Nắm bắt tình trạng phòng, sắp xếp không gian và đón khách thuê mới."
      />
      {options.loading ? (
        <LoadingState />
      ) : options.error ? (
        <ErrorState message={options.error} retry={options.reload} />
      ) : !options.data.length ? (
        <EmptyState
          title="Bạn chưa có cơ sở nào"
          action={
            <Link className="button primary" to="/branches">
              Quản lý cơ sở <ArrowRight size={17} />
            </Link>
          }
        />
      ) : (
        <>
          <div className="branch-switcher">
            <BuildingMarker />
            <div>
              <span>CƠ SỞ ĐANG XEM</span>
              <select
                aria-label="Chọn cơ sở"
                value={branchId}
                onChange={(e) => setParams({ branchId: e.target.value })}
              >
                {options.data.map((b) => (
                  <option key={b._id} value={b._id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
            <p>{branch?.address?.fullAddress}</p>
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
    </>
  );
}
function BuildingMarker() {
  return (
    <div className="switcher-icon">
      <Layers size={24} />
    </div>
  );
}
function RoomList({ branch }) {
  const { user } = useAuth(),
    canEdit = user.role === "LANDLORD",
    toast = useToast();
  const [status, setStatus] = useState(""),
    [floor, setFloor] = useState(""),
    [search, setSearch] = useState(""),
    [page, setPage] = useState(1),
    [view, setView] = useState("grid");
  const [editing, setEditing] = useState(null),
    [deleting, setDeleting] = useState(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const debounced = useDebounced(search);
  const resource = useResource(
    () => roomApi.list(branch._id, { status, floor, search: debounced, page }),
    [branch._id, status, floor, debounced, page],
  );
  const stats = resource.data?.stats || {},
    total = Object.values(stats).reduce((a, b) => a + b, 0);
  async function remove() {
    setBusy(true);
    setError("");
    try {
      await roomApi.remove(deleting._id);
      toast("Đã xóa phòng");
      setDeleting(null);
      resource.reload();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }
  const actions = (room) => (
    <div className="room-actions">
      {canEdit && room.status === "EMPTY" && branch.status === "ACTIVE" && (
        <Link
          className="text-link"
          to={`/contracts?create=1&branchId=${branch._id}&roomId=${room._id}`}
        >
          <FilePlus2 size={16} />
          Lập hợp đồng
        </Link>
      )}
      {!canEdit && room.status === "RENTED" ? (
        <span className="muted">Đang có khách thuê</span>
      ) : (
        <button
          className="icon-button"
          aria-label={`Sửa phòng ${room.roomNumber}`}
          onClick={() => setEditing({ room })}
        >
          <Settings2 size={17} />
        </button>
      )}
      {canEdit && (
        <button
          className="icon-button danger-text"
          aria-label={`Xóa phòng ${room.roomNumber}`}
          onClick={() => {
            setDeleting(room);
            setError("");
          }}
        >
          <Trash2 size={16} />
        </button>
      )}
    </div>
  );
  return (
    <>
      <div className="metrics">
        <Metric
          icon={DoorOpen}
          label="Tổng số phòng"
          value={resource.data ? total : "—"}
          detail={`${branch.totalFloors} tầng đang quản lý`}
        />
        <Metric
          icon={Users}
          label="Đang cho thuê"
          value={resource.data ? stats.RENTED || 0 : "—"}
          detail={`${total ? Math.round(((stats.RENTED || 0) / total) * 100) : 0}% tỷ lệ lấp đầy`}
        />
        <Metric
          icon={DoorOpen}
          label="Phòng trống"
          value={resource.data ? stats.EMPTY || 0 : "—"}
          detail="Sẵn sàng đón khách"
          tone="indigo"
        />
        <Metric
          icon={Wrench}
          label="Cần xử lý"
          value={
            resource.data
              ? (stats.MAINTENANCE || 0) + (stats.CLEANING || 0)
              : "—"
          }
          detail="Bảo trì và dọn dẹp"
          tone="amber"
        />
      </div>
      <div className="section-heading room-section-heading">
        <div>
          <h2>Danh sách phòng</h2>
          <p className="muted">Phân bố theo tầng và trạng thái vận hành</p>
        </div>
        {canEdit && branch.status === "ACTIVE" && (
          <div className="inline-actions">
            <Button
              variant="secondary"
              onClick={() => setEditing({ bulk: true })}
            >
              <Layers size={17} />
              Sinh phòng nhanh
            </Button>
            <Button onClick={() => setEditing({})}>
              <Plus size={17} />
              Thêm phòng
            </Button>
          </div>
        )}
      </div>
      <div className="filter-tabs">
        {["", "RENTED", "EMPTY", "MAINTENANCE", "CLEANING"].map((s) => (
          <button
            key={s}
            className={status === s ? "active" : ""}
            onClick={() => {
              setStatus(s);
              setPage(1);
            }}
          >
            {s ? labels[s] : "Tất cả phòng"}
            <span>{s ? stats[s] || 0 : total}</span>
          </button>
        ))}
      </div>
      <div className="toolbar">
        <SearchBox
          value={search}
          onChange={(value) => {
            setSearch(value);
            setPage(1);
          }}
          placeholder="Tìm số phòng…"
        />
        <select
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
        <div className="view-switch">
          <button
            className={view === "grid" ? "active" : ""}
            aria-label="Sơ đồ"
            aria-pressed={view === "grid"}
            onClick={() => setView("grid")}
          >
            <Grid2X2 size={18} />
          </button>
          <button
            className={view === "list" ? "active" : ""}
            aria-label="Danh sách"
            aria-pressed={view === "list"}
            onClick={() => setView("list")}
          >
            <List size={18} />
          </button>
        </div>
      </div>
      {resource.loading ? (
        <LoadingState />
      ) : resource.error ? (
        <ErrorState message={resource.error} retry={resource.reload} />
      ) : !resource.data.items.length ? (
        <EmptyState
          title="Chưa có phòng phù hợp"
          description="Thử thay đổi bộ lọc hoặc thêm phòng mới cho cơ sở."
          action={
            canEdit &&
            branch.status === "ACTIVE" && (
              <Button onClick={() => setEditing({})}>
                <Plus size={17} />
                Thêm phòng
              </Button>
            )
          }
        />
      ) : (
        <>
          {view === "grid" ? (
            [...new Set(resource.data.items.map((r) => r.floor))].map((f) => (
              <section className="floor-section" key={f}>
                <div className="floor-heading">
                  <Layers size={17} />
                  <h3>Tầng {f}</h3>
                  <span>
                    {resource.data.items.filter((r) => r.floor === f).length}{" "}
                    phòng trên trang
                  </span>
                  <div />
                </div>
                <div className="room-grid">
                  {resource.data.items
                    .filter((r) => r.floor === f)
                    .map((room) => (
                      <article
                        className={`room-card room-${room.status.toLowerCase()}`}
                        key={room._id}
                      >
                        <div className="section-heading">
                          <h3>{room.roomNumber}</h3>
                          <Badge status={room.status} />
                        </div>
                        <p className="room-capacity">
                          <Users size={14} />
                          {room.currentTenantName ||
                            `Tối đa ${room.maxOccupants} người`}
                        </p>
                        <div className="room-price">
                          {money(room.basePrice)}
                          <small>/ tháng</small>
                        </div>
                        <p className="room-amenities">
                          {room.amenities.length
                            ? room.amenities.join(" · ")
                            : "Chưa thiết lập tiện nghi"}
                        </p>
                        {actions(room)}
                      </article>
                    ))}
                </div>
              </section>
            ))
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Phòng</th>
                    <th>Tầng</th>
                    <th>Trạng thái</th>
                    <th>Giá thuê / tháng</th>
                    <th>Số người tối đa</th>
                    <th>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {resource.data.items.map((room) => (
                    <tr key={room._id}>
                      <td>
                        <strong>{room.roomNumber}</strong>
                      </td>
                      <td>{room.floor}</td>
                      <td>
                        <Badge status={room.status} />
                      </td>
                      <td>{money(room.basePrice)}</td>
                      <td>{room.maxOccupants}</td>
                      <td>{actions(room)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <Pagination {...resource.data} onChange={setPage} />
        </>
      )}
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
      {deleting && (
        <Modal
          title={`Xóa phòng ${deleting.roomNumber}?`}
          onClose={() => setDeleting(null)}
          busy={busy}
        >
          <p className="modal-copy">
            Phòng sẽ được ẩn khỏi danh sách. Hợp đồng và dữ liệu lịch sử được
            giữ lại.
          </p>
          <FormError error={error} />
          <footer className="modal-footer">
            <Button
              variant="secondary"
              disabled={busy}
              onClick={() => setDeleting(null)}
            >
              Hủy
            </Button>
            <Button variant="danger" busy={busy} onClick={remove}>
              Xác nhận xóa
            </Button>
          </footer>
        </Modal>
      )}
    </>
  );
}
