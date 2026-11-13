import {
  Search,
  X,
  RotateCcw,
  ShieldCheck,
  ArrowUpDown,
  Filter,
  Activity,
} from "lucide-react";

const STATUS_LABELS = {
  ACTIVE: "Đang hoạt động",
  MUST_CHANGE_PW: "Chờ đổi mật khẩu",
  INACTIVE: "Tạm khóa (hết HĐ)",
};

const PROFILE_LABELS = {
  COMPLETE: "Đủ thông tin (CCCD + SĐT + Email)",
  HAS_CCCD: "Đã định danh CCCD 12 số",
  MISSING_CCCD: "Chưa có CCCD chuẩn",
  MISSING_CONTACT: "Thiếu SĐT hoặc Email",
};

const SORT_LABELS = {
  NAME_ASC: "Tên A → Z",
  NAME_DESC: "Tên Z → A",
};

export function TenantsFilterBar({
  searchTerm,
  setSearchTerm,
  statusFilter,
  setStatusFilter,
  profileFilter,
  setProfileFilter,
  sortBy,
  setSortBy,
  totalCount,
  stats,
  onResetFilters,
}) {
  const activeChips = [
    statusFilter !== "ALL" && {
      key: "status",
      label: `Trạng thái: ${STATUS_LABELS[statusFilter] || statusFilter}`,
      onClear: () => setStatusFilter("ALL"),
    },
    profileFilter !== "ALL" && {
      key: "profile",
      label: `Hồ sơ: ${PROFILE_LABELS[profileFilter] || profileFilter}`,
      onClear: () => setProfileFilter("ALL"),
    },
    sortBy !== "DEFAULT" && {
      key: "sort",
      label: `Sắp xếp: ${SORT_LABELS[sortBy] || sortBy}`,
      onClear: () => setSortBy("DEFAULT"),
    },
    searchTerm.trim() && {
      key: "search",
      label: `Từ khóa: "${searchTerm.trim()}"`,
      onClear: () => setSearchTerm(""),
    },
  ].filter(Boolean);

  return (
    <div className="tenants-filter-card">
      <div className="tenants-filter-controls">
        <div className="tenants-search-box">
          <Search size={15} className="tenants-search-icon" />
          <input
            type="text"
            className="tenants-search-input"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Tìm theo Họ tên, CCCD (12 số), SĐT, Email hoặc địa chỉ..."
          />
          {searchTerm && (
            <button
              type="button"
              className="tenants-search-clear"
              onClick={() => setSearchTerm("")}
              title="Xóa từ khóa tìm kiếm"
              aria-label="Xóa từ khóa tìm kiếm"
            >
              <X size={14} />
            </button>
          )}
        </div>

        <div className="tenants-selects-group">
          <label
            className={`tenants-filter-field ${statusFilter !== "ALL" ? "is-filtered" : ""}`}
          >
            <span className="tenants-filter-field-label">
              <Activity size={13} />
              <span>Trạng thái:</span>
            </span>
            <select
              className="tenants-select-clean"
              aria-label="Lọc theo trạng thái tài khoản cư dân"
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
              <option value="INACTIVE">
                Tạm khóa (hết HĐ) ({stats.inactiveCount})
              </option>
            </select>
          </label>

          <label
            className={`tenants-filter-field ${profileFilter !== "ALL" ? "is-filtered" : ""}`}
          >
            <span className="tenants-filter-field-label">
              <ShieldCheck size={13} />
              <span>Hồ sơ:</span>
            </span>
            <select
              className="tenants-select-clean"
              aria-label="Lọc theo tình trạng hồ sơ định danh và liên hệ"
              value={profileFilter}
              onChange={(e) => setProfileFilter(e.target.value)}
            >
              <option value="ALL">Tất cả hồ sơ</option>
              <option value="COMPLETE">Đủ thông tin (CCCD + SĐT + Email)</option>
              <option value="HAS_CCCD">
                Đã định danh CCCD 12 số ({stats.citizenIdCount})
              </option>
              <option value="MISSING_CCCD">Chưa có CCCD chuẩn</option>
              <option value="MISSING_CONTACT">
                Thiếu SĐT hoặc Email ({stats.missingContactCount})
              </option>
            </select>
          </label>

          <label
            className={`tenants-filter-field ${sortBy !== "DEFAULT" ? "is-filtered" : ""}`}
          >
            <span className="tenants-filter-field-label">
              <ArrowUpDown size={13} />
              <span>Sắp xếp:</span>
            </span>
            <select
              className="tenants-select-clean"
              aria-label="Sắp xếp danh sách cư dân"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
            >
              <option value="DEFAULT">Mới cấp gần nhất</option>
              <option value="NAME_ASC">Tên A → Z</option>
              <option value="NAME_DESC">Tên Z → A</option>
            </select>
          </label>

          {activeChips.length > 0 && (
            <button
              type="button"
              className="tenants-btn-reset is-active"
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
        <div className="tenants-active-chips-row">
          <span className="tenants-active-chips-label">
            <Filter size={12} />
            <span>Đang lọc:</span>
          </span>
          <div className="tenants-active-chips-list">
            {activeChips.map((chip) => (
              <span key={chip.key} className="tenants-filter-chip">
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
