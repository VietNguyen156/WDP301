import {
  MapPin,
  AlertTriangle,
  DoorOpen,
  CheckCircle2,
  LayoutGrid,
  Table as TableIcon,
} from "lucide-react";
import { SearchBox } from "../ui";

export function BranchToolbar({
  search,
  setSearch,
  setPage,
  cityFilter,
  setCityFilter,
  availableCities,
  totalCount,
  occupancyFilter,
  setOccupancyFilter,
  quickFilter,
  setQuickFilter,
  debtBranchesCount,
  vacantBranchesCount,
  activeBranchesCount,
  sortOption,
  setSortOption,
  viewMode,
  setViewMode,
}) {
  return (
    <div className="branch-toolbar">
      <div className="branch-toolbar-left">
        <div className="branch-search-wrap">
          <SearchBox
            value={search}
            onChange={(value) => {
              setSearch(value);
              setPage(1);
            }}
            placeholder="Tìm tên tòa nhà, địa chỉ..."
          />
        </div>

        <div className="branch-select-wrap">
          <MapPin size={14} className="branch-select-icon" />
          <select
            className="branch-select"
            value={cityFilter}
            onChange={(e) => setCityFilter(e.target.value)}
            aria-label="Lọc theo khu vực"
          >
            <option value="">Tất cả khu vực ({totalCount})</option>
            {availableCities.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        <div className="branch-select-wrap">
          <select
            className="branch-select"
            style={{ paddingLeft: "12px" }}
            value={occupancyFilter}
            onChange={(e) => setOccupancyFilter(e.target.value)}
            aria-label="Lọc theo tỷ lệ lấp đầy"
          >
            <option value="ALL">Lấp đầy: Tất cả</option>
            <option value="HIGH">Cao (≥ 95%)</option>
            <option value="MEDIUM">Trung bình (80% - 94%)</option>
            <option value="LOW">Cần chú ý (&lt; 80%)</option>
          </select>
        </div>

        <div className="branch-quick-chips">
          <button
            type="button"
            className={`branch-chip-btn ${quickFilter === "ALL" ? "is-active" : ""}`}
            onClick={() => setQuickFilter("ALL")}
          >
            Tất cả ({totalCount})
          </button>
          <button
            type="button"
            className={`branch-chip-btn ${quickFilter === "DEBT" ? "is-active" : ""}`}
            onClick={() =>
              setQuickFilter(quickFilter === "DEBT" ? "ALL" : "DEBT")
            }
          >
            <AlertTriangle
              size={13}
              style={{ color: quickFilter === "DEBT" ? "#fff" : "#ea580c" }}
            />
            <span>Có nợ đọng ({debtBranchesCount})</span>
          </button>
          <button
            type="button"
            className={`branch-chip-btn ${quickFilter === "VACANT" ? "is-active" : ""}`}
            onClick={() =>
              setQuickFilter(quickFilter === "VACANT" ? "ALL" : "VACANT")
            }
          >
            <DoorOpen
              size={13}
              style={{ color: quickFilter === "VACANT" ? "#fff" : "#0284c7" }}
            />
            <span>Còn phòng ({vacantBranchesCount})</span>
          </button>
          <button
            type="button"
            className={`branch-chip-btn ${quickFilter === "ACTIVE" ? "is-active" : ""}`}
            onClick={() =>
              setQuickFilter(quickFilter === "ACTIVE" ? "ALL" : "ACTIVE")
            }
          >
            <CheckCircle2
              size={13}
              style={{ color: quickFilter === "ACTIVE" ? "#fff" : "#059669" }}
            />
            <span>Hoạt động ({activeBranchesCount})</span>
          </button>
        </div>
      </div>

      <div className="branch-toolbar-right">
        <div className="branch-select-wrap">
          <select
            className="branch-select"
            style={{ paddingLeft: "12px" }}
            value={sortOption}
            onChange={(e) => setSortOption(e.target.value)}
            aria-label="Sắp xếp danh sách cơ sở"
          >
            <option value="REVENUE">Doanh thu cao nhất</option>
            <option value="VACANCY">Phòng trống giảm dần</option>
            <option value="NEWEST">Cơ sở mới nhất</option>
          </select>
        </div>

        <div className="branch-view-switcher">
          <button
            type="button"
            className={`branch-view-btn ${viewMode === "cards" ? "is-active" : ""}`}
            onClick={() => setViewMode("cards")}
            title="Hiển thị dạng thẻ"
          >
            <LayoutGrid size={15} />
            <span>Thẻ</span>
          </button>
          <button
            type="button"
            className={`branch-view-btn ${viewMode === "table" ? "is-active" : ""}`}
            onClick={() => setViewMode("table")}
            title="Hiển thị dạng bảng"
          >
            <TableIcon size={15} />
            <span>Bảng</span>
          </button>
        </div>
      </div>
    </div>
  );
}

