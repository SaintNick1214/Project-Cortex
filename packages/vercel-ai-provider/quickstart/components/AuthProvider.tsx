"use client";
import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
export interface User {
  id: string;
  displayName: string;
  allowedMemorySpaceIds: string[];
}
export interface AuthState {
  isLoading: boolean;
  isAdminSetup: boolean | null;
  isAuthenticated: boolean;
  user: User | null;
  error: string | null;
}
export interface AuthContextValue extends AuthState {
  setupAdmin: (
    username: string,
    password: string,
    setupToken: string,
  ) => Promise<boolean>;
  login: (username: string, password: string) => Promise<boolean>;
  register: (
    username: string,
    password: string,
    displayName?: string,
  ) => Promise<boolean>;
  logout: () => Promise<void>;
  clearError: () => void;
}
const AuthContext = createContext<AuthContextValue | null>(null);
export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    isLoading: true,
    isAdminSetup: null,
    isAuthenticated: false,
    user: null,
    error: null,
  });
  useEffect(() => {
    // Retire the old client-asserted identity; only the server cookie restores access.
    try {
      localStorage.removeItem("cortex-quickstart-auth");
    } catch {
      /* Cookie authentication also works when browser storage is blocked. */
    }
    let active = true;
    fetch("/api/auth/check")
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok)
          throw new Error(data.error || "Authentication unavailable");
        if (active)
          setState({
            isLoading: false,
            isAdminSetup: data.isSetup,
            isAuthenticated: !!data.user,
            user: data.user,
            error: null,
          });
      })
      .catch((error) => {
        if (active)
          setState((previous) => ({
            ...previous,
            isLoading: false,
            error: error.message,
          }));
      });
    return () => {
      active = false;
    };
  }, []);
  const authenticate = useCallback(async (mode: string, body: object) => {
    setState((previous) => ({ ...previous, error: null }));
    try {
      const response = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error || "Authentication unavailable");
      setState({
        isLoading: false,
        isAdminSetup: true,
        isAuthenticated: true,
        user: data.user,
        error: null,
      });
      return true;
    } catch (error) {
      setState((previous) => ({
        ...previous,
        error:
          error instanceof Error ? error.message : "Authentication unavailable",
      }));
      return false;
    }
  }, []);
  const logout = useCallback(async () => {
    try {
      const response = await fetch("/api/auth/logout", { method: "POST" });
      if (!response.ok) throw new Error("Logout could not finish. Retry.");
      setState((previous) => ({
        ...previous,
        isAuthenticated: false,
        user: null,
        error: null,
      }));
    } catch (error) {
      setState((previous) => ({
        ...previous,
        error: error instanceof Error ? error.message : "Logout unavailable",
      }));
    }
  }, []);
  return (
    <AuthContext.Provider
      value={{
        ...state,
        setupAdmin: (username, password, setupToken) =>
          authenticate("setup", { username, password, setupToken }),
        login: (username, password) =>
          authenticate("login", { username, password }),
        register: (username, password, displayName) =>
          authenticate("register", { username, password, displayName }),
        logout,
        clearError: () =>
          setState((previous) => ({ ...previous, error: null })),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth requires AuthProvider");
  return context;
}
