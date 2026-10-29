import { Building2, DoorOpen, TrendingUp, Banknote } from "lucide-react";

export function BranchKpiGrid({ metrics, financialMetrics }) {
  return (
    <div className="branch-kpi-grid">
      <div className="branch-kpi-card">
        <div className="branch-kpi-top">
          <span className="branch-kpi-label">Cơ sở vận hành</span>
          <div
            className="branch-kpi-icon-box"
            style={{
              background: "rgba(0, 92, 85, 0.1)",
              color: "var(--branch-primary)",
            }}
          >
            <Building2 size={18} />
          </div>
        </div>
        <div>
          <div className="branch-kpi-value">{metrics.totalBranches} Tòa</div>
          <div className="branch-kpi-sub">{metrics.cityText}</div>
        </div>
      </div>

      <div className="branch-kpi-card">
        <div className="branch-kpi-top">
          <span className="branch-kpi-label">Quy mô phòng</span>
          <div
            className="branch-kpi-icon-box"
            style={{ background: "#eff6ff", color: "#2563eb" }}
          >
            <DoorOpen size={18} />
          </div>
        </div>
        <div>
          <div className="branch-kpi-value">{metrics.totalRooms} Phòng</div>
          <div className="branch-kpi-sub">
            {metrics.rentedRooms} đang thuê · {metrics.vacantRooms} trống
          </div>
        </div>
      </div>

      <div className="branch-kpi-card">
        <div className="branch-kpi-top">
          <span className="branch-kpi-label">Tỷ lệ lấp đầy</span>
          <div
            className="branch-kpi-icon-box"
            style={{ background: "#ecfdf5", color: "#059669" }}
          >
            <TrendingUp size={18} />
          </div>
        </div>
        <div>
          <div
            className="branch-kpi-value"
            style={{
              color: metrics.occupancyRate >= 85 ? "#059669" : "#d97706",
            }}
          >
            {metrics.occupancyRate}%
          </div>
          <div className="branch-kpi-sub">
            {metrics.occupancyRate >= 85
              ? "Đạt mục tiêu hòa vốn"
              : "Dưới ngưỡng hòa vốn (85%)"}
          </div>
          <div className="branch-kpi-progress">
            <div
              className="branch-kpi-progress-fill"
              style={{
                width: `${Math.min(metrics.occupancyRate, 100)}%`,
                background:
                  metrics.occupancyRate >= 85 ? "#059669" : "#d97706",
              }}
            />
          </div>
        </div>
      </div>

      <div className="branch-kpi-card">
        <div className="branch-kpi-top">
          <span className="branch-kpi-label">Doanh thu thực thu</span>
          <div
            className="branch-kpi-icon-box"
            style={{ background: "#fef3c7", color: "#d97706" }}
          >
            <Banknote size={18} />
          </div>
        </div>
        <div>
          <div
            className="branch-kpi-value"
            style={{ color: "var(--branch-primary)" }}
          >
            {financialMetrics.actualRevenueFormatted}
          </div>
          <div className="branch-kpi-sub">
            {financialMetrics.collectionRate}% thu hồi · Nợ:{" "}
            {financialMetrics.debtAmountFormatted}
          </div>
        </div>
      </div>
    </div>
  );
}

