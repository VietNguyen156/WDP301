import { Link } from "react-router-dom";
import { Plus, Layers, ArrowRight, Building, Download } from "lucide-react";
import {
  useRoomsBranchSelection,
  useRoomList,
} from "../../hooks/useRoomsPage";
import {
  Button,
  PageHeader,
  LoadingState,
  ErrorState,
  EmptyState,
  Pagination,
  Modal,
  FormError,
} from "../../components/ui";
import {
  RoomsMetricsGrid,
  RoomsToolbar,
  RoomsFloorMatrix,
  RoomsTable,
} from "../../components/rooms";
import RoomForm from "./RoomForm";
import "./Rooms.css";

export default function RoomsPage() {
  const {
    user,
    options,
    branchId,
    branch,
    urlSearch,
    setParams,
    selectBranch,
  } = useRoomsBranchSelection();

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
          title={
            user?.role === "LANDLORD"
              ? "Bạn chưa có cơ sở nào"
              : "Bạn chưa được phân công cơ sở nào"
          }
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
            <RoomList
              key={`${branchId}:${urlSearch}`}
              branch={branch}
              initialSearch={urlSearch}
            />
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

function RoomList({ branch, initialSearch }) {
  const {
    canEdit,
    isLandlord,
    resource,
    stats,
    total,
    occupancyRate,
    maintenanceCount,
    items,
    roomsByFloor,
    status,
    setStatus,
    floor,
    setFloor,
    search,
    setSearch,
    setPage,
    limit,
    setLimit,
    view,
    setView,
    editing,
    setEditing,
    deleting,
    setDeleting,
    busy,
    error,
    quickStatusChange,
    requestDeleteRoom,
    remove,
    handleExportCsv,
  } = useRoomList(branch, initialSearch);

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

      {/* 5 Quick Status Metric Cards */}
      <RoomsMetricsGrid
        hasData={Boolean(resource.data)}
        total={total}
        stats={stats}
        occupancyRate={occupancyRate}
        maintenanceCount={maintenanceCount}
        status={status}
        onSelectStatus={(nextStatus) => {
          setStatus(nextStatus);
          setPage(1);
        }}
      />

      {/* Interactive Floor Filter Pills & Toolbar */}
      <RoomsToolbar
        totalFloors={branch.totalFloors}
        total={total}
        floor={floor}
        setFloor={setFloor}
        search={search}
        setSearch={setSearch}
        status={status}
        setStatus={setStatus}
        limit={limit}
        setLimit={setLimit}
        view={view}
        setView={setView}
        setPage={setPage}
      />

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
        <RoomsFloorMatrix
          roomsByFloor={roomsByFloor}
          branch={branch}
          canEdit={canEdit}
          isLandlord={isLandlord}
          onQuickStatusChange={quickStatusChange}
          onEditRoom={(room) => setEditing({ room })}
          onDeleteRoom={requestDeleteRoom}
        />
      ) : (
        <RoomsTable
          items={items}
          branch={branch}
          canEdit={canEdit}
          isLandlord={isLandlord}
          onEditRoom={(room) => setEditing({ room })}
          onDeleteRoom={requestDeleteRoom}
        />
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
            Hành động này sẽ xóa phòng <strong>{deleting.roomNumber}</strong>{" "}
            khỏi danh mục cơ sở. Dữ liệu hợp đồng và hóa đơn cũ trong lịch sử
            vẫn được bảo toàn.
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
