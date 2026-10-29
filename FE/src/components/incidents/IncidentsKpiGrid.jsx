import {
  Clock,
  Wrench,
  CheckCircle2,
  CheckCheck,
  XCircle,
} from "lucide-react";

export default function IncidentsKpiGrid({
  stats,
  status,
  setStatus,
  setPage,
  getProgressRate,
}) {
  return (
    <div className="inc-kpi-grid">
      <div
        className={`inc-kpi-card ${status === "PENDING" ? "is-active" : ""}`}
        onClick={() => {
          setStatus(status === "PENDING" ? "" : "PENDING");
          setPage(1);
        }}
      >
        <div className="inc-kpi-top">
          <span className="inc-kpi-label">Chờ tiếp nhận</span>
          <div
            className="inc-kpi-icon-box"
            style={{ background: "#fef3c7", color: "#d97706" }}
          >
            <Clock size={17} />
          </div>
        </div>
        <div className="inc-kpi-val" style={{ color: "#d97706" }}>
          {stats.PENDING || 0}
        </div>
        <span style={{ fontSize: "11px", color: "var(--inc-text-muted)" }}>
          Sự cố mới báo
        </span>
        <div className="inc-kpi-progress-bar">
          <div
            className="inc-kpi-progress-fill"
            style={{
              width: `${getProgressRate(stats.PENDING)}%`,
              background: "#d97706",
            }}
          />
        </div>
      </div>

      <div
        className={`inc-kpi-card ${status === "IN_PROGRESS" ? "is-active" : ""}`}
        onClick={() => {
          setStatus(status === "IN_PROGRESS" ? "" : "IN_PROGRESS");
          setPage(1);
        }}
      >
        <div className="inc-kpi-top">
          <span className="inc-kpi-label">Đang xử lý</span>
          <div
            className="inc-kpi-icon-box"
            style={{ background: "#e0e7ff", color: "#4f46e5" }}
          >
            <Wrench size={17} />
          </div>
        </div>
        <div className="inc-kpi-val" style={{ color: "#4f46e5" }}>
          {stats.IN_PROGRESS || 0}
        </div>
        <span style={{ fontSize: "11px", color: "var(--inc-text-muted)" }}>
          Đang sửa chữa
        </span>
        <div className="inc-kpi-progress-bar">
          <div
            className="inc-kpi-progress-fill"
            style={{
              width: `${getProgressRate(stats.IN_PROGRESS)}%`,
              background: "#4f46e5",
            }}
          />
        </div>
      </div>

      <div
        className={`inc-kpi-card ${status === "SOLVED" ? "is-active" : ""}`}
        onClick={() => {
          setStatus(status === "SOLVED" ? "" : "SOLVED");
          setPage(1);
        }}
      >
        <div className="inc-kpi-top">
          <span className="inc-kpi-label">Đã khắc phục</span>
          <div
            className="inc-kpi-icon-box"
            style={{ background: "#d1fae5", color: "#059669" }}
          >
            <CheckCircle2 size={17} />
          </div>
        </div>
        <div className="inc-kpi-val" style={{ color: "#059669" }}>
          {stats.SOLVED || 0}
        </div>
        <span style={{ fontSize: "11px", color: "var(--inc-text-muted)" }}>
          Chờ nghiệm thu & chi phí
        </span>
        <div className="inc-kpi-progress-bar">
          <div
            className="inc-kpi-progress-fill"
            style={{
              width: `${getProgressRate(stats.SOLVED)}%`,
              background: "#059669",
            }}
          />
        </div>
      </div>

      <div
        className={`inc-kpi-card ${status === "CLOSED" ? "is-active" : ""}`}
        onClick={() => {
          setStatus(status === "CLOSED" ? "" : "CLOSED");
          setPage(1);
        }}
      >
        <div className="inc-kpi-top">
          <span className="inc-kpi-label">Hoàn tất đóng</span>
          <div
            className="inc-kpi-icon-box"
            style={{ background: "#f1f5f9", color: "#475569" }}
          >
            <CheckCheck size={17} />
          </div>
        </div>
        <div className="inc-kpi-val" style={{ color: "#475569" }}>
          {stats.CLOSED || 0}
        </div>
        <span style={{ fontSize: "11px", color: "var(--inc-text-muted)" }}>
          Đã thanh toán / đóng hồ sơ
        </span>
        <div className="inc-kpi-progress-bar">
          <div
            className="inc-kpi-progress-fill"
            style={{
              width: `${getProgressRate(stats.CLOSED)}%`,
              background: "#475569",
            }}
          />
        </div>
      </div>

      <div
        className={`inc-kpi-card ${status === "REJECTED" ? "is-active" : ""}`}
        onClick={() => {
          setStatus(status === "REJECTED" ? "" : "REJECTED");
          setPage(1);
        }}
      >
        <div className="inc-kpi-top">
          <span className="inc-kpi-label">Từ chối</span>
          <div
            className="inc-kpi-icon-box"
            style={{ background: "#fee2e2", color: "#dc2626" }}
          >
            <XCircle size={17} />
          </div>
        </div>
        <div className="inc-kpi-val" style={{ color: "#dc2626" }}>
          {stats.REJECTED || 0}
        </div>
        <span style={{ fontSize: "11px", color: "var(--inc-text-muted)" }}>
          Không giải quyết
        </span>
        <div className="inc-kpi-progress-bar">
          <div
            className="inc-kpi-progress-fill"
            style={{
              width: `${getProgressRate(stats.REJECTED)}%`,
              background: "#dc2626",
            }}
          />
        </div>
      </div>
    </div>
  );
}

