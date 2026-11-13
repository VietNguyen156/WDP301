import { Layers, CheckCircle2, Clock, Lock } from "lucide-react";

export default function UtilityKpiGrid({
  stats,
  filterStatus,
  setFilterStatus,
  setCurrentIndex,
}) {
  return (
    <div className="util-kpi-grid">
      <button
        type="button"
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
            <Layers size={16} />
          </div>
        </div>
        <div className="util-kpi-val">{stats.total}</div>
        <div className="util-kpi-sub">Phòng thuê &amp; đã chốt</div>
      </button>

      <button
        type="button"
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
            <CheckCircle2 size={16} />
          </div>
        </div>
        <div className="util-kpi-val" style={{ color: "#059669" }}>
          {stats.recorded}
        </div>
        <div className="util-kpi-sub">
          {stats.total ? Math.round((stats.recorded / stats.total) * 100) : 0}%
          hoàn thành
        </div>
      </button>

      <button
        type="button"
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
            <Clock size={16} />
          </div>
        </div>
        <div className="util-kpi-val" style={{ color: "#d97706" }}>
          {stats.pending}
        </div>
        <div className="util-kpi-sub">Cần nhập số đo</div>
      </button>

      <div className="util-kpi-card is-static">
        <div className="util-kpi-top">
          <span className="util-kpi-label">Đã lập hóa đơn</span>
          <div
            className="util-kpi-icon"
            style={{ background: "#f1f5f9", color: "#334155" }}
          >
            <Lock size={16} />
          </div>
        </div>
        <div className="util-kpi-val" style={{ color: "#334155" }}>
          {stats.billed}
        </div>
        <div className="util-kpi-sub">Chỉ số đã khóa sổ HĐ</div>
      </div>
    </div>
  );
}
