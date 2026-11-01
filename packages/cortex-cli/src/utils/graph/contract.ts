import { createHash } from "node:crypto";
import path from "node:path";

export type GraphProvider = "neo4j" | "memgraph";
export type GraphMode = "local" | "existing";
export class GraphPlanError extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = "GraphPlanError";
  }
}
export const graphImages: Readonly<Record<GraphProvider, string>> =
  Object.freeze({
    neo4j:
      "neo4j:2026.09.0@sha256:0dfcadbd51e1d2e5a0cf86d054a0bb537a4bce212796d967cbd88445aaf3fbf3",
    memgraph:
      "memgraph/memgraph:3.13.1@sha256:bd3fe13228f40881365486729c78110dde6e04f3c1f102c84720d31f38b693f8",
  });
export const graphFiles = Object.freeze({
  compose: ".cortex/graph/compose.json",
  ownership: ".cortex/graph/ownership.json",
  credentials: ".cortex/graph/credentials.json",
});
export const graphHash = (bytes: string | Uint8Array): string =>
  createHash("sha256").update(bytes).digest("hex");
export function graphJson(value: unknown): string {
  const sorted = (v: unknown): unknown =>
    Array.isArray(v)
      ? v.map(sorted)
      : v && typeof v === "object"
        ? Object.fromEntries(
            Object.entries(v)
              .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
              .map(([k, x]) => [k, sorted(x)]),
          )
        : v;
  return JSON.stringify(sorted(value), null, 2) + "\n";
}
export interface GraphOptions {
  graph?: "none" | GraphProvider;
  skipGraph?: boolean;
  graphMode?: GraphMode;
  graphUri?: string;
  boltPort?: number;
  httpPort?: number;
}
export type NormalizedGraphOptions =
  | { provider: "none" }
  | {
      provider: GraphProvider;
      mode: GraphMode;
      uri: string;
      boltPort: number;
      httpPort?: number;
    };
export function graphPort(value: number): number {
  if (!Number.isSafeInteger(value) || value < 1 || value > 65535)
    throw new GraphPlanError("GRAPH_PORT_INVALID");
  return value;
}
/** Values are never interpolated into diagnostics, including parser errors. */
export function graphUri(
  value: string,
  provider: GraphProvider,
): { uri: string; hostname: string; port: number; protocol: string } {
  if (!["neo4j", "memgraph"].includes(provider))
    throw new GraphPlanError("GRAPH_OPTIONS_INVALID");
  if (
    typeof value !== "string" ||
    !value ||
    value.length > 2048 ||
    /\s/.test(value) ||
    [...value].some((c) => c.charCodeAt(0) < 32)
  )
    throw new GraphPlanError("GRAPH_URI_INVALID");
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new GraphPlanError("GRAPH_URI_INVALID");
  }
  if (
    ![
      "bolt:",
      "bolt+s:",
      "bolt+ssc:",
      "neo4j:",
      "neo4j+s:",
      "neo4j+ssc:",
    ].includes(parsed.protocol) ||
    (provider === "memgraph" && !parsed.protocol.startsWith("bolt")) ||
    parsed.username ||
    parsed.password ||
    !parsed.hostname ||
    parsed.hostname.includes("%") ||
    parsed.search ||
    parsed.hash ||
    (parsed.pathname && parsed.pathname !== "/")
  )
    throw new GraphPlanError("GRAPH_URI_INVALID");
  const port = graphPort(parsed.port ? Number(parsed.port) : 7687);
  return {
    uri: `${parsed.protocol}//${parsed.hostname}:${port}`,
    hostname: parsed.hostname,
    port,
    protocol: parsed.protocol,
  };
}
export function normalizeGraphOptions(
  options: GraphOptions = {},
): NormalizedGraphOptions {
  if (
    !options ||
    typeof options !== "object" ||
    Array.isArray(options) ||
    Object.keys(options).some(
      (key) =>
        ![
          "graph",
          "skipGraph",
          "graphMode",
          "graphUri",
          "boltPort",
          "httpPort",
        ].includes(key),
    ) ||
    (options.skipGraph !== undefined &&
      typeof options.skipGraph !== "boolean") ||
    (options.graph !== undefined &&
      !["none", "neo4j", "memgraph"].includes(options.graph))
  )
    throw new GraphPlanError("GRAPH_OPTIONS_INVALID");
  if (
    options.skipGraph &&
    options.graph !== undefined &&
    options.graph !== "none"
  )
    throw new GraphPlanError("GRAPH_SKIP_CONFLICT");
  const provider = options.skipGraph ? "none" : (options.graph ?? "none");
  if (provider === "none") {
    if (
      [
        options.graphMode,
        options.graphUri,
        options.boltPort,
        options.httpPort,
      ].some((v) => v !== undefined)
    )
      throw new GraphPlanError("GRAPH_OFF_OPTIONS_CONFLICT");
    return { provider: "none" };
  }
  const mode = options.graphMode ?? "local";
  if (!["local", "existing"].includes(mode))
    throw new GraphPlanError("GRAPH_MODE_INVALID");
  if (mode === "existing") {
    if (options.boltPort !== undefined || options.httpPort !== undefined)
      throw new GraphPlanError("GRAPH_EXISTING_PORT_CONFLICT");
    if (options.graphUri === undefined)
      throw new GraphPlanError("GRAPH_EXISTING_URI_REQUIRED");
    const parsed = graphUri(options.graphUri, provider);
    return { provider, mode, uri: parsed.uri, boltPort: parsed.port };
  }
  if (provider === "memgraph" && options.httpPort !== undefined)
    throw new GraphPlanError("GRAPH_HTTP_PORT_UNSUPPORTED");
  const parsed =
    options.graphUri === undefined
      ? undefined
      : graphUri(options.graphUri, provider);
  if (
    parsed &&
    (parsed.protocol !== "bolt:" ||
      !["127.0.0.1", "localhost"].includes(parsed.hostname))
  )
    throw new GraphPlanError("GRAPH_LOCAL_URI_CONFLICT");
  const boltPort = graphPort(options.boltPort ?? parsed?.port ?? 7687);
  if (parsed && parsed.port !== boltPort)
    throw new GraphPlanError("GRAPH_LOCAL_PORT_CONFLICT");
  const httpPort =
    provider === "neo4j" ? graphPort(options.httpPort ?? 7474) : undefined;
  if (httpPort === boltPort) throw new GraphPlanError("GRAPH_PORT_CONFLICT");
  return {
    provider,
    mode,
    uri: `bolt://127.0.0.1:${boltPort}`,
    boltPort,
    ...(httpPort === undefined ? {} : { httpPort }),
  };
}
export interface SelectedGraphProject {
  root: string;
  canonicalRoot: string;
  kind: "directory";
  symlink: false;
}
/** Consumes the later service's realpath/lstat observation; does not inspect the filesystem itself. */
export function validateGraphProject(project: SelectedGraphProject): string {
  if (
    !project ||
    typeof project.root !== "string" ||
    !path.isAbsolute(project.root) ||
    path.resolve(project.root) !== project.root ||
    project.root === path.parse(project.root).root ||
    project.canonicalRoot !== project.root ||
    project.kind !== "directory" ||
    project.symlink !== false ||
    [...project.root].some((c) => c.charCodeAt(0) < 32)
  )
    throw new GraphPlanError("GRAPH_PROJECT_INVALID");
  return graphHash(`cortex-graph-project-v1\0${project.root}`).slice(0, 24);
}
export interface GraphCredentials {
  username: string;
  password: string;
}
export interface PrivateGraphEnvironment {
  path: typeof graphFiles.credentials;
  mode: 0o600;
  bytes: Buffer;
}
/** Credentials are a separate private artifact, never a member of a public graph plan. */
export function renderPrivateGraphEnvironment(
  provider: GraphProvider,
  uri: string,
  credentials: GraphCredentials,
  mode: GraphMode,
): PrivateGraphEnvironment {
  if (
    !["neo4j", "memgraph"].includes(provider) ||
    !["local", "existing"].includes(mode)
  )
    throw new GraphPlanError("GRAPH_OPTIONS_INVALID");
  const normalized = graphUri(uri, provider);
  if (
    mode === "local" &&
    (normalized.protocol !== "bolt:" ||
      !["127.0.0.1", "localhost"].includes(normalized.hostname))
  )
    throw new GraphPlanError("GRAPH_LOCAL_URI_CONFLICT");
  if (
    !credentials ||
    typeof credentials.username !== "string" ||
    !credentials.username ||
    typeof credentials.password !== "string" ||
    !credentials.password ||
    Buffer.byteLength(credentials.username) > 256 ||
    Buffer.byteLength(credentials.password) > 4096 ||
    credentials.username.includes("\0") ||
    credentials.password.includes("\0")
  )
    throw new GraphPlanError("GRAPH_CREDENTIALS_REQUIRED");
  if (
    mode === "local" &&
    provider === "neo4j" &&
    (credentials.username !== "neo4j" || credentials.password.length < 8)
  )
    throw new GraphPlanError("GRAPH_LOCAL_AUTH_INVALID");
  if (
    mode === "local" &&
    provider === "memgraph" &&
    !/^[A-Za-z_][A-Za-z0-9_]{0,62}$/.test(credentials.username)
  )
    throw new GraphPlanError("GRAPH_LOCAL_AUTH_INVALID");
  const prefix = provider.toUpperCase();
  return {
    path: graphFiles.credentials,
    mode: 0o600,
    bytes: Buffer.from(
      graphJson({
        [`${prefix}_URI`]: normalized.uri,
        [`${prefix}_USERNAME`]: credentials.username,
        [`${prefix}_PASSWORD`]: credentials.password,
      }),
    ),
  };
}
