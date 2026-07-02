import { createContext, useCallback, useContext, useEffect, useState } from "react";
import {
  login as apiLogin,
  fetchMe,
  getToken,
  setToken as persistToken,
  clearSession,
} from "@/lib/api";
import { setActorId } from "@/lib/currentUser";

const USER_KEY = "sopra_pm_user";

function getStoredUser() {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(getStoredUser());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      setLoading(false);
      return;
    }
    fetchMe()
      .then((u) => {
        setUser(u);
        localStorage.setItem(USER_KEY, JSON.stringify(u));
        setActorId(u.id);
      })
      .catch(() => {
        clearSession();
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (email, password) => {
    const { access_token, user: loggedInUser } = await apiLogin(email, password);
    persistToken(access_token);
    localStorage.setItem(USER_KEY, JSON.stringify(loggedInUser));
    setUser(loggedInUser);
    setActorId(loggedInUser.id);
    return loggedInUser;
  }, []);

  const logout = useCallback(() => {
    clearSession();
    setActorId("");
    setUser(null);
  }, []);

  const value = {
    user,
    loading,
    login,
    logout,
    isAuthenticated: !!getToken(),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
