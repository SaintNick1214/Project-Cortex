"use client";

import { useState, useEffect, useCallback } from "react";

interface HealthCheck {
  status: string;
  latencyMs?: number;
  error?: string;
}

interface HealthResponse {
  status: "healthy" | "degraded" | "unhealthy";
  timestamp: string;
  checks: Record<string, HealthCheck>;
  config: {
    convexUrl: string;
    publicConvexUrl: string;
    openaiKey: string;
    graphSync: string;
    graphBackend: string;
  };
}

export function HealthStatus() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  const checkHealth = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch("/api/health");
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const data = await response.json();
      setHealth(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Health check failed");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkHealth();
    // Re-check every 30 seconds
    const interval = setInterval(checkHealth, 30000);
    return () => clearInterval(interval);
  }, [checkHealth]);

  const statusColor = {
    healthy: "bg-green-500",
    degraded: "bg-yellow-500",
    unhealthy: "bg-red-500",
  };

  const statusIcon = {
    healthy: "✓",
    degraded: "⚠",
    unhealthy: "✗",
  };

  if (loading && !health) {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-400">
        <div className="w-2 h-2 rounded-full bg-gray-500 animate-pulse" />
        <span>Checking...</span>
      </div>
    );
  }

  if (error && !health) {
    return (
      <button
        onClick={checkHealth}
        className="flex items-center gap-2 text-sm text-red-400 hover:text-red-300"
      >
        <div className="w-2 h-2 rounded-full bg-red-500" />
        <span>Connection Error</span>
      </button>
    );
  }

  if (!health) return null;

  return (
    <div className="relative">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 text-sm hover:opacity-80 transition-opacity"
      >
        <div
          className={`w-2 h-2 rounded-full ${statusColor[health.status]} ${
            loading ? "animate-pulse" : ""
          }`}
        />
        <span
          className={
            health.status === "healthy"
              ? "text-green-400"
              : health.status === "degraded"
                ? "text-yellow-400"
                : "text-red-400"
          }
        >
          {statusIcon[health.status]} Backend{" "}
          {health.status.charAt(0).toUpperCase() + health.status.slice(1)}
        </span>
      </button>

      {expanded && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-gray-900 border border-white/10 rounded-lg shadow-xl z-50 p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold">System Health</h3>
            <button
              onClick={checkHealth}
              disabled={loading}
              className="text-xs text-gray-400 hover:text-white disabled:opacity-50"
            >
              {loading ? "Checking..." : "Refresh"}
            </button>
          </div>

          <div className="space-y-2 text-sm">
            {/* Individual checks */}
            {Object.entries(health.checks).map(([name, check]) => (
              <div
                key={name}
                className="flex items-center justify-between py-1 border-b border-white/5"
              >
                <span className="text-gray-400 capitalize">
                  {name.replace(/([A-Z])/g, " $1").trim()}
                </span>
                <span
                  className={`flex items-center gap-1 ${
                    check.status === "ok"
                      ? "text-green-400"
                      : check.status === "warning"
                        ? "text-yellow-400"
                        : "text-red-400"
                  }`}
                >
                  {check.status === "ok" ? "✓" : check.status === "warning" ? "⚠" : "✗"}
                  {check.latencyMs !== undefined && (
                    <span className="text-gray-500 text-xs ml-1">
                      {check.latencyMs}ms
                    </span>
                  )}
                </span>
              </div>
            ))}

            {/* Config summary */}
            <div className="pt-2 mt-2 border-t border-white/10">
              <div className="text-xs text-gray-500 mb-1">Configuration</div>
              <div className="flex flex-wrap gap-1">
                <span
                  className={`px-2 py-0.5 rounded text-xs ${
                    health.config.convexUrl === "configured"
                      ? "bg-green-900/30 text-green-400"
                      : "bg-red-900/30 text-red-400"
                  }`}
                >
                  Convex
                </span>
                <span
                  className={`px-2 py-0.5 rounded text-xs ${
                    health.config.openaiKey === "configured"
                      ? "bg-green-900/30 text-green-400"
                      : "bg-red-900/30 text-red-400"
                  }`}
                >
                  OpenAI
                </span>
                <span
                  className={`px-2 py-0.5 rounded text-xs ${
                    health.config.graphSync === "enabled"
                      ? "bg-blue-900/30 text-blue-400"
                      : "bg-gray-900/30 text-gray-500"
                  }`}
                >
                  Graph: {health.config.graphBackend}
                </span>
              </div>
            </div>

            {/* Errors */}
            {Object.entries(health.checks)
              .filter(([, check]) => check.error)
              .map(([name, check]) => (
                <div
                  key={`error-${name}`}
                  className="mt-2 p-2 bg-red-900/20 rounded text-xs text-red-400"
                >
                  <strong className="capitalize">{name}:</strong> {check.error}
                </div>
              ))}
          </div>

          <div className="mt-3 pt-2 border-t border-white/10 text-xs text-gray-500">
            Last checked: {new Date(health.timestamp).toLocaleTimeString()}
          </div>
        </div>
      )}
    </div>
  );
}
