import {
  DoorOpen,
  Users,
  Sparkles,
  Wrench,
  AlertCircle,
} from "lucide-react";

export function RoomsMetricsGrid({
  hasData,
  total,
  stats,
  occupancyRate,
  maintenanceCount,
  status,
  onSelectStatus,
}) {
  return (
    <div className="rooms-metrics-grid">
      <div
        className={`rooms-metric-card tone-neutral ${status === "" ? "is-active" : ""}`}
        onClick={() => onSelectStatus("")}
        title="Xem tất cả các phòng"
      >
        <div className="rooms-metric-card-top">
          <span className="rooms-metric-label">Tổng số phòng</span>
          <div className="rooms-metric-icon-box">
            <DoorOpen size={18} />
          </div>
        </div>
        <div className="rooms-metric-val">{hasData ? total : "—"}</div>
        <div className="rooms-metric-detail">
          <span>100% quỹ phòng cơ sở</span>
        </div>
      </div>

      <div
        className={`rooms-metric-card tone-emerald ${status === "RENTED" ? "is-active" : ""}`}
        onClick={() => onSelectStatus("RENTED")}
        title="Lọc các phòng đang cho thuê"
      >
        <div className="rooms-metric-card-top">
          <span className="rooms-metric-label">Đang cho thuê</span>
          <div className="rooms-metric-icon-box">
            <Users size={18} />
          </div>
        </div>
        <div className="rooms-metric-val">
          {hasData ? stats.RENTED || 0 : "—"}
        </div>
        <div className="rooms-metric-detail">
          <span>{occupancyRate}% tỷ lệ lấp đầy</span>
        </div>
        <div className="rooms-progress-bar">
          <div
            className="rooms-progress-fill fill-emerald"
            style={{ width: `${occupancyRate}%` }}
          />
        </div>
      </div>

      <div
        className={`rooms-metric-card tone-cyan ${status === "EMPTY" ? "is-active" : ""}`}
        onClick={() => onSelectStatus("EMPTY")}
        title="Lọc các phòng đang trống"
      >
        <div className="rooms-metric-card-top">
          <span className="rooms-metric-label">Phòng trống</span>
          <div className="rooms-metric-icon-box">
            <Sparkles size={18} />
          </div>
        </div>
        <div className="rooms-metric-val">
          {hasData ? stats.EMPTY || 0 : "—"}
        </div>
        <div className="rooms-metric-detail">
          <span>Sẵn sàng ký hợp đồng mới</span>
        </div>
      </div>

      <div
        className={`rooms-metric-card tone-amber ${status === "MAINTENANCE" || status === "CLEANING" ? "is-active" : ""}`}
        onClick={() =>
          onSelectStatus(status === "CLEANING" ? "MAINTENANCE" : "CLEANING")
        }
        title="Lọc phòng cần dọn dẹp hoặc bảo trì"
      >
        <div className="rooms-metric-card-top">
          <span className="rooms-metric-label">Dọn dẹp &amp; Sửa chữa</span>
          <div className="rooms-metric-icon-box">
            <Wrench size={18} />
          </div>
        </div>
        <div className="rooms-metric-val">
          {hasData ? maintenanceCount : "—"}
        </div>
        <div className="rooms-metric-detail">
          <span>
            {stats.CLEANING || 0} cần dọn · {stats.MAINTENANCE || 0} bảo trì
          </span>
        </div>
      </div>

      <div
        className={`rooms-metric-card tone-rose ${status === "INACTIVE" ? "is-active" : ""}`}
        onClick={() => onSelectStatus("INACTIVE")}
        title="Lọc phòng ngừng hoạt động"
      >
        <div className="rooms-metric-card-top">
          <span className="rooms-metric-label">Tạm dừng</span>
          <div className="rooms-metric-icon-box">
            <AlertCircle size={18} />
          </div>
        </div>
        <div className="rooms-metric-val">
          {hasData ? stats.INACTIVE || 0 : "—"}
        </div>
        <div className="rooms-metric-detail">
          <span>Kho hoặc ngừng kinh doanh</span>
        </div>
      </div>
    </div>
  );
}

