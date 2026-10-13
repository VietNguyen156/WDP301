import React, { lazy, Suspense, useState, useEffect } from "react";
import {
  BrowserRouter,
  Navigate,
  NavLink,
  Route,
  Routes,
  useLocation,
  useParams,
} from "react-router-dom";
import {
  Building2,
  DoorOpen,
  FileText,
  LogOut,
  ChevronRight,
  House,
  Receipt,
  CreditCard,
  Scale,
  PlusCircle,
} from "lucide-react";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { ToastProvider, useToast } from "./context/ToastContext";
import { LoadingState, EmptyState, Button } from "./components/ui";
import { errorMessage } from "./services/api";
import LoginPage from "./features/auth/LoginPage";
import { InvoiceList } from "./features/invoices/InvoiceList";
import { PaymentHistoryList } from "./features/payments/PaymentHistoryList";
import { UnmatchedPaymentList } from "./features/payments/UnmatchedPaymentList";
import { PublicInvoicePage } from "./features/public-invoice/PublicInvoicePage";
import { InvoiceGenerateModal } from "./features/invoices/InvoiceGenerateModal";
import "./App.css";

const BranchesPage = lazy(() => import("./features/branches/BranchesPage"));
const RoomsPage = lazy(() => import("./features/rooms/RoomsPage"));
const ContractsPage = lazy(() => import("./features/contracts/ContractsPage"));

const roles = {
  LANDLORD: "Chủ cơ sở",
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
          padding: "12px 20px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <House size={24} color="#3c9e47" />
          <span style={{ fontWeight: 700, fontSize: "1.1rem" }}>
            Cổng Thông Tin Hóa Đơn Khách Thuê
          </span>
        </div>
      </header>
      <main style={{ padding: "20px" }}>
        <PublicInvoicePage token={token} />
      </main>
    </div>
  );
}

function Workspace() {
  const { user, loading, logout, selectedBranchId } = useAuth();
  const location = useLocation();
  const toast = useToast();
  const [isQuickCreateOpen, setIsQuickCreateOpen] = useState(false);

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

  const isLandlord = user.role === "LANDLORD";
  const isManager = user.role === "PROPERTY_MANAGER";
  const isTenant = user.role === "TENANT";

  const propertyAccess = isLandlord || isManager;
  const contractAccess = isLandlord || isTenant;
  const financeAccess = isLandlord || isTenant;

  const home = propertyAccess ? "/branches" : "/contracts";

  const nav = [
    ...(propertyAccess
      ? [
          { path: "/branches", label: "Cơ sở / Nhà trọ", icon: Building2 },
          { path: "/rooms", label: "Sơ đồ phòng", icon: DoorOpen },
        ]
      : []),
    ...(contractAccess
      ? [
          {
            path: "/contracts",
            label: isTenant ? "Hợp đồng của tôi" : "Hợp đồng thuê",
            icon: FileText,
          },
        ]
      : []),
    ...(financeAccess
      ? [
          {
            path: "/invoices",
            label: isTenant ? "Hóa đơn của tôi" : "Quản lý hóa đơn",
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
          {
            path: "/unmatched",
            label: "Đối soát chưa khớp",
            icon: Scale,
          },
        ]
      : []),
  ];

  const current = nav.find((n) => location.pathname.startsWith(n.path));

  async function signOut() {
    try {
      await logout();
    } catch (err) {
      toast(errorMessage(err), "error");
    }
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <NavLink to={home} className="brand">
          <House size={29} strokeWidth={2.5} />
          <span>QUẢN LÝ TRỌ</span>
        </NavLink>
        <span className="topbar-caption">Quản lý nhà cho thuê & Tài chính</span>

        <div className="topbar-right">
          {isLandlord && (
            <button
              onClick={() => setIsQuickCreateOpen(true)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                backgroundColor: "rgba(255,255,255,0.2)",
                color: "#fff",
                padding: "6px 12px",
                borderRadius: "6px",
                fontSize: "13px",
                fontWeight: 600,
                transition: "background-color 0.2s",
              }}
              title="Lập hóa đơn tiền trọ tháng mới"
            >
              <PlusCircle size={16} />
              <span>Tạo hóa đơn</span>
            </button>
          )}

          <div className="header-user">
            <strong>{user.name}</strong>
            <small>{roles[user.role] || user.role}</small>
          </div>

          <button
            className="header-logout"
            aria-label="Đăng xuất"
            onClick={signOut}
          >
            <LogOut size={18} />
            <span>Đăng xuất</span>
          </button>
        </div>
      </header>

      <aside className="sidebar">
        <div className="sidebar-account">
          <div className="avatar">{user.name?.slice(0, 1) || "U"}</div>
          <div>
            <strong>{roles[user.role] || user.role}</strong>
            <small>{user.email}</small>
          </div>
        </div>

        <div className="nav-caption">QUẢN LÝ</div>
        <nav aria-label="Điều hướng chính">
          {nav.map(({ path, label, icon: Icon }) => (
            <NavLink
              to={path}
              key={path}
              className={({ isActive }) =>
                `nav-item ${isActive ? "active" : ""}`
              }
            >
              <Icon size={20} />
              <span>{label}</span>
              <ChevronRight size={15} />
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <Building2 size={18} />
          <span>Quản lý phòng & Thu chi tài chính</span>
        </div>
      </aside>

      <div className="workspace-main">
        <div className="breadcrumbs">
          <House size={15} />
          <span>Quản lý</span>
          <ChevronRight size={14} />
          <strong>{current?.label || "Hệ thống"}</strong>
        </div>

        <main className="page-content">
          <Suspense fallback={<LoadingState />}>
            {user.role === "SUPER_ADMIN" ? (
              <EmptyState
                title="Tài khoản quản trị nền tảng"
                description="Khu vực này dành cho chủ nhà và quản lý cơ sở. Hãy sử dụng tài khoản được cấp để xem phòng và hợp đồng."
                action={<Button onClick={signOut}>Đổi tài khoản</Button>}
              />
            ) : (
              <Routes>
                {propertyAccess && (
                  <>
                    <Route path="/branches" element={<BranchesPage />} />
                    <Route path="/rooms" element={<RoomsPage />} />
                  </>
                )}
                {contractAccess && (
                  <Route path="/contracts" element={<ContractsPage />} />
                )}
                {financeAccess && (
                  <>
                    <Route path="/invoices" element={<InvoiceList />} />
                    <Route path="/payments" element={<PaymentHistoryList />} />
                  </>
                )}
                {isLandlord && (
                  <Route path="/unmatched" element={<UnmatchedPaymentList />} />
                )}
                <Route path="*" element={<Navigate to={home} replace />} />
              </Routes>
            )}
          </Suspense>
        </main>
      </div>

      {isQuickCreateOpen && (
        <InvoiceGenerateModal
          isOpen={isQuickCreateOpen}
          onClose={() => setIsQuickCreateOpen(false)}
          defaultBranchId={selectedBranchId}
          onGenerated={() => {
            setIsQuickCreateOpen(false);
          }}
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
