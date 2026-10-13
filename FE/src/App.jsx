import { lazy, Suspense } from "react";
import {
  BrowserRouter,
  Navigate,
  NavLink,
  Route,
  Routes,
  useLocation,
} from "react-router-dom";
import {
  Building2,
  DoorOpen,
  FileText,
  LogOut,
  ChevronRight,
  House,
} from "lucide-react";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { ToastProvider, useToast } from "./context/ToastContext";
import { LoadingState, EmptyState, Button } from "./components/ui";
import { errorMessage } from "./services/api";
import LoginPage from "./features/auth/LoginPage";
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
function Workspace() {
  const { user, loading, logout } = useAuth(),
    location = useLocation(),
    toast = useToast();
  if (loading)
    return (
      <div className="app-loading">
        <LoadingState />
      </div>
    );
  if (!user) return <LoginPage />;
  const propertyAccess = ["LANDLORD", "PROPERTY_MANAGER"].includes(user.role);
  const contractAccess = ["LANDLORD", "TENANT"].includes(user.role);
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
            label:
              user.role === "TENANT" ? "Hợp đồng của tôi" : "Hợp đồng thuê",
            icon: FileText,
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
        <span className="topbar-caption">Quản lý nhà cho thuê</span>
        <div className="topbar-right">
          <div className="header-user">
            <strong>{user.name}</strong>
            <small>{roles[user.role]}</small>
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
          <div className="avatar">{user.name.slice(0, 1)}</div>
          <div>
            <strong>{roles[user.role]}</strong>
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
          <span>Quản lý cơ sở và phòng cho thuê</span>
        </div>
      </aside>
      <div className="workspace-main">
        <div className="breadcrumbs">
          <House size={15} />
          <span>Quản lý</span>
          <ChevronRight size={14} />
          <strong>{current?.label || "Tài khoản"}</strong>
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
                <Route path="*" element={<Navigate to={home} replace />} />
              </Routes>
            )}
          </Suspense>
        </main>
      </div>
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
