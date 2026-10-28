import { Layers, Search, Grid2X2, List } from "lucide-react";

export function RoomsToolbar({
  totalFloors,
  total,
  floor,
  setFloor,
  search,
  setSearch,
  status,
  setStatus,
  limit,
  setLimit,
  view,
  setView,
  setPage,
}) {
  return (
    <>
      <div className="rooms-floor-tabs-bar">
        <button
          type="button"
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
        {Array.from({ length: totalFloors }, (_, i) => {
          const f = i + 1;
          return (
            <button
              type="button"
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
            {Array.from({ length: totalFloors }, (_, i) => (
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
              type="button"
              className={`rooms-view-btn ${view === "grid" ? "is-active" : ""}`}
              onClick={() => setView("grid")}
              title="Sơ đồ mặt bằng phòng trực quan (Grid Matrix)"
            >
              <Grid2X2 size={16} />
            </button>
            <button
              type="button"
              className={`rooms-view-btn ${view === "list" ? "is-active" : ""}`}
              onClick={() => setView("list")}
              title="Danh sách bảng (Table View)"
            >
              <List size={16} />
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

