import React, { createContext, useContext, useState, useEffect } from "react";

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

  const [selectedBranchId, setSelectedBranchId] = useState(
    () => localStorage.getItem("selectedBranchId") || ""
  );

  useEffect(() => {
    if (token) {
      localStorage.setItem("token", token);
    } else {
      localStorage.removeItem("token");
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

  const login = (newToken, newUser) => {
    setToken(newToken);
    setUser(newUser);
    if (newUser?.assignedBranches?.length > 0) {
      setSelectedBranchId(newUser.assignedBranches[0]);
    }
  };

  const logout = () => {
    setToken("");
    setUser(null);
    setSelectedBranchId("");
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    localStorage.removeItem("selectedBranchId");
  };

  return (
    <AuthContext.Provider
      value={{
        token,
        user,
        selectedBranchId,
        setSelectedBranchId,
        login,
        logout,
        isAuthenticated: !!token,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
