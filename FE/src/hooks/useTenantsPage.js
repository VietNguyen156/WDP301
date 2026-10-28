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

  // Search & Filter state
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL"); // ALL | ACTIVE | MUST_CHANGE_PW | INACTIVE
  const [hometownFilter, setHometownFilter] = useState("ALL");
  const [copiedKey, setCopiedKey] = useState(null);

  // Create Modal states
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [citizenId, setCitizenId] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [email, setEmail] = useState("");
  const [hometown, setHometown] = useState("");
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState("");

  // Reset Password Confirmation Modal state
  const [resettingTenant, setResettingTenant] = useState(null);
  const [resetBusy, setResetBusy] = useState(false);

  // Credentials dialog for newly created or reset tenant
  const [issuedCreds, setIssuedCreds] = useState(null);

  const hometownOptions = useMemo(() => {
    const set = new Set();
    tenants.forEach((t) => {
      if (t.hometown && t.hometown.trim()) {
        set.add(t.hometown.trim());
      }
    });
    return Array.from(set).sort();
  }, [tenants]);

  const stats = useMemo(() => {
    let activeCount = 0;
    let mustChangePwCount = 0;
    let citizenIdCount = 0;

    tenants.forEach((t) => {
      if (t.status === "ACTIVE" && !t.mustChangePassword) activeCount += 1;
      if (t.mustChangePassword) mustChangePwCount += 1;
      if (t.citizenId && /^\d{12}$/.test(t.citizenId)) citizenIdCount += 1;
    });

    return {
      total: tenants.length,
      activeCount,
      mustChangePwCount,
      citizenIdCount,
    };
  }, [tenants]);

  const filteredTenants = useMemo(() => {
    return tenants.filter((item) => {
      if (statusFilter === "ACTIVE") {
        if (item.mustChangePassword || item.status !== "ACTIVE") return false;
      } else if (statusFilter === "MUST_CHANGE_PW") {
        if (!item.mustChangePassword) return false;
      } else if (statusFilter === "INACTIVE") {
        if (item.status !== "INACTIVE") return false;
      }

      if (hometownFilter !== "ALL") {
        if (!item.hometown || item.hometown.trim() !== hometownFilter)
          return false;
      }

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
  }, [tenants, statusFilter, hometownFilter, searchTerm]);

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
    setHometownFilter("ALL");
  }

  async function handleCreateTenant(e) {
    e.preventDefault();
    setBusy(true);
    setFormError("");

    if (!/^\d{12}$/.test(citizenId.trim())) {
      setFormError("Số CCCD phải gồm đúng 12 chữ số.");
      setBusy(false);
      return;
    }

    try {
      const res = await tenantApi.create({
        name: name.trim(),
        citizenId: citizenId.trim(),
        phoneNumber: phoneNumber.trim() || undefined,
        email: email.trim() || undefined,
        hometown: hometown.trim() || undefined,
      });

      toast.success("Cấp tài khoản Khách thuê thành công!");
      setIsCreateOpen(false);
      setName("");
      setCitizenId("");
      setPhoneNumber("");
      setEmail("");
      setHometown("");

      if (res?.credentials) {
        setIssuedCreds({
          credentials: res.credentials,
          recipientName: res.user?.name || name,
          roleLabel: "Khách thuê (Tenant)",
        });
      }
      loadData();
    } catch (err) {
      const msg = errorMessage(err);
      setFormError(msg);
      toast.error(msg);
    } finally {
      setBusy(false);
    }
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
    searchTerm.trim() || statusFilter !== "ALL" || hometownFilter !== "ALL",
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
    hometownFilter,
    setHometownFilter,
    hometownOptions,
    copiedKey,
    copyText,
    stats,
    filteredTenants,
    hasActiveFilters,
    handleResetFilters,
    isCreateOpen,
    setIsCreateOpen,
    name,
    setName,
    citizenId,
    setCitizenId,
    phoneNumber,
    setPhoneNumber,
    email,
    setEmail,
    hometown,
    setHometown,
    busy,
    formError,
    handleCreateTenant,
    resettingTenant,
    setResettingTenant,
    resetBusy,
    requestResetPassword,
    confirmResetPassword,
    issuedCreds,
    setIssuedCreds,
  };
}

