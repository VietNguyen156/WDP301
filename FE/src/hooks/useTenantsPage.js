import { useState, useMemo } from "react";
import { tenantApi, errorMessage } from "../services/api";
import { useToast } from "../context/ToastContext";
import { useResource } from "./useResource";
import { useLiveRefresh } from "./useLiveRefresh";

export function useTenantsPage() {
  const toast = useToast();
  const resource = useResource(() => tenantApi.list({ limit: 100 }), []);
  useLiveRefresh(["tenants"], resource.refresh);

  const tenants = useMemo(
    () => resource.data?.items || [],
    [resource.data],
  );
  const loading = resource.loading;
  const error = resource.error;
  const loadData = resource.reload;

  // Search, Filter & Sort state
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL"); // ALL | ACTIVE | MUST_CHANGE_PW | INACTIVE
  const [profileFilter, setProfileFilter] = useState("ALL"); // ALL | COMPLETE | HAS_CCCD | MISSING_CCCD | MISSING_CONTACT
  const [sortBy, setSortBy] = useState("DEFAULT"); // DEFAULT | NAME_ASC | NAME_DESC
  const [copiedKey, setCopiedKey] = useState(null);

  // Reset Password Confirmation Modal state
  const [resettingTenant, setResettingTenant] = useState(null);
  const [resetBusy, setResetBusy] = useState(false);

  // Credentials dialog for newly created or reset tenant
  const [issuedCreds, setIssuedCreds] = useState(null);

  const stats = useMemo(() => {
    let activeCount = 0;
    let mustChangePwCount = 0;
    let inactiveCount = 0;
    let citizenIdCount = 0;
    let missingContactCount = 0;

    tenants.forEach((t) => {
      if (t.status === "ACTIVE" && !t.mustChangePassword) activeCount += 1;
      if (t.mustChangePassword) mustChangePwCount += 1;
      if (t.status === "INACTIVE") inactiveCount += 1;
      if (t.citizenId && /^\d{12}$/.test(t.citizenId)) citizenIdCount += 1;
      if (!t.phoneNumber?.trim() || !t.email?.trim()) missingContactCount += 1;
    });

    return {
      total: tenants.length,
      activeCount,
      mustChangePwCount,
      inactiveCount,
      citizenIdCount,
      missingContactCount,
    };
  }, [tenants]);

  const filteredTenants = useMemo(() => {
    const filtered = tenants.filter((item) => {
      if (statusFilter === "ACTIVE") {
        if (item.mustChangePassword || item.status !== "ACTIVE") return false;
      } else if (statusFilter === "MUST_CHANGE_PW") {
        if (!item.mustChangePassword) return false;
      } else if (statusFilter === "INACTIVE") {
        if (item.status !== "INACTIVE") return false;
      }

      const hasValidCccd = Boolean(
        item.citizenId && /^\d{12}$/.test(item.citizenId),
      );
      const hasFullContact = Boolean(
        item.phoneNumber?.trim() && item.email?.trim(),
      );

      if (profileFilter === "HAS_CCCD" && !hasValidCccd) return false;
      if (profileFilter === "MISSING_CCCD" && hasValidCccd) return false;
      if (profileFilter === "MISSING_CONTACT" && hasFullContact) return false;
      if (profileFilter === "COMPLETE" && (!hasValidCccd || !hasFullContact))
        return false;

      if (searchTerm.trim()) {
        const term = searchTerm.trim().toLowerCase();
        const matchName = (item.name || "").toLowerCase().includes(term);
        const matchCccd = (item.citizenId || item.username || "")
          .toLowerCase()
          .includes(term);
        const matchPhone = (item.phoneNumber || "").toLowerCase().includes(term);
        const matchEmail = (item.email || "").toLowerCase().includes(term);
        const matchHometown = (item.hometown || "")
          .toLowerCase()
          .includes(term);

        if (
          !matchName &&
          !matchCccd &&
          !matchPhone &&
          !matchEmail &&
          !matchHometown
        ) {
          return false;
        }
      }

      return true;
    });

    if (sortBy === "NAME_ASC") {
      return [...filtered].sort((a, b) =>
        (a.name || "").localeCompare(b.name || "", "vi"),
      );
    }
    if (sortBy === "NAME_DESC") {
      return [...filtered].sort((a, b) =>
        (b.name || "").localeCompare(a.name || "", "vi"),
      );
    }
    return filtered;
  }, [tenants, statusFilter, profileFilter, searchTerm, sortBy]);

  function copyText(text, label, key) {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    toast.success(`Đã sao chép ${label}: ${text}`);
    setTimeout(() => setCopiedKey(null), 2000);
  }

  function handleResetFilters() {
    setSearchTerm("");
    setStatusFilter("ALL");
    setProfileFilter("ALL");
    setSortBy("DEFAULT");
  }

  function requestResetPassword(tenant) {
    setResettingTenant(tenant);
  }

  async function confirmResetPassword() {
    if (!resettingTenant) return;
    setResetBusy(true);
    try {
      const res = await tenantApi.resetPassword(
        resettingTenant._id || resettingTenant.id,
      );
      toast.success("Đã cấp lại mật khẩu tạm thời thành công!");
      if (res?.credentials) {
        setIssuedCreds({
          credentials: res.credentials,
          recipientName: resettingTenant.name,
          roleLabel: "Khách thuê (Cấp lại mật khẩu)",
        });
      }
      setResettingTenant(null);
      loadData();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setResetBusy(false);
    }
  }

  const hasActiveFilters = Boolean(
    searchTerm.trim() ||
    statusFilter !== "ALL" ||
    profileFilter !== "ALL" ||
    sortBy !== "DEFAULT",
  );

  return {
    tenants,
    loading,
    error,
    loadData,
    searchTerm,
    setSearchTerm,
    statusFilter,
    setStatusFilter,
    profileFilter,
    setProfileFilter,
    sortBy,
    setSortBy,
    copiedKey,
    copyText,
    stats,
    filteredTenants,
    hasActiveFilters,
    handleResetFilters,
    resettingTenant,
    setResettingTenant,
    resetBusy,
    requestResetPassword,
    confirmResetPassword,
    issuedCreds,
    setIssuedCreds,
  };
}

