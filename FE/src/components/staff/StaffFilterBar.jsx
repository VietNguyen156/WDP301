import {
  Search,
  X,
  RotateCcw,
  Building2,
  Activity,
  Filter,
} from "lucide-react";

const STATUS_LABELS = {
  ACTIVE: "Đang hoạt động",
  MUST_CHANGE_PW: "Chờ đổi mật khẩu",
  SUSPENDED: "Đang tạm khóa",
};

export function StaffFilterBar({
  searchTerm,
  setSearchTerm,
  statusFilter,
  setStatusFilter,
  branchFilter,
  setBranchFilter,
  branches,
  totalCount,
  stats,
  onResetFilters,
}) {
  const selectedBranch = branches.find((b) => String(b._id) === branchFilter);

  const activeChips = [
    statusFilter !== "ALL" && {
      key: "status",
      label: `Trạng thái: ${STATUS_LABELS[statusFilter] || statusFilter}`,
      onClear: () => setStatusFilter("ALL"),
    },
    branchFilter !== "ALL" && {
      key: "branch",
      label:
        branchFilter === "UNASSIGNED"
          ? "Cơ sở: Chưa gán cơ sở"
          : `Cơ sở: ${selectedBranch?.name || "Đã chọn"}`,
      onClear: () => setBranchFilter("ALL"),
    },
    searchTerm.trim() && {
      key: "search",
      label: `Từ khóa: "${searchTerm.trim()}"`,
      onClear: () => setSearchTerm(""),
    },
  ].filter(Boolean);

  return (
    <div className="staff-filter-card">
      <div className="staff-filter-controls">
        <div className="staff-search-box">
          <Search size={15} className="staff-search-icon" />
          <input
            type="text"
            className="staff-search-input"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Tìm theo Họ tên, SĐT đăng nhập, Email hoặc cơ sở phụ trách..."
          />
          {searchTerm && (
            <button
              type="button"
              className="staff-search-clear"
              onClick={() => setSearchTerm("")}
              title="Xóa từ khóa"
              aria-label="Xóa từ khóa tìm kiếm"
            >
              <X size={14} />
            </button>
          )}
        </div>

        <div className="staff-selects-group">
          <label
            className={`staff-filter-field ${
              statusFilter !== "ALL" ? "is-filtered" : ""
            }`}
          >
            <span className="staff-filter-field-label">
              <Activity size={13} />
              <span>Trạng thái:</span>
            </span>
            <select
              className="staff-select-clean"
              aria-label="Lọc theo trạng thái nhân sự"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="ALL">Tất cả ({totalCount})</option>
              <option value="ACTIVE">
                Đang hoạt động ({stats.activeCount})
              </option>
              <option value="MUST_CHANGE_PW">
                Chờ đổi mật khẩu ({stats.mustChangePwCount})
              </option>
              <option value="SUSPENDED">
                Đang tạm khóa ({stats.suspendedCount})
              </option>
            </select>
          </label>

          <label
            className={`staff-filter-field ${
              branchFilter !== "ALL" ? "is-filtered" : ""
            }`}
          >
            <span className="staff-filter-field-label">
              <Building2 size={13} />
              <span>Cơ sở:</span>
            </span>
            <select
              className="staff-select-clean"
              aria-label="Lọc theo cơ sở phụ trách"
              value={branchFilter}
              onChange={(e) => setBranchFilter(e.target.value)}
            >
              <option value="ALL">Tất cả cơ sở</option>
              <option value="UNASSIGNED">Chưa gán cơ sở</option>
              {branches.map((b) => (
                <option key={b._id} value={String(b._id)}>
                  {b.name}
                </option>
              ))}
            </select>
          </label>

          {activeChips.length > 0 && (
            <button
              type="button"
              className="staff-btn-reset"
              onClick={onResetFilters}
              title="Đặt lại toàn bộ bộ lọc"
            >
              <RotateCcw size={14} />
              <span>Xóa lọc ({activeChips.length})</span>
            </button>
          )}
        </div>
      </div>

      {activeChips.length > 0 && (
        <div className="staff-active-chips-row">
          <span className="staff-active-chips-label">
            <Filter size={12} />
            <span>Đang lọc:</span>
          </span>
          <div className="staff-active-chips-list">
            {activeChips.map((chip) => (
              <span key={chip.key} className="staff-filter-chip">
                <span>{chip.label}</span>
                <button
                  type="button"
                  onClick={chip.onClear}
                  aria-label={`Bỏ lọc ${chip.label}`}
                >
                  <X size={12} />
                </button>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

