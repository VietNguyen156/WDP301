import { Link } from "react-router-dom";
import { ArrowRight, Building2 } from "lucide-react";
import { formatCurrency } from "../../utils/formatters";

export default function DashboardChartsRow({
  roomMetrics,
  activeBranchesCount,
  contractWatchlist,
  branchPerformance,
}) {
  return (
    <div className="stitch-dash-grid-2">
      {/* Visual Chart 1: Cơ Cấu Trạng Thái Phòng */}
      <div className="stitch-dash-card">
        <div className="stitch-dash-card-header">
          <div>
            <h2 className="stitch-dash-card-title">Cơ Cấu Trạng Thái Phòng</h2>
            <p className="stitch-dash-card-sub">
              Phân bố phòng đang thuê, phòng trống và phòng cần bảo dưỡng
            </p>
          </div>
          <Link to="/rooms" className="stitch-dash-card-link">
            Sơ đồ phòng <ArrowRight size={14} />
          </Link>
        </div>

        {/* Visual Stacked Bar Chart */}
        <div className="stitch-dist-bar-wrap">
          <div className="stitch-dist-bar">
            {roomMetrics.totalRooms > 0 ? (
              <>
                <div
                  className="stitch-dist-seg rented"
                  style={{
                    width: `${(roomMetrics.rentedRooms / roomMetrics.totalRooms) * 100}%`,
                  }}
                  title={`Đang thuê: ${roomMetrics.rentedRooms} phòng (${Math.round((roomMetrics.rentedRooms / roomMetrics.totalRooms) * 100)}%)`}
                />
                <div
                  className="stitch-dist-seg vacant"
                  style={{
                    width: `${(roomMetrics.vacantRooms / roomMetrics.totalRooms) * 100}%`,
                  }}
                  title={`Phòng trống: ${roomMetrics.vacantRooms} phòng (${Math.round((roomMetrics.vacantRooms / roomMetrics.totalRooms) * 100)}%)`}
                />
              </>
            ) : (
              <div
                style={{
                  width: "100%",
                  height: "100%",
                  backgroundColor: "#e2e8f0",
                }}
              />
            )}
          </div>

          {/* Legend Breakdown */}
          <div className="stitch-dist-legend">
            <div className="stitch-legend-item">
              <span className="stitch-legend-dot rented" />
              <span className="stitch-legend-label">Đang thuê:</span>
              <strong className="stitch-legend-val">
                {roomMetrics.rentedRooms}
              </strong>
              <span className="stitch-legend-pct">
                (
                {roomMetrics.totalRooms > 0
                  ? Math.round(
                      (roomMetrics.rentedRooms / roomMetrics.totalRooms) * 100,
                    )
                  : 0}
                %)
              </span>
            </div>

            <div className="stitch-legend-item">
              <span className="stitch-legend-dot vacant" />
              <span className="stitch-legend-label">Phòng trống:</span>
              <strong className="stitch-legend-val">
                {roomMetrics.vacantRooms}
              </strong>
              <span className="stitch-legend-pct">
                (
                {roomMetrics.totalRooms > 0
                  ? Math.round(
                      (roomMetrics.vacantRooms / roomMetrics.totalRooms) * 100,
                    )
                  : 0}
                %)
              </span>
            </div>

            <div className="stitch-legend-item">
              <span className="stitch-legend-dot cleaning" />
              <span className="stitch-legend-label">Tổng quy mô:</span>
              <strong className="stitch-legend-val">
                {roomMetrics.totalRooms} phòng
              </strong>
            </div>
          </div>
        </div>

        {/* Micro Status Summary Cards */}
        <div className="stitch-dash-mini-stat-grid">
          <div className="stitch-dash-mini-stat">
            <span className="mini-label">Cơ sở hoạt động</span>
            <strong className="mini-value">{activeBranchesCount}</strong>
            <small className="mini-desc">Đang quản lý vận hành</small>
          </div>
          <div className="stitch-dash-mini-stat">
            <span className="mini-label">Hợp đồng hiệu lực</span>
            <strong className="mini-value">
              {contractWatchlist.totalActive}
            </strong>
            <small className="mini-desc">Cư dân đang cư trú</small>
          </div>
          <div className="stitch-dash-mini-stat">
            <span className="mini-label">Sắp hết hạn (30 ngày)</span>
            <strong
              className="mini-value"
              style={{
                color:
                  contractWatchlist.expiringSoon.length > 0
                    ? "#d97706"
                    : "#131b2e",
              }}
            >
              {contractWatchlist.expiringSoon.length}
            </strong>
            <small className="mini-desc">Cần gia hạn / tìm khách</small>
          </div>
        </div>
      </div>

      {/* Visual Chart 2: Hiệu Suất Thu Tiền Theo Từng Cơ Sở */}
      <div className="stitch-dash-card">
        <div className="stitch-dash-card-header">
          <div>
            <h2 className="stitch-dash-card-title">
              Hiệu Suất Thu Tiền Từng Cơ Sở
            </h2>
            <p className="stitch-dash-card-sub">
              So sánh tiến độ thực thu vs công nợ giữa các tòa nhà trong chuỗi
            </p>
          </div>
          <Link to="/branches" className="stitch-dash-card-link">
            Chi tiết cơ sở <ArrowRight size={14} />
          </Link>
        </div>

        {branchPerformance.length === 0 ? (
          <div className="stitch-dash-empty-box">
            <Building2 size={32} color="#94a3b8" />
            <p>Chưa có cơ sở nào được cấu hình trong hệ thống.</p>
            <Link to="/branches" className="stitch-dash-btn primary">
              Khởi tạo cơ sở đầu tiên
            </Link>
          </div>
        ) : (
          <div className="stitch-branch-perf-list">
            {branchPerformance.map((bp) => (
              <div key={bp._id} className="stitch-branch-perf-item">
                <div className="stitch-branch-perf-top">
                  <div>
                    <strong className="stitch-branch-perf-name">
                      {bp.name}
                    </strong>
                    <span className="stitch-branch-perf-sub">
                      {bp.rentedRooms}/{bp.totalRooms} phòng · {bp.occRate}% lấp
                      đầy
                    </span>
                  </div>
                  <div className="stitch-branch-perf-amounts">
                    <span className="perf-paid">{formatCurrency(bp.paid)}</span>
                    <span className="perf-slash">/</span>
                    <span className="perf-exp">
                      {formatCurrency(bp.expected)}
                    </span>
                  </div>
                </div>

                {/* Dual Comparison Bar */}
                <div className="stitch-branch-bar-track">
                  <div
                    className="stitch-branch-bar-fill"
                    style={{
                      width: `${
                        bp.expected > 0
                          ? Math.min(
                              100,
                              Math.round((bp.paid / bp.expected) * 100),
                            )
                          : 0
                      }%`,
                    }}
                  />
                </div>

                <div className="stitch-branch-perf-foot">
                  <span
                    style={{
                      color: bp.debt > 0 ? "#dc2626" : "#059669",
                      fontWeight: 600,
                    }}
                  >
                    {bp.debt > 0
                      ? `Còn nợ: ${formatCurrency(bp.debt)}`
                      : "Đã thu đủ 100%"}
                  </span>
                  <span className="perf-rate-chip">Đạt {bp.rate}%</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

