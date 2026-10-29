import React from "react";
import { useNavigate } from "react-router-dom";
import { Menu, PlusCircle, LogOut } from "lucide-react";
import { GlobalSearch } from "./GlobalSearch";
import { NotificationBell } from "./NotificationBell";

/**
 * TopBar Component - DOMUS ERP
 * Sticky header bar with mobile navigation toggle, global search, quick action CTA, notifications, and user account pill.
 */
export function TopBar({
  user = { name: "User", role: "" },
  userInitials = "U",
  roles = {},
  propertyAccess = false,
  isLandlord = false,
  onOpenQuickCreate,
  onOpenMobileMenu,
  onSignOut,
}) {
  const navigate = useNavigate();

  const handleProfileClick = () => {
    navigate("/profile");
  };

  const handleKeyDownProfile = (e) => {
    if (e.key === "Enter" || e.key === " ") {
      navigate("/profile");
    }
  };

  return (
    <header className="stitch-topbar">
      <div className="stitch-topbar-left">
        <button
          type="button"
          className="stitch-mobile-menu-toggle"
          onClick={onOpenMobileMenu}
          aria-label="Mở menu điều hướng"
        >
          <Menu size={20} />
        </button>

        {propertyAccess && <GlobalSearch />}
      </div>

      {/* Right cluster: Actions, Notifications, Profile */}
      <div className="stitch-topbar-right">
        {/* Quick Action in Topbar */}
        {isLandlord && (
          <button
            type="button"
            className="stitch-topbar-cta"
            onClick={onOpenQuickCreate}
            title="Lập hóa đơn thu tiền"
          >
            <PlusCircle size={15} />
            <span>Tạo hóa đơn</span>
          </button>
        )}

        {/* Notifications: work waiting for this user */}
        <NotificationBell userId={user?._id || user?.id} />

        <div className="stitch-divider-v" />

        {/* User Profile Pill */}
        <div
          className="stitch-profile-pill"
          onClick={handleProfileClick}
          title="Quản lý hồ sơ & thông tin tài khoản"
          role="button"
          tabIndex={0}
          onKeyDown={handleKeyDownProfile}
        >
          <div className="stitch-avatar">{userInitials}</div>
          <div className="stitch-profile-text">
            <span className="stitch-profile-name">{user?.name}</span>
            <span className="stitch-profile-role">
              {roles[user?.role] || user?.role}
            </span>
          </div>
        </div>

        {/* Logout Button */}
        {onSignOut && (
          <button
            type="button"
            className="stitch-logout-btn"
            onClick={onSignOut}
            title="Đăng xuất khỏi hệ thống"
          >
            <LogOut size={16} />
            <span className="stitch-logout-text">Đăng xuất</span>
          </button>
        )}
      </div>
    </header>
  );
}

export default TopBar;
