import { Link } from "react-router-dom";
import {
  MapPin,
  Settings2,
  Trash2,
  DoorOpen,
  Zap,
  Gauge,
  Wifi,
  Droplets,
  ShieldCheck,
} from "lucide-react";
import { money } from "../../utils/format";

export function BranchCardsGrid({
  items,
  rawInvoices,
  canEdit,
  getBranchManagers,
  onEdit,
  onDelete,
}) {
  return (
    <div className="branch-cards-grid">
      {items.map((branch) => {
        const totalR = branch.roomStats?.total || 0;
        const rentedR = branch.roomStats?.rented || 0;
        const vacantR = Math.max(0, totalR - rentedR);
        const isFull = totalR > 0 && rentedR === totalR;
        const isInactive = branch.status === "INACTIVE";

        const stripeClass = isInactive
          ? "stripe-inactive"
          : isFull
            ? "stripe-full"
            : "stripe-has-vacancy";

        const branchInvoices = rawInvoices.filter(
          (inv) => String(inv.branchId) === String(branch._id),
        );
        const branchPaid = branchInvoices.reduce(
          (sum, inv) => sum + (inv.paidAmount || 0),
          0,
        );
        const branchDebt = branchInvoices.reduce((sum, inv) => {
          const rem = Math.max(
            0,
            (inv.totalAmount || 0) - (inv.paidAmount || 0),
          );
          return inv.status !== "DRAFT" && inv.status !== "CANCELLED"
            ? sum + rem
            : sum;
        }, 0);
        const branchRevenueDisplay =
          branchPaid > 0
            ? `${(branchPaid / 1000000).toFixed(1)}M`
            : totalR > 0
              ? `${rentedR}/${totalR} P`
              : "0đ";
        const branchDebtDisplay =
          branchDebt > 0 ? `Nợ: ${(branchDebt / 1000000).toFixed(1)}M` : "0đ nợ";
        const managers = getBranchManagers(branch);

        return (
          <div className="branch-card" key={branch._id}>
            <div className={`branch-card-stripe ${stripeClass}`} />

            <div className="branch-card-body">
              <div className="branch-card-header">
                <div>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      flexWrap: "wrap",
                    }}
                  >
                    <Link
                      className="branch-card-title"
                      to={`/rooms?branchId=${branch._id}`}
                    >
                      {branch.name}
                    </Link>
                    <span
                      className={`branch-occupancy-pill ${isFull ? "full" : vacantR > 0 ? "has-vacant" : "empty"}`}
                    >
                      <span
                        style={{
                          width: "6px",
                          height: "6px",
                          borderRadius: "50%",
                          backgroundColor: isFull
                            ? "#16a34a"
                            : vacantR > 0
                              ? "#d97706"
                              : "#64748b",
                        }}
                      />
                      {isFull
                        ? "100% Full"
                        : `${totalR > 0 ? Math.round((rentedR / totalR) * 100) : 0}% Lấp đầy`}
                    </span>
                  </div>
                  <p className="branch-card-address">
                    <MapPin
                      size={13}
                      style={{ color: "var(--branch-primary)", flexShrink: 0 }}
                    />
                    <span>
                      {branch.address?.fullAddress || "Chưa có địa chỉ"}
                    </span>
                  </p>
                </div>

                {canEdit && (
                  <button
                    type="button"
                    className="branch-card-icon-btn"
                    onClick={() => onEdit(branch)}
                    title="Cấu hình cơ sở"
                  >
                    <Settings2 size={16} />
                  </button>
                )}
              </div>

              <div className="branch-stats-mini">
                <div className="branch-stat-col">
                  <span className="branch-stat-label">Quy mô</span>
                  <span className="branch-stat-num">
                    {branch.totalFloors} Tầng
                  </span>
                  <span className="branch-stat-sub">{totalR} Phòng</span>
                </div>
                <div className="branch-stat-col">
                  <span className="branch-stat-label">Đang thuê</span>
                  <span
                    className="branch-stat-num"
                    style={{ color: "#059669" }}
                  >
                    {rentedR}/{totalR}
                  </span>
                  <span
                    className="branch-stat-sub"
                    style={{ color: vacantR > 0 ? "#b45309" : "#059669" }}
                  >
                    {vacantR > 0 ? `${vacantR} Trống` : "0 Trống"}
                  </span>
                </div>
                <div className="branch-stat-col">
                  <span className="branch-stat-label">Doanh thu</span>
                  <span
                    className="branch-stat-num"
                    style={{ color: "var(--branch-primary)" }}
                  >
                    {branchRevenueDisplay}
                  </span>
                  <span
                    className="branch-stat-sub"
                    style={{
                      color: branchDebt > 0 ? "#dc2626" : "#059669",
                      fontWeight: 600,
                    }}
                  >
                    {branchDebtDisplay}
                  </span>
                </div>
              </div>

              <div className="branch-details-row">
                <div className="branch-detail-item">
                  <span style={{ color: "var(--branch-text-muted)" }}>
                    Quản lý phụ trách:
                  </span>
                  <span
                    style={{
                      fontWeight: 600,
                      color: "var(--branch-text-main)",
                      display: "flex",
                      alignItems: "center",
                      gap: "5px",
                    }}
                  >
                    <ShieldCheck size={13} color="var(--branch-primary)" />
                    {managers.length > 0 ? (
                      <span
                        title={managers
                          .map(
                            (m) =>
                              `${m.name}${m.phoneNumber ? ` (SĐT: ${m.phoneNumber})` : ""}`,
                          )
                          .join(" · ")}
                        style={{
                          color: "var(--branch-primary)",
                          fontWeight: 700,
                          cursor: "default",
                        }}
                      >
                        {managers[0].name}
                        {managers.length > 1 && (
                          <span
                            style={{
                              fontSize: "11px",
                              marginLeft: "4px",
                              opacity: 0.85,
                            }}
                          >
                            (+{managers.length - 1})
                          </span>
                        )}
                      </span>
                    ) : (
                      <span
                        style={{
                          color: "var(--branch-text-muted)",
                          fontStyle: "italic",
                          fontWeight: 400,
                        }}
                      >
                        Chưa phân công
                      </span>
                    )}
                  </span>
                </div>
                <div className="branch-detail-item">
                  <span style={{ color: "var(--branch-text-muted)" }}>
                    Kỳ chốt số:
                  </span>
                  <span
                    style={{ color: "var(--branch-primary)", fontWeight: 600 }}
                  >
                    Ngày {branch.billingCycleDay || 1} hàng tháng
                  </span>
                </div>
              </div>

              <div className="branch-pricing-pills">
                <span className="branch-pricing-pill">
                  <Zap size={12} style={{ color: "#d97706" }} />
                  <span>
                    Điện: {money(branch.defaultElectricityPrice ?? 3500)}/kWh
                  </span>
                </span>
                <span className="branch-pricing-pill">
                  <Droplets size={12} style={{ color: "#0284c7" }} />
                  <span>
                    Nước: {money(branch.defaultWaterPrice ?? 30000)}/
                    {branch.waterBillingType === "METER"
                      ? "m³"
                      : branch.waterBillingType === "PER_PERSON"
                        ? "người"
                        : "phòng"}
                  </span>
                </span>
                {Array.isArray(branch.defaultServices) &&
                  branch.defaultServices.length > 0 && (
                    <span className="branch-pricing-pill">
                      <Wifi size={12} style={{ color: "#0f766e" }} />
                      <span>+{branch.defaultServices.length} Dịch vụ</span>
                    </span>
                  )}
              </div>
            </div>

            <div className="branch-card-footer">
              <Link
                className="branch-card-btn"
                to={`/rooms?branchId=${branch._id}`}
              >
                <DoorOpen size={14} />
                <span>Xem {totalR} phòng</span>
              </Link>

              <Link
                className="branch-card-btn primary"
                to={`/utility-readings?branchId=${branch._id}`}
              >
                <Gauge size={14} />
                <span>Chốt điện nước</span>
              </Link>

              {canEdit && (
                <button
                  type="button"
                  className="branch-card-icon-btn danger"
                  title="Xóa cơ sở"
                  onClick={() => onDelete(branch)}
                >
                  <Trash2 size={15} />
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

