import { Search, X, RotateCcw } from "lucide-react";

export function TenantsFilterBar({
  searchTerm,
  setSearchTerm,
  statusFilter,
  setStatusFilter,
  hometownFilter,
  setHometownFilter,
  hometownOptions,
  totalCount,
  stats,
  hasActiveFilters,
  onResetFilters,
}) {
  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: "12px",
        alignItems: "center",
        justifyContent: "space-between",
        backgroundColor: "#ffffff",
        padding: "14px 18px",
        borderRadius: "12px",
        border: "1px solid #e2e8f0",
        boxShadow: "0 1px 3px rgba(15, 23, 42, 0.03)",
      }}
    >
      {/* Left: Search input */}
      <div
        style={{
          position: "relative",
          flex: "1 1 280px",
          maxWidth: "440px",
        }}
      >
        <Search
          size={16}
          color="#94a3b8"
          style={{
            position: "absolute",
            left: "12px",
            top: "50%",
            transform: "translateY(-50%)",
            pointerEvents: "none",
          }}
        />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Tìm theo Tên, CCCD (12 số), Số điện thoại, Email..."
          style={{
            width: "100%",
            padding: "9px 36px 9px 36px",
            borderRadius: "8px",
            border: "1px solid #cbd5e1",
            fontSize: "13px",
            outline: "none",
            backgroundColor: "#ffffff",
          }}
        />
        {searchTerm && (
          <button
            type="button"
            onClick={() => setSearchTerm("")}
            style={{
              position: "absolute",
              right: "10px",
              top: "50%",
              transform: "translateY(-50%)",
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: "4px",
              color: "#94a3b8",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
            title="Xóa từ khóa"
          >
            <X size={15} />
          </button>
        )}
      </div>

      {/* Right: Status and Hometown Dropdowns */}
      <div
        style={{
          display: "flex",
          gap: "10px",
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <span
            style={{ fontSize: "12.5px", color: "#64748b", fontWeight: 600 }}
          >
            Trạng thái:
          </span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{
              padding: "8px 12px",
              borderRadius: "8px",
              border: "1px solid #cbd5e1",
              fontSize: "13px",
              backgroundColor: "#ffffff",
              color: "#1e293b",
              cursor: "pointer",
              outline: "none",
            }}
          >
            <option value="ALL">Tất cả ({totalCount})</option>
            <option value="ACTIVE">
              Đang hoạt động ({stats.activeCount})
            </option>
            <option value="MUST_CHANGE_PW">
              Chờ đổi mật khẩu ({stats.mustChangePwCount})
            </option>
            <option value="INACTIVE">Tạm khóa (hết hợp đồng)</option>
          </select>
        </div>

        {hometownOptions.length > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span
              style={{
                fontSize: "12.5px",
                color: "#64748b",
                fontWeight: 600,
              }}
            >
              Quê quán:
            </span>
            <select
              value={hometownFilter}
              onChange={(e) => setHometownFilter(e.target.value)}
              style={{
                padding: "8px 12px",
                borderRadius: "8px",
                border: "1px solid #cbd5e1",
                fontSize: "13px",
                backgroundColor: "#ffffff",
                color: "#1e293b",
                cursor: "pointer",
                outline: "none",
                maxWidth: "180px",
              }}
            >
              <option value="ALL">Tất cả quê quán</option>
              {hometownOptions.map((ht) => (
                <option key={ht} value={ht}>
                  {ht}
                </option>
              ))}
            </select>
          </div>
        )}

        {hasActiveFilters && (
          <button
            type="button"
            onClick={onResetFilters}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "5px",
              padding: "7px 12px",
              borderRadius: "8px",
              border: "1px dashed #cbd5e1",
              backgroundColor: "#f8fafc",
              color: "#64748b",
              fontSize: "12.5px",
              fontWeight: 600,
              cursor: "pointer",
              transition: "all 0.15s ease",
            }}
            title="Đặt lại bộ lọc về mặc định"
          >
            <RotateCcw size={13} />
            <span>Xóa bộ lọc</span>
          </button>
        )}
      </div>
    </div>
  );
}

