import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { authApi, setAccessToken } from "../api/authApi";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // Khởi động ứng dụng: Tự động khôi phục phiên qua HttpOnly Cookie nếu có
  const checkAuth = useCallback(async () => {
    try {
      const data = await authApi.refreshToken();
      setAccessToken(data.accessToken);
      setUser(data.user);
    } catch (err) {
      setAccessToken(null);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const login = async (credentials) => {
    const data = await authApi.login(credentials);
    setAccessToken(data.accessToken);
    setUser(data.user);
    return data;
  };

  const register = async (formData) => {
    return await authApi.register(formData);
  };

  const verifyEmail = async (token) => {
    const data = await authApi.verifyEmail(token);
    if (data.accessToken && data.user) {
      setAccessToken(data.accessToken);
      setUser(data.user);
    }
    return data;
  };

  const logout = async () => {
    try {
      await authApi.logout();
    } catch (err) {
      console.warn("Logout error:", err);
    } finally {
      setAccessToken(null);
      setUser(null);
    }
  };

  const value = {
    user,
    isLoading,
    isAuthenticated: !!user,
    login,
    register,
    verifyEmail,
    logout,
    checkAuth,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth phải được sử dụng bên trong AuthProvider");
  }
  return context;
};
