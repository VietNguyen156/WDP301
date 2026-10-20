import React, { lazy, Suspense, useState, useEffect, useRef } from "react";
import {
  BrowserRouter,
  Navigate,
  NavLink,
  Route,
  Routes,
  useLocation,
  useParams,
  useNavigate,
} from "react-router-dom";
import {
  Building2,
  DoorOpen,
  FileText,
  LogOut,
  Receipt,
  CreditCard,
  Scale,
  PlusCircle,
  Users,
  UserCheck,
  Search,
  Bell,
  Settings,
  Headphones,
  CheckCircle2,
  ChevronDown,
  LayoutDashboard,
  Crown,
  Layers,
  Menu,
  X,
  ShieldCheck,
  UserPlus,
  Zap,
  AlertTriangle,
  Wrench,
  ArrowUpCircle,
} from "lucide-react";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { ToastProvider, useToast } from "./context/ToastContext";
import { LoadingState } from "./components/ui";
import { branchApi, errorMessage } from "./services/api";
import LoginPage from "./features/auth/LoginPage";
import ForceChangePassword from "./features/auth/ForceChangePassword";
import { InvoiceList } from "./features/invoices/InvoiceList";
import { PaymentHistoryList } from "./features/payments/PaymentHistoryList";
import { UnmatchedPaymentList } from "./features/payments/UnmatchedPaymentList";
import { PublicInvoicePage } from "./features/public-invoice/PublicInvoicePage";
import { InvoiceGenerateModal } from "./features/invoices/InvoiceGenerateModal";
import { SaaSPlansModal } from "./features/plans/SaaSPlansModal";
import "./App.css";

const DashboardPage = lazy(() => import("./features/dashboard/DashboardPage"));
const BranchesPage = lazy(() => import("./features/branches/BranchesPage"));
const RoomsPage = lazy(() => import("./features/rooms/RoomsPage"));
const UtilityReadingsPage = lazy(() => import("./features/utility-readings/UtilityReadingsPage"));
const IncidentsPage = lazy(() => import("./features/incidents/IncidentsPage"));
const ContractsPage = lazy(() => import("./features/contracts/ContractsPage"));
const StaffPage = lazy(() => import("./features/staff/StaffPage"));
const TenantsPage = lazy(() => import("./features/tenants/TenantsPage"));
const SaasAdminPage = lazy(() => import("./features/saas-admin/SaasAdminPage"));
const ProfilePage = lazy(() => import("./features/profile/ProfilePage"));

const roles = {
  LANDLORD: "Chủ chuỗi cơ sở",
  PROPERTY_MANAGER: "Quản lý cơ sở",
  TENANT: "Khách thuê",
  SUPER_ADMIN: "Quản trị nền tảng",
};

function PublicInvoiceRoute() {
  const { token } = useParams();
  return (
    <div style={{ minHeight: "100vh", backgroundColor: "var(--bg-app)" }}>
      <header
        style={{
          backgroundColor: "#fff",
          borderBottom: "1px solid var(--border-color)",
          padding: "14px 24px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div
            style={{
              width: "36px",
              height: "36px",
              borderRadius: "10px",
              backgroundColor: "var(--primary-container, #0f766e)",
              color: "#fff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Building2 size={20} />
          </div>
          <span style={{ fontWeight: 700, fontSize: "1.15rem", fontFamily: "var(--font-heading)" }}>
            DOMUS <span style={{ color: "var(--primary, #005c55)" }}>ERP</span> · Cổng Hóa Đơn Khách Thuê
          </span>
        </div>
      </header>
      <main style={{ padding: "24px", maxWidth: "900px", margin: "0 auto" }}>
        <PublicInvoicePage token={token} />
      </main>
    </div>
  );
}

function Workspace() {
  const { user, loading, logout, selectedBranchId, setSelectedBranchId, mustChangePassword } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const toast = useToast();
  const [isQuickCreateOpen, setIsQuickCreateOpen] = useState(false);
  const [isPlansModalOpen, setIsPlansModalOpen] = useState(false);
  const [branches, setBranches] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const searchInputRef = useRef(null);

  useEffect(() => {
    function handleKeyDown(e) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname, location.search]);

  // /plans (also SePay's return URL) opens the plans & payment modal.
  useEffect(() => {
    if (location.pathname === "/plans" && user?.role === "LANDLORD") setIsPlansModalOpen(true);
  }, [location.pathname, user]);

  const userInitials = React.useMemo(() => {
    if (!user?.name) return "U";
    const parts = user.name.trim().split(" ");
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }, [user]);

  const currentPlan = React.useMemo(() => {
    if (!user) {
      return {
        code: "FREE_TRIAL",
        name: "Gói Dùng Thử",
        expiryText: "30 ngày trải nghiệm",
        connectedText: "1 cơ sở · 5 phòng",
      };
    }
    if (user.role === "SUPER_ADMIN") {
      return {
        code: "ENTERPRISE",
        name: "Quản Trị Hệ Thống",
        expiryText: "Toàn quyền nền tảng (Root)",
        connectedText: "Toàn sàn DOMUS ERP",
      };
    }
    if (user.role === "PROPERTY_MANAGER") {
      return {
        code: "PROPERTY_MANAGER",
        name: "Quản Lý Cơ Sở",
        expiryText: "Theo phân quyền cơ sở",
        connectedText: `${branches.length} cơ sở phân công`,
      };
    }
    if (user.role === "TENANT") {
      return {
        code: "TENANT",
        name: "Tài Khoản Cư Dân",
        expiryText: "Khách thuê phòng",
        connectedText: "Đang thuê phòng",
      };
    }
    // LANDLORD
    const code = user.subscription?.plan?.code || user.subscriptionPlan || "FREE_TRIAL";
    const name =
      user.subscription?.plan?.name ||
      (code === "PRO"
        ? "Gói Chuyên Nghiệp (Pro)"
        : code === "STARTER"
        ? "Gói Khởi Nghiệp (Starter)"
        : code === "ENTERPRISE"
        ? "Gói Doanh Nghiệp Max"
        : "Gói Dùng Thử (Free Trial)");
    const expiryText = user.subscription?.endDate
      ? `Hạn dùng: ${new Date(user.subscription.endDate).toLocaleDateString("vi-VN")}`
      : "30 ngày trải nghiệm";
    const connectedText = branches.length > 0 ? `Đã kết nối ${branches.length} cơ sở` : "Hệ thống sẵn sàng";
    return { code, name, expiryText, connectedText };
  }, [user, branches]);

  useEffect(() => {
    let active = true;
    if (user && (user.role === "LANDLORD" || user.role === "PROPERTY_MANAGER")) {
      branchApi
        .options()
        .then((items) => {
          if (active) {
            const list = items || [];
            setBranches(list);
            if (list.length > 0) {
              const exists = list.some((b) => b._id === selectedBranchId);
              if (!exists) {
                setSelectedBranchId(list[0]._id);
              }
            } else if (selectedBranchId) {
              setSelectedBranchId("");
            }
          }
        })
        .catch(() => {});
    }
    return () => {
      active = false;
    };
  }, [user, selectedBranchId, setSelectedBranchId]);

  // Allow public invoice view without authentication
  if (
    location.pathname.startsWith("/i/") ||
    location.pathname.startsWith("/public/") ||
    window.location.hash.startsWith("#public/")
  ) {
    const hashToken = window.location.hash.replace("#public/", "");
    return (
      <Routes>
        <Route path="/i/:token" element={<PublicInvoiceRoute />} />
        <Route path="/public/:token" element={<PublicInvoiceRoute />} />
        <Route
          path="*"
          element={<PublicInvoicePage token={hashToken || undefined} />}
        />
      </Routes>
    );
  }

  if (loading) {
    return (
      <div className="app-loading">
        <LoadingState />
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  if (mustChangePassword) {
    return <ForceChangePassword />;
  }

  const isSuperAdmin = user.role === "SUPER_ADMIN";
  const isLandlord = user.role === "LANDLORD";
  const isManager = user.role === "PROPERTY_MANAGER";
  const isTenant = user.role === "TENANT";

  const propertyAccess = !isSuperAdmin && (isLandlord || isManager);
  const contractAccess = !isSuperAdmin && (isLandlord || isTenant);
  const financeAccess = !isSuperAdmin && (isLandlord || isManager || isTenant);
  const tenantDirAccess = !isSuperAdmin && isLandlord;

  const home = isSuperAdmin ? "/admin" : propertyAccess ? "/dashboard" : "/contracts";

  const nav = isSuperAdmin
    ? [
        { path: "/admin?tab=analytics", label: "Tổng quan Hệ thống", icon: LayoutDashboard },
        { path: "/admin?tab=landlords", label: "Quản lý Chủ trọ", icon: Users },
        { path: "/admin?tab=plans", label: "Gói dịch vụ SaaS", icon: Layers },
        { path: "/admin?tab=subscriptions", label: "Thuê bao & Hạn ngạch", icon: Crown },
        { path: "/admin?tab=upgrade-requests", label: "Yêu cầu đổi gói", icon: ArrowUpCircle },
        { path: "/admin?tab=invoices", label: "Hóa đơn & Thu tiền", icon: Receipt },
      ]
    : [
        ...(propertyAccess
          ? [
              { path: "/dashboard", label: "Tổng quan & Thống kê", icon: LayoutDashboard },
              { path: "/branches", label: "Cơ sở / Tòa nhà", icon: Building2, count: branches.length || undefined },
              { path: "/rooms", label: "Phòng & Căn hộ", icon: DoorOpen },
              { path: "/utility-readings", label: "Chốt số điện nước", icon: Zap },
              { path: "/incidents", label: "Sự cố & Bảo trì", icon: Wrench },
            ]
          : []),
        ...(isTenant
          ? [
              { path: "/incidents", label: "Báo sự cố phòng", icon: AlertTriangle },
            ]
          : []),
        ...(contractAccess
          ? [
              {
                path: "/contracts",
                label: isTenant ? "Hợp đồng của tôi" : "Hợp đồng & Khách thuê",
                icon: FileText,
              },
            ]
          : []),
        ...(financeAccess
          ? [
              {
                path: "/invoices",
                label: isTenant ? "Hóa đơn của tôi" : "Hóa đơn & Thu nợ",
                icon: Receipt,
              },
              {
                path: "/payments",
                label: "Lịch sử thanh toán",
                icon: CreditCard,
              },
            ]
          : []),
        ...(isLandlord
          ? [
              { path: "/staff", label: "Quản lý nhân sự", icon: Users },
            ]
          : []),
        ...(tenantDirAccess
          ? [
              { path: "/tenants", label: "Hồ sơ cư dân", icon: UserCheck },
            ]
          : []),
        ...(isLandlord
          ? [
              {
                path: "/unmatched",
                label: "Đối soát SePay",
                icon: Scale,
              },
            ]
          : []),
      ];

  async function signOut() {
    try {
      await logout();
    } catch (err) {
      toast(errorMessage(err), "error");
    }
  }

  function handleBranchChange(e) {
    const val = e.target.value;
    setSelectedBranchId(val);
    if (location.pathname === "/rooms") {
      navigate(val ? `/rooms?branchId=${val}` : "/rooms");
    }
  }

  return (
    <div className="stitch-layout">
      {/* Mobile drawer backdrop */}
      {mobileMenuOpen && (
        <div
          className="stitch-sidebar-backdrop"
          onClick={() => setMobileMenuOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* 1. LEFT SIDEBAR: SideNavBar (Strict Stitch Source of Truth) */}
      <aside className={`stitch-sidebar ${mobileMenuOpen ? "mobile-open" : ""}`}>
        {/* Top Branding & Quick Actions */}
        <div className="stitch-sidebar-top">
          {/* Logo & Tenant Header */}
          <div className="stitch-brand-header-wrap">
            <NavLink to={home} className="stitch-brand-header">
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
                onClick={() => setMobileMenuOpen(false)}
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
                setMobileMenuOpen(false);
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
                setIsQuickCreateOpen(true);
                setMobileMenuOpen(false);
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
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <Icon size={18} className="stitch-nav-icon" />
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
              setMobileMenuOpen(false);
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
            onClick={() => {
              if (isSuperAdmin) {
                navigate("/admin?tab=plans");
              } else if (isLandlord) {
                setIsPlansModalOpen(true);
              } else if (isTenant) {
                navigate("/contracts");
              } else if (isManager) {
                navigate("/branches");
              }
              setMobileMenuOpen(false);
            }}
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
                <span className="stitch-sub-expiry">{currentPlan.connectedText || currentPlan.expiryText}</span>
              </div>
            </div>
            <CheckCircle2 size={18} className="stitch-sub-verified" />
          </button>

          {/* System Node Status Badge (From Stitch Source of Truth) */}
          <div className="stitch-node-badge">
            <div className="stitch-node-left">
              <span className="stitch-node-pulse" />
              <span className="stitch-node-name">Node VN-Central 01</span>
            </div>
            <span className="stitch-node-ver">v2.4.8</span>
          </div>
        </div>
      </aside>

      {/* 2. MAIN WORKSPACE WRAPPER (Offset by sidebar width 256px) */}
      <div className="stitch-main-wrap">
        {/* TopNavBar (Docked sticky top-0) */}
        <header className="stitch-topbar">
          <div className="stitch-topbar-left">
            <button
              type="button"
              className="stitch-mobile-menu-toggle"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Mở menu điều hướng"
            >
              <Menu size={20} />
            </button>

            {/* Left: Global Search bar */}
            <div className="stitch-search-container">
              <Search size={16} className="stitch-search-icon" />
              <input
                ref={searchInputRef}
                type="text"
                className="stitch-search-input"
                placeholder="Tìm theo tên cơ sở, phòng, khách thuê, số CCCD..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && searchQuery.trim()) {
                    const q = searchQuery.trim();
                    if (location.pathname === "/rooms") {
                      navigate(`/rooms?search=${encodeURIComponent(q)}`);
                    } else if (location.pathname !== "/invoices") {
                      if (/^(p|phòng)?\s*\d+/i.test(q)) {
                        navigate(`/rooms?search=${encodeURIComponent(q)}`);
                      } else {
                        navigate("/invoices");
                      }
                    }
                  }
                }}
              />
              <span
                className="stitch-search-shortcut"
                onClick={() => searchInputRef.current?.focus()}
                style={{ cursor: "pointer" }}
                title="Phím tắt: Nhấn Ctrl+K hoặc ⌘K để tìm kiếm"
              >
                ⌘K
              </span>
            </div>
          </div>

          {/* Right cluster: Branch switcher, Actions, Profile */}
          <div className="stitch-topbar-right">
            {/* Chi nhánh Switcher Dropdown */}
            {propertyAccess && branches.length > 0 && (
              <div className="stitch-branch-select-wrap">
                <Building2 size={15} className="stitch-branch-icon" />
                <select
                  className="stitch-branch-select"
                  aria-label="Chọn chi nhánh"
                  value={selectedBranchId}
                  onChange={handleBranchChange}
                >
                  <option value="">Tất cả cơ sở ({branches.length})</option>
                  {branches.map((b) => (
                    <option key={b._id} value={b._id}>
                      {b.name}
                    </option>
                  ))}
                </select>
                <ChevronDown size={14} className="stitch-branch-chevron" />
              </div>
            )}

            {/* Quick Action in Topbar */}
            {isLandlord && (
              <button
                type="button"
                className="stitch-topbar-cta"
                onClick={() => setIsQuickCreateOpen(true)}
              >
                <PlusCircle size={15} />
                <span>Tạo hóa đơn</span>
              </button>
            )}

            {/* Trailing Icons: Notification */}
            <button
              type="button"
              className="stitch-icon-btn"
              title="Thông báo hệ thống"
              onClick={() => toast("Bạn không có thông báo công nợ tồn đọng mới.", "info")}
            >
              <Bell size={17} />
              <span className="stitch-notif-dot" />
            </button>

            <div className="stitch-divider-v" />

            {/* User Profile Pill */}
            <div
              className="stitch-profile-pill"
              onClick={() => navigate("/profile")}
              title="Quản lý hồ sơ & thông tin tài khoản"
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  navigate("/profile");
                }
              }}
            >
              <div className="stitch-avatar">
                {userInitials}
              </div>
              <div className="stitch-profile-text">
                <span className="stitch-profile-name">{user.name}</span>
                <span className="stitch-profile-role">
                  {roles[user.role] || user.role}
                </span>
              </div>
            </div>

            {/* Logout Button */}
            <button
              type="button"
              className="stitch-logout-btn"
              onClick={signOut}
              title="Đăng xuất khỏi hệ thống"
            >
              <LogOut size={16} />
              <span className="stitch-logout-text">Đăng xuất</span>
            </button>
          </div>
        </header>

        {/* 3. MAIN SCROLLABLE CONTENT CANVAS */}
        <main className="stitch-canvas">
          <div className="stitch-canvas-inner">
            <Suspense fallback={<LoadingState />}>
              <Routes>
                {isSuperAdmin && (
                  <>
                    <Route path="/admin" element={<SaasAdminPage />} />
                    <Route path="/admin/analytics" element={<SaasAdminPage initialTab="analytics" />} />
                    <Route path="/admin/plans" element={<SaasAdminPage initialTab="plans" />} />
                    <Route path="/admin/landlords" element={<SaasAdminPage initialTab="landlords" />} />
                    <Route path="/admin/subscriptions" element={<SaasAdminPage initialTab="subscriptions" />} />
                    <Route path="/admin/invoices" element={<SaasAdminPage initialTab="invoices" />} />
                    <Route path="/admin/upgrade-requests" element={<SaasAdminPage initialTab="upgrade-requests" />} />
                  </>
                )}
                {propertyAccess && (
                  <>
                    <Route path="/dashboard" element={<DashboardPage />} />
                    {/* SePay returns here after paying a SaaS invoice; the plans modal handles it. */}
                    <Route path="/plans" element={<DashboardPage />} />
                    <Route path="/branches" element={<BranchesPage />} />
                    <Route path="/rooms" element={<RoomsPage />} />
                    <Route path="/utility-readings" element={<UtilityReadingsPage />} />
                  </>
                )}
                {!isSuperAdmin && (
                  <Route path="/incidents" element={<IncidentsPage />} />
                )}
                {contractAccess && (
                  <Route path="/contracts" element={<ContractsPage />} />
                )}
                {financeAccess && (
                  <>
                    <Route path="/invoices" element={<InvoiceList externalSearchTerm={searchQuery} />} />
                    <Route path="/payments" element={<PaymentHistoryList />} />
                  </>
                )}
                {isLandlord && (
                  <Route path="/staff" element={<StaffPage />} />
                )}
                {tenantDirAccess && (
                  <Route path="/tenants" element={<TenantsPage />} />
                )}
                {isLandlord && (
                  <Route path="/unmatched" element={<UnmatchedPaymentList />} />
                )}
                <Route path="/profile" element={<ProfilePage />} />
                <Route path="*" element={<Navigate to={home} replace />} />
              </Routes>
            </Suspense>
          </div>
        </main>
      </div>

      {isQuickCreateOpen && isLandlord && (
        <InvoiceGenerateModal
          isOpen={isQuickCreateOpen}
          onClose={() => setIsQuickCreateOpen(false)}
          defaultBranchId={selectedBranchId}
          onGenerated={() => {
            setIsQuickCreateOpen(false);
          }}
        />
      )}

      {isPlansModalOpen && isLandlord && (
        <SaaSPlansModal
          isOpen={isPlansModalOpen}
          onClose={() => setIsPlansModalOpen(false)}
          currentPlan={currentPlan}
          branchesCount={branches.length}
          user={user}
        />
      )}
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <AuthProvider>
          <Workspace />
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  );
}

