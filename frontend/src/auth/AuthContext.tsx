import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { fetchMe, login as apiLogin, logout as apiLogout } from "../api/endpoints";
import { tokenStore } from "../api/client";
import { disablePush } from "../lib/push";
import { isUnreachable } from "../offline/connectivity";
import type { User } from "../types";

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tokenStore.getAccess()) {
      setLoading(false);
      return;
    }
    fetchMe()
      .then(setUser)
      .catch((error) => {
        // Only drop the session when the server actually rejected it. If it
        // simply couldn't be reached (offline, or a sleeping host answering
        // 502/503) keep the tokens, so reconnecting resumes the session
        // instead of forcing a fresh login.
        if (!isUnreachable(error)) tokenStore.clear();
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  async function login(email: string, password: string) {
    const loggedInUser = await apiLogin(email, password);
    setUser(loggedInUser);
    return loggedInUser;
  }

  function logout() {
    // Alerts belong to the person, not the device: stop them while we can still
    // authenticate, but never make signing out wait on a slow connection.
    const detach = disablePush().catch(() => {});
    const patience = new Promise((resolve) => setTimeout(resolve, 1500));
    void Promise.race([detach, patience]).finally(() => {
      apiLogout();
      setUser(null);
    });
  }

  return <AuthContext.Provider value={{ user, loading, login, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
