import { Link } from "react-router-dom";
import {
  ShieldCheck,
  Building2,
  Calendar,
  RefreshCw,
  AlertTriangle,
  Scale,
  ArrowRight,
} from "lucide-react";
import { formatBillingPeriod } from "../../utils/formatters";

export default function DashboardHeaderBar({
  user,
  branches,
  filterBranchId,
  setFilterBranchId,
  billingPeriod,
  setBillingPeriod,
  currentMonthStr,
  prevMonthStr,
  refreshing,
  onRefresh,
  unmatchedCount,
}) {
  return (
    <>
      <header className="stitch-dash-header">
        <div>
          <div className="stitch-dash-title-row">
            <h1 className="stitch-dash-title">Tổng quan vận hành</h1>
            {user?.role === "LANDLORD" ? (
              <span className="stitch-badge-live">
                <span className="stitch-live-dot" />
                <span>Toàn chuỗi ({branches.length} cơ sở)</span>
              </span>
            ) : (
              <span className="stitch-badge-live">
                <ShieldCheck size={13} />
                <span>Khu vực phân công</span>
              </span>
            )}
          </div>
          <p className="stitch-dash-subtitle">
            Giám sát thời gian thực dòng tiền, tỷ lệ lấp đầy phòng và công nợ
            toàn hệ thống.
          </p>
        </div>

        {/* Global Toolbar Controls */}
        <div className="stitch-dash-controls">
          {/* Branch Filter Selector */}
          <div className="dash-filter-item">
            <span className="dash-filter-icon">
              <Building2 size={15} />
            </span>
            <select
              className="dash-filter-select"
              value={filterBranchId}
              onChange={(e) => setFilterBranchId(e.target.value)}
              title="Lọc theo cơ sở / tòa nhà"
            >
              <option value="">Tất cả cơ sở ({branches.length})</option>
              {branches.map((b) => (
                <option key={b._id} value={b._id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          {/* Month / Billing Period Selector */}
          <div className="dash-filter-item">
            <span className="dash-filter-icon">
              <Calendar size={15} />
            </span>
            <input
              type="month"
              value={billingPeriod}
              onChange={(e) => setBillingPeriod(e.target.value)}
              className="dash-filter-input"
              title="Chọn kỳ hóa đơn / tháng thu phí"
            />
          </div>

          {/* Quick Period Presets */}
          <div className="dash-period-presets">
            <button
              type="button"
              className={`dash-preset-btn ${billingPeriod === currentMonthStr ? "active" : ""}`}
              onClick={() => setBillingPeriod(currentMonthStr)}
              title="Xem kỳ tháng hiện tại"
            >
              Kỳ này
            </button>
            <button
              type="button"
              className={`dash-preset-btn ${billingPeriod === prevMonthStr ? "active" : ""}`}
              onClick={() => setBillingPeriod(prevMonthStr)}
              title="Xem kỳ tháng trước"
            >
              Tháng trước
            </button>
            <button
              type="button"
              className={`dash-preset-btn ${!billingPeriod ? "active" : ""}`}
              onClick={() => setBillingPeriod("")}
              title="Xem tổng hợp tất cả các kỳ"
            >
              Tất cả
            </button>
          </div>

          {/* Refresh Live Data */}
          <button
            type="button"
            className="stitch-dash-btn secondary"
            onClick={onRefresh}
            disabled={refreshing}
            title="Tải lại dữ liệu sống"
          >
            <RefreshCw size={15} className={refreshing ? "spin" : ""} />
            <span>Làm mới</span>
          </button>
        </div>
      </header>

      {/* Active Filter Summary Bar */}
      {(filterBranchId || billingPeriod) && (
        <div className="dash-active-filters-bar">
          <div className="dash-filter-chips">
            <span style={{ fontWeight: 600 }}>Đang xem:</span>
            <span className="dash-chip">
              <Building2 size={12} />
              <span>
                {filterBranchId
                  ? branches.find(
                      (b) => String(b._id) === String(filterBranchId),
                    )?.name || "Cơ sở đã chọn"
                  : "Tất cả cơ sở"}
              </span>
            </span>
            <span className="dash-chip">
              <Calendar size={12} />
              <span>
                {billingPeriod
                  ? formatBillingPeriod(billingPeriod)
                  : "Tất cả các kỳ"}
              </span>
            </span>
          </div>

          {(filterBranchId || billingPeriod !== currentMonthStr) && (
            <button
              type="button"
              className="dash-reset-btn"
              onClick={() => {
                setFilterBranchId("");
                setBillingPeriod(currentMonthStr);
              }}
            >
              Đặt lại bộ lọc mặc định
            </button>
          )}
        </div>
      )}

      {/* SEPAY UNMATCHED TRANSACTION BANNER (IF PENDING) */}
      {unmatchedCount > 0 && (
        <div className="stitch-dash-alert-banner">
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div className="stitch-dash-alert-icon">
              <AlertTriangle size={18} />
            </div>
            <div>
              <strong style={{ fontSize: "14px", color: "#991b1b" }}>
                Cảnh báo SePay: Có {unmatchedCount} giao dịch chuyển khoản chưa
                khớp cú pháp
              </strong>
              <p
                style={{
                  margin: "2px 0 0",
                  fontSize: "12px",
                  color: "#7f1d1d",
                }}
              >
                Khách thuê chuyển khoản sai cú pháp hoặc sai số tiền. Vui lòng
                đối soát và gán vào hóa đơn phòng tương ứng.
              </p>
            </div>
          </div>
          <Link to="/unmatched" className="stitch-dash-alert-action">
            <Scale size={14} />
            <span>Xử lý đối soát ngay</span>
            <ArrowRight size={14} />
          </Link>
        </div>
      )}
    </>
  );
}

