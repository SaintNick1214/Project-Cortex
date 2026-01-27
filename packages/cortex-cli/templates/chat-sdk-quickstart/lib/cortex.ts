/**
 * Cortex SDK Client
 *
 * Shared Cortex client instance for API routes.
 * Supports both unauthenticated (shared) and authenticated (per-request) clients.
 */

import { Cortex, type AuthContext } from "@cortexmemory/sdk";

/**
 * Cached unauthenticated client (singleton for operations that don't need auth)
 */
let cortexClient: Cortex | null = null;

/**
 * Get or create an unauthenticated Cortex SDK client.
 *
 * Use this for operations that don't require user context,
 * such as system-level queries or background jobs.
 *
 * @returns Cortex client without auth context
 */
export function getCortex(): Cortex {
  if (!cortexClient) {
    const convexUrl = process.env.CONVEX_URL;
    if (!convexUrl) {
      throw new Error("CONVEX_URL environment variable is required");
    }

    cortexClient = new Cortex({
      convexUrl,
    });
  }

  return cortexClient;
}

/**
 * Create an authenticated Cortex SDK client with user context.
 *
 * Use this for all user-facing operations. The auth context is
 * automatically injected into all Cortex operations.
 *
 * @param authContext - Auth context from getCortexAuthContext() or createCortexAuthContextFromSession()
 * @returns Cortex client with auth context auto-injected to all operations
 *
 * @example
 * ```typescript
 * import { getCortexAuthContext } from "@/lib/auth-cortex";
 * import { getCortexWithAuth } from "@/lib/cortex";
 *
 * const authContext = await getCortexAuthContext();
 * if (!authContext) {
 *   return new Response("Unauthorized", { status: 401 });
 * }
 *
 * const cortex = getCortexWithAuth(authContext);
 * // All operations auto-scoped to the authenticated user
 * await cortex.memory.remember({ ... });
 * ```
 */
export function getCortexWithAuth(authContext: AuthContext): Cortex {
  const convexUrl = process.env.CONVEX_URL;
  if (!convexUrl) {
    throw new Error("CONVEX_URL environment variable is required");
  }

  return new Cortex({
    convexUrl,
    auth: authContext,
  });
}

/**
 * Get the memory space ID for the chat SDK.
 * Uses MEMORY_SPACE_ID env var or defaults to 'chat-sdk-demo'.
 */
export function getMemorySpaceId(): string {
  return process.env.MEMORY_SPACE_ID || "chat-sdk-demo";
}

/**
 * Get the agent/assistant ID for the chat SDK.
 * Uses AGENT_ID env var or defaults to 'chat-assistant'.
 */
export function getAgentId(): string {
  return process.env.AGENT_ID || "chat-assistant";
}
