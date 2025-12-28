import { query } from "./_generated/server";

/**
 * Simple health check query to verify Convex backend is reachable
 */
export const ping = query({
  args: {},
  handler: async () => {
    return {
      status: "ok",
      timestamp: Date.now(),
      backend: "convex",
    };
  },
});
