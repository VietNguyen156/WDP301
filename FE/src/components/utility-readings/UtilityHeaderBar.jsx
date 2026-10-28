import {
  Building2,
  ShieldCheck,
  Crown,
  Calendar,
  MapPin,
  Grid2X2,
  List,
} from "lucide-react";
import { getCurrentPeriod } from "../../hooks/useUtilityReadingsPage";

export default function UtilityHeaderBar({
  user,
  allowedBranches,
  branchId,
  branch,
  onBranchChange,
  billingPeriod,
  setBillingPeriod,
  availablePeriods,
  viewMode,
  setViewMode,
  setCurrentIndex,
}) {
  return (
    <div className="util-header-bar">
      <div className="util-header-left">
        <div className="util-header-icon">
          <Building2 size={24} />
        </div>
        <div className="util-header-info">
          <div className="util-branch-picker-row">
            <div className="util-branch-select-group">
              <label htmlFor="util-branch-select" className="util-picker-label">
                Tòa nhà:
              </label>
              <div className="util-branch-select-wrap">
                <select
                  id="util-branch-select"
                  className="util-branch-select"
                  value={branchId}
                  onChange={onBranchChange}
                  aria-label="Chọn tòa nhà / cơ sở"
                >
                  {allowedBranches.map((b) => (
                    <option key={b._id} value={b._id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Role-based Scoping Badge */}
            {user?.role === "PROPERTY_MANAGER" || user?.role === "STAFF" ? (
              <span
                className="util-role-badge manager"
                title="Chỉ hiển thị các cơ sở bạn được phân công quản lý"
              >
                <ShieldCheck size={13} />
                <span>Phân công ({allowedBranches.length} cơ sở)</span>
              </span>
            ) : user?.role === "LANDLORD" ? (
              <span
                className="util-role-badge landlord"
                title="Chủ sở hữu toàn quyền quản trị tất cả cơ sở"
              >
                <Crown size={13} />
                <span>Chủ sở hữu ({allowedBranches.length} tòa)</span>
              </span>
            ) : null}

            <span className="util-period-badge">
              <Calendar size={13} />
              <span>Kỳ {billingPeriod}</span>
            </span>
          </div>

          <p className="util-header-sub">
            <MapPin
              size={13}
              style={{ marginRight: "4px", verticalAlign: "-2px" }}
            />
            {branch?.address?.fullAddress || "Chuỗi căn hộ DOMUS ERP"}
          </p>
        </div>
      </div>

      <div className="util-header-controls">
        {/* Period Dropdown */}
        <div className="util-control-item">
          <label className="util-control-label">Chọn kỳ chốt:</label>
          <div className="util-select-wrapper">
            <Calendar size={15} className="util-select-icon" />
            <select
              className="util-period-select"
              value={billingPeriod}
              onChange={(e) => {
                setBillingPeriod(e.target.value);
                setCurrentIndex(0);
              }}
            >
              {availablePeriods.map((p) => (
                <option key={p} value={p}>
                  Kỳ {p} {p === getCurrentPeriod() ? "(Hiện tại)" : ""}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* View Switcher */}
        <div className="util-view-switcher">
          <button
            type="button"
            className={`util-view-btn ${viewMode === "wizard" ? "is-active" : ""}`}
            onClick={() => setViewMode("wizard")}
          >
            <Grid2X2 size={14} /> Duyệt 1 tay
          </button>
          <button
            type="button"
            className={`util-view-btn ${viewMode === "table" ? "is-active" : ""}`}
            onClick={() => setViewMode("table")}
          >
            <List size={14} /> Bảng chi tiết
          </button>
        </div>
      </div>
    </div>
  );
}

