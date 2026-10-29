import { Users, CheckCircle2, Clock, ShieldCheck } from "lucide-react";

export function TenantsKpiRibbon({
  stats,
  hasActiveFilters,
  statusFilter,
  setStatusFilter,
  onResetFilters,
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
        gap: "14px",
      }}
    >
      {/* Card 1: Tổng số */}
      <div
        onClick={onResetFilters}
        style={{
          backgroundColor: "#ffffff",
          border: !hasActiveFilters
            ? "1.5px solid #005c55"
            : "1px solid #e2e8f0",
          borderRadius: "12px",
          padding: "16px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          cursor: "pointer",
          boxShadow: "0 1px 3px rgba(15, 23, 42, 0.04)",
          transition: "all 0.15s ease",
        }}
        title="Bấm để xem tất cả cư dân"
      >
        <div>
          <span
            style={{
              fontSize: "12px",
              color: "#64748b",
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.02em",
            }}
          >
            Tổng số cư dân
          </span>
          <div
            style={{
              fontSize: "24px",
              fontWeight: 800,
              color: "#0f172a",
              marginTop: "4px",
            }}
          >
            {stats.total}
          </div>
        </div>
        <div
          style={{
            width: "42px",
            height: "42px",
            borderRadius: "10px",
            backgroundColor: "rgba(0, 92, 85, 0.08)",
            color: "#005c55",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Users size={20} />
        </div>
      </div>

      {/* Card 2: Đang hoạt động */}
      <div
        onClick={() =>
          setStatusFilter(statusFilter === "ACTIVE" ? "ALL" : "ACTIVE")
        }
        style={{
          backgroundColor: "#ffffff",
          border:
            statusFilter === "ACTIVE"
              ? "1.5px solid #059669"
              : "1px solid #e2e8f0",
          borderRadius: "12px",
          padding: "16px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          cursor: "pointer",
          boxShadow: "0 1px 3px rgba(15, 23, 42, 0.04)",
          transition: "all 0.15s ease",
        }}
        title="Lọc cư dân đang hoạt động bình thường"
      >
        <div>
          <span
            style={{
              fontSize: "12px",
              color: "#059669",
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.02em",
            }}
          >
            Đang hoạt động
          </span>
          <div
            style={{
              fontSize: "24px",
              fontWeight: 800,
              color: "#059669",
              marginTop: "4px",
            }}
          >
            {stats.activeCount}
          </div>
        </div>
        <div
          style={{
            width: "42px",
            height: "42px",
            borderRadius: "10px",
            backgroundColor: "#ecfdf5",
            color: "#059669",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <CheckCircle2 size={20} />
        </div>
      </div>

      {/* Card 3: Chờ đổi mật khẩu */}
      <div
        onClick={() =>
          setStatusFilter(
            statusFilter === "MUST_CHANGE_PW" ? "ALL" : "MUST_CHANGE_PW",
          )
        }
        style={{
          backgroundColor: "#ffffff",
          border:
            statusFilter === "MUST_CHANGE_PW"
              ? "1.5px solid #d97706"
              : "1px solid #e2e8f0",
          borderRadius: "12px",
          padding: "16px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          cursor: "pointer",
          boxShadow: "0 1px 3px rgba(15, 23, 42, 0.04)",
          transition: "all 0.15s ease",
        }}
        title="Lọc cư dân chưa đăng nhập đổi mật khẩu lần đầu"
      >
        <div>
          <span
            style={{
              fontSize: "12px",
              color: "#b45309",
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.02em",
            }}
          >
            Chờ đổi mật khẩu
          </span>
          <div
            style={{
              fontSize: "24px",
              fontWeight: 800,
              color: "#b45309",
              marginTop: "4px",
            }}
          >
            {stats.mustChangePwCount}
          </div>
        </div>
        <div
          style={{
            width: "42px",
            height: "42px",
            borderRadius: "10px",
            backgroundColor: "#fffbeb",
            color: "#d97706",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Clock size={20} />
        </div>
      </div>

      {/* Card 4: Định danh CCCD 12 số */}
      <div
        style={{
          backgroundColor: "#ffffff",
          border: "1px solid #e2e8f0",
          borderRadius: "12px",
          padding: "16px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          boxShadow: "0 1px 3px rgba(15, 23, 42, 0.04)",
        }}
      >
        <div>
          <span
            style={{
              fontSize: "12px",
              color: "#64748b",
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.02em",
            }}
          >
            Định danh CCCD 12 số
          </span>
          <div
            style={{
              fontSize: "24px",
              fontWeight: 800,
              color: "#0f172a",
              marginTop: "4px",
            }}
          >
            {stats.citizenIdCount}
          </div>
        </div>
        <div
          style={{
            width: "42px",
            height: "42px",
            borderRadius: "10px",
            backgroundColor: "#f1f5f9",
            color: "#475569",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <ShieldCheck size={20} />
        </div>
      </div>
    </div>
  );
}

