import { useState, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { contractApi, branchApi, errorMessage } from "../services/api";
import { useResource, useDebounced } from "./useResource";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { useLiveRefresh } from "./useLiveRefresh";
import { downloadTemporaryResidenceCsv } from "../utils/temporaryResidenceExport";

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
  const [exportingResidence, setExportingResidence] = useState(false);
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
  const summary = resource.data?.summary || null;

  // Selected contract for Inspector panel
  const selectedContract = useMemo(() => {
    if (!selectedId && items.length > 0) return items[0];
    return items.find((c) => c._id === selectedId) || items[0] || null;
  }, [items, selectedId]);

  // Accurate KPI & Tab counts across all pages (using backend summary, with fallback)
  const summaryCountAll = useMemo(
    () => summary?.all ?? total ?? items.length,
    [summary, total, items.length],
  );
  const activeCount = useMemo(
    () =>
      summary?.active ??
      items.filter((c) => c.displayStatus === "ACTIVE").length,
    [summary, items],
  );
  const expiringCount = useMemo(
    () =>
      summary?.expiringSoon ??
      items.filter((c) => c.displayStatus === "EXPIRING_SOON").length,
    [summary, items],
  );
  const expiredCount = useMemo(
    () =>
      summary?.expired ??
      items.filter((c) => c.displayStatus === "EXPIRED").length,
    [summary, items],
  );
  const draftCount = useMemo(
    () =>
      summary?.draft ??
      items.filter((c) => c.displayStatus === "DRAFT").length,
    [summary, items],
  );
  const terminatedCount = useMemo(
    () =>
      summary?.terminated ??
      items.filter((c) => c.displayStatus === "TERMINATED").length,
    [summary, items],
  );
  const totalDeposit = useMemo(
    () =>
      summary?.totalDeposit ??
      items.reduce((acc, c) => acc + (c.depositAmount || 0), 0),
    [summary, items],
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

  async function exportTemporaryResidence() {
    if (exportingResidence) return;
    setExportingResidence(true);
    try {
      const collected = [];
      let currentPage = 1;
      let expectedTotal = Infinity;

      while (collected.length < expectedTotal) {
        const res = await contractApi.list({
          status,
          branchId: activeBranchId,
          page: currentPage,
          limit: 100,
          search: debounced,
          depositStatus: depositFilter || undefined,
          confirmation: confirmationFilter || undefined,
        });
        const batch = res?.items || [];
        expectedTotal = res?.total ?? batch.length;
        collected.push(...batch);
        if (batch.length < 100 || batch.length === 0) break;
        currentPage += 1;
      }

      const targetContracts = status
        ? collected
        : collected.filter(
            (c) =>
              c.displayStatus !== "TERMINATED" && c.displayStatus !== "DRAFT",
          );

      if (targetContracts.length === 0) {
        toast.error(
          "Không có cư dân đang cư trú phù hợp bộ lọc để xuất danh sách tạm trú.",
        );
        return;
      }

      const { residentCount, contractCount } =
        downloadTemporaryResidenceCsv(targetContracts);
      if (residentCount === 0) {
        toast.error("Không tìm thấy thông tin cư dân trong các hợp đồng phù hợp.");
        return;
      }

      toast.success(
        `Đã xuất file CSV tạm trú gồm ${residentCount} cư dân (${contractCount} hợp đồng).`,
      );
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setExportingResidence(false);
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
    exportingResidence,
    exportTemporaryResidence,
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
    summaryCountAll,
    selectedContract,
    activeCount,
    expiringCount,
    expiredCount,
    draftCount,
    terminatedCount,
    totalDeposit,
  };
}
