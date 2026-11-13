import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Role, SelfRegisterRole } from '@/src/types/api';
import { fetchMe, logout as apiLogout, login as apiLogin, register as apiRegister } from '@/src/api/endpoints';
import { tokenStore } from '@/src/api/client';
import { router } from 'expo-router';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (payload: { email: string; password: string; first_name: string; last_name: string; phone?: string; role: SelfRegisterRole }) => Promise<User>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  hasRole: (roles: Role[]) => boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshUser = async () => {
    try {
      const access = await tokenStore.getAccess();
      const refresh = await tokenStore.getRefresh();
      if (!access && !refresh) { setUser(null); return; }
      const userData = await fetchMe();
      setUser(userData);
    } catch {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refreshUser();
  }, []);

  const login = async (email: string, password: string) => {
    const userData = await apiLogin(email, password);
    setUser(userData);
    return userData;
  };

  const register = async (payload: { email: string; password: string; first_name: string; last_name: string; phone?: string; role: SelfRegisterRole }) => {
    await apiRegister(payload);
    // Registration does not return JWTs; authenticate immediately after creating the account.
    const userData = await apiLogin(payload.email, payload.password);
    setUser(userData);
    return userData;
  };

  const logout = async () => {
    await apiLogout();
    setUser(null);
    router.replace('/auth/login');
  };

  const hasRole = (roles: Role[]) => {
    return user ? roles.includes(user.role) : false;
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, isAuthenticated: !!user, login, register, logout, refreshUser, hasRole }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}