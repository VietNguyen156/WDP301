import { Search, X } from "lucide-react";

export default function UtilityFilterBar({
  filterStatus,
  setFilterStatus,
  setCurrentIndex,
  itemsCount,
  stats,
  roomSearch,
  setRoomSearch,
  filteredCount,
}) {
  return (
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
          Tất cả phòng ({itemsCount})
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

      <div className="util-filter-right">
        <div className="util-search-wrapper">
          <Search size={14} className="util-search-icon" />
          <input
            type="text"
            className="util-search-input"
            placeholder="Tìm phòng, tầng..."
            value={roomSearch}
            onChange={(e) => {
              setRoomSearch(e.target.value);
              setCurrentIndex(0);
            }}
          />
          {roomSearch && (
            <button
              type="button"
              className="util-search-clear"
              onClick={() => {
                setRoomSearch("");
                setCurrentIndex(0);
              }}
              title="Xóa tìm kiếm"
            >
              <X size={12} strokeWidth={2.5} />
            </button>
          )}
        </div>

        <span className="util-items-count">
          {filteredCount} phòng đang hiển thị
        </span>
      </div>
    </div>
  );
}

