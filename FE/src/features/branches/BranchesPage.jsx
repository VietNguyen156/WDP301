import { Plus, Download, Gauge, ShieldCheck, Crown } from "lucide-react";
import { useBranchesPage } from "../../hooks/useBranchesPage";
import {
  Button,
  LoadingState,
  ErrorState,
  EmptyState,
  Modal,
  FormError,
} from "../../components/ui";
import {
  BranchKpiGrid,
  BranchToolbar,
  BranchCardsGrid,
  BranchTable,
  BranchOccupancyChart,
} from "../../components/branches";
import BranchForm from "./BranchForm";
import "./Branches.css";

export default function BranchesPage() {
  const {
    user,
    canEdit,
    resource,
    rawItems,
    rawInvoices,
    availableCities,
    debtBranchesCount,
    vacantBranchesCount,
    filteredItems,
    metrics,
    financialMetrics,
    getBranchManagers,
    search,
    setSearch,
    cityFilter,
    setCityFilter,
    occupancyFilter,
    setOccupancyFilter,
    quickFilter,
    setQuickFilter,
    sortOption,
    setSortOption,
    setPage,
    viewMode,
    setViewMode,
    editing,
    setEditing,
    deleting,
    setDeleting,
    busy,
    error,
    setError,
    isChartCollapsed,
    setIsChartCollapsed,
    remove,
    handleQuickExport,
    handleQuickReadings,
  } = useBranchesPage();

  const handleOpenDelete = (branch) => {
    setDeleting(branch);
    setError("");
  };

  return (
    <div className="branch-container">
      {/* 1. Header Banner & Quick Actions */}
      <div className="branch-header-wrap">
        <div className="branch-header-top">
          <div className="branch-title-group">
            <div className="branch-title-row">
              <h1 className="branch-page-title">
                Danh sách Cơ sở &amp; Tòa nhà
              </h1>
              {user?.role === "LANDLORD" ? (
                <span
                  className="branch-role-chip landlord"
                  title="Chủ sở hữu toàn quyền quản trị"
                >
                  <Crown size={13} />
                  <span>Chuỗi {user.name || "DOMUS ERP"}</span>
                </span>
              ) : (
                <span
                  className="branch-role-chip manager"
                  title="Phạm vi chi nhánh được phân công phụ trách"
                >
                  <ShieldCheck size={13} />
                  <span>Phân công quản lý</span>
                </span>
              )}
            </div>
            <p className="branch-subtitle">
              Quản lý đồng bộ {rawItems.length} tòa nhà, thiết lập đơn giá
              điện/nước riêng biệt và giám sát đối soát hóa đơn tự động.
            </p>
          </div>

          <div className="branch-actions-row">
            <button
              type="button"
              className="button secondary"
              onClick={handleQuickExport}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              <Download size={15} />
              <span>Xuất báo cáo</span>
            </button>

            <button
              type="button"
              className="button secondary"
              onClick={handleQuickReadings}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              <Gauge size={15} />
              <span>Chốt điện nước toàn chuỗi</span>
            </button>

            {canEdit && (
              <button
                type="button"
                className="button primary"
                onClick={() => setEditing({})}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                <Plus size={16} />
                <span>Thêm cơ sở mới</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 2. 4 Modern High-Velocity KPI Cards */}
      <BranchKpiGrid metrics={metrics} financialMetrics={financialMetrics} />

      {/* 3. Toolbar & Real-Time Filter Section */}
      <BranchToolbar
        search={search}
        setSearch={setSearch}
        setPage={setPage}
        cityFilter={cityFilter}
        setCityFilter={setCityFilter}
        availableCities={availableCities}
        totalCount={rawItems.length}
        occupancyFilter={occupancyFilter}
        setOccupancyFilter={setOccupancyFilter}
        quickFilter={quickFilter}
        setQuickFilter={setQuickFilter}
        debtBranchesCount={debtBranchesCount}
        vacantBranchesCount={vacantBranchesCount}
        activeBranchesCount={metrics.activeBranches}
        sortOption={sortOption}
        setSortOption={setSortOption}
        viewMode={viewMode}
        setViewMode={setViewMode}
      />

      {/* 4. Main Content Area */}
      {resource.loading ? (
        <LoadingState />
      ) : resource.error ? (
        <ErrorState message={resource.error} retry={resource.reload} />
      ) : !filteredItems.length ? (
        <EmptyState
          title={
            search ||
            cityFilter ||
            occupancyFilter !== "ALL" ||
            quickFilter !== "ALL"
              ? "Không tìm thấy cơ sở nào phù hợp"
              : canEdit
                ? "Bạn chưa có Cơ sở hoặc Tòa nhà nào"
                : "Bạn chưa được phân công quản lý cơ sở nào"
          }
          description={
            search ||
            cityFilter ||
            occupancyFilter !== "ALL" ||
            quickFilter !== "ALL"
              ? "Vui lòng thử điều chỉnh lại bộ lọc tìm kiếm hoặc khu vực."
              : canEdit
                ? "Bấm nút bên dưới để khởi tạo cơ sở và tòa nhà đầu tiên của bạn."
                : "Vui lòng liên hệ Chủ nhà trọ để được gán quyền phụ trách cơ sở."
          }
          action={
            canEdit &&
            !search &&
            !cityFilter &&
            occupancyFilter === "ALL" &&
            quickFilter === "ALL" ? (
              <Button onClick={() => setEditing({})}>
                <Plus size={16} /> Thêm cơ sở đầu tiên
              </Button>
            ) : null
          }
        />
      ) : viewMode === "cards" ? (
        <BranchCardsGrid
          items={filteredItems}
          rawInvoices={rawInvoices}
          canEdit={canEdit}
          getBranchManagers={getBranchManagers}
          onEdit={setEditing}
          onDelete={handleOpenDelete}
        />
      ) : (
        <BranchTable
          items={filteredItems}
          canEdit={canEdit}
          getBranchManagers={getBranchManagers}
          onEdit={setEditing}
          onDelete={handleOpenDelete}
        />
      )}

      {/* 5. Occupancy & Capacity Benchmark Mini-Chart */}
      <BranchOccupancyChart
        rawItems={rawItems}
        occupancyRate={metrics.occupancyRate}
        isChartCollapsed={isChartCollapsed}
        onToggleCollapse={() => setIsChartCollapsed((prev) => !prev)}
      />

      {/* Editing Form Modal */}
      {editing && (
        <BranchForm
          branch={editing._id ? editing : null}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            resource.reload();
          }}
        />
      )}

      {/* Deletion Confirmation Modal */}
      {deleting && (
        <Modal
          title="Xóa cơ sở?"
          subtitle={deleting.name}
          onClose={() => setDeleting(null)}
          busy={busy}
        >
          <p className="modal-copy">
            Cơ sở sẽ được ẩn khỏi danh sách. Hệ thống chỉ cho phép xóa khi không
            còn phòng đang quản lý; lịch sử được giữ lại.
          </p>
          <FormError error={error} />
          <footer className="modal-footer">
            <Button
              variant="secondary"
              disabled={busy}
              onClick={() => setDeleting(null)}
            >
              Hủy
            </Button>
            <Button variant="danger" busy={busy} onClick={remove}>
              Xác nhận xóa
            </Button>
          </footer>
        </Modal>
      )}
    </div>
  );
}
