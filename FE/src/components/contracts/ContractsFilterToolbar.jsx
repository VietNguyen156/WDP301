import { Search, RefreshCw } from "lucide-react";

export default function ContractsFilterToolbar({
  status,
  setStatus,
  total,
  itemsLength,
  activeCount,
  expiringCount,
  expiredCount,
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
  return (
    <div className="contracts-filter-card">
      {/* Quick Filter Tabs */}
      <div className="contracts-tabs-row">
        <div className="contracts-quick-tabs">
          <button
            type="button"
            className={`contracts-tab-btn ${status === "" ? "is-active" : ""}`}
            onClick={() => {
              setStatus("");
              setPage(1);
            }}
          >
            Tất cả hợp đồng
            <span className="badge-count">{total || itemsLength}</span>
          </button>
          <button
            type="button"
            className={`contracts-tab-btn ${status === "ACTIVE" ? "is-active" : ""}`}
            onClick={() => {
              setStatus("ACTIVE");
              setPage(1);
            }}
          >
            Đang hiệu lực
            <span className="badge-count">{activeCount}</span>
          </button>
          <button
            type="button"
            className={`contracts-tab-btn ${status === "EXPIRING_SOON" ? "is-active" : ""}`}
            onClick={() => {
              setStatus("EXPIRING_SOON");
              setPage(1);
            }}
          >
            Sắp hết hạn (30 ngày)
            <span
              className="badge-count"
              style={{ background: "#fef3c7", color: "#92400e" }}
            >
              {expiringCount}
            </span>
          </button>
          <button
            type="button"
            className={`contracts-tab-btn ${status === "EXPIRED" ? "is-active" : ""}`}
            onClick={() => {
              setStatus("EXPIRED");
              setPage(1);
            }}
          >
            Quá hạn
            <span
              className="badge-count"
              style={{ background: "#fee2e2", color: "#991b1b" }}
            >
              {expiredCount}
            </span>
          </button>
          <button
            type="button"
            className={`contracts-tab-btn ${status === "TERMINATED" ? "is-active" : ""}`}
            onClick={() => {
              setStatus("TERMINATED");
              setPage(1);
            }}
          >
            Đã thanh lý
          </button>
        </div>

        <span style={{ fontSize: 12, color: "#64748b" }}>
          Trang <strong>{page}</strong> /{" "}
          <strong>{Math.ceil((total || 1) / 10)}</strong>
        </span>
      </div>

      {/* Search & Branch Select Row */}
      <div className="contracts-filter-inputs">
        <div style={{ position: "relative", flex: 1, minWidth: 260 }}>
          <Search
            size={15}
            style={{
              position: "absolute",
              left: 10,
              top: 10,
              color: "#94a3b8",
            }}
          />
          <input
            type="text"
            className="contracts-search-input"
            placeholder="Mã hợp đồng, số phòng, tên / SĐT / CCCD khách hoặc người ở cùng..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>

        <select
          className="contracts-select"
          aria-label="Lọc theo tiền cọc"
          value={depositFilter}
          onChange={(e) => {
            setDepositFilter(e.target.value);
            setPage(1);
          }}
        >
          <option value="">Mọi trạng thái cọc</option>
          <option value="UNPAID">Chưa nhận cọc</option>
          <option value="PAID">Đã nhận cọc</option>
          <option value="APPLIED">Đã cấn trừ cọc</option>
          <option value="PARTIALLY_REFUNDED">Hoàn một phần cọc</option>
          <option value="REFUNDED">Đã hoàn cọc</option>
        </select>

        <select
          className="contracts-select"
          aria-label="Lọc theo xác nhận hợp đồng"
          value={confirmationFilter}
          onChange={(e) => {
            setConfirmationFilter(e.target.value);
            setPage(1);
          }}
        >
          <option value="">Mọi trạng thái xác nhận</option>
          <option value="PENDING">Chờ xác nhận 2 chiều</option>
          <option value="CONFIRMED">Đã xác nhận 2 bên</option>
        </select>

        {branches.length > 0 && (
          <select
            className="contracts-select"
            value={branchFilter}
            onChange={(e) => {
              setBranchFilter(e.target.value);
              setPage(1);
            }}
          >
            <option value="">Tất cả cơ sở ({branches.length})</option>
            {branches.map((b) => (
              <option key={b._id} value={b._id}>
                {b.name}
              </option>
            ))}
          </select>
        )}

        <button
          type="button"
          className="contracts-btn-outline"
          onClick={onReset}
          title="Đặt lại bộ lọc"
        >
          <RefreshCw size={14} />
          <span>Đặt lại</span>
        </button>
      </div>
    </div>
  );
}

