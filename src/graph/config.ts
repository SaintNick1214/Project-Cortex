/** Narrow graph connection selection shared by the SDK and provider. */
import type { GraphConnectionConfig } from "./types";

export interface GraphConnectionOptions {
  type?: "neo4j" | "memgraph";
  uri?: string;
  username?: string;
  password?: string;
}

/**
 * Explicit off wins over connection/env configuration. A manually injected
 * adapter is handled by the caller before resolving automatic configuration.
 * Explicit URIs without a provider require a complete explicit credential tuple.
 */
export function resolveGraphConnection(
  options: { enabled?: boolean; connection?: GraphConnectionOptions } = {},
  env: Record<string, string | undefined> = process.env,
): GraphConnectionConfig | undefined {
  if (!(options.enabled ?? env.CORTEX_GRAPH_SYNC === "true")) return undefined;
  const explicit = options.connection;
  if (explicit?.type !== undefined && !["neo4j", "memgraph"].includes(explicit.type)) {
    throw new Error("Graph provider must be neo4j or memgraph.");
  }
  const providers = ["neo4j", "memgraph"] as const;
  const available = providers.filter((provider) => env[`${provider.toUpperCase()}_URI`]);
  const provider = explicit?.type ?? (explicit?.uri ? undefined : available.length === 1 ? available[0] : undefined);
  if (!explicit?.uri && !provider) {
    throw new Error(available.length > 1
      ? "Graph configuration is ambiguous. Select graphConnection.type (neo4j or memgraph)."
      : "Graph is enabled but no URI is configured. Set NEO4J_URI or MEMGRAPH_URI.");
  }
  const prefix = provider?.toUpperCase();
  const uri = explicit?.uri ?? (prefix ? env[`${prefix}_URI`] : undefined);
  const username = explicit?.username ?? (prefix ? env[`${prefix}_USERNAME`] : undefined);
  const password = explicit?.password ?? (prefix ? env[`${prefix}_PASSWORD`] : undefined);
  if (!uri || !username || !password) {
    throw new Error("Graph is enabled but its URI, username and password tuple is incomplete. Configure one provider's credentials or a complete explicit graph connection.");
  }
  return { uri, username, password };
}
