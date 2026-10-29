import { Layers, CheckCircle2, Clock, Lock } from "lucide-react";

export default function UtilityKpiGrid({
  stats,
  filterStatus,
  setFilterStatus,
  setCurrentIndex,
}) {
  return (
    <div className="util-kpi-grid">
      <div
        className={`util-kpi-card ${filterStatus === "ALL" ? "is-active" : ""}`}
        onClick={() => {
          setFilterStatus("ALL");
          setCurrentIndex(0);
        }}
      >
        <div className="util-kpi-top">
          <span className="util-kpi-label">Tổng phòng kỳ này</span>
          <div
            className="util-kpi-icon"
            style={{ background: "#f1f5f9", color: "#475569" }}
          >
            <Layers size={17} />
          </div>
        </div>
        <div className="util-kpi-val">{stats.total}</div>
        <div className="util-kpi-sub">Bao gồm phòng thuê & đã chốt</div>
      </div>

      <div
        className={`util-kpi-card ${filterStatus === "RECORDED" ? "is-active" : ""}`}
        onClick={() => {
          setFilterStatus("RECORDED");
          setCurrentIndex(0);
        }}
      >
        <div className="util-kpi-top">
          <span className="util-kpi-label">Đã chốt số</span>
          <div
            className="util-kpi-icon"
            style={{ background: "#ecfdf5", color: "#059669" }}
          >
            <CheckCircle2 size={17} />
          </div>
        </div>
        <div className="util-kpi-val" style={{ color: "#059669" }}>
          {stats.recorded}
        </div>
        <div className="util-kpi-sub">
          {stats.total ? Math.round((stats.recorded / stats.total) * 100) : 0}%
          tiến độ hoàn thành
        </div>
      </div>

      <div
        className={`util-kpi-card ${filterStatus === "PENDING" ? "is-active" : ""}`}
        onClick={() => {
          setFilterStatus("PENDING");
          setCurrentIndex(0);
        }}
      >
        <div className="util-kpi-top">
          <span className="util-kpi-label">Chưa chốt số</span>
          <div
            className="util-kpi-icon"
            style={{ background: "#fffbeb", color: "#d97706" }}
          >
            <Clock size={17} />
          </div>
        </div>
        <div className="util-kpi-val" style={{ color: "#d97706" }}>
          {stats.pending}
        </div>
        <div className="util-kpi-sub">Cần nhập số đo tháng này</div>
      </div>

      <div className="util-kpi-card">
        <div className="util-kpi-top">
          <span className="util-kpi-label">Đã lập hóa đơn</span>
          <div
            className="util-kpi-icon"
            style={{ background: "#f5f3ff", color: "#7c3aed" }}
          >
            <Lock size={17} />
          </div>
        </div>
        <div className="util-kpi-val" style={{ color: "#7c3aed" }}>
          {stats.billed}
        </div>
        <div className="util-kpi-sub">Chỉ số đã khóa sổ hóa đơn</div>
      </div>
    </div>
  );
}

