import {
  Search,
  RotateCcw,
  X,
  Building2,
  Wallet,
  FileCheck2,
  Filter,
} from "lucide-react";

const STATUS_LABELS = {
  DRAFT: "Chờ ký (nháp)",
  ACTIVE: "Đang hiệu lực",
  EXPIRING_SOON: "Sắp hết hạn (30 ngày)",
  EXPIRED: "Quá hạn",
  TERMINATED: "Đã thanh lý",
};

const DEPOSIT_LABELS = {
  UNPAID: "Chưa nhận cọc",
  PAID: "Đã nhận cọc",
  APPLIED: "Đã cấn trừ cọc",
  PARTIALLY_REFUNDED: "Hoàn một phần cọc",
  REFUNDED: "Đã hoàn cọc",
};

const CONFIRMATION_LABELS = {
  PENDING: "Chờ xác nhận 2 chiều",
  CONFIRMED: "Đã xác nhận 2 bên",
};

export default function ContractsFilterToolbar({
  status,
  setStatus,
  total,
  itemsLength,
  summaryCountAll,
  activeCount,
  expiringCount,
  expiredCount,
  draftCount,
  terminatedCount = 0,
  page,
  setPage,
  search,
  setSearch,
  depositFilter,
  setDepositFilter,
  confirmationFilter,
  setConfirmationFilter,
  branches,
  branchFilter,
  setBranchFilter,
  onReset,
}) {
  const allCount = summaryCountAll ?? total ?? itemsLength;
  const selectedBranch = branches.find((b) => b._id === branchFilter);

  const activeChips = [
    status && {
      key: "status",
      label: `Trạng thái: ${STATUS_LABELS[status] || status}`,
      onClear: () => {
        setStatus("");
        setPage(1);
      },
    },
    branchFilter && {
      key: "branch",
      label: `Cơ sở: ${selectedBranch?.name || "Đã chọn"}`,
      onClear: () => {
        setBranchFilter("");
        setPage(1);
      },
    },
    depositFilter && {
      key: "deposit",
      label: `Tiền cọc: ${DEPOSIT_LABELS[depositFilter] || depositFilter}`,
      onClear: () => {
        setDepositFilter("");
        setPage(1);
      },
    },
    confirmationFilter && {
      key: "confirmation",
      label: `Ký kết: ${
        CONFIRMATION_LABELS[confirmationFilter] || confirmationFilter
      }`,
      onClear: () => {
        setConfirmationFilter("");
        setPage(1);
      },
    },
    search.trim() && {
      key: "search",
      label: `Từ khóa: "${search.trim()}"`,
      onClear: () => {
        setSearch("");
        setPage(1);
      },
    },
  ].filter(Boolean);

  return (
    <div className="contracts-filter-card">
      {/* Row 1: Segmented Status Tabs & Result Summary */}
      <div className="contracts-tabs-row">
        <div
          className="contracts-quick-tabs"
          role="tablist"
          aria-label="Lọc theo trạng thái hợp đồng"
        >
          <button
            type="button"
            className={`contracts-tab-btn ${status === "" ? "is-active" : ""}`}
            onClick={() => {
              setStatus("");
              setPage(1);
            }}
          >
            <span>Tất cả hợp đồng</span>
            <span className="badge-count">{allCount}</span>
          </button>

          <button
            type="button"
            className={`contracts-tab-btn ${
              status === "ACTIVE" ? "is-active" : ""
            }`}
            onClick={() => {
              setStatus("ACTIVE");
              setPage(1);
            }}
          >
            <span>Đang hiệu lực</span>
            <span className="badge-count">{activeCount}</span>
          </button>

          <button
            type="button"
            className={`contracts-tab-btn ${
              status === "DRAFT" ? "is-active" : ""
            }`}
            onClick={() => {
              setStatus("DRAFT");
              setPage(1);
            }}
          >
            <span>Chờ ký (nháp)</span>
            <span
              className="badge-count"
              style={
                status === "DRAFT"
                  ? undefined
                  : { background: "#fef3c7", color: "#92400e" }
              }
            >
              {draftCount}
            </span>
          </button>

          <button
            type="button"
            className={`contracts-tab-btn ${
              status === "EXPIRING_SOON" ? "is-active" : ""
            }`}
            onClick={() => {
              setStatus("EXPIRING_SOON");
              setPage(1);
            }}
          >
            <span>Sắp hết hạn (30 ngày)</span>
            <span
              className="badge-count"
              style={
                status === "EXPIRING_SOON"
                  ? undefined
                  : { background: "#fef3c7", color: "#92400e" }
              }
            >
              {expiringCount}
            </span>
          </button>

          <button
            type="button"
            className={`contracts-tab-btn ${
              status === "EXPIRED" ? "is-active" : ""
            }`}
            onClick={() => {
              setStatus("EXPIRED");
              setPage(1);
            }}
          >
            <span>Quá hạn</span>
            <span
              className="badge-count"
              style={
                status === "EXPIRED"
                  ? undefined
                  : { background: "#fee2e2", color: "#991b1b" }
              }
            >
              {expiredCount}
            </span>
          </button>

          <button
            type="button"
            className={`contracts-tab-btn ${
              status === "TERMINATED" ? "is-active" : ""
            }`}
            onClick={() => {
              setStatus("TERMINATED");
              setPage(1);
            }}
          >
            <span>Đã thanh lý</span>
            <span className="badge-count">{terminatedCount}</span>
          </button>
        </div>

        <div className="contracts-pagination-hint">
          Hiển thị <strong>{itemsLength}</strong> / <strong>{total}</strong> kết
          quả · Trang <strong>{page}</strong>/
          <strong>{Math.max(1, Math.ceil((total || 1) / 10))}</strong>
        </div>
      </div>

      {/* Row 2: Search Box & Labeled Filter Controls */}
      <div className="contracts-filter-inputs">
        <div className="contracts-search-box">
          <Search size={15} className="contracts-search-icon" />
          <input
            type="text"
            className="contracts-search-input"
            placeholder="Tìm mã HĐ, số phòng, tên / SĐT / CCCD khách hoặc người ở cùng..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
          {search && (
            <button
              type="button"
              className="contracts-search-clear"
              onClick={() => {
                setSearch("");
                setPage(1);
              }}
              title="Xóa từ khóa tìm kiếm"
              aria-label="Xóa từ khóa tìm kiếm"
            >
              <X size={14} />
            </button>
          )}
        </div>

        <div className="contracts-filter-selects-group">
          {branches.length > 0 && (
            <label
              className={`contracts-filter-field ${
                branchFilter ? "is-filtered" : ""
              }`}
            >
              <span className="contracts-filter-field-label">
                <Building2 size={13} />
                <span>Cơ sở:</span>
              </span>
              <select
                className="contracts-select-clean"
                aria-label="Lọc theo cơ sở"
                value={branchFilter}
                onChange={(e) => {
                  setBranchFilter(e.target.value);
                  setPage(1);
                }}
              >
                <option value="">Tất cả ({branches.length})</option>
                {branches.map((b) => (
                  <option key={b._id} value={b._id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </label>
          )}

          <label
            className={`contracts-filter-field ${
              depositFilter ? "is-filtered" : ""
            }`}
          >
            <span className="contracts-filter-field-label">
              <Wallet size={13} />
              <span>Tiền cọc:</span>
            </span>
            <select
              className="contracts-select-clean"
              aria-label="Lọc theo tiền cọc"
              value={depositFilter}
              onChange={(e) => {
                setDepositFilter(e.target.value);
                setPage(1);
              }}
            >
              <option value="">Tất cả trạng thái</option>
              <option value="UNPAID">Chưa nhận cọc</option>
              <option value="PAID">Đã nhận cọc</option>
              <option value="APPLIED">Đã cấn trừ cọc</option>
              <option value="PARTIALLY_REFUNDED">Hoàn một phần cọc</option>
              <option value="REFUNDED">Đã hoàn cọc</option>
            </select>
          </label>

          <label
            className={`contracts-filter-field ${
              confirmationFilter ? "is-filtered" : ""
            }`}
          >
            <span className="contracts-filter-field-label">
              <FileCheck2 size={13} />
              <span>Ký kết:</span>
            </span>
            <select
              className="contracts-select-clean"
              aria-label="Lọc theo xác nhận hợp đồng"
              value={confirmationFilter}
              onChange={(e) => {
                setConfirmationFilter(e.target.value);
                setPage(1);
              }}
            >
              <option value="">Tất cả trạng thái</option>
              <option value="PENDING">Chờ xác nhận 2 chiều</option>
              <option value="CONFIRMED">Đã xác nhận 2 bên</option>
            </select>
          </label>

          <button
            type="button"
            className={`contracts-btn-reset ${
              activeChips.length > 0 ? "is-active" : ""
            }`}
            onClick={onReset}
            title="Đặt lại toàn bộ bộ lọc"
          >
            <RotateCcw size={14} />
            <span>
              {activeChips.length > 0
                ? `Xóa lọc (${activeChips.length})`
                : "Đặt lại"}
            </span>
          </button>
        </div>
      </div>

      {/* Row 3: Active Filter Chips (shown only when filters are active) */}
      {activeChips.length > 0 && (
        <div className="contracts-active-chips-row">
          <span className="contracts-active-chips-label">
            <Filter size={12} />
            <span>Đang lọc:</span>
          </span>
          <div className="contracts-active-chips-list">
            {activeChips.map((chip) => (
              <span key={chip.key} className="contracts-filter-chip">
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
