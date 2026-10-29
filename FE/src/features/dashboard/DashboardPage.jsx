import { LoadingState } from "../../components/ui";
import { useDashboardPage } from "../../hooks/useDashboardPage";
import {
  DashboardHeaderBar,
  DashboardKpiGrid,
  DashboardChartsRow,
  DashboardWatchlistsRow,
  DashboardRecentPayments,
  DashboardShortcuts,
} from "../../components/dashboard";
import "./Dashboard.css";

export default function DashboardPage() {
  const {
    user,
    navigate,
    currentMonthStr,
    prevMonthStr,
    filterBranchId,
    setFilterBranchId,
    billingPeriod,
    setBillingPeriod,
    branches,
    unmatched,
    loading,
    refreshing,
    detailsLoading,
    loadDashboardData,
    activeBranches,
    activePayments,
    roomMetrics,
    financialMetrics,
    contractWatchlist,
    branchPerformance,
    handleCopyZaloReminder,
  } = useDashboardPage();

  if (loading) {
    return (
      <div
        style={{ padding: "40px", display: "flex", justifyContent: "center" }}
      >
        <LoadingState />
      </div>
    );
  }

  return (
    <div className="stitch-dash-container">
      <DashboardHeaderBar
        user={user}
        branches={branches}
        filterBranchId={filterBranchId}
        setFilterBranchId={setFilterBranchId}
        billingPeriod={billingPeriod}
        setBillingPeriod={setBillingPeriod}
        currentMonthStr={currentMonthStr}
        prevMonthStr={prevMonthStr}
        refreshing={refreshing}
        onRefresh={() => loadDashboardData(true)}
        unmatchedCount={unmatched.length}
      />

      <DashboardKpiGrid
        financialMetrics={financialMetrics}
        roomMetrics={roomMetrics}
        activeBranchesCount={activeBranches.length}
        totalActiveContracts={contractWatchlist.totalActive}
      />

      <DashboardChartsRow
        roomMetrics={roomMetrics}
        activeBranchesCount={activeBranches.length}
        contractWatchlist={contractWatchlist}
        branchPerformance={branchPerformance}
      />

      <DashboardWatchlistsRow
        userRole={user?.role}
        financialMetrics={financialMetrics}
        contractWatchlist={contractWatchlist}
        activeBranches={activeBranches}
        detailsLoading={detailsLoading}
        onCopyZaloReminder={handleCopyZaloReminder}
      />

      <DashboardRecentPayments
        detailsLoading={detailsLoading}
        activePayments={activePayments}
      />

      <DashboardShortcuts userRole={user?.role} navigate={navigate} />
    </div>
  );
}
