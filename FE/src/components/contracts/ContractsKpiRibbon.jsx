import { FileCheck2, Clock, AlertTriangle, ShieldCheck } from "lucide-react";
import { money } from "../../utils/format";

export default function ContractsKpiRibbon({
  total,
  itemsLength,
  summaryCountAll,
  activeCount,
  expiringCount,
  expiredCount,
  totalDeposit,
  status,
  onSelectStatus,
}) {
  const allCount = summaryCountAll ?? total ?? itemsLength;

  return (
    <div className="contracts-kpi-ribbon">
      <div
        className={`contracts-kpi-card is-clickable ${status === "" ? "is-selected-kpi" : ""}`}
        onClick={() => onSelectStatus?.("")}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onSelectStatus?.("");
          }
        }}
      >
        <div className="contracts-kpi-top">
          <span className="contracts-kpi-label">Tổng hợp đồng hệ thống</span>
          <div className="contracts-kpi-icon primary">
            <FileCheck2 size={18} />
          </div>
        </div>
        <div className="contracts-kpi-num">{allCount}</div>
        <div className="contracts-kpi-sub">
          <span style={{ color: "var(--contracts-primary)", fontWeight: 600 }}>
            {activeCount} đang thuê ổn định
          </span>
        </div>
      </div>

      <div
        className={`contracts-kpi-card warning is-clickable ${
          status === "EXPIRING_SOON" ? "is-selected-kpi" : ""
        }`}
        onClick={() =>
          onSelectStatus?.(status === "EXPIRING_SOON" ? "" : "EXPIRING_SOON")
        }
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onSelectStatus?.(status === "EXPIRING_SOON" ? "" : "EXPIRING_SOON");
          }
        }}
      >
        <div className="contracts-kpi-top">
          <span className="contracts-kpi-label" style={{ color: "#92400e" }}>
            Sắp hết hạn (30 ngày)
          </span>
          <div className="contracts-kpi-icon warning">
            <Clock size={18} />
          </div>
        </div>
        <div className="contracts-kpi-num" style={{ color: "#92400e" }}>
          {expiringCount}
        </div>
        <div className="contracts-kpi-sub" style={{ color: "#b45309" }}>
          <span>Nhấn để lọc HĐ cần gia hạn</span>
        </div>
      </div>

      <div
        className={`contracts-kpi-card danger is-clickable ${
          status === "EXPIRED" ? "is-selected-kpi" : ""
        }`}
        onClick={() =>
          onSelectStatus?.(status === "EXPIRED" ? "" : "EXPIRED")
        }
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onSelectStatus?.(status === "EXPIRED" ? "" : "EXPIRED");
          }
        }}
      >
        <div className="contracts-kpi-top">
          <span className="contracts-kpi-label" style={{ color: "#991b1b" }}>
            Quá hạn chưa ký lại
          </span>
          <div className="contracts-kpi-icon danger">
            <AlertTriangle size={18} />
          </div>
        </div>
        <div className="contracts-kpi-num" style={{ color: "#991b1b" }}>
          {expiredCount}
        </div>
        <div className="contracts-kpi-sub" style={{ color: "#dc2626" }}>
          <span>Nhấn để lọc HĐ cần quyết toán</span>
        </div>
      </div>

      <div className="contracts-kpi-card">
        <div className="contracts-kpi-top">
          <span className="contracts-kpi-label">Tổng tiền cọc đang giữ</span>
          <div className="contracts-kpi-icon teal">
            <ShieldCheck size={18} />
          </div>
        </div>
        <div
          className="contracts-kpi-num"
          style={{ color: "var(--contracts-primary)" }}
        >
          {money(totalDeposit)}
        </div>
        <div className="contracts-kpi-sub">
          <span>Quỹ bảo lãnh tài sản đã thu</span>
        </div>
      </div>
    </div>
  );
}
