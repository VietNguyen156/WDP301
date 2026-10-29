import React from "react";
import { NavLink, useNavigate, useLocation } from "react-router-dom";
import {
  ShieldCheck,
  Building2,
  X,
  UserPlus,
  PlusCircle,
  Settings,
  Headphones,
  CheckCircle2,
} from "lucide-react";
import { useToast } from "../../context/ToastContext";

/**
 * Sidebar Component - DOMUS ERP
 * Handles navigation drawer, brand identity, quick actions, role menu items, and subscription status.
 */
export function Sidebar({
  nav = [],
  currentPlan = { name: "DOMUS ERP", expiryText: "" },
  home = "/",
  isSuperAdmin = false,
  isLandlord = false,
  isManager = false,
  isTenant = false,
  mobileMenuOpen = false,
  setMobileMenuOpen,
  onQuickCreate,
  onOpenPlans,
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();

  const handleCloseMobileMenu = () => {
    if (setMobileMenuOpen) setMobileMenuOpen(false);
  };

  const handleSubCardClick = () => {
    if (isSuperAdmin) {
      navigate("/admin?tab=plans");
    } else if (isLandlord) {
      if (onOpenPlans) onOpenPlans();
    } else if (isTenant) {
      navigate("/contracts");
    } else if (isManager) {
      navigate("/branches");
    }
    handleCloseMobileMenu();
  };

  return (
    <>
      {/* Mobile drawer backdrop */}
      {mobileMenuOpen && (
        <div
          className="stitch-sidebar-backdrop"
          onClick={handleCloseMobileMenu}
          aria-hidden="true"
        />
      )}

      {/* Main Sidebar */}
      <aside className={`stitch-sidebar ${mobileMenuOpen ? "mobile-open" : ""}`}>
        {/* Top Branding & Quick Actions */}
        <div className="stitch-sidebar-top">
          {/* Logo & Tenant Header */}
          <div className="stitch-brand-header-wrap">
            <NavLink to={home} className="stitch-brand-header" onClick={handleCloseMobileMenu}>
              <div className={`stitch-brand-icon ${isSuperAdmin ? "super-admin" : ""}`}>
                {isSuperAdmin ? (
                  <ShieldCheck size={22} strokeWidth={2.2} />
                ) : (
                  <Building2 size={22} strokeWidth={2.2} />
                )}
              </div>
              <div className="stitch-brand-info">
                <span className="stitch-brand-title">
                  {isSuperAdmin ? "DOMUS Super Admin" : "DOMUS ERP"}
                </span>
                <span className="stitch-brand-sub">
                  {isSuperAdmin
                    ? "Master Control: Platform Root"
                    : isTenant
                    ? "Cổng Cư Dân & Khách Thuê"
                    : "Chuỗi căn hộ & Nhà trọ cao cấp"}
                </span>
              </div>
            </NavLink>

            {mobileMenuOpen && (
              <button
                type="button"
                className="stitch-sidebar-close-btn"
                onClick={handleCloseMobileMenu}
                aria-label="Đóng menu"
              >
                <X size={18} />
              </button>
            )}
          </div>

          {/* Quick Action CTA: Role-aware */}
          {isSuperAdmin && (
            <button
              type="button"
              className="stitch-quick-action"
              onClick={() => {
                navigate("/admin?tab=landlords");
                handleCloseMobileMenu();
              }}
              title="Thêm và phân quyền tài khoản Landlord"
            >
              <UserPlus size={17} />
              <span>+ Cấp quyền Landlord</span>
            </button>
          )}

          {isLandlord && (
            <button
              type="button"
              className="stitch-quick-action"
              onClick={() => {
                if (onQuickCreate) onQuickCreate();
                handleCloseMobileMenu();
              }}
              title="Lập hóa đơn tiền trọ tháng mới"
            >
              <PlusCircle size={17} />
              <span>Tạo hóa đơn nhanh</span>
            </button>
          )}

          {/* Main Navigation Tabs */}
          <nav className="stitch-nav-list" aria-label="Điều hướng chính">
            {nav.map(({ path, label, icon: Icon, count }) => {
              const isItemActive = path.includes("?tab=")
                ? location.pathname === "/admin" &&
                  (location.search.includes(path.split("?")[1]) ||
                    (!location.search && path.includes("tab=analytics")))
                : location.pathname === path;

              return (
                <NavLink
                  to={path}
                  key={path}
                  className={`stitch-nav-item ${isItemActive ? "active" : ""}`}
                  onClick={handleCloseMobileMenu}
                >
                  {Icon && <Icon size={18} className="stitch-nav-icon" />}
                  <span className="stitch-nav-label">{label}</span>
                  {count !== undefined && count > 0 && (
                    <span className="stitch-nav-badge">{count}</span>
                  )}
                </NavLink>
              );
            })}
          </nav>
        </div>

        {/* Footer Utility Actions & Subscription Chip */}
        <div className="stitch-sidebar-footer">
          <button
            type="button"
            className="stitch-footer-link"
            onClick={() => {
              navigate("/profile");
              handleCloseMobileMenu();
            }}
          >
            <Settings size={17} />
            <span>Hồ sơ & Tài khoản</span>
          </button>
          <button
            type="button"
            className="stitch-footer-link"
            onClick={() => toast("Hotline hỗ trợ kỹ thuật: 1900.8888 (24/7)", "info")}
          >
            <Headphones size={17} />
            <span>Hỗ trợ kỹ thuật 24/7</span>
          </button>

          {/* Subscription / Role Account Card */}
          <button
            type="button"
            className="stitch-sub-card"
            onClick={handleSubCardClick}
            title={
              isSuperAdmin
                ? "Quản trị các gói dịch vụ hệ thống"
                : isLandlord
                ? "Bấm để xem chi tiết các gói cước và hạn ngạch SaaS"
                : isTenant
                ? "Bấm để xem thông tin hợp đồng & phòng đang thuê"
                : "Bấm để xem danh sách cơ sở được phân công"
            }
          >
            <div className="stitch-sub-card-left">
              <span className="stitch-sub-pulse-dot" />
              <div className="stitch-sub-info">
                <span className="stitch-sub-plan">{currentPlan.name}</span>
                <span className="stitch-sub-expiry">
                  {currentPlan.connectedText || currentPlan.expiryText}
                </span>
              </div>
            </div>
            <CheckCircle2 size={18} className="stitch-sub-verified" />
          </button>

          {/* System Node Status Badge */}
          <div className="stitch-node-badge">
            <div className="stitch-node-left">
              <span className="stitch-node-pulse" />
              <span className="stitch-node-name">Node VN-Central 01</span>
            </div>
            <span className="stitch-node-ver">v2.4.8</span>
          </div>
        </div>
      </aside>
    </>
  );
}

export default Sidebar;
