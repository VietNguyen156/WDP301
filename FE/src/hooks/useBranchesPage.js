import { useState, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { branchApi, staffApi, errorMessage } from "../services/api";
import { invoiceService } from "../services/invoiceService";
import { useResource, useDebounced } from "./useResource";
import { useLiveRefresh } from "./useLiveRefresh";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";

export function useBranchesPage() {
  const { user, selectedBranchId } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const canEdit = user?.role === "LANDLORD";

  const staffResource = useResource(
    () =>
      user?.role === "LANDLORD"
        ? staffApi.list({ limit: 100 })
        : Promise.resolve({ items: [] }),
    [user?.role],
  );
  const staffList = useMemo(
    () => staffResource.data?.items || [],
    [staffResource.data],
  );

  const getBranchManagers = useCallback(
    (branch) => {
      if (Array.isArray(branch.managers) && branch.managers.length > 0) {
        return branch.managers;
      }
      if (staffList.length > 0) {
        const matched = staffList.filter((s) =>
          (s.assignedBranches || []).some(
            (bId) => String(bId?._id || bId) === String(branch._id),
          ),
        );
        if (matched.length > 0) {
          return matched.map((s) => ({
            _id: s._id,
            name: s.name,
            phoneNumber: s.phoneNumber,
            email: s.email,
          }));
        }
      }
      if (Array.isArray(branch.managerIds) && branch.managerIds.length > 0) {
        if (
          typeof branch.managerIds[0] === "object" &&
          branch.managerIds[0]?.name
        ) {
          return branch.managerIds;
        }
      }
      if (user?.role === "PROPERTY_MANAGER") {
        return [
          { _id: user._id, name: user.name, phoneNumber: user.phoneNumber },
        ];
      }
      return [];
    },
    [staffList, user],
  );

  // Search & Filter States
  const [search, setSearch] = useState("");
  const [cityFilter, setCityFilter] = useState("");
  const [occupancyFilter, setOccupancyFilter] = useState("ALL");
  const [quickFilter, setQuickFilter] = useState("ALL"); // ALL | DEBT | VACANT | ACTIVE
  const [sortOption, setSortOption] = useState("REVENUE");
  const [page, setPage] = useState(1);
  const [viewMode, setViewMode] = useState("cards"); // 'cards' or 'table'

  // Modal States
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [isChartCollapsed, setIsChartCollapsed] = useState(false);

  const debounced = useDebounced(search);
  const resource = useResource(
    () => branchApi.list({ search: debounced, page, limit: 100 }),
    [debounced, page],
  );
  useLiveRefresh(["branches"], resource.refresh);

  const rawItems = useMemo(
    () => resource.data?.items || [],
    [resource.data],
  );

  const invoicesResource = useResource(
    () => invoiceService.getInvoices({ limit: 100 }),
    [],
  );
  const rawInvoices = useMemo(
    () =>
      invoicesResource.data?.data ||
      (Array.isArray(invoicesResource.data) ? invoicesResource.data : []),
    [invoicesResource.data],
  );

  const availableCities = useMemo(() => {
    const cities = new Set();
    rawItems.forEach((b) => {
      const city =
        b.address?.city ||
        (b.address?.fullAddress
          ? b.address.fullAddress.split(",").pop().trim()
          : "");
      if (city) cities.add(city);
    });
    return Array.from(cities);
  }, [rawItems]);

  const debtBranchesCount = useMemo(() => {
    return rawItems.filter((b) => {
      const invs = rawInvoices.filter(
        (inv) => String(inv.branchId) === String(b._id),
      );
      const debt = invs.reduce((sum, inv) => {
        const rem = Math.max(0, (inv.totalAmount || 0) - (inv.paidAmount || 0));
        return inv.status !== "DRAFT" && inv.status !== "CANCELLED"
          ? sum + rem
          : sum;
      }, 0);
      return debt > 0;
    }).length;
  }, [rawItems, rawInvoices]);

  const vacantBranchesCount = useMemo(() => {
    return rawItems.filter((b) => {
      const total = b.roomStats?.total || 0;
      const rented = b.roomStats?.rented || 0;
      return total - rented > 0;
    }).length;
  }, [rawItems]);

  const filteredItems = useMemo(() => {
    let result = [...rawItems];

    if (cityFilter) {
      result = result.filter((b) => {
        const full = (
          b.address?.city ||
          b.address?.fullAddress ||
          ""
        ).toLowerCase();
        return full.includes(cityFilter.toLowerCase());
      });
    }

    if (occupancyFilter === "HIGH") {
      result = result.filter((b) => {
        const total = b.roomStats?.total || 0;
        const rented = b.roomStats?.rented || 0;
        return total > 0 && rented / total >= 0.95;
      });
    } else if (occupancyFilter === "MEDIUM") {
      result = result.filter((b) => {
        const total = b.roomStats?.total || 0;
        const rented = b.roomStats?.rented || 0;
        const rate = total > 0 ? rented / total : 0;
        return rate >= 0.8 && rate < 0.95;
      });
    } else if (occupancyFilter === "LOW") {
      result = result.filter((b) => {
        const total = b.roomStats?.total || 0;
        const rented = b.roomStats?.rented || 0;
        return total > 0 && rented / total < 0.8;
      });
    }

    if (quickFilter === "DEBT") {
      result = result.filter((b) => {
        const invs = rawInvoices.filter(
          (inv) => String(inv.branchId) === String(b._id),
        );
        const debt = invs.reduce((sum, inv) => {
          const rem = Math.max(
            0,
            (inv.totalAmount || 0) - (inv.paidAmount || 0),
          );
          return inv.status !== "DRAFT" && inv.status !== "CANCELLED"
            ? sum + rem
            : sum;
        }, 0);
        return debt > 0;
      });
    } else if (quickFilter === "VACANT") {
      result = result.filter((b) => {
        const total = b.roomStats?.total || 0;
        const rented = b.roomStats?.rented || 0;
        return total - rented > 0;
      });
    } else if (quickFilter === "ACTIVE") {
      result = result.filter((b) => b.status === "ACTIVE");
    }

    if (sortOption === "REVENUE") {
      result.sort(
        (a, b) => (b.roomStats?.rented || 0) - (a.roomStats?.rented || 0),
      );
    } else if (sortOption === "VACANCY") {
      result.sort((a, b) => {
        const vacA = (a.roomStats?.total || 0) - (a.roomStats?.rented || 0);
        const vacB = (b.roomStats?.total || 0) - (b.roomStats?.rented || 0);
        return vacB - vacA;
      });
    } else if (sortOption === "NEWEST") {
      result.sort(
        (a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0),
      );
    }

    return result;
  }, [
    rawItems,
    cityFilter,
    occupancyFilter,
    quickFilter,
    sortOption,
    rawInvoices,
  ]);

  const metrics = useMemo(() => {
    let totalRooms = 0;
    let rentedRooms = 0;
    let activeBranches = 0;
    const cityCountMap = {};

    rawItems.forEach((b) => {
      if (b.status === "ACTIVE") activeBranches++;
      const city =
        b.address?.city ||
        (b.address?.fullAddress
          ? b.address.fullAddress.split(",").pop().trim()
          : "Khác");
      cityCountMap[city] = (cityCountMap[city] || 0) + 1;

      if (b.roomStats) {
        totalRooms += b.roomStats.total || 0;
        rentedRooms += b.roomStats.rented || 0;
      }
    });

    const occupancyRate =
      totalRooms > 0 ? Math.round((rentedRooms / totalRooms) * 1000) / 10 : 0;
    const vacantRooms = Math.max(0, totalRooms - rentedRooms);

    const cityEntries = Object.entries(cityCountMap);
    const cityText =
      cityEntries.length > 0
        ? cityEntries.map(([c, count]) => `${count} tại ${c}`).join(" • ")
        : "0 cơ sở";

    return {
      totalBranches: rawItems.length,
      activeBranches,
      cityText,
      totalRooms,
      rentedRooms,
      vacantRooms,
      occupancyRate,
    };
  }, [rawItems]);

  const financialMetrics = useMemo(() => {
    let totalExpected = 0;
    let totalCollected = 0;
    let totalDebt = 0;
    let debtRoomsCount = 0;

    rawInvoices.forEach((inv) => {
      const total = inv.totalAmount || 0;
      const paid = inv.paidAmount || 0;
      totalExpected += total;
      totalCollected += paid;
      const remaining = Math.max(0, total - paid);
      if (
        remaining > 0 &&
        inv.status !== "DRAFT" &&
        inv.status !== "CANCELLED"
      ) {
        totalDebt += remaining;
        debtRoomsCount++;
      }
    });

    const collectionRate =
      totalExpected > 0
        ? Math.round((totalCollected / totalExpected) * 1000) / 10
        : 0;

    return {
      expectedRevenueFormatted: `${(totalExpected / 1000000).toFixed(1)}M`,
      actualRevenueFormatted: `${(totalCollected / 1000000).toFixed(1)}M`,
      debtAmountFormatted: `${(totalDebt / 1000000).toFixed(1)}M`,
      debtRoomsCount,
      collectionRate,
    };
  }, [rawInvoices]);

  async function remove() {
    setBusy(true);
    setError("");
    try {
      await branchApi.remove(deleting._id);
      toast("Đã xóa cơ sở thành công");
      setDeleting(null);
      resource.reload();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  function handleQuickExport() {
    toast(
      `Đang trích xuất báo cáo tổng hợp ${rawItems.length} cơ sở ra tệp Excel (.xlsx)...`,
      "info",
    );
  }

  function handleQuickReadings() {
    if (selectedBranchId) {
      navigate(`/utility-readings?branchId=${selectedBranchId}`);
    } else {
      navigate("/utility-readings");
    }
  }

  return {
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
    page,
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
  };
}

