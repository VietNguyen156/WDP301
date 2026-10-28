import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import {
  PageHeader,
  LoadingState,
  ErrorState,
  EmptyState,
} from "../../components/ui";
import { useUtilityReadingsPage } from "../../hooks/useUtilityReadingsPage";
import {
  UtilityHeaderBar,
  UtilityKpiGrid,
  UtilityFilterBar,
  UtilityWizardView,
  UtilityTableView,
  UtilityAbnormalModal,
} from "../../components/utility-readings";
import "./UtilityReadings.css";

export default function UtilityReadingsPage() {
  const {
    user,
    options,
    allowedBranches,
    branchId,
    branch,
    handleBranchChange,
    billingPeriod,
    setBillingPeriod,
    filterStatus,
    setFilterStatus,
    roomSearch,
    setRoomSearch,
    viewMode,
    setViewMode,
    currentIndex,
    setCurrentIndex,
    readingResource,
    abnormalWarning,
    setAbnormalWarning,
    submitting,
    items,
    stats,
    filteredItems,
    activeItem,
    availablePeriods,
    handleInputChange,
    getItemValues,
    submitReading,
  } = useUtilityReadingsPage();

  return (
    <div className="util-container">
      <PageHeader
        title="Chốt số Điện & Nước theo kỳ"
        description="Ghi nhận chỉ số công tơ, phát hiện tiêu thụ bất thường và đồng bộ hóa đơn hàng tháng."
      />

      {options.loading ? (
        <LoadingState />
      ) : options.error ? (
        <ErrorState message={options.error} retry={options.reload} />
      ) : !allowedBranches.length ? (
        <EmptyState
          title={
            user?.role === "PROPERTY_MANAGER" || user?.role === "STAFF"
              ? "Bạn chưa được phân công quản lý cơ sở nào"
              : "Bạn chưa có cơ sở nào"
          }
          description={
            user?.role === "PROPERTY_MANAGER" || user?.role === "STAFF"
              ? "Tài khoản của bạn chưa được cấp quyền quản lý cơ sở nào trong hệ thống. Vui lòng liên hệ Chủ nhà trọ để được gán chi nhánh phụ trách."
              : "Tạo cơ sở đầu tiên để bắt đầu chốt số điện nước và quản lý chuỗi phòng."
          }
          action={
            user?.role === "LANDLORD" ? (
              <Link className="button primary" to="/branches">
                Quản lý cơ sở <ArrowRight size={17} />
              </Link>
            ) : null
          }
        />
      ) : (
        <>
          <UtilityHeaderBar
            user={user}
            allowedBranches={allowedBranches}
            branchId={branchId}
            branch={branch}
            onBranchChange={handleBranchChange}
            billingPeriod={billingPeriod}
            setBillingPeriod={setBillingPeriod}
            availablePeriods={availablePeriods}
            viewMode={viewMode}
            setViewMode={setViewMode}
            setCurrentIndex={setCurrentIndex}
          />

          <UtilityKpiGrid
            stats={stats}
            filterStatus={filterStatus}
            setFilterStatus={setFilterStatus}
            setCurrentIndex={setCurrentIndex}
          />

          <UtilityFilterBar
            filterStatus={filterStatus}
            setFilterStatus={setFilterStatus}
            setCurrentIndex={setCurrentIndex}
            itemsCount={items.length}
            stats={stats}
            roomSearch={roomSearch}
            setRoomSearch={setRoomSearch}
            filteredCount={filteredItems.length}
          />

          {/* Content Views */}
          {readingResource.loading ? (
            <LoadingState />
          ) : readingResource.error ? (
            <ErrorState
              message={readingResource.error}
              retry={readingResource.reload}
            />
          ) : !filteredItems.length ? (
            <EmptyState
              title={
                roomSearch
                  ? `Không tìm thấy phòng phù hợp với "${roomSearch}"`
                  : "Không có phòng nào trong danh sách"
              }
              description={
                roomSearch
                  ? "Vui lòng thử tìm kiếm với số phòng hoặc tầng khác."
                  : "Hãy kiểm tra lại cơ sở, kỳ chốt số hoặc bộ lọc trạng thái."
              }
            />
          ) : viewMode === "wizard" && activeItem ? (
            <UtilityWizardView
              activeItem={activeItem}
              currentIndex={currentIndex}
              setCurrentIndex={setCurrentIndex}
              filteredLength={filteredItems.length}
              getItemValues={getItemValues}
              handleInputChange={handleInputChange}
              submitting={submitting}
              billingPeriod={billingPeriod}
              submitReading={submitReading}
            />
          ) : (
            <UtilityTableView
              filteredItems={filteredItems}
              setCurrentIndex={setCurrentIndex}
              setViewMode={setViewMode}
            />
          )}

          <UtilityAbnormalModal
            abnormalWarning={abnormalWarning}
            setAbnormalWarning={setAbnormalWarning}
            submitting={submitting}
            submitReading={submitReading}
          />
        </>
      )}
    </div>
  );
}
