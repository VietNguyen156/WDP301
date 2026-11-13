import { Plus, RefreshCw } from "lucide-react";
import { Button, LoadingState, EmptyState } from "../../components/ui";
import {
  StaffKpiRibbon,
  StaffFilterBar,
  StaffTable,
  StaffModals,
} from "../../components/staff";
import { useStaffManagement } from "../../hooks/useStaffManagement";
import "./Staff.css";

export default function StaffPage() {
  const {
    staffList,
    filteredStaff,
    branches,
    stats,
    searchTerm,
    setSearchTerm,
    statusFilter,
    setStatusFilter,
    branchFilter,
    setBranchFilter,
    hasActiveFilters,
    handleResetFilters,
    copiedKey,
    copyPhone,
    loading,
    error,
    loadData,
    isCreateOpen,
    openCreateModal,
    closeCreateModal,
    name,
    setName,
    phoneNumber,
    setPhoneNumber,
    email,
    setEmail,
    assignedBranches,
    toggleBranch,
    toggleAllBranches,
    busy,
    formError,
    handleCreateStaff,
    resettingStaff,
    setResettingStaff,
    resetBusy,
    confirmResetPassword,
    issuedCreds,
    setIssuedCreds,
    resolveAssignedBranches,
    permissionStaff,
    setPermissionStaff,
    permissionBusyKey,
    togglePermission,
    lockingStaff,
    setLockingStaff,
    lockBusy,
    confirmToggleLock,
  } = useStaffManagement();

  return (
    <div className="staff-management-page">
      <header className="page-heading">
        <div>
          <h1>Đội ngũ Quản lý cơ sở</h1>
          <p>
            Cấp tài khoản đăng nhập (SĐT), phân công cơ sở phụ trách và kiểm
            soát quyền thao tác cho Quản lý (Property Manager).
          </p>
        </div>
        <div className="page-actions">
          <Button
            variant="secondary"
            onClick={() => loadData()}
            title="Làm mới danh sách"
          >
            <RefreshCw size={15} />
            <span>Làm mới</span>
          </Button>
          <Button onClick={openCreateModal}>
            <Plus size={16} />
            <span>Cấp tài khoản Quản lý</span>
          </Button>
        </div>
      </header>

      <StaffKpiRibbon
        stats={stats}
        hasActiveFilters={hasActiveFilters}
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        onResetFilters={handleResetFilters}
      />

      <StaffFilterBar
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        branchFilter={branchFilter}
        setBranchFilter={setBranchFilter}
        branches={branches}
        totalCount={staffList.length}
        stats={stats}
        onResetFilters={handleResetFilters}
      />

      {loading ? (
        <LoadingState />
      ) : error ? (
        <EmptyState
          title="Không thể tải dữ liệu"
          description={error}
          action={<Button onClick={() => loadData()}>Thử lại</Button>}
        />
      ) : staffList.length === 0 ? (
        <EmptyState
          title="Chưa có Quản lý cơ sở nào"
          description="Chủ trọ có thể cấp tài khoản cho nhân sự quản lý tòa nhà, chốt số điện nước và phụ trách vận hành chi nhánh."
          action={
            <Button onClick={openCreateModal}>
              <Plus size={16} />
              Cấp tài khoản Quản lý đầu tiên
            </Button>
          }
        />
      ) : (
        <StaffTable
          staffList={staffList}
          filteredStaff={filteredStaff}
          searchTerm={searchTerm}
          copiedKey={copiedKey}
          onCopyPhone={copyPhone}
          onResetFilters={handleResetFilters}
          resolveAssignedBranches={resolveAssignedBranches}
          onOpenPermissions={setPermissionStaff}
          onOpenLock={setLockingStaff}
          onOpenResetPassword={setResettingStaff}
        />
      )}

      <StaffModals
        branches={branches}
        isCreateOpen={isCreateOpen}
        closeCreateModal={closeCreateModal}
        name={name}
        setName={setName}
        phoneNumber={phoneNumber}
        setPhoneNumber={setPhoneNumber}
        email={email}
        setEmail={setEmail}
        assignedBranches={assignedBranches}
        toggleBranch={toggleBranch}
        toggleAllBranches={toggleAllBranches}
        busy={busy}
        formError={formError}
        handleCreateStaff={handleCreateStaff}
        resettingStaff={resettingStaff}
        setResettingStaff={setResettingStaff}
        resetBusy={resetBusy}
        confirmResetPassword={confirmResetPassword}
        lockingStaff={lockingStaff}
        setLockingStaff={setLockingStaff}
        lockBusy={lockBusy}
        confirmToggleLock={confirmToggleLock}
        permissionStaff={permissionStaff}
        setPermissionStaff={setPermissionStaff}
        permissionBusyKey={permissionBusyKey}
        togglePermission={togglePermission}
        issuedCreds={issuedCreds}
        setIssuedCreds={setIssuedCreds}
      />
    </div>
  );
}
