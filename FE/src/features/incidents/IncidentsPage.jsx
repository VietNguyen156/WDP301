import { Plus } from "lucide-react";
import {
  Button,
  PageHeader,
  LoadingState,
  ErrorState,
  EmptyState,
  Pagination,
} from "../../components/ui";
import { useIncidentsPage } from "../../hooks/useIncidentsPage";
import {
  IncidentsKpiGrid,
  IncidentsToolbar,
  IncidentsCardGrid,
  CreateIncidentModal,
  IncidentDetailModal,
  TransitionModal,
  UpdateCostModal,
} from "../../components/incidents";
import "./Incidents.css";

export default function IncidentsPage() {
  const {
    isTenant,
    isLandlord,
    isStaff,
    branches,
    branchId,
    handleBranchChange,
    status,
    setStatus,
    priority,
    setPriority,
    category,
    setCategory,
    needsReview,
    setNeedsReview,
    searchTerm,
    setSearchTerm,
     setPage,
    creating,
    setCreating,
    viewingDetail,
    setViewingDetail,
    transitioning,
    setTransitioning,
    editingCost,
    setEditingCost,
    incidentResource,
    triageEnabled,
    items,
    stats,
    total,
    getProgressRate,
  } = useIncidentsPage();

  return (
    <div className="inc-container">
      <PageHeader
        title={isTenant ? "Phản ánh & Báo sự cố" : "Quản lý Sự cố & Bảo trì"}
        description={
          isTenant
            ? "Gửi báo cáo hư hỏng thiết bị, điện nước trong phòng để ban quản lý hỗ trợ xử lý kịp thời."
            : "Theo dõi phản ánh của cư dân, điều phối thợ sửa chữa và ghi nhận chi phí nghiệm thu."
        }
      />

      {/* 5 KPI Metric Cards with Visual Icon Boxes & Progress Bars */}
      <IncidentsKpiGrid
        stats={stats}
        status={status}
        setStatus={setStatus}
        setPage={setPage}
        getProgressRate={getProgressRate}
      />

      {/* Toolbar with SearchBox & Standardized Filters */}
      <IncidentsToolbar
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        isStaff={isStaff}
        branches={branches}
        branchId={branchId}
        onBranchChange={handleBranchChange}
        status={status}
        setStatus={setStatus}
        priority={priority}
        setPriority={setPriority}
        category={category}
        setCategory={setCategory}
        needsReview={needsReview}
        setNeedsReview={setNeedsReview}
        setPage={setPage}
        loading={incidentResource.loading}
        onReload={() => incidentResource.reload()}
        onOpenCreate={() => setCreating(true)}
      />

      {/* Incident List */}
      {incidentResource.loading ? (
        <LoadingState />
      ) : incidentResource.error ? (
        <ErrorState
          message={incidentResource.error}
          retry={incidentResource.reload}
        />
      ) : !items.length ? (
        <EmptyState
          title="Không có sự cố nào"
          description={
            searchTerm
              ? `Không tìm thấy sự cố nào phù hợp với từ khóa "${searchTerm}".`
              : "Chưa có báo cáo sự cố hoặc bảo trì phù hợp với bộ lọc."
          }
          action={
            <Button
              onClick={() => setCreating(true)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              <Plus size={16} />
              <span>Tạo báo cáo sự cố</span>
            </Button>
          }
        />
      ) : (
        <IncidentsCardGrid
          items={items}
          isStaff={isStaff}
          onViewDetail={setViewingDetail}
          onTransition={setTransitioning}
        />
      )}

      {/* Pagination */}
      {incidentResource.data && total > 15 && (
        <Pagination {...incidentResource.data} onChange={setPage} />
      )}

      {/* 1. Modal Create Incident */}
      {creating && (
        <CreateIncidentModal
          triageEnabled={triageEnabled}
          isTenant={isTenant}
          branches={branches}
          onClose={() => setCreating(false)}
          onSuccess={() => {
            setCreating(false);
            incidentResource.reload();
          }}
        />
      )}

      {/* 2. Modal View Detail & History */}
      {viewingDetail && (
        <IncidentDetailModal
          incident={viewingDetail}
          isStaff={isStaff}
          onClose={() => setViewingDetail(null)}
          onEditCost={(inc) => {
            setEditingCost(inc);
          }}
          onTransition={(inc, target) => {
            setTransitioning({ incident: inc, targetStatus: target });
          }}
        />
      )}

      {/* 3. Modal Status Transition */}
      {transitioning && (
        <TransitionModal
          incident={transitioning.incident}
          targetStatus={transitioning.targetStatus}
          onClose={() => setTransitioning(null)}
          onSuccess={() => {
            setTransitioning(null);
            setViewingDetail(null);
            incidentResource.reload();
          }}
        />
      )}

      {/* 4. Modal Edit Cost */}
      {editingCost && (
        <UpdateCostModal
          incident={editingCost}
          isLandlord={isLandlord}
          onClose={() => setEditingCost(null)}
          onSuccess={() => {
            setEditingCost(null);
            setViewingDetail(null);
            incidentResource.reload();
          }}
        />
      )}
    </div>
  );
}
