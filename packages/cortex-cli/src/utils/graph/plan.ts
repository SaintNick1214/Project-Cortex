import {
  GraphPlanError,
  graphFiles,
  graphHash,
  graphImages,
  graphJson,
  graphPort,
  normalizeGraphOptions,
  type GraphOptions,
  type GraphProvider,
  type SelectedGraphProject,
} from "./contract.js";
import {
  graphResourceIdentity,
  validateGraphResourceIdentity,
  validateGraphOwnership,
  validateGraphResources,
  type GraphOwnership,
  type GraphResourceObservation,
} from "./ownership.js";

export interface GraphFileObservation {
  kind: "file" | "directory" | "symlink";
  hash?: string;
  mode?: number;
}
export interface GraphPlanObservations {
  project?: SelectedGraphProject;
  ownership?: unknown;
  files?: Partial<Record<keyof typeof graphFiles, GraphFileObservation>>;
  busyPorts?: readonly number[];
  ownedPorts?: readonly number[];
  resources?: readonly GraphResourceObservation[];
  unownedEnvKeys?: readonly string[];
}
export type GraphSetupPlan =
  | { provider: "none"; mode: "none"; actions: []; writes: []; requires: [] }
  | {
      provider: GraphProvider;
      mode: "existing";
      uri: string;
      actions: [
        "read-only-authenticated-probe",
        "read-only-managed-compatibility",
      ];
      writes: [];
      requires: ["explicit-provider-credentials", "accepted-managed-sdk"];
    }
  | {
      provider: GraphProvider;
      mode: "local";
      uri: string;
      ownership: GraphOwnership;
      compose: { path: typeof graphFiles.compose; mode: 0o644; bytes: string };
      writes: string[];
      actions: string[];
      requires: string[];
      preserveCredentials: boolean;
      preserveVolume: true;
      authentication:
        | "neo4j-initial-auth"
        | "memgraph-first-user-bootstrap-and-verify";
    };

export function renderGraphCompose(
  provider: GraphProvider,
  identity: ReturnType<typeof graphResourceIdentity>,
  ports: { boltPort: number; httpPort?: number },
): string {
  validateGraphResourceIdentity(identity, provider);
  graphPort(ports.boltPort);
  if (ports.httpPort !== undefined) {
    graphPort(ports.httpPort);
    if (provider === "memgraph")
      throw new GraphPlanError("GRAPH_HTTP_PORT_UNSUPPORTED");
    if (ports.httpPort === ports.boltPort)
      throw new GraphPlanError("GRAPH_PORT_CONFLICT");
  }
  const service: Record<string, unknown> = {
    image: graphImages[provider],
    labels: identity.labels,
    ports: [`127.0.0.1:${ports.boltPort}:7687`],
    volumes: [
      {
        type: "volume",
        source: "data",
        target: provider === "neo4j" ? "/data" : "/var/lib/memgraph",
      },
    ],
  };
  if (provider === "neo4j") {
    service.environment = {
      NEO4J_AUTH:
        "${NEO4J_USERNAME:?Explicit private graph credentials required}/${NEO4J_PASSWORD:?Explicit private graph credentials required}",
    };
    if (ports.httpPort !== undefined)
      (service.ports as string[]).push(`127.0.0.1:${ports.httpPort}:7474`);
  } else {
    // The image does not initialize a password user from these variables. The service
    // must perform the separate first-user bootstrap and genuine authenticated probe.
    service.environment = {
      MEMGRAPH_USERNAME:
        "${MEMGRAPH_USERNAME:?Explicit private graph credentials required}",
      MEMGRAPH_PASSWORD:
        "${MEMGRAPH_PASSWORD:?Explicit private graph credentials required}",
    };
    service.command = ["--bolt-port=7687"];
  }
  return graphJson({
    name: identity.composeProject,
    services: { [provider]: service },
    volumes: { data: { name: identity.volume, labels: identity.labels } },
  });
}
/** Pure plan from explicit selected observations. No dotenv, filesystem, driver, SDK or Docker call. */
export function planGraphSetup(
  options: GraphOptions = {},
  observations: GraphPlanObservations = {},
): GraphSetupPlan {
  const normalized = normalizeGraphOptions(options);
  if (normalized.provider === "none")
    return {
      provider: "none",
      mode: "none",
      actions: [],
      writes: [],
      requires: [],
    };
  const provider = normalized.provider;
  const relevant = new Set([
    "CORTEX_GRAPH_SYNC",
    `${provider.toUpperCase()}_URI`,
    `${provider.toUpperCase()}_USERNAME`,
    `${provider.toUpperCase()}_PASSWORD`,
  ]);
  if (observations.unownedEnvKeys?.some((key) => relevant.has(key)))
    throw new GraphPlanError("GRAPH_USER_ENV_CONFLICT");
  if (normalized.mode === "existing")
    return {
      provider,
      mode: "existing",
      uri: normalized.uri,
      actions: [
        "read-only-authenticated-probe",
        "read-only-managed-compatibility",
      ],
      writes: [],
      requires: ["explicit-provider-credentials", "accepted-managed-sdk"],
    };
  if (!observations.project) throw new GraphPlanError("GRAPH_PROJECT_REQUIRED");
  const identity = graphResourceIdentity(observations.project, provider);
  const compose = renderGraphCompose(provider, identity, normalized);
  const owner: GraphOwnership = {
    version: 1,
    ...identity,
    provider,
    image: graphImages[provider],
    uri: normalized.uri,
    boltPort: normalized.boltPort,
    ...(normalized.httpPort === undefined
      ? {}
      : { httpPort: normalized.httpPort }),
    composeHash: graphHash(compose),
    files: { ...graphFiles },
  };
  const current = observations.files ?? {};
  const reuse = observations.ownership !== undefined;
  if (reuse) {
    validateGraphOwnership(observations.ownership, owner);
    if (
      current.compose?.kind !== "file" ||
      current.compose.hash !== owner.composeHash ||
      current.ownership?.kind !== "file" ||
      current.ownership.hash !== graphHash(graphJson(owner)) ||
      current.credentials?.kind !== "file" ||
      current.credentials.mode !== 0o600
    )
      throw new GraphPlanError("GRAPH_OWNED_FILES_CONFLICT");
    validateGraphResources(
      observations.project,
      owner,
      observations.resources ?? [],
    );
  } else if (
    Object.values(current).some((value) => value !== undefined) ||
    observations.resources?.length
  )
    throw new GraphPlanError("GRAPH_USER_FILES_CONFLICT");
  const ports = [
    normalized.boltPort,
    ...(normalized.httpPort === undefined ? [] : [normalized.httpPort]),
  ];
  if (
    ports.some(
      (port) =>
        observations.busyPorts?.includes(port) &&
        !(
          reuse &&
          observations.ownedPorts?.includes(port) &&
          observations.resources?.some((r) => r.kind === "container")
        ),
    )
  )
    throw new GraphPlanError("GRAPH_PORT_BUSY");
  return {
    provider,
    mode: "local",
    uri: normalized.uri,
    ownership: owner,
    compose: { path: graphFiles.compose, mode: 0o644, bytes: compose },
    writes: reuse ? [] : Object.values(graphFiles),
    preserveCredentials: reuse,
    preserveVolume: true,
    authentication:
      provider === "neo4j"
        ? "neo4j-initial-auth"
        : "memgraph-first-user-bootstrap-and-verify",
    actions: [
      "preflight-runtime-and-selected-ports",
      "start-only-owned-resources",
      ...(provider === "memgraph" && !reuse ? ["bootstrap-first-user"] : []),
      "authenticated-readiness",
      "initialize-managed-namespace",
      "read-only-managed-compatibility",
    ],
    requires: [
      "docker-daemon",
      "compose",
      "available-selected-ports",
      "explicit-provider-credentials",
      "accepted-managed-sdk",
    ],
  };
}
