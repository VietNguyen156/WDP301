import { createContext, useContext, useEffect, useState } from "react";
import {
  authApi,
  restoreSession,
  setAccessToken,
  setSessionExpiredHandler,
} from "../services/api";
const AuthContext = createContext(null);
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    setSessionExpiredHandler(() => setUser(null));
    restoreSession()
      .then((data) => {
        if (active) setUser(data.user);
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);
  async function login(body) {
    const data = await authApi.login(body);
    setAccessToken(data.token);
    setUser(data.user);
  }
  async function logout() {
    await authApi.logout();
    setAccessToken(null);
    setUser(null);
  }
  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
// oxlint-disable-next-line react/only-export-components -- context hook shares provider
export const useAuth = () => useContext(AuthContext);
