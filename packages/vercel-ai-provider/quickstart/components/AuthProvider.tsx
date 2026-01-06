"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Types
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export interface User {
  id: string;
  displayName: string;
}

export interface AuthState {
  isLoading: boolean;
  isAdminSetup: boolean | null;
  isAuthenticated: boolean;
  user: User | null;
  error: string | null;
}

export interface AuthContextValue extends AuthState {
  setupAdmin: (password: string) => Promise<boolean>;
  login: (username: string, password: string) => Promise<boolean>;
  register: (
    username: string,
    password: string,
    displayName?: string,
  ) => Promise<boolean>;
  logout: () => void;
  clearError: () => void;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Context
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const AuthContext = createContext<AuthContextValue | null>(null);

const STORAGE_KEY = "cortex-quickstart-auth";

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Provider
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    isLoading: true,
    isAdminSetup: null,
    isAuthenticated: false,
    user: null,
    error: null,
  });

  // Check admin setup status and restore session on mount
  useEffect(() => {
    const init = async () => {
      try {
        // Check if admin is set up
        const checkResponse = await fetch("/api/auth/check");
        const checkData = await checkResponse.json();

        // Try to restore session from localStorage
        let user: User | null = null;
        let sessionToken: string | null = null;

        if (typeof window !== "undefined") {
          const stored = localStorage.getItem(STORAGE_KEY);
          if (stored) {
            try {
              const parsed = JSON.parse(stored);
              user = parsed.user;
              sessionToken = parsed.sessionToken;
            } catch {
              localStorage.removeItem(STORAGE_KEY);
            }
          }
        }

        setState({
          isLoading: false,
          isAdminSetup: checkData.isSetup,
          isAuthenticated: !!user && !!sessionToken,
          user,
          error: null,
        });
      } catch (error) {
        console.error("Auth init error:", error);
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: "Failed to initialize authentication",
        }));
      }
    };

    init();
  }, []);

  // Setup admin password
  const setupAdmin = useCallback(async (password: string): Promise<boolean> => {
    setState((prev) => ({ ...prev, error: null }));

    try {
      const response = await fetch("/api/auth/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      const data = await response.json();

      if (!response.ok) {
        setState((prev) => ({ ...prev, error: data.error }));
        return false;
      }

      setState((prev) => ({
        ...prev,
        isAdminSetup: true,
      }));

      return true;
    } catch (error) {
      console.error("Setup error:", error);
      setState((prev) => ({
        ...prev,
        error: "Failed to setup admin password",
      }));
      return false;
    }
  }, []);

  // Login
  const login = useCallback(
    async (username: string, password: string): Promise<boolean> => {
      setState((prev) => ({ ...prev, error: null }));

      try {
        const response = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username, password }),
        });

        const data = await response.json();

        if (!response.ok) {
          setState((prev) => ({ ...prev, error: data.error }));
          return false;
        }

        // Store session
        if (typeof window !== "undefined") {
          localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify({
              user: data.user,
              sessionToken: data.sessionToken,
            }),
          );
        }

        setState((prev) => ({
          ...prev,
          isAuthenticated: true,
          user: data.user,
        }));

        return true;
      } catch (error) {
        console.error("Login error:", error);
        setState((prev) => ({
          ...prev,
          error: "Failed to login",
        }));
        return false;
      }
    },
    [],
  );

  // Register
  const register = useCallback(
    async (
      username: string,
      password: string,
      displayName?: string,
    ): Promise<boolean> => {
      setState((prev) => ({ ...prev, error: null }));

      try {
        const response = await fetch("/api/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username, password, displayName }),
        });

        const data = await response.json();

        if (!response.ok) {
          setState((prev) => ({ ...prev, error: data.error }));
          return false;
        }

        // Store session
        if (typeof window !== "undefined") {
          localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify({
              user: data.user,
              sessionToken: data.sessionToken,
            }),
          );
        }

        setState((prev) => ({
          ...prev,
          isAuthenticated: true,
          user: data.user,
        }));

        return true;
      } catch (error) {
        console.error("Register error:", error);
        setState((prev) => ({
          ...prev,
          error: "Failed to register",
        }));
        return false;
      }
    },
    [],
  );

  // Logout
  const logout = useCallback(() => {
    if (typeof window !== "undefined") {
      localStorage.removeItem(STORAGE_KEY);
    }

    setState((prev) => ({
      ...prev,
      isAuthenticated: false,
      user: null,
    }));
  }, []);

  // Clear error
  const clearError = useCallback(() => {
    setState((prev) => ({ ...prev, error: null }));
  }, []);

  const value: AuthContextValue = {
    ...state,
    setupAdmin,
    login,
    register,
    logout,
    clearError,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Hook
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
