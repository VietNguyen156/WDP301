import { Link } from "react-router-dom";
import { TrendingUp, Receipt, Percent, Building2 } from "lucide-react";
import { formatCurrency } from "../../utils/formatters";

export default function DashboardKpiGrid({
  financialMetrics,
  roomMetrics,
  activeBranchesCount,
  totalActiveContracts,
}) {
  return (
    <section className="stitch-kpi-grid">
      {/* KPI 1: Thực Thu Kỳ Này */}
      <div className="stitch-kpi-card">
        <div className="stitch-kpi-header">
          <div>
            <p className="stitch-kpi-title">Thực thu kỳ này (Đã nhận tiền)</p>
            <div className="stitch-kpi-value-row">
              <span className="stitch-kpi-value" style={{ color: "#047857" }}>
                {formatCurrency(financialMetrics.actualRevenue)}
              </span>
            </div>
          </div>
          <div
            className="stitch-kpi-icon"
            style={{ backgroundColor: "#ecfdf5", color: "#059669" }}
          >
            <TrendingUp size={22} />
          </div>
        </div>
        <div className="stitch-kpi-footer">
          <span>
            Dự thu:{" "}
            <strong>{formatCurrency(financialMetrics.expectedRevenue)}</strong>
          </span>
          <span
            style={{
              fontWeight: 700,
              color:
                financialMetrics.collectionRate >= 80 ? "#047857" : "#b45309",
              backgroundColor:
                financialMetrics.collectionRate >= 80 ? "#ecfdf5" : "#fef3c7",
              padding: "2px 8px",
              borderRadius: "9999px",
            }}
          >
            Đạt {financialMetrics.collectionRate}%
          </span>
        </div>
      </div>

      {/* KPI 2: Hóa Đơn & Công Nợ Chưa Thu */}
      <div
        className="stitch-kpi-card"
        style={{
          border:
            financialMetrics.debtAmount > 0
              ? "1px solid rgba(220, 38, 38, 0.4)"
              : "1px solid rgba(189, 201, 198, 0.6)",
          background:
            financialMetrics.debtAmount > 0
              ? "linear-gradient(to bottom right, #ffffff, #fff5f5)"
              : "#ffffff",
        }}
      >
        <div className="stitch-kpi-header">
          <div>
            <p
              className="stitch-kpi-title"
              style={{
                color: financialMetrics.debtAmount > 0 ? "#dc2626" : "#64748b",
              }}
            >
              Công nợ tồn đọng ({financialMetrics.debtRoomsCount} phòng)
            </p>
            <div className="stitch-kpi-value-row">
              <span
                className="stitch-kpi-value"
                style={{
                  color:
                    financialMetrics.debtAmount > 0 ? "#dc2626" : "#131b2e",
                }}
              >
                {formatCurrency(financialMetrics.debtAmount)}
              </span>
            </div>
          </div>
          <div
            className="stitch-kpi-icon"
            style={{ backgroundColor: "#fef2f2", color: "#dc2626" }}
          >
            <Receipt size={22} />
          </div>
        </div>
        <div
          className="stitch-kpi-footer"
          style={{ borderTopColor: "rgba(254, 202, 202, 0.7)" }}
        >
          <span>Phát sinh trễ hạn</span>
          <Link
            to="/invoices"
            style={{
              color: "#dc2626",
              fontWeight: 700,
              textDecoration: "underline",
            }}
          >
            Xem {financialMetrics.debtRoomsCount} hóa đơn nợ →
          </Link>
        </div>
      </div>

      {/* KPI 3: Tỷ Lệ Lấp Đầy Toàn Chuỗi */}
      <div className="stitch-kpi-card">
        <div className="stitch-kpi-header">
          <div>
            <p className="stitch-kpi-title">Tỷ lệ lấp đầy toàn chuỗi</p>
            <div className="stitch-kpi-value-row">
              <span
                className="stitch-kpi-value"
                style={{ color: "var(--primary, #005c55)" }}
              >
                {roomMetrics.occupancyRate}%
              </span>
              <span
                style={{
                  fontSize: "11px",
                  fontWeight: 700,
                  padding: "2px 8px",
                  borderRadius: "9999px",
                  backgroundColor:
                    roomMetrics.occupancyRate >= 90 ? "#ecfdf5" : "#fef3c7",
                  color:
                    roomMetrics.occupancyRate >= 90 ? "#047857" : "#b45309",
                }}
              >
                {roomMetrics.occupancyRate >= 90 ? "Tối ưu" : "Còn phòng trống"}
              </span>
            </div>
          </div>
          <div
            className="stitch-kpi-icon"
            style={{ backgroundColor: "#eff6ff", color: "#2563eb" }}
          >
            <Percent size={22} />
          </div>
        </div>
        <div className="stitch-kpi-footer">
          <span>
            <strong>{roomMetrics.rentedRooms}</strong> phòng đang thuê
          </span>
          <span style={{ color: "#b45309", fontWeight: 600 }}>
            {roomMetrics.vacantRooms} phòng trống
          </span>
        </div>
      </div>

      {/* KPI 4: Quy Mô Chuỗi Vận Hành */}
      <div className="stitch-kpi-card">
        <div className="stitch-kpi-header">
          <div>
            <p className="stitch-kpi-title">Quy mô chuỗi vận hành</p>
            <div className="stitch-kpi-value-row">
              <span className="stitch-kpi-value">{roomMetrics.totalRooms}</span>
              <span className="stitch-kpi-sub">Phòng / Căn hộ</span>
            </div>
          </div>
          <div
            className="stitch-kpi-icon"
            style={{ backgroundColor: "#f5f3ff", color: "#7c3aed" }}
          >
            <Building2 size={22} />
          </div>
        </div>
        <div className="stitch-kpi-footer">
          <span>
            <strong>{activeBranchesCount}</strong> Tòa nhà
          </span>
          <span>
            <strong>{totalActiveContracts}</strong> Hợp đồng hiệu lực
          </span>
        </div>
      </div>
    </section>
  );
}

