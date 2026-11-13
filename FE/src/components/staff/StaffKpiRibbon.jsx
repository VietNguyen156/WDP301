import { Users, CheckCircle2, Clock, Lock } from "lucide-react";

export function StaffKpiRibbon({
  stats,
  hasActiveFilters,
  statusFilter,
  setStatusFilter,
  onResetFilters,
}) {
  return (
    <div className="staff-kpi-ribbon">
      <button
        type="button"
        onClick={onResetFilters}
        className={`staff-kpi-card ${!hasActiveFilters ? "is-selected" : ""}`}
        title="Bấm để xem tất cả nhân sự"
      >
        <div>
          <span className="staff-kpi-label">Tổng nhân sự</span>
          <div className="staff-kpi-value">{stats.total}</div>
        </div>
        <div
          className="staff-kpi-icon"
          style={{ background: "rgba(0, 92, 85, 0.08)", color: "#005c55" }}
        >
          <Users size={20} />
        </div>
      </button>

      <button
        type="button"
        onClick={() =>
          setStatusFilter(statusFilter === "ACTIVE" ? "ALL" : "ACTIVE")
        }
        className={`staff-kpi-card ${
          statusFilter === "ACTIVE" ? "is-selected-success" : ""
        }`}
        title="Lọc quản lý đang hoạt động bình thường"
      >
        <div>
          <span className="staff-kpi-label" style={{ color: "#059669" }}>
            Đang hoạt động
          </span>
          <div className="staff-kpi-value" style={{ color: "#059669" }}>
            {stats.activeCount}
          </div>
        </div>
        <div
          className="staff-kpi-icon"
          style={{ background: "#ecfdf5", color: "#059669" }}
        >
          <CheckCircle2 size={20} />
        </div>
      </button>

      <button
        type="button"
        onClick={() =>
          setStatusFilter(
            statusFilter === "MUST_CHANGE_PW" ? "ALL" : "MUST_CHANGE_PW",
          )
        }
        className={`staff-kpi-card ${
          statusFilter === "MUST_CHANGE_PW" ? "is-selected-warning" : ""
        }`}
        title="Lọc quản lý chưa đổi mật khẩu lần đầu"
      >
        <div>
          <span className="staff-kpi-label" style={{ color: "#b45309" }}>
            Chờ đổi mật khẩu
          </span>
          <div className="staff-kpi-value" style={{ color: "#b45309" }}>
            {stats.mustChangePwCount}
          </div>
        </div>
        <div
          className="staff-kpi-icon"
          style={{ background: "#fffbeb", color: "#d97706" }}
        >
          <Clock size={20} />
        </div>
      </button>

      <button
        type="button"
        onClick={() =>
          setStatusFilter(statusFilter === "SUSPENDED" ? "ALL" : "SUSPENDED")
        }
        className={`staff-kpi-card ${
          statusFilter === "SUSPENDED" ? "is-selected-danger" : ""
        }`}
        title="Lọc tài khoản đang tạm khóa"
      >
        <div>
          <span className="staff-kpi-label" style={{ color: "#dc2626" }}>
            Đang tạm khóa
          </span>
          <div className="staff-kpi-value" style={{ color: "#dc2626" }}>
            {stats.suspendedCount}
          </div>
        </div>
        <div
          className="staff-kpi-icon"
          style={{ background: "#fef2f2", color: "#dc2626" }}
        >
          <Lock size={20} />
        </div>
      </button>
    </div>
  );
}

