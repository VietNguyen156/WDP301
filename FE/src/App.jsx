import { lazy, Suspense } from "react";
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  useParams,
} from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { ToastProvider } from "./context/ToastContext";
import { LoadingState } from "./components/ui";
import { AppLayout, PublicLayout } from "./components/layout";
import { useWorkspaceShell } from "./hooks/useWorkspaceShell";
import "./App.css";

// Every screen and modal is its own chunk, loaded the first time it is shown.
const named = (load, name) =>
  lazy(() => load().then((m) => ({ default: m[name] })));
const LoginPage = lazy(() => import("./features/auth/LoginPage"));
const ForceChangePassword = lazy(
  () => import("./features/auth/ForceChangePassword"),
);
const InvoiceList = named(
  () => import("./features/invoices/InvoiceList"),
  "InvoiceList",
);
const PaymentHistoryList = named(
  () => import("./features/payments/PaymentHistoryList"),
  "PaymentHistoryList",
);
const UnmatchedPaymentList = named(
  () => import("./features/payments/UnmatchedPaymentList"),
  "UnmatchedPaymentList",
);
const PublicInvoicePage = named(
  () => import("./features/public-invoice/PublicInvoicePage"),
  "PublicInvoicePage",
);
const InvoiceGenerateModal = named(
  () => import("./features/invoices/InvoiceGenerateModal"),
  "InvoiceGenerateModal",
);
const SaaSPlansModal = named(
  () => import("./features/plans/SaaSPlansModal"),
  "SaaSPlansModal",
);
const DashboardPage = lazy(() => import("./features/dashboard/DashboardPage"));
const BranchesPage = lazy(() => import("./features/branches/BranchesPage"));
const RoomsPage = lazy(() => import("./features/rooms/RoomsPage"));
const UtilityReadingsPage = lazy(
  () => import("./features/utility-readings/UtilityReadingsPage"),
);
const IncidentsPage = lazy(() => import("./features/incidents/IncidentsPage"));
const ContractsPage = lazy(() => import("./features/contracts/ContractsPage"));
const StaffPage = lazy(() => import("./features/staff/StaffPage"));
const TenantsPage = lazy(() => import("./features/tenants/TenantsPage"));
const SaasAdminPage = lazy(
  () => import("./features/saas-admin/SaasAdminPage"),
);
const ProfilePage = lazy(() => import("./features/profile/ProfilePage"));

function PublicInvoiceRoute() {
  const { token } = useParams();
  return (
    <PublicLayout>
      <PublicInvoicePage token={token} />
    </PublicLayout>
  );
}

function Workspace() {
  const {
    user,
    loading,
    mustChangePassword,
    selectedBranchId,
    branches,
    userInitials,
    currentPlan,
    roles,
    nav,
    isSuperAdmin,
    isLandlord,
    isManager,
    isTenant,
    propertyAccess,
    contractAccess,
    financeAccess,
    tenantDirAccess,
    home,
    isPublicInvoicePath,
    hashToken,
    mobileMenuOpen,
    setMobileMenuOpen,
    isQuickCreateOpen,
    setIsQuickCreateOpen,
    isPlansModalOpen,
    setIsPlansModalOpen,
    signOut,
  } = useWorkspaceShell();

  if (isPublicInvoicePath) {
    return (
      <Suspense fallback={<LoadingState />}>
        <Routes>
          <Route path="/i/:token" element={<PublicInvoiceRoute />} />
          <Route path="/public/:token" element={<PublicInvoiceRoute />} />
          <Route
            path="*"
            element={<PublicInvoicePage token={hashToken || undefined} />}
          />
        </Routes>
      </Suspense>
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
    return (
      <Suspense fallback={<LoadingState />}>
        <LoginPage />
      </Suspense>
    );
  }

  if (mustChangePassword) {
    return (
      <Suspense fallback={<LoadingState />}>
        <ForceChangePassword />
      </Suspense>
    );
  }

  return (
    <>
      <AppLayout
        nav={nav}
        currentPlan={currentPlan}
        home={home}
        isSuperAdmin={isSuperAdmin}
        isLandlord={isLandlord}
        isManager={isManager}
        isTenant={isTenant}
        propertyAccess={propertyAccess}
        user={user}
        userInitials={userInitials}
        roles={roles}
        mobileMenuOpen={mobileMenuOpen}
        setMobileMenuOpen={setMobileMenuOpen}
        onQuickCreate={() => setIsQuickCreateOpen(true)}
        onOpenPlans={() => setIsPlansModalOpen(true)}
        onSignOut={signOut}
      >
        <Suspense fallback={<LoadingState />}>
          <Routes>
            {isSuperAdmin && (
              <>
                <Route path="/admin" element={<SaasAdminPage />} />
                <Route
                  path="/admin/analytics"
                  element={<SaasAdminPage initialTab="analytics" />}
                />
                <Route
                  path="/admin/plans"
                  element={<SaasAdminPage initialTab="plans" />}
                />
                <Route
                  path="/admin/landlords"
                  element={<SaasAdminPage initialTab="landlords" />}
                />
                <Route
                  path="/admin/subscriptions"
                  element={<SaasAdminPage initialTab="subscriptions" />}
                />
                <Route
                  path="/admin/invoices"
                  element={<SaasAdminPage initialTab="invoices" />}
                />
                <Route
                  path="/admin/upgrade-requests"
                  element={<SaasAdminPage initialTab="upgrade-requests" />}
                />
              </>
            )}
            {propertyAccess && (
              <>
                <Route path="/dashboard" element={<DashboardPage />} />
                <Route path="/plans" element={<DashboardPage />} />
                <Route path="/branches" element={<BranchesPage />} />
                <Route path="/rooms" element={<RoomsPage />} />
                <Route
                  path="/utility-readings"
                  element={<UtilityReadingsPage />}
                />
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
                <Route path="/invoices" element={<InvoiceList />} />
                <Route path="/payments" element={<PaymentHistoryList />} />
              </>
            )}
            {isLandlord && <Route path="/staff" element={<StaffPage />} />}
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
      </AppLayout>

      <Suspense fallback={null}>
        {isQuickCreateOpen && isLandlord && (
          <InvoiceGenerateModal
            isOpen={isQuickCreateOpen}
            onClose={() => setIsQuickCreateOpen(false)}
            defaultBranchId={selectedBranchId}
            onGenerated={() => setIsQuickCreateOpen(false)}
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
      </Suspense>
    </>
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
