import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import {
  authApi,
  profileApi,
  restoreSession,
  setAccessToken,
  setSessionExpiredHandler,
  setPasswordChangeRequiredHandler,
} from "../services/api";
import { updateSocketAuthToken, disconnectSocket } from "../services/socket";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem("token") || "");
  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem("user");
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [profile, setProfile] = useState(() => {
    try {
      const saved = localStorage.getItem("profile");
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [mustChangePassword, setMustChangePassword] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedBranchId, setSelectedBranchId] = useState(
    () => localStorage.getItem("selectedBranchId") || "",
  );

  const refreshProfile = useCallback(async () => {
    try {
      const currentToken = localStorage.getItem("token");
      if (!currentToken) return null;
      const p = await profileApi.get();
      if (p) {
        setProfile(p);
        localStorage.setItem("profile", JSON.stringify(p));
      }
      return p;
    } catch {
      return null;
    }
  }, []);

  // Reload the signed-in user (e.g. the active SaaS plan after a payment).
  const refreshUser = useCallback(async () => {
    try {
      const fresh = await authApi.me();
      if (fresh) {
        setUser(fresh);
        localStorage.setItem("user", JSON.stringify(fresh));
      }
      return fresh;
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    let active = true;

    setSessionExpiredHandler(() => {
      setToken("");
      setUser(null);
      setProfile(null);
      setMustChangePassword(false);
      setSelectedBranchId("");
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      localStorage.removeItem("profile");
      localStorage.removeItem("selectedBranchId");
    });

    setPasswordChangeRequiredHandler(() => {
      setMustChangePassword(true);
    });

    restoreSession()
      .then((data) => {
        if (active && data?.user) {
          setUser(data.user);
          setToken(data.token || localStorage.getItem("token") || "");
          if (data.user.mustChangePassword) {
            setMustChangePassword(true);
          } else {
            // Load fresh profile details (including bankAccount for LANDLORD)
            profileApi.get()
              .then((p) => {
                if (active && p) {
                  setProfile(p);
                  localStorage.setItem("profile", JSON.stringify(p));
                }
              })
              .catch(() => {});
          }
          localStorage.setItem("user", JSON.stringify(data.user));
        }
      })
      .catch(() => {
        setAccessToken(null);
        setToken("");
        setUser(null);
        setProfile(null);
        setMustChangePassword(false);
        setSelectedBranchId("");
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        localStorage.removeItem("profile");
        localStorage.removeItem("selectedBranchId");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (token) {
      localStorage.setItem("token", token);
      setAccessToken(token);
      updateSocketAuthToken(token);
    } else {
      localStorage.removeItem("token");
      setAccessToken(null);
      disconnectSocket();
    }
  }, [token]);

  useEffect(() => {
    if (user) {
      localStorage.setItem("user", JSON.stringify(user));
      if (user.mustChangePassword) {
        setMustChangePassword(true);
      }
    } else {
      localStorage.removeItem("user");
      setMustChangePassword(false);
    }
  }, [user]);

  useEffect(() => {
    if (selectedBranchId) {
      localStorage.setItem("selectedBranchId", selectedBranchId);
    } else {
      localStorage.removeItem("selectedBranchId");
    }
  }, [selectedBranchId]);

  async function login(firstArg, secondArg) {
    if (typeof firstArg === "string" && secondArg) {
      setToken(firstArg);
      setUser(secondArg);
      setAccessToken(firstArg);
      if (secondArg.mustChangePassword) {
        setMustChangePassword(true);
      }
      if (secondArg.assignedBranches?.length > 0) {
        setSelectedBranchId(secondArg.assignedBranches[0]);
      }
      return { token: firstArg, user: secondArg };
    }

    const data = await authApi.login(firstArg);
    setAccessToken(data.token);
    setToken(data.token);
    setUser(data.user);
    if (data.user?.mustChangePassword) {
      setMustChangePassword(true);
    } else {
      setMustChangePassword(false);
    }
    if (data.user?.assignedBranches?.length > 0) {
      setSelectedBranchId(data.user.assignedBranches[0]);
    }
    if (data.user && !data.user.mustChangePassword) {
      profileApi.get()
        .then((p) => {
          if (p) {
            setProfile(p);
            localStorage.setItem("profile", JSON.stringify(p));
          }
        })
        .catch(() => {});
    }
    return data;
  }

  async function changePassword({ currentPassword, newPassword }) {
    const res = await authApi.changePassword({ currentPassword, newPassword });
    // After password change, all sessions are revoked by backend
    setAccessToken(null);
    setToken("");
    setUser(null);
    setProfile(null);
    setMustChangePassword(false);
    setSelectedBranchId("");
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    localStorage.removeItem("profile");
    localStorage.removeItem("selectedBranchId");
    return res;
  }

  async function logout() {
    try {
      await authApi.logout();
    } catch {
      // Ignore API logout error if session already expired
    }
    setAccessToken(null);
    setToken("");
    setUser(null);
    setProfile(null);
    setMustChangePassword(false);
    setSelectedBranchId("");
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    localStorage.removeItem("profile");
    localStorage.removeItem("selectedBranchId");
  }

  return (
    <AuthContext.Provider
      value={{
        token,
        user,
        profile,
        setProfile,
        refreshProfile,
        refreshUser,
        loading,
        mustChangePassword,
        setMustChangePassword,
        selectedBranchId,
        setSelectedBranchId,
        login,
        changePassword,
        logout,
        isAuthenticated: !!user || !!token,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// oxlint-disable-next-line react/only-export-components -- context hook shares provider
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
