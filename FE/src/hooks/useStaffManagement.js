import { useState, useCallback, useMemo } from "react";
import { staffApi, branchApi, errorMessage } from "../services/api";
import { useToast } from "../context/ToastContext";
import { useResource } from "./useResource";
import { useLiveRefresh } from "./useLiveRefresh";

export function useStaffManagement() {
  const toast = useToast();

  const resource = useResource(async () => {
    const [staffRes, branchRes] = await Promise.all([
      staffApi.list({ limit: 100 }),
      branchApi.list({ limit: 100 }),
    ]);
    return {
      staffList: staffRes?.items || [],
      branches: branchRes?.items || [],
    };
  }, []);

  useLiveRefresh(["staff"], resource.refresh);

  const staffList = useMemo(
    () => resource.data?.staffList || [],
    [resource.data],
  );
  const branches = useMemo(
    () => resource.data?.branches || [],
    [resource.data],
  );

  // Filter & UX states
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL"); // ALL | ACTIVE | MUST_CHANGE_PW | SUSPENDED
  const [branchFilter, setBranchFilter] = useState("ALL"); // ALL | UNASSIGNED | <branchId>
  const [copiedKey, setCopiedKey] = useState(null);

  // Create Staff Modal States
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [email, setEmail] = useState("");
  const [assignedBranches, setAssignedBranches] = useState([]);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState("");

  // Reset Password Confirmation Modal State
  const [resettingStaff, setResettingStaff] = useState(null);
  const [resetBusy, setResetBusy] = useState(false);

  // Lock / Unlock Confirmation Modal State
  const [lockingStaff, setLockingStaff] = useState(null);
  const [lockBusy, setLockBusy] = useState(false);

  // Permissions Modal State
  const [permissionStaff, setPermissionStaff] = useState(null);
  const [permissionBusyKey, setPermissionBusyKey] = useState("");

  // Issued Temporary Credentials Modal State
  const [issuedCreds, setIssuedCreds] = useState(null);

  const resolveAssignedBranches = useCallback(
    (branchIds = []) =>
      (branchIds || []).map((bId) => {
        const found = branches.find((b) => String(b._id) === String(bId));
        return {
          id: String(bId),
          name: found?.name || String(bId),
        };
      }),
    [branches],
  );

  const resolveAssignedBranchNames = useCallback(
    (branchIds = []) =>
      resolveAssignedBranches(branchIds)
        .map((b) => b.name)
        .join(", "),
    [resolveAssignedBranches],
  );

  const stats = useMemo(() => {
    let activeCount = 0;
    let mustChangePwCount = 0;
    let suspendedCount = 0;

    staffList.forEach((s) => {
      if (s.status === "SUSPENDED") suspendedCount += 1;
      else if (s.mustChangePassword) mustChangePwCount += 1;
      else activeCount += 1;
    });

    return {
      total: staffList.length,
      activeCount,
      mustChangePwCount,
      suspendedCount,
    };
  }, [staffList]);

  const filteredStaff = useMemo(() => {
    return staffList.filter((item) => {
      if (statusFilter === "ACTIVE") {
        if (item.status === "SUSPENDED" || item.mustChangePassword) return false;
      } else if (statusFilter === "MUST_CHANGE_PW") {
        if (item.status === "SUSPENDED" || !item.mustChangePassword) return false;
      } else if (statusFilter === "SUSPENDED") {
        if (item.status !== "SUSPENDED") return false;
      }

      const ids = (item.assignedBranches || []).map(String);
      if (branchFilter === "UNASSIGNED") {
        if (ids.length > 0) return false;
      } else if (branchFilter !== "ALL") {
        if (!ids.includes(String(branchFilter))) return false;
      }

      if (searchTerm.trim()) {
        const term = searchTerm.trim().toLowerCase();
        const branchText = resolveAssignedBranchNames(item.assignedBranches).toLowerCase();
        const matchName = (item.name || "").toLowerCase().includes(term);
        const matchPhone = (item.username || item.phoneNumber || "")
          .toLowerCase()
          .includes(term);
        const matchEmail = (item.email || "").toLowerCase().includes(term);
        const matchBranch = branchText.includes(term);
        if (!matchName && !matchPhone && !matchEmail && !matchBranch) {
          return false;
        }
      }

      return true;
    });
  }, [staffList, statusFilter, branchFilter, searchTerm, resolveAssignedBranchNames]);

  const hasActiveFilters = Boolean(
    searchTerm.trim() || statusFilter !== "ALL" || branchFilter !== "ALL",
  );

  function handleResetFilters() {
    setSearchTerm("");
    setStatusFilter("ALL");
    setBranchFilter("ALL");
  }

  function copyPhone(text, key) {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    toast.success(`Đã sao chép SĐT: ${text}`);
    setTimeout(() => setCopiedKey(null), 2000);
  }

  const openCreateModal = useCallback(() => {
    setFormError("");
    setIsCreateOpen(true);
  }, []);

  const closeCreateModal = useCallback(() => {
    if (busy) return;
    setIsCreateOpen(false);
    setFormError("");
  }, [busy]);

  function toggleBranch(branchId) {
    setAssignedBranches((prev) =>
      prev.includes(branchId)
        ? prev.filter((id) => id !== branchId)
        : [...prev, branchId],
    );
  }

  function toggleAllBranches() {
    if (assignedBranches.length === branches.length) {
      setAssignedBranches([]);
    } else {
      setAssignedBranches(branches.map((b) => b._id));
    }
  }

  async function handleCreateStaff(e) {
    e.preventDefault();
    setBusy(true);
    setFormError("");

    try {
      const res = await staffApi.create({
        name: name.trim(),
        phoneNumber: phoneNumber.trim(),
        email: email.trim() || undefined,
        assignedBranches,
      });

      toast.success("Cấp tài khoản Quản lý cơ sở thành công!");
      setIsCreateOpen(false);
      setName("");
      setPhoneNumber("");
      setEmail("");
      setAssignedBranches([]);

      if (res?.credentials) {
        setIssuedCreds({
          credentials: res.credentials,
          recipientName: res.user?.name || name,
          roleLabel: "Quản lý cơ sở (Property Manager)",
        });
      }
      resource.refresh();
    } catch (err) {
      const msg = errorMessage(err);
      setFormError(msg);
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  }

  async function confirmResetPassword() {
    if (!resettingStaff) return;
    setResetBusy(true);
    try {
      const res = await staffApi.resetPassword(
        resettingStaff._id || resettingStaff.id,
      );
      const targetName = resettingStaff.name;
      setResettingStaff(null);
      toast.success("Đã cấp lại mật khẩu tạm thời thành công!");
      if (res?.credentials) {
        setIssuedCreds({
          credentials: res.credentials,
          recipientName: targetName,
          roleLabel: "Quản lý cơ sở (Cấp lại mật khẩu)",
        });
      }
      resource.refresh();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setResetBusy(false);
    }
  }

  // Lock / unlock: `lockingStaff` is the manager whose confirmation modal is open.
  async function confirmToggleLock() {
    if (!lockingStaff) return;
    const locking = lockingStaff.status !== "SUSPENDED";
    setLockBusy(true);
    try {
      await staffApi.setLock(lockingStaff._id || lockingStaff.id, locking);
      toast.success(
        locking
          ? `Đã khóa tài khoản ${lockingStaff.name}`
          : `Đã mở khóa tài khoản ${lockingStaff.name}`,
      );
      setLockingStaff(null);
      resource.refresh();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setLockBusy(false);
    }
  }

  // Permission switches: each toggle saves at once and updates the open modal from the response.
  async function togglePermission(key, enabled) {
    if (!permissionStaff) return;
    setPermissionBusyKey(key);
    try {
      const res = await staffApi.updatePermissions(
        permissionStaff._id || permissionStaff.id,
        { [key]: enabled },
      );
      setPermissionStaff((current) =>
        current ? { ...current, permissions: res?.user?.permissions } : current,
      );
      resource.refresh();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setPermissionBusyKey("");
    }
  }

  return {
    staffList,
    filteredStaff,
    branches,
    stats,
    searchTerm,
    setSearchTerm,
    statusFilter,
    setStatusFilter,
    branchFilter,
    setBranchFilter,
    hasActiveFilters,
    handleResetFilters,
    copiedKey,
    copyPhone,
    loading: resource.loading,
    error: resource.error,
    loadData: resource.reload,
    isCreateOpen,
    openCreateModal,
    closeCreateModal,
    name,
    setName,
    phoneNumber,
    setPhoneNumber,
    email,
    setEmail,
    assignedBranches,
    toggleBranch,
    toggleAllBranches,
    busy,
    formError,
    handleCreateStaff,
    resettingStaff,
    setResettingStaff,
    resetBusy,
    confirmResetPassword,
    issuedCreds,
    setIssuedCreds,
    resolveAssignedBranches,
    resolveAssignedBranchNames,
    permissionStaff,
    setPermissionStaff,
    permissionBusyKey,
    togglePermission,
    lockingStaff,
    setLockingStaff,
    lockBusy,
    confirmToggleLock,
  };
}
