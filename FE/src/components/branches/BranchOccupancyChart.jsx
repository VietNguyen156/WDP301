import { Link } from "react-router-dom";
import { BarChart3, ChevronDown, ChevronUp, ExternalLink } from "lucide-react";

export function BranchOccupancyChart({
  rawItems,
  occupancyRate,
  isChartCollapsed,
  onToggleCollapse,
}) {
  if (!rawItems?.length) return null;

  return (
    <section
      className="stitch-chart-card"
      role="region"
      aria-label="Biểu đồ so sánh tỷ lệ lấp đầy và ngưỡng hòa vốn cơ sở"
    >
      <div className="stitch-chart-header">
        <div>
          <h3 className="stitch-chart-title">
            <BarChart3
              size={20}
              style={{ color: "var(--primary, #005c55)" }}
              aria-hidden="true"
            />
            <span>
              Biểu đồ So sánh Hiệu suất &amp; Tỷ lệ Lấp đầy {rawItems.length} Cơ
              sở
            </span>
            <span
              style={{
                fontSize: "12px",
                fontWeight: 600,
                color: "var(--primary, #005c55)",
                backgroundColor: "#f0fdfa",
                padding: "2px 8px",
                borderRadius: "9999px",
              }}
            >
              {new Intl.DateTimeFormat("vi-VN", {
                month: "2-digit",
                year: "numeric",
              }).format(new Date())}
            </span>
          </h3>
          <p className="stitch-chart-sub">
            Mức hòa vốn mục tiêu chuỗi vận hành là <strong>85.0%</strong> · Tỷ
            lệ lấp đầy bình quân hiện tại: <strong>{occupancyRate}%</strong>
          </p>
        </div>

        <div className="stitch-chart-actions-group">
          <div className="stitch-chart-legend" role="list">
            <div className="stitch-chart-legend-item" role="listitem">
              <span
                style={{
                  width: "12px",
                  height: "12px",
                  borderRadius: "3px",
                  backgroundColor: "#059669",
                }}
                aria-hidden="true"
              />
              <span>Đạt mục tiêu (≥ 85%)</span>
            </div>
            <div className="stitch-chart-legend-item" role="listitem">
              <span
                style={{
                  width: "12px",
                  height: "12px",
                  borderRadius: "3px",
                  backgroundColor: "#d97706",
                }}
                aria-hidden="true"
              />
              <span>Dưới hòa vốn (&lt; 85%)</span>
            </div>
            <div className="stitch-chart-legend-item" role="listitem">
              <span
                style={{
                  width: "16px",
                  height: "0",
                  borderTop: "2px dashed #dc2626",
                }}
                aria-hidden="true"
              />
              <span style={{ color: "#dc2626", fontWeight: 600 }}>
                Ngưỡng hòa vốn (85%)
              </span>
            </div>
          </div>

          <button
            type="button"
            className="stitch-chart-toggle-btn"
            onClick={onToggleCollapse}
            aria-expanded={!isChartCollapsed}
            title={
              isChartCollapsed
                ? "Mở rộng biểu đồ phân tích"
                : "Thu gọn biểu đồ"
            }
          >
            {isChartCollapsed ? (
              <>
                <ChevronDown size={15} aria-hidden="true" />
                <span>Mở rộng biểu đồ</span>
              </>
            ) : (
              <>
                <ChevronUp size={15} aria-hidden="true" />
                <span>Thu gọn</span>
              </>
            )}
          </button>

          <Link
            to="/dashboard"
            className="stitch-dash-link"
            style={{ padding: "5px 10px", fontSize: "11px" }}
            title="Chuyển đến trang Dashboard tổng quan để xem toàn bộ phân tích tài chính"
          >
            <span>Xem tại Dashboard</span>
            <ExternalLink size={12} aria-hidden="true" />
          </Link>
        </div>
      </div>

      {!isChartCollapsed && (
        <div
          className={`stitch-chart-bars-wrap ${rawItems.length <= 4 ? "few-items" : ""}`}
          tabIndex={0}
          aria-label="Khu vực thanh biểu đồ lấp đầy"
        >
          <div className="stitch-benchmark-line" aria-hidden="true">
            <span className="stitch-benchmark-label">Mục tiêu 85%</span>
          </div>

          {rawItems.map((branch) => {
            const total = branch.roomStats?.total || 0;
            const rented = branch.roomStats?.rented || 0;
            const rate = total > 0 ? Math.round((rented / total) * 100) : 0;
            const isGood = rate >= 85;
            const isZero = rate === 0;

            const statusClass = isZero ? "zero" : isGood ? "good" : "warning";
            const fillClass = isZero
              ? "bar-zero"
              : isGood
                ? "bar-good"
                : "bar-warning";
            const diff = rate - 85;

            return (
              <div
                className="stitch-bar-col"
                key={branch._id}
                tabIndex={0}
                role="img"
                aria-label={`${branch.name}: ${rate}% lấp đầy (${rented}/${total} phòng). ${diff >= 0 ? `Vượt mục tiêu ${diff}%` : `Dưới mục tiêu ${Math.abs(diff)}%`}`}
              >
                <div className="stitch-bar-tooltip">
                  <strong>{branch.name}</strong>
                  <div style={{ marginTop: "2px", opacity: 0.9 }}>
                    {rented}/{total} phòng ({rate}%)
                  </div>
                  <div
                    style={{
                      color: isGood ? "#6ee7b7" : "#fcd34d",
                      fontWeight: 700,
                      marginTop: "2px",
                    }}
                  >
                    {diff >= 0
                      ? `+${diff}% vượt hòa vốn`
                      : `${diff}% so với hòa vốn`}
                  </div>
                </div>

                <span className={`stitch-bar-pct ${statusClass}`}>{rate}%</span>

                <div
                  className={`stitch-bar-fill ${fillClass}`}
                  style={{ height: isZero ? "4px" : `${Math.max(rate, 4)}%` }}
                />

                <div className="stitch-bar-info">
                  <span className="stitch-bar-name" title={branch.name}>
                    {branch.name}
                  </span>
                  <span className="stitch-bar-occupants">
                    {rented}/{total} P
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

