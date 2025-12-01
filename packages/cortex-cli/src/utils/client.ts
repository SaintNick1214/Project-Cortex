/**
 * Cortex SDK Client Initialization
 *
 * Handles creating and managing connections to the Cortex SDK
 */

import { Cortex } from "@cortexmemory/sdk";
import type { CLIConfig, GlobalOptions } from "../types.js";
import { resolveConfig } from "./config.js";

/**
 * Cached client instance
 */
let cachedClient: Cortex | null = null;
let cachedUrl: string | null = null;

/**
 * Create a Cortex client from configuration and options
 */
export function createClient(
  config: CLIConfig,
  options: GlobalOptions,
): Cortex {
  const resolved = resolveConfig(config, options);

  // Return cached client if URL matches
  if (cachedClient && cachedUrl === resolved.url) {
    return cachedClient;
  }

  // Close existing client if URL changed
  if (cachedClient) {
    cachedClient.close();
  }

  // Create new client
  cachedClient = new Cortex({
    convexUrl: resolved.url,
  });
  cachedUrl = resolved.url;

  return cachedClient;
}

/**
 * Close the cached client connection
 */
export function closeClient(): void {
  if (cachedClient) {
    cachedClient.close();
    cachedClient = null;
    cachedUrl = null;
  }
}

/**
 * Test connection to the Convex deployment
 */
export async function testConnection(
  config: CLIConfig,
  options: GlobalOptions,
): Promise<{
  connected: boolean;
  url: string;
  error?: string;
  latency?: number;
}> {
  const resolved = resolveConfig(config, options);

  const startTime = Date.now();

  try {
    const client = createClient(config, options);

    // Try to query something simple to verify connection
    await client.memorySpaces.list({ limit: 1 });

    const latency = Date.now() - startTime;

    return {
      connected: true,
      url: resolved.url,
      latency,
    };
  } catch (error) {
    return {
      connected: false,
      url: resolved.url,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Get deployment info
 */
export function getDeploymentInfo(
  config: CLIConfig,
  options: GlobalOptions,
): {
  url: string;
  deployment?: string;
  hasKey: boolean;
  isLocal: boolean;
} {
  const resolved = resolveConfig(config, options);

  return {
    url: resolved.url,
    deployment: resolved.deployment,
    hasKey: Boolean(resolved.key),
    isLocal:
      resolved.url.includes("localhost") || resolved.url.includes("127.0.0.1"),
  };
}

/**
 * Ensure client is connected before running an operation
 */
export async function withClient<T>(
  config: CLIConfig,
  options: GlobalOptions,
  operation: (client: Cortex) => Promise<T>,
): Promise<T> {
  const client = createClient(config, options);

  try {
    return await operation(client);
  } finally {
    // Don't close the client here - allow reuse
  }
}

/**
 * Run an operation with automatic cleanup on process exit
 */
export function setupClientCleanup(): void {
  process.on("exit", () => {
    closeClient();
  });

  process.on("SIGINT", () => {
    closeClient();
    process.exit(0);
  });

  process.on("SIGTERM", () => {
    closeClient();
    process.exit(0);
  });
}
