import { useState, useMemo, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { branchApi, utilityReadingApi, errorMessage } from "../services/api";
import { useResource } from "./useResource";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { useLiveRefresh } from "./useLiveRefresh";

// Vietnam UTC+7 current period YYYY-MM
export const getCurrentPeriod = () =>
  new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 7);

export function useUtilityReadingsPage() {
  const { user, selectedBranchId, setSelectedBranchId } = useAuth();
  const options = useResource(branchApi.options);
  const [params, setParams] = useSearchParams();
  const toast = useToast();

  // Enforce role-based branch scoping strictly
  const allowedBranches = useMemo(() => {
    const allBranches = options.data || [];
    if (!user) return [];
    if (user.role === "LANDLORD") {
      return allBranches;
    }
    if (user.role === "PROPERTY_MANAGER" || user.role === "STAFF") {
      const assignedIds = new Set(
        (user.assignedBranches || []).map((b) =>
          String(typeof b === "object" ? b._id || b.id : b),
        ),
      );
      return allBranches.filter((b) => assignedIds.has(String(b._id)));
    }
    return [];
  }, [options.data, user]);

  const requestedBranchId = selectedBranchId || params.get("branchId") || "";
  const isValidBranch = allowedBranches.some(
    (item) => item._id === requestedBranchId,
  );
  const branchId = isValidBranch
    ? requestedBranchId
    : allowedBranches[0]?._id || "";
  const branch = allowedBranches.find((b) => b._id === branchId);

  useEffect(() => {
    if (allowedBranches.length > 0) {
      const exists = allowedBranches.some(
        (item) => item._id === selectedBranchId,
      );
      if (!exists) {
        setSelectedBranchId(allowedBranches[0]._id);
      }
    }
  }, [allowedBranches, selectedBranchId, setSelectedBranchId]);

  const [billingPeriod, setBillingPeriod] = useState(
    params.get("billingPeriod") || getCurrentPeriod(),
  );
  const [filterStatus, setFilterStatus] = useState("ALL"); // ALL | PENDING | RECORDED
  const [roomSearch, setRoomSearch] = useState("");
  const [viewMode, setViewMode] = useState("wizard"); // wizard (nhập 1 tay) | table (danh sách)
  const [currentIndex, setCurrentIndex] = useState(0);

  // Abnormal confirmation state
  const [abnormalWarning, setAbnormalWarning] = useState(null); // { item, payload, details }

  // Quick form input states for current room
  const [inputValues, setInputValues] = useState({});
  const [submitting, setSubmitting] = useState(false);

  function handleBranchChange(e) {
    const nextId = e.target.value;
    setSelectedBranchId(nextId);
    setParams((prev) => {
      const nextParams = new URLSearchParams(prev);
      nextParams.set("branchId", nextId);
      return nextParams;
    });
    setCurrentIndex(0);
    setInputValues({});
  }

  // Resource for reading list
  const readingResource = useResource(
    () =>
      branchId ? utilityReadingApi.list(branchId, { billingPeriod }) : null,
    [branchId, billingPeriod],
  );
  useLiveRefresh(["utility-readings"], readingResource.refresh);

  const items = useMemo(
    () => readingResource.data?.items || [],
    [readingResource.data],
  );
  const stats = readingResource.data?.stats || {
    total: 0,
    recorded: 0,
    pending: 0,
    billed: 0,
  };

  // Filtered items based on filterStatus and roomSearch
  const filteredItems = useMemo(() => {
    let result = items;
    if (filterStatus === "PENDING") {
      result = result.filter((i) => !i.reading);
    } else if (filterStatus === "RECORDED") {
      result = result.filter((i) => Boolean(i.reading));
    }
    if (roomSearch.trim()) {
      const q = roomSearch.trim().toLowerCase();
      result = result.filter((i) => {
        const roomNum = String(i.room?.roomNumber || "").toLowerCase();
        const floor = String(i.room?.floor || "").toLowerCase();
        const tenant = String(i.tenant?.name || "").toLowerCase();
        return roomNum.includes(q) || floor.includes(q) || tenant.includes(q);
      });
    }
    return result;
  }, [items, filterStatus, roomSearch]);

  // Current active item for wizard mode
  const activeItem = filteredItems[currentIndex] || filteredItems[0] || null;

  // Periods for dropdown selector (current month and last 5 months)
  const availablePeriods = useMemo(() => {
    const list = [];
    const now = new Date();
    for (let i = 0; i < 6; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      list.push(d.toISOString().slice(0, 7));
    }
    return list;
  }, []);

  // Handle input change for a room
  function handleInputChange(roomId, field, value) {
    setInputValues((prev) => ({
      ...prev,
      [roomId]: {
        ...prev[roomId],
        [field]: value,
      },
    }));
  }

  // Get current working values for an item
  function getItemValues(item) {
    if (!item) return {};
    const local = inputValues[item.room.id] || {};
    return {
      electricNewIndex:
        local.electricNewIndex !== undefined
          ? local.electricNewIndex
          : item.reading?.newElectricIndex !== undefined
            ? item.reading.newElectricIndex
            : "",
      waterNewIndex:
        local.waterNewIndex !== undefined
          ? local.waterNewIndex
          : item.reading?.newWaterIndex !== undefined
            ? item.reading.newWaterIndex
            : "",
      electricImage:
        local.electricImage !== undefined
          ? local.electricImage
          : item.reading?.electricImage || "",
      waterImage:
        local.waterImage !== undefined
          ? local.waterImage
          : item.reading?.waterImage || "",
    };
  }

  // Submit reading (create or update)
  async function submitReading(item, confirmAbnormal = false) {
    if (!item) return;
    const vals = getItemValues(item);

    if (vals.electricNewIndex === "") {
      toast.error("Vui lòng nhập chỉ số điện mới.");
      return;
    }

    const isMeterWater = item.waterBillingType === "METER";
    if (isMeterWater && vals.waterNewIndex === "") {
      toast.error(
        "Phòng tính nước theo đồng hồ, vui lòng nhập chỉ số nước mới.",
      );
      return;
    }

    setSubmitting(true);
    const payload = {
      branchId,
      roomId: item.room.id,
      billingPeriod,
      electricNewIndex: Number(vals.electricNewIndex),
      waterNewIndex:
        vals.waterNewIndex !== "" ? Number(vals.waterNewIndex) : undefined,
      electricImage: vals.electricImage || undefined,
      waterImage: vals.waterImage || undefined,
      confirmAbnormal,
    };

    try {
      if (item.reading) {
        // PUT update
        await utilityReadingApi.update(item.reading.id, {
          electricNewIndex: payload.electricNewIndex,
          waterNewIndex: payload.waterNewIndex,
          electricImage: payload.electricImage,
          waterImage: payload.waterImage,
          confirmAbnormal,
        });
        toast.success(`Đã cập nhật chỉ số phòng ${item.room.roomNumber}!`);
      } else {
        // POST create
        await utilityReadingApi.create(payload);
        toast.success(`Đã chốt số phòng ${item.room.roomNumber} thành công!`);
      }

      setAbnormalWarning(null);
      await readingResource.reload();

      // In wizard mode, automatically advance to next pending room
      if (viewMode === "wizard" && currentIndex < filteredItems.length - 1) {
        setCurrentIndex((prev) => prev + 1);
      }
    } catch (err) {
      const resp = err.response?.data;
      if (
        err.response?.status === 409 &&
        resp?.errorCode === "READING_ABNORMAL_INCREASE"
      ) {
        // Show abnormal modal
        setAbnormalWarning({
          item,
          payload,
          details: resp.data || {},
        });
      } else {
        toast.error(errorMessage(err));
      }
    } finally {
      setSubmitting(false);
    }
  }

  return {
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
  };
}

