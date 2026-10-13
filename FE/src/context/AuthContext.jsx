import React, { createContext, useContext, useEffect, useState } from "react";
import {
  authApi,
  restoreSession,
  setAccessToken,
  setSessionExpiredHandler,
} from "../services/api";

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
  const [loading, setLoading] = useState(true);
  const [selectedBranchId, setSelectedBranchId] = useState(
    () => localStorage.getItem("selectedBranchId") || "",
  );

  useEffect(() => {
    let active = true;
    setSessionExpiredHandler(() => {
      setToken("");
      setUser(null);
      localStorage.removeItem("token");
      localStorage.removeItem("user");
    });

    restoreSession()
      .then((data) => {
        if (active && data?.user) {
          setUser(data.user);
          setToken(data.token || localStorage.getItem("token") || "");
          localStorage.setItem("user", JSON.stringify(data.user));
        }
      })
      .catch(() => {
        // Fallback to localStorage if available
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
    } else {
      localStorage.removeItem("token");
      setAccessToken(null);
    }
  }, [token]);

  useEffect(() => {
    if (user) {
      localStorage.setItem("user", JSON.stringify(user));
    } else {
      localStorage.removeItem("user");
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
    // If called with (token, user) - Manh's style
    if (typeof firstArg === "string" && secondArg) {
      setToken(firstArg);
      setUser(secondArg);
      setAccessToken(firstArg);
      if (secondArg.assignedBranches?.length > 0) {
        setSelectedBranchId(secondArg.assignedBranches[0]);
      }
      return;
    }

    // Otherwise called with credentials object: { email, password } - Viet's style
    const data = await authApi.login(firstArg);
    setAccessToken(data.token);
    setToken(data.token);
    setUser(data.user);
    if (data.user?.assignedBranches?.length > 0) {
      setSelectedBranchId(data.user.assignedBranches[0]);
    }
    return data;
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
    setSelectedBranchId("");
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    localStorage.removeItem("selectedBranchId");
  }

  return (
    <AuthContext.Provider
      value={{
        token,
        user,
        loading,
        selectedBranchId,
        setSelectedBranchId,
        login,
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
