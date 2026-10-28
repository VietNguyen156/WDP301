import { useState, useEffect, useMemo, useCallback } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { branchApi, errorMessage } from "../services/api";
import {
  ROLE_LABELS,
  getUserInitials,
  resolveCurrentPlanMeta,
  resolveRoleAccess,
  buildNavigationItems,
} from "../utils/navigationConfig";

export function useWorkspaceShell() {
  const {
    user,
    loading,
    logout,
    selectedBranchId,
    setSelectedBranchId,
    mustChangePassword,
  } = useAuth();
  const location = useLocation();
  const toast = useToast();

  const routeKey = `${location.pathname}${location.search}`;
  const [isQuickCreateOpen, setIsQuickCreateOpen] = useState(false);
  const [plansModalState, setPlansModalState] = useState({
    routeKey: "",
    open: false,
  });
  const [mobileMenuRouteKey, setMobileMenuRouteKey] = useState("");
  const [branches, setBranches] = useState([]);

  // Derived states that automatically reset on navigation without cascading effects
  const mobileMenuOpen = mobileMenuRouteKey === routeKey;
  const setMobileMenuOpen = useCallback(
    (nextOpen) => {
      setMobileMenuRouteKey(nextOpen ? routeKey : "");
    },
    [routeKey],
  );

  const isPlansRouteForLandlord =
    location.pathname === "/plans" && user?.role === "LANDLORD";
  const isPlansModalOpen =
    plansModalState.routeKey === routeKey
      ? plansModalState.open
      : isPlansRouteForLandlord;

  const setIsPlansModalOpen = useCallback(
    (nextOpen) => {
      setPlansModalState({ routeKey, open: Boolean(nextOpen) });
    },
    [routeKey],
  );

  // Load accessible branches for Landlord / Property Manager
  useEffect(() => {
    let active = true;
    if (
      user &&
      (user.role === "LANDLORD" || user.role === "PROPERTY_MANAGER")
    ) {
      branchApi
        .options()
        .then((items) => {
          if (active) {
            const list = items || [];
            setBranches(list);
            if (list.length > 0) {
              const exists = list.some((b) => b._id === selectedBranchId);
              if (!exists) {
                setSelectedBranchId(list[0]._id);
              }
            } else if (selectedBranchId) {
              setSelectedBranchId("");
            }
          }
        })
        .catch(() => {});
    }
    return () => {
      active = false;
    };
  }, [user, selectedBranchId, setSelectedBranchId]);

  const userInitials = useMemo(() => getUserInitials(user), [user]);
  const currentPlan = useMemo(
    () => resolveCurrentPlanMeta(user, branches),
    [user, branches],
  );
  const access = useMemo(() => resolveRoleAccess(user), [user]);
  const nav = useMemo(
    () => buildNavigationItems(access, branches.length),
    [access, branches.length],
  );

  const isPublicInvoicePath =
    location.pathname.startsWith("/i/") ||
    location.pathname.startsWith("/public/") ||
    window.location.hash.startsWith("#public/");

  const hashToken = isPublicInvoicePath
    ? window.location.hash.replace("#public/", "")
    : "";

  async function signOut() {
    try {
      await logout();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  return {
    user,
    loading,
    mustChangePassword,
    selectedBranchId,
    branches,
    userInitials,
    currentPlan,
    roles: ROLE_LABELS,
    nav,
    ...access,
    isPublicInvoicePath,
    hashToken,
    mobileMenuOpen,
    setMobileMenuOpen,
    isQuickCreateOpen,
    setIsQuickCreateOpen,
    isPlansModalOpen,
    setIsPlansModalOpen,
    signOut,
  };
}

