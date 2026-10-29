import { useState, useMemo, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { branchApi, incidentApi } from "../services/api";
import { useResource } from "./useResource";
import { useAuth } from "../context/AuthContext";
import { useLiveRefresh } from "./useLiveRefresh";

export const STATUS_LABELS = {
  PENDING: "Chờ tiếp nhận",
  IN_PROGRESS: "Đang xử lý",
  SOLVED: "Đã khắc phục",
  CLOSED: "Hoàn tất đóng",
  REJECTED: "Đã từ chối",
};

export const PRIORITY_LABELS = {
  LOW: "Thấp",
  MEDIUM: "Trung bình",
  HIGH: "Cao",
  URGENT: "Khẩn cấp",
};

// Loại sự cố do TypeSafe phân loại (BE/services/incidentTriage.js).
export const CATEGORY_LABELS = {
  ELECTRICAL: "Điện",
  PLUMBING: "Cấp thoát nước",
  APPLIANCE: "Thiết bị (điều hòa, nóng lạnh...)",
  DOOR_LOCK_WINDOW: "Cửa, khóa, cửa sổ",
  WALL_CEILING_FLOOR: "Tường, trần, sàn",
  INTERNET: "Internet / Wi-Fi",
  PEST_CLEANING: "Côn trùng / vệ sinh",
  SHARED_AREA: "Khu vực chung",
  OTHER: "Khác",
};

export const COST_PAYER_LABELS = {
  LANDLORD: "Chủ trọ thanh toán",
  TENANT: "Khách thuê chi trả",
  NONE: "Miễn phí / Bảo hành",
};

export function useIncidentsPage() {
  const { user } = useAuth();
  const isTenant = user?.role === "TENANT";
  const isLandlord = user?.role === "LANDLORD";
  const isManager = user?.role === "PROPERTY_MANAGER";
  const isStaff = isLandlord || isManager;

  const [params, setParams] = useSearchParams();

  const branchOptions = useResource(
    isStaff ? branchApi.options : () => Promise.resolve([]),
  );
  const branches = branchOptions.data || [];
  // The branch filter lives in the URL (?branchId=); empty means every branch in scope.
  const branchId = isStaff ? params.get("branchId") || "" : "";

  const [status, setStatus] = useState(params.get("status") || "");
  const [priority, setPriority] = useState("");
  const [category, setCategory] = useState("");
  const [needsReview, setNeedsReview] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [page, setPage] = useState(1);

  // Modals
  const [creating, setCreating] = useState(false);
  const [viewingDetail, setViewingDetail] = useState(null); // incident detail
  const [transitioning, setTransitioning] = useState(null); // { incident, targetStatus }
  const [editingCost, setEditingCost] = useState(null); // incident for cost

  const handleBranchChange = useCallback(
    (value) => {
      const next = new URLSearchParams(params);
      if (value) next.set("branchId", value);
      else next.delete("branchId");
      setParams(next);
      setPage(1);
    },
    [params, setParams],
  );

  // Fetch incidents list
  const incidentResource = useResource(
    () =>
      incidentApi.list({
        branchId: branchId || undefined,
        status: status || undefined,
        priority: priority || undefined,
        category: category || undefined,
        needsReview: needsReview ? "true" : undefined,
        page,
        limit: 15,
      }),
    [branchId, status, priority, category, needsReview, page],
  );
  useLiveRefresh(["incidents"], incidentResource.refresh);

  const triageEnabled = !!incidentResource.data?.triageEnabled;

  const rawItems = useMemo(
    () => incidentResource.data?.items || [],
    [incidentResource.data],
  );
  const stats = useMemo(
    () => incidentResource.data?.stats || {},
    [incidentResource.data],
  );
  const total = incidentResource.data?.total || 0;

  // Client-side search filter for instantaneous responsiveness
  const items = useMemo(() => {
    if (!searchTerm.trim()) return rawItems;
    const q = searchTerm.toLowerCase();
    return rawItems.filter(
      (inc) =>
        inc.title?.toLowerCase().includes(q) ||
        inc.description?.toLowerCase().includes(q) ||
        inc.roomId?.roomNumber?.toLowerCase().includes(q) ||
        inc.branchId?.name?.toLowerCase().includes(q) ||
        inc.reportedBy?.name?.toLowerCase().includes(q),
    );
  }, [rawItems, searchTerm]);

  // Total incidents across all categories for progress percentage
  const totalIncidentsCount = useMemo(() => {
    return (
      (stats.PENDING || 0) +
      (stats.IN_PROGRESS || 0) +
      (stats.SOLVED || 0) +
      (stats.CLOSED || 0) +
      (stats.REJECTED || 0)
    );
  }, [stats]);

  const getProgressRate = useCallback(
    (count) => {
      if (!totalIncidentsCount || totalIncidentsCount === 0) return 0;
      return Math.round(((count || 0) / totalIncidentsCount) * 100);
    },
    [totalIncidentsCount],
  );

  return {
    isTenant,
    isLandlord,
    isStaff,
    branchOptions,
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
    page,
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
  };
}

