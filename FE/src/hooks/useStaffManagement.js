import { useState, useCallback } from "react";
import { staffApi, branchApi, errorMessage } from "../services/api";
import { useToast } from "../context/ToastContext";
import { useResource } from "./useResource";
import { useLiveRefresh } from "./useLiveRefresh";

export function useStaffManagement() {
  const toast = useToast();

  const resource = useResource(
    async () => {
      const [staffRes, branchRes] = await Promise.all([
        staffApi.list({ limit: 50 }),
        branchApi.list({ limit: 100 }),
      ]);
      return {
        staffList: staffRes?.items || [],
        branches: branchRes?.items || [],
      };
    },
    [],
  );

  useLiveRefresh(["staff"], resource.refresh);

  const staffList = resource.data?.staffList || [];
  const branches = resource.data?.branches || [];

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

  // Issued Temporary Credentials Modal State
  const [issuedCreds, setIssuedCreds] = useState(null);

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

  function resolveAssignedBranchNames(branchIds = []) {
    return branchIds
      .map((bId) => {
        const found = branches.find((b) => String(b._id) === String(bId));
        return found?.name || bId;
      })
      .join(", ");
  }

  return {
    staffList,
    branches,
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
    busy,
    formError,
    handleCreateStaff,
    resettingStaff,
    setResettingStaff,
    resetBusy,
    confirmResetPassword,
    issuedCreds,
    setIssuedCreds,
    resolveAssignedBranchNames,
  };
}

