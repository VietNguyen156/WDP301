import { useState, useMemo, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { branchApi, roomApi, errorMessage } from "../services/api";
import { useResource, useDebounced } from "./useResource";
import { useLiveRefresh } from "./useLiveRefresh";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { labels } from "../utils/format";

export function useRoomsBranchSelection() {
  const options = useResource(branchApi.options);
  const [params, setParams] = useSearchParams();
  const { user, selectedBranchId, setSelectedBranchId } = useAuth();
  const requestedBranchId = selectedBranchId || params.get("branchId");
  const branchId = options.data?.some((item) => item._id === requestedBranchId)
    ? requestedBranchId
    : options.data?.[0]?._id || "";
  const branch = options.data?.find((b) => b._id === branchId);
  const urlSearch = params.get("search") || "";

  useEffect(() => {
    if (options.data?.length > 0) {
      const exists = options.data.some((item) => item._id === selectedBranchId);
      if (!exists) {
        setSelectedBranchId(options.data[0]._id);
      }
    }
  }, [options.data, selectedBranchId, setSelectedBranchId]);

  function selectBranch(event) {
    const nextBranchId = event.target.value;
    setSelectedBranchId(nextBranchId);
    setParams(nextBranchId ? { branchId: nextBranchId } : {});
  }

  return {
    user,
    options,
    branchId,
    branch,
    urlSearch,
    setParams,
    selectBranch,
  };
}

export function useRoomList(branch, initialSearch = "") {
  const { user } = useAuth();
  const canEdit =
    user?.role === "LANDLORD" || user?.role === "PROPERTY_MANAGER";
  const isLandlord = user?.role === "LANDLORD";
  const toast = useToast();

  const [status, setStatus] = useState("");
  const [floor, setFloor] = useState("");
  const [search, setSearch] = useState(initialSearch);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);
  const [view, setView] = useState("grid");

  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const debounced = useDebounced(search);
  const resource = useResource(
    () =>
      roomApi.list(branch._id, {
        status,
        floor,
        search: debounced,
        page,
        limit,
      }),
    [branch._id, status, floor, debounced, page, limit],
  );
  useLiveRefresh(["rooms"], resource.refresh);

  const stats = resource.data?.stats || {};
  const total = Object.values(stats).reduce((a, b) => a + b, 0);
  const occupancyRate = total
    ? Math.round(((stats.RENTED || 0) / total) * 100)
    : 0;
  const maintenanceCount = (stats.MAINTENANCE || 0) + (stats.CLEANING || 0);

  const items = useMemo(
    () => resource.data?.items || [],
    [resource.data],
  );

  const roomsByFloor = useMemo(() => {
    const map = {};
    items.forEach((room) => {
      const f = room.floor || 1;
      if (!map[f]) map[f] = [];
      map[f].push(room);
    });
    return Object.keys(map)
      .map(Number)
      .sort((a, b) => a - b)
      .map((f) => ({ floor: f, rooms: map[f] }));
  }, [items]);

  async function quickStatusChange(room, newStatus, actionName) {
    try {
      await roomApi.update(room._id, { status: newStatus });
      toast.success(
        `Phòng ${room.roomNumber}: ${actionName} thành công, sẵn sàng đón khách!`,
      );
      resource.reload();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  function requestDeleteRoom(room) {
    const isRented =
      room.status === "RENTED" || Boolean(room.currentContractId);
    if (isRented) {
      toast.error("Không thể xóa phòng đang có hợp đồng thuê.");
      return;
    }
    setDeleting(room);
    setError("");
  }

  async function remove() {
    if (deleting?.status === "RENTED" || deleting?.currentContractId) {
      setError("Phòng đang có hợp đồng thuê chưa thanh lý, không thể xóa.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await roomApi.remove(deleting._id);
      toast.success(`Đã xóa phòng ${deleting.roomNumber}`);
      setDeleting(null);
      resource.reload();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  function handleExportCsv() {
    if (!items.length) {
      toast.error("Không có dữ liệu phòng để xuất.");
      return;
    }
    const headers = [
      "Số phòng",
      "Tầng",
      "Trạng thái",
      "Khách thuê",
      "Sức chứa",
      "Giá thuê (VND)",
      "Tiện nghi",
      "Ghi chú",
    ];
    const rows = items.map((r) => [
      `"${r.roomNumber}"`,
      r.floor,
      `"${labels[r.status] || r.status}"`,
      `"${r.currentTenantName || "Trống"}"`,
      r.maxOccupants,
      r.basePrice,
      `"${(r.amenities || []).join(", ")}"`,
      `"${(r.notes || "").replace(/"/g, '""')}"`,
    ]);

    const csvContent =
      "\uFEFF" +
      [headers.join(","), ...rows.map((row) => row.join(","))].join("\r\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Danh_sach_phong_${branch.name.replace(/\s+/g, "_")}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success("Đã xuất danh sách phòng ra tệp CSV thành công.");
  }

  return {
    canEdit,
    isLandlord,
    resource,
    stats,
    total,
    occupancyRate,
    maintenanceCount,
    items,
    roomsByFloor,
    status,
    setStatus,
    floor,
    setFloor,
    search,
    setSearch,
    page,
    setPage,
    limit,
    setLimit,
    view,
    setView,
    editing,
    setEditing,
    deleting,
    setDeleting,
    busy,
    error,
    quickStatusChange,
    requestDeleteRoom,
    remove,
    handleExportCsv,
  };
}

