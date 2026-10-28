import { useState, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { contractApi, branchApi } from "../services/api";
import { useResource, useDebounced } from "./useResource";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { useLiveRefresh } from "./useLiveRefresh";

export function getContractProgress(startDate, endDate) {
  if (!startDate || !endDate) return { percent: 0, daysLeft: 0 };
  const start = new Date(startDate).getTime();
  const end = new Date(endDate).getTime();
  const now = Date.now();
  const totalDuration = end - start;
  if (totalDuration <= 0) return { percent: 100, daysLeft: 0 };
  const elapsed = now - start;
  const percent = Math.min(
    100,
    Math.max(0, Math.round((elapsed / totalDuration) * 100)),
  );
  const daysLeft = Math.max(0, Math.ceil((end - now) / 86400000));
  return { percent, daysLeft };
}

export function useContractsPage() {
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const { user, selectedBranchId } = useAuth();

  // Tenants cannot list branches; they only see their own contracts anyway.
  const branchResource = useResource(
    () =>
      user.role === "TENANT"
        ? Promise.resolve(null)
        : branchApi.list({ limit: 100 }),
    [user.role],
  );
  const branches = branchResource.data?.items || [];
  const landlord = user.role === "LANDLORD";

  const [creating, setCreating] = useState(
    params.get("create") === "1" && landlord,
  );
  const [selectedId, setSelectedId] = useState(null);
  // ?contractId=... (from the rooms page) opens that contract directly, whatever the list filters.
  const [detailModalId, setDetailModalId] = useState(params.get("contractId"));

  const [status, setStatus] = useState("");
  const [depositFilter, setDepositFilter] = useState("");
  const [confirmationFilter, setConfirmationFilter] = useState("");
  // "" = every branch in scope; only the dropdown on this page narrows the list.
  const [branchFilter, setBranchFilter] = useState("");
  const [page, setPage] = useState(1);
  const urlSearch = params.get("search");
  const [localSearch, setLocalSearch] = useState(null);
  const search = localSearch !== null ? localSearch : urlSearch || "";

  function setSearch(val) {
    setLocalSearch(val);
  }

  const debounced = useDebounced(search);

  function closeDetail() {
    setDetailModalId(null);
    if (params.has("contractId")) {
      const next = new URLSearchParams(params);
      next.delete("contractId");
      setParams(next, { replace: true });
    }
  }

  const activeBranchId = branchFilter;

  const resource = useResource(
    () =>
      contractApi.list({
        status,
        branchId: activeBranchId,
        page,
        limit: 10,
        search: debounced,
        depositStatus: depositFilter || undefined,
        confirmation: confirmationFilter || undefined,
      }),
    [status, activeBranchId, page, debounced, depositFilter, confirmationFilter],
  );
  useLiveRefresh(["contracts"], resource.refresh);

  const items = useMemo(() => resource.data?.items || [], [resource.data]);
  const total = resource.data?.total || 0;

  // Selected contract for Inspector panel
  const selectedContract = useMemo(() => {
    if (!selectedId && items.length > 0) return items[0];
    return items.find((c) => c._id === selectedId) || items[0] || null;
  }, [items, selectedId]);

  // Derived KPI metrics
  const activeCount = useMemo(
    () => items.filter((c) => c.displayStatus === "ACTIVE").length,
    [items],
  );
  const expiringCount = useMemo(
    () => items.filter((c) => c.displayStatus === "EXPIRING_SOON").length,
    [items],
  );
  const expiredCount = useMemo(
    () => items.filter((c) => c.displayStatus === "EXPIRED").length,
    [items],
  );
  const totalDeposit = useMemo(
    () => items.reduce((acc, c) => acc + (c.depositAmount || 0), 0),
    [items],
  );

  function closeCreate() {
    setCreating(false);
    setParams({});
  }

  function resetFilters() {
    setLocalSearch("");
    setStatus("");
    setBranchFilter("");
    setDepositFilter("");
    setConfirmationFilter("");
    setPage(1);
    if (params.has("search")) {
      const next = new URLSearchParams(params);
      next.delete("search");
      setParams(next, { replace: true });
    }
  }

  return {
    toast,
    params,
    selectedBranchId,
    branches,
    landlord,
    creating,
    setCreating,
    selectedId,
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
  };
}

