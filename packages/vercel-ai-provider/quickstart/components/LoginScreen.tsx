"use client";

import { useState } from "react";
import { useAuth } from "./AuthProvider";

type Tab = "login" | "register";

export function LoginScreen() {
  const { login, register, error, clearError } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    clearError();

    if (!username.trim()) {
      setLocalError("Username is required");
      return;
    }

    if (!password) {
      setLocalError("Password is required");
      return;
    }

    setIsLoading(true);

    if (activeTab === "login") {
      await login(username, password);
    } else {
      await register(username, password, displayName || undefined);
    }

    setIsLoading(false);
  };

  const handleTabChange = (tab: Tab) => {
    setActiveTab(tab);
    setLocalError(null);
    clearError();
  };

  const displayError = localError || error;

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo and Title */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-cortex-500 to-cortex-700 flex items-center justify-center shadow-lg shadow-cortex-500/20">
            <span className="text-4xl">🧠</span>
          </div>
          <h1 className="text-3xl font-bold mb-2">Cortex Memory Demo</h1>
          <p className="text-gray-400">
            Sign in to explore AI with long-term memory
          </p>
        </div>

        {/* Login/Register Card */}
        <div className="glass rounded-2xl overflow-hidden">
          {/* Tabs */}
          <div className="flex border-b border-white/10">
            <button
              onClick={() => handleTabChange("login")}
              className={`flex-1 py-4 text-sm font-medium transition-colors ${
                activeTab === "login"
                  ? "text-white border-b-2 border-cortex-500"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              Sign In
            </button>
            <button
              onClick={() => handleTabChange("register")}
              className={`flex-1 py-4 text-sm font-medium transition-colors ${
                activeTab === "register"
                  ? "text-white border-b-2 border-cortex-500"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              Create Account
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-8 space-y-5">
            <div>
              <label
                htmlFor="username"
                className="block text-sm font-medium text-gray-300 mb-2"
              >
                Username
              </label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter your username"
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:border-cortex-500 transition-colors"
                disabled={isLoading}
                autoFocus
                autoComplete="username"
              />
            </div>

            {activeTab === "register" && (
              <div>
                <label
                  htmlFor="displayName"
                  className="block text-sm font-medium text-gray-300 mb-2"
                >
                  Display Name <span className="text-gray-500">(optional)</span>
                </label>
                <input
                  id="displayName"
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="How should we call you?"
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:border-cortex-500 transition-colors"
                  disabled={isLoading}
                />
              </div>
            )}

            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-gray-300 mb-2"
              >
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:border-cortex-500 transition-colors"
                disabled={isLoading}
                autoComplete={
                  activeTab === "login" ? "current-password" : "new-password"
                }
              />
            </div>

            {displayError && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
                {displayError}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading || !username || !password}
              className="w-full py-3 bg-cortex-600 hover:bg-cortex-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <svg
                    className="animate-spin h-5 w-5"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    />
                  </svg>
                  {activeTab === "login"
                    ? "Signing in..."
                    : "Creating account..."}
                </>
              ) : activeTab === "login" ? (
                "Sign In"
              ) : (
                "Create Account"
              )}
            </button>
          </form>
        </div>

        {/* Demo hint */}
        <p className="mt-6 text-center text-sm text-gray-500">
          Create an account to start chatting with memory-enabled AI
        </p>
      </div>
    </div>
  );
}
