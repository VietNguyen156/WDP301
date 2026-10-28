import { FileCheck2, Clock, AlertTriangle, ShieldCheck } from "lucide-react";
import { money } from "../../utils/format";

export default function ContractsKpiRibbon({
  total,
  itemsLength,
  activeCount,
  expiringCount,
  expiredCount,
  totalDeposit,
}) {
  return (
    <div className="contracts-kpi-ribbon">
      <div className="contracts-kpi-card">
        <div className="contracts-kpi-top">
          <span className="contracts-kpi-label">Tổng hợp đồng hiệu lực</span>
          <div className="contracts-kpi-icon primary">
            <FileCheck2 size={18} />
          </div>
        </div>
        <div className="contracts-kpi-num">{total || itemsLength}</div>
        <div className="contracts-kpi-sub">
          <span style={{ color: "var(--contracts-primary)", fontWeight: 600 }}>
            {activeCount} đang thuê ổn định
          </span>
        </div>
      </div>

      <div className="contracts-kpi-card warning">
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
          <span>Cần liên hệ gia hạn hoặc báo trả</span>
        </div>
      </div>

      <div className="contracts-kpi-card danger">
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
          <span>Cần xử lý quyết toán hoặc ký mới</span>
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
          <span>An toàn quỹ bảo lãnh tài sản</span>
        </div>
      </div>
    </div>
  );
}

