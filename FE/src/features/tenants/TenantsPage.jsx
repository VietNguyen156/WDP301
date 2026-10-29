import { Plus, RefreshCw } from "lucide-react";
import { useTenantsPage } from "../../hooks/useTenantsPage";
import {
  Button,
  Modal,
  LoadingState,
  EmptyState,
  CredentialsModal,
} from "../../components/ui";
import {
  TenantsKpiRibbon,
  TenantsFilterBar,
  TenantsTable,
  TenantCreateModal,
} from "../../components/tenants";

export default function TenantsPage() {
  const {
    tenants,
    loading,
    error,
    loadData,
    searchTerm,
    setSearchTerm,
    statusFilter,
    setStatusFilter,
    hometownFilter,
    setHometownFilter,
    hometownOptions,
    copiedKey,
    copyText,
    stats,
    filteredTenants,
    hasActiveFilters,
    handleResetFilters,
    isCreateOpen,
    setIsCreateOpen,
    name,
    setName,
    citizenId,
    setCitizenId,
    phoneNumber,
    setPhoneNumber,
    email,
    setEmail,
    hometown,
    setHometown,
    busy,
    formError,
    handleCreateTenant,
    resettingTenant,
    setResettingTenant,
    resetBusy,
    requestResetPassword,
    confirmResetPassword,
    issuedCreds,
    setIssuedCreds,
  } = useTenantsPage();

  return (
    <div className="tenants-management-page">
      <header className="page-heading">
        <div>
          <h1>Hồ sơ Khách thuê &amp; Cư dân</h1>
          <p>
            Cấp và quản lý tài khoản khách thuê theo CCCD (12 số). Mật khẩu tạm
            thời chỉ hiển thị một lần duy nhất tại đây.
          </p>
        </div>
        <div className="page-actions">
          <Button
            variant="secondary"
            onClick={loadData}
            title="Làm mới danh sách"
          >
            <RefreshCw size={15} />
            <span>Làm mới</span>
          </Button>
          <Button onClick={() => setIsCreateOpen(true)}>
            <Plus size={16} />
            <span>Cấp tài khoản Khách thuê</span>
          </Button>
        </div>
      </header>

      {/* 1. Quick KPI Cards Ribbon */}
      <TenantsKpiRibbon
        stats={stats}
        hasActiveFilters={hasActiveFilters}
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        onResetFilters={handleResetFilters}
      />

      {/* 2. Search & Filter Bar */}
      <TenantsFilterBar
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        hometownFilter={hometownFilter}
        setHometownFilter={setHometownFilter}
        hometownOptions={hometownOptions}
        totalCount={tenants.length}
        stats={stats}
        hasActiveFilters={hasActiveFilters}
        onResetFilters={handleResetFilters}
      />

      {/* 3. Main Data Panel */}
      {loading ? (
        <LoadingState />
      ) : error ? (
        <EmptyState
          title="Không thể tải dữ liệu"
          description={error}
          action={<Button onClick={loadData}>Thử lại</Button>}
        />
      ) : tenants.length === 0 ? (
        <EmptyState
          title="Chưa có Khách thuê nào trong chuỗi"
          description="Khách thuê có thể được cấp tài khoản tại đây hoặc tự động khởi tạo khi lập Hợp đồng thuê phòng mới."
          action={
            <Button onClick={() => setIsCreateOpen(true)}>
              <Plus size={16} />
              Cấp tài khoản Khách thuê đầu tiên
            </Button>
          }
        />
      ) : (
        <TenantsTable
          tenants={tenants}
          filteredTenants={filteredTenants}
          searchTerm={searchTerm}
          copiedKey={copiedKey}
          onCopyText={copyText}
          onResetFilters={handleResetFilters}
          onResetPassword={requestResetPassword}
        />
      )}

      {/* Modal Cấp tài khoản Tenant mới */}
      <TenantCreateModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        busy={busy}
        name={name}
        setName={setName}
        citizenId={citizenId}
        setCitizenId={setCitizenId}
        phoneNumber={phoneNumber}
        setPhoneNumber={setPhoneNumber}
        email={email}
        setEmail={setEmail}
        hometown={hometown}
        setHometown={setHometown}
        formError={formError}
        onSubmit={handleCreateTenant}
      />

      {/* Modal Xác nhận cấp lại mật khẩu tạm */}
      {resettingTenant && (
        <Modal
          title="Cấp lại mật khẩu tạm thời?"
          subtitle={`${resettingTenant.name} (CCCD: ${resettingTenant.citizenId || resettingTenant.username})`}
          onClose={() => setResettingTenant(null)}
          busy={resetBusy}
        >
          <p className="modal-copy">
            Bạn có chắc chắn muốn cấp lại mật khẩu tạm cho khách thuê{" "}
            <strong>{resettingTenant.name}</strong>? Phiên đăng nhập hiện tại
            của cư dân sẽ bị thu hồi và yêu cầu đổi mật khẩu mới khi đăng nhập.
          </p>
          <footer className="modal-footer">
            <Button
              type="button"
              variant="secondary"
              disabled={resetBusy}
              onClick={() => setResettingTenant(null)}
            >
              Hủy
            </Button>
            <Button busy={resetBusy} onClick={confirmResetPassword}>
              Xác nhận cấp lại mật khẩu
            </Button>
          </footer>
        </Modal>
      )}

      {/* Hiển thị mật khẩu tạm thời một lần duy nhất */}
      {issuedCreds && (
        <CredentialsModal
          credentials={issuedCreds.credentials}
          recipientName={issuedCreds.recipientName}
          roleLabel={issuedCreds.roleLabel}
          onClose={() => setIssuedCreds(null)}
        />
      )}
    </div>
  );
}
