/**
 * Cortex SDK Client
 *
 * Shared Cortex client instance for API routes.
 */

import { Cortex } from "@cortexmemory/sdk";

let cortexClient: Cortex | null = null;

/**
 * Get or create a Cortex SDK client
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
