import { Plus, Share2 } from "lucide-react";
import { useContractsPage } from "../../hooks/useContractsPage";
import {
  ContractsKpiRibbon,
  ContractsFilterToolbar,
  ContractsTable,
  ContractInspectorPanel,
} from "../../components/contracts";
import ContractForm from "./ContractForm";
import ContractDetail from "./ContractDetail";
import "./Contracts.css";

export default function ContractsPage() {
  const {
    toast,
    params,
    selectedBranchId,
    branches,
    landlord,
    creating,
    setCreating,
    setSelectedId,
    detailModalId,
    setDetailModalId,
    status,
    setStatus,
    depositFilter,
    setDepositFilter,
    confirmationFilter,
    setConfirmationFilter,
    branchFilter,
    setBranchFilter,
    page,
    setPage,
    search,
    setSearch,
    closeDetail,
    closeCreate,
    resetFilters,
    resource,
    items,
    total,
    selectedContract,
    activeCount,
    expiringCount,
    expiredCount,
    totalDeposit,
  } = useContractsPage();

  return (
    <div className="contracts-wrapper animate-fade-in">
      {/* 1. Header Section */}
      <div className="contracts-header-bar">
        <div>
          <h1 className="contracts-header-title">
            {landlord
              ? "Quản lý Hợp đồng & Khách thuê"
              : "Hợp đồng Thuê phòng của tôi"}
          </h1>
          <p className="contracts-header-subtext">
            Theo dõi thời hạn thuê phòng trên toàn hệ thống, tự động cảnh báo
            gia hạn 30 ngày và định danh thông tin cư dân.
          </p>
        </div>

        <div className="contracts-header-actions">
          {landlord && (
            <>
              <button
                type="button"
                className="contracts-btn-outline"
                onClick={() =>
                  toast.success(
                    "Đang xuất danh sách khai báo tạm trú theo chuẩn Bộ Công an (CSV)...",
                  )
                }
              >
                <Share2 size={15} />
                <span>Xuất tạm trú (Công an)</span>
              </button>
              <button
                type="button"
                className="contracts-btn-primary"
                onClick={() => setCreating(true)}
              >
                <Plus size={16} />
                <span>+ Tạo hợp đồng mới</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* 2. Metric KPI Cards */}
      <ContractsKpiRibbon
        total={total}
        itemsLength={items.length}
        activeCount={activeCount}
        expiringCount={expiringCount}
        expiredCount={expiredCount}
        totalDeposit={totalDeposit}
      />

      {/* 3. Filter Toolbar & Search */}
      <ContractsFilterToolbar
        status={status}
        setStatus={setStatus}
        total={total}
        itemsLength={items.length}
        activeCount={activeCount}
        expiringCount={expiringCount}
        expiredCount={expiredCount}
        page={page}
        setPage={setPage}
        search={search}
        setSearch={setSearch}
        depositFilter={depositFilter}
        setDepositFilter={setDepositFilter}
        confirmationFilter={confirmationFilter}
        setConfirmationFilter={setConfirmationFilter}
        branches={branches}
        branchFilter={branchFilter}
        setBranchFilter={setBranchFilter}
        onReset={resetFilters}
      />

      {/* 4. Split Layout: Table (Left) + Inspector Panel (Right) */}
      <div
        className={`contracts-split-layout ${selectedContract ? "has-inspector" : ""}`}
      >
        <ContractsTable
          resource={resource}
          items={items}
          landlord={landlord}
          selectedContract={selectedContract}
          onSelectContract={setSelectedId}
          onOpenDetail={setDetailModalId}
          onOpenCreate={() => setCreating(true)}
          onPageChange={setPage}
        />

        <ContractInspectorPanel
          selectedContract={selectedContract}
          onOpenDetail={setDetailModalId}
          onPrintPdf={(code) =>
            toast.success(`Đã chuẩn bị bản in PDF chuẩn cho HĐ ${code}.`)
          }
        />
      </div>

      {/* Contract Creation Stepper Modal */}
      {creating && (
        <ContractForm
          branchId={
            params.get("branchId") || branchFilter || selectedBranchId || ""
          }
          roomId={params.get("roomId") || ""}
          onClose={closeCreate}
          onSaved={() => {
            closeCreate();
            resource.reload();
          }}
        />
      )}

      {/* Contract Detail & Settlement Modal */}
      {detailModalId && (
        <ContractDetail
          id={detailModalId}
          onClose={closeDetail}
          onSaved={() => {
            closeDetail();
            resource.reload();
          }}
        />
      )}
    </div>
  );
}
