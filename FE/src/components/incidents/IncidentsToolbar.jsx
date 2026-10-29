import {
  Building2,
  Filter,
  SlidersHorizontal,
  Tags,
  RefreshCw,
  Plus,
} from "lucide-react";
import { Button, SearchBox } from "../ui";
import {
  STATUS_LABELS,
  PRIORITY_LABELS,
  CATEGORY_LABELS,
} from "../../hooks/useIncidentsPage";

export default function IncidentsToolbar({
  searchTerm,
  setSearchTerm,
  isStaff,
  branches,
  branchId,
  onBranchChange,
  status,
  setStatus,
  priority,
  setPriority,
  category,
  setCategory,
  needsReview,
  setNeedsReview,
  setPage,
  loading,
  onReload,
  onOpenCreate,
}) {
  return (
    <div className="inc-toolbar">
      <div className="inc-toolbar-left">
        {/* Search Box */}
        <div style={{ minWidth: "240px", flex: "1 1 240px" }}>
          <SearchBox
            value={searchTerm}
            onChange={setSearchTerm}
            placeholder="Tìm sự cố, số phòng, người báo..."
          />
        </div>

        {/* Branch select for staff */}
        {isStaff && branches.length > 0 && (
          <div className="inc-select-wrapper">
            <Building2 size={15} className="inc-select-icon" />
            <select
              className="inc-select"
              value={branchId}
              onChange={(e) => onBranchChange(e.target.value)}
            >
              <option value="">Tất cả cơ sở</option>
              {branches.map((b) => (
                <option key={b._id} value={b._id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Status select */}
        <div className="inc-select-wrapper">
          <Filter size={15} className="inc-select-icon" />
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
        </div>

        {/* Priority select */}
        <div className="inc-select-wrapper">
          <SlidersHorizontal size={15} className="inc-select-icon" />
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

        {/* Category select (TypeSafe triage) */}
        <div className="inc-select-wrapper">
          <Tags size={15} className="inc-select-icon" />
          <select
            className="inc-select"
            aria-label="Lọc theo loại sự cố"
            value={category}
            onChange={(e) => {
              setCategory(e.target.value);
              setPage(1);
            }}
          >
            <option value="">Tất cả loại sự cố</option>
            {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
            <option value="UNCLASSIFIED">Chưa phân loại</option>
          </select>
        </div>

        {isStaff && (
          <label className="inc-review-toggle">
            <input
              type="checkbox"
              checked={needsReview}
              onChange={(e) => {
                setNeedsReview(e.target.checked);
                setPage(1);
              }}
            />
            <span>Cần xem lại</span>
          </label>
        )}

        {/* Reload Button */}
        <Button
          variant="secondary"
          compact
          onClick={onReload}
          title="Tải lại danh sách sự cố"
          aria-label="Tải lại dữ liệu"
        >
          <RefreshCw size={15} className={loading ? "spin" : ""} />
        </Button>
      </div>

      <Button
        onClick={onOpenCreate}
        style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
      >
        <Plus size={16} />
        <span>Báo cáo sự cố mới</span>
      </Button>
    </div>
  );
}

