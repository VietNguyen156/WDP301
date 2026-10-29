import {
  Building2,
  BadgeCheck,
  Zap,
  ShieldCheck,
  Lock,
  Cookie,
} from "lucide-react";
import {
  AUTH_HERO_SHOWCASE_IMAGE,
  RBAC_ROLE_SPECS,
} from "../../utils/authValidators";

export default function AuthHeroPanel() {
  return (
    <section
      className="domus-portal-left"
      aria-label="Giới thiệu nền tảng DOMUS ERP"
    >
      {/* Atmospheric subtle glow circles */}
      <div className="domus-glow-primary" aria-hidden="true" />
      <div className="domus-glow-secondary" aria-hidden="true" />

      {/* Top Header Brand & Version Meta */}
      <div className="domus-left-top">
        <div className="domus-brand-bar">
          <div className="domus-brand-identity">
            <div className="domus-brand-logo">
              <Building2 size={22} />
            </div>
            <div>
              <div className="domus-brand-name-row">
                <span className="domus-brand-name">DOMUS ERP</span>
                <span className="domus-version-pill">ENTERPRISE v3.4.2</span>
              </div>
              <p className="domus-brand-sub">
                Chuỗi căn hộ &amp; Nhà trọ cao cấp • Spec 14/10/2026
              </p>
            </div>
          </div>

          <div className="domus-webhook-status">
            <span className="domus-pulse-dot" />
            <span>SePay Webhook 100%</span>
          </div>
        </div>

        {/* Headline & Value Pitch */}
        <div className="domus-hero-pitch">
          <div className="domus-verified-pill">
            <BadgeCheck size={15} />
            <span>Chuẩn hóa RBAC 4 Cấp Độ &amp; Tự Động Hóa Dòng Tiền</span>
          </div>
          <h1 className="domus-hero-title">
            Nền tảng Vận hành Chuỗi Căn hộ &amp; Tự động hóa Dòng tiền
          </h1>
          <p className="domus-hero-desc">
            Quản trị tập trung danh mục bất động sản cho thuê, chốt chỉ số thông
            minh IoT, đối soát giao dịch VietQR tự động qua SePay và quản lý hợp
            đồng cư dân theo thời gian thực.
          </p>
        </div>
      </div>

      {/* Center Showcase: Real Estate Architecture Asset & 4 Role Specs */}
      <div className="domus-left-center">
        {/* Visual architectural showcase card */}
        <div className="domus-showcase-card">
          <img
            className="domus-showcase-img"
            src={AUTH_HERO_SHOWCASE_IMAGE}
            alt="Toà nhà căn hộ dịch vụ hiện đại DOMUS ERP"
          />
          <div className="domus-showcase-overlay" />
          <div className="domus-showcase-sla-bar">
            <div className="domus-sla-left">
              <Zap size={20} className="domus-sla-icon" />
              <div>
                <p className="domus-sla-title">
                  Tự động gạch nợ VietQR Real-time
                </p>
                <p className="domus-sla-sub">
                  Khớp tiền thuê phòng &amp; dịch vụ trong 1.2s
                </p>
              </div>
            </div>
            <div className="domus-sla-right">
              <span className="domus-sla-metric">99.98%</span>
              <p className="domus-sla-label">Uptime SLA</p>
            </div>
          </div>
        </div>

        {/* 4 Role Specifications (RBAC Core Architecture Card) */}
        <div className="domus-rbac-box">
          <div className="domus-rbac-header">
            <span className="domus-rbac-title">
              <ShieldCheck size={16} className="domus-rbac-icon" />
              Đặc tả 4 Vai trò Xác thực (RBAC Spec 14/10/2026)
            </span>
            <span className="domus-rbac-tag">Tự động định tuyến</span>
          </div>

          <div className="domus-rbac-grid">
            {RBAC_ROLE_SPECS.map((role) => (
              <div key={role.code} className="domus-rbac-card">
                <div className="domus-rbac-card-top">
                  <span className={`domus-rbac-badge tone-${role.badgeTone}`}>
                    {role.code}
                  </span>
                  <span className="domus-rbac-role-name">{role.label}</span>
                </div>
                <p className="domus-rbac-card-desc">
                  {role.description}
                  <span className={`domus-rbac-highlight tone-${role.badgeTone}`}>
                    {role.highlight}
                  </span>
                  {role.suffix}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom Compliance & Security Assurance Footer */}
      <div className="domus-left-footer">
        <div className="domus-compliance-badges">
          <span className="domus-compliance-item">
            <Lock size={14} className="icon-green" />
            AES-256 Encrypted
          </span>
          <span className="domus-compliance-item">
            <ShieldCheck size={14} className="icon-teal" />
            SOC2 Type II Ready
          </span>
          <span className="domus-compliance-item">
            <Cookie size={14} className="icon-indigo" />
            HttpOnly Safe Cookie
          </span>
        </div>
        <span className="domus-copyright">DOMUS Cloud Platform © 2026</span>
      </div>
    </section>
  );
}
