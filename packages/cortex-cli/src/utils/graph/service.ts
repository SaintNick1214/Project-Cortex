/** The one selected-project graph setup/lifecycle service. Off has no runtime imports. */
import fs from "node:fs/promises";
import path from "node:path";
import net from "node:net";
import os from "node:os";
import { execFile } from "node:child_process";
import { randomBytes } from "node:crypto";
import {
  GraphPlanError,
  graphFiles,
  graphHash,
  graphJson,
  normalizeGraphOptions,
  renderPrivateGraphEnvironment,
  validateGraphProject,
  type GraphCredentials,
  type GraphOptions,
  type GraphProvider,
  type SelectedGraphProject,
} from "./contract.js";
import { planGraphSetup, type GraphFileObservation } from "./plan.js";
import {
  validateGraphResources,
  type GraphOwnership,
  type GraphResourceObservation,
} from "./ownership.js";

export interface GraphServiceOptions extends GraphOptions {
  dryRun?: boolean;
  credentialsFile?: string;
  credentials?: GraphCredentials;
}
export interface GraphSetupReceipt {
  provider: "none" | GraphProvider;
  mode: "none" | "local" | "existing";
  projectPath: string;
  uri?: string;
  image?: string;
  projectId?: string;
  dryRun?: boolean;
  status: "disabled" | "planned" | "ready" | "stopped";
  authentication?: "verified";
  managedSchema?: "verified";
  containerId?: string;
  preserveVolume?: true;
  environmentSource?: string;
  sdkActivation?: string;
}
interface Connection {
  version: 1;
  projectId: string;
  provider: GraphProvider;
  mode: "existing";
  uri: string;
}
const connectionFile = ".cortex/graph/connection.json";
const sdkActivation =
  "Load the selected private provider JSON into the process environment, set CORTEX_GRAPH_SYNC=true, then use Cortex.create with graphConnection.type set to the selected provider (the map exposes it as CORTEX_GRAPH_PROVIDER). readSelectedGraphEnvironment supplies this exact map; never print it.";
function sdkConfigurationReceipt() {
  return { environmentSource: graphFiles.credentials, sdkActivation };
}
function fail(code: string): never {
  throw new GraphPlanError(code);
}
async function selectedProject(
  directory: string,
): Promise<SelectedGraphProject> {
  const root = path.resolve(directory),
    stat = await fs.lstat(root);
  if (
    !stat.isDirectory() ||
    stat.isSymbolicLink() ||
    (await fs.realpath(root)) !== root
  )
    fail("GRAPH_PROJECT_INVALID");
  const project: SelectedGraphProject = {
    root,
    canonicalRoot: root,
    kind: "directory",
    symlink: false,
  };
  validateGraphProject(project);
  return project;
}
async function safeFile(
  project: SelectedGraphProject,
  relative: string,
): Promise<string> {
  const target = path.join(project.root, relative);
  for (
    let cursor = target;
    cursor !== project.root;
    cursor = path.dirname(cursor)
  ) {
    const stat = await fs.lstat(cursor).catch((error: { code?: string }) => {
      if (error.code === "ENOENT") return undefined;
      throw error;
    });
    if (stat?.isSymbolicLink()) fail("GRAPH_SYMLINK_CONFLICT");
  }
  return target;
}
async function jsonFile(file: string, privateFile = false): Promise<unknown> {
  const stat = await fs.lstat(file);
  if (
    !stat.isFile() ||
    stat.isSymbolicLink() ||
    stat.size > 65536 ||
    (privateFile && (stat.mode & 0o777) !== 0o600)
  )
    fail("GRAPH_FILE_INVALID");
  try {
    return JSON.parse(await fs.readFile(file, "utf8"));
  } catch {
    return fail("GRAPH_FILE_INVALID");
  }
}
function credentialsFromMap(
  value: unknown,
  provider: GraphProvider,
): GraphCredentials {
  const map = value as Record<string, unknown>,
    prefix = provider.toUpperCase();
  if (!map || typeof map !== "object" || Array.isArray(map))
    fail("GRAPH_CREDENTIALS_REQUIRED");
  const username = map[`${prefix}_USERNAME`],
    password = map[`${prefix}_PASSWORD`];
  if (typeof username !== "string" || typeof password !== "string")
    fail("GRAPH_CREDENTIALS_REQUIRED");
  return { username, password };
}
async function newCredentials(
  options: GraphServiceOptions,
  provider: GraphProvider,
  mode: "local" | "existing",
): Promise<GraphCredentials> {
  if (options.credentials) return options.credentials;
  if (options.credentialsFile)
    return credentialsFromMap(
      await jsonFile(path.resolve(options.credentialsFile), true),
      provider,
    );
  const prefix = provider.toUpperCase();
  if (
    process.env[`${prefix}_USERNAME`] !== undefined ||
    process.env[`${prefix}_PASSWORD`] !== undefined
  )
    return credentialsFromMap(process.env, provider);
  if (mode === "existing") fail("GRAPH_CREDENTIALS_REQUIRED");
  return {
    username: provider === "neo4j" ? "neo4j" : "cortexadmin",
    password: randomBytes(24).toString("base64url"),
  };
}
function dockerEnvironment(
  credentials?: Record<string, string>,
): Record<string, string | undefined> {
  const host =
    process.env.DOCKER_HOST ??
    `unix://${path.join(os.homedir(), ".docker/run/docker.sock")}`;
  if (!host.startsWith("unix:///") || /[\r\n\0]/.test(host))
    fail("GRAPH_LOCAL_DOCKER_ENDPOINT_REQUIRED");
  return {
    ...process.env,
    DOCKER_HOST: host,
    DOCKER_CONTEXT: undefined,
    ...credentials,
  };
}
/** Literal argv, finite time/output, callback after actual child close. Raw diagnostics stay private. */
async function docker(
  args: string[],
  project: SelectedGraphProject,
  credentials?: Record<string, string>,
  absent = false,
): Promise<string | undefined> {
  return new Promise((resolve, reject) => {
    execFile(
      "docker",
      args,
      {
        cwd: project.root,
        env: dockerEnvironment(credentials),
        timeout: 60000,
        maxBuffer: 1024 * 1024,
      },
      (error, stdout, stderr) => {
        if (error) {
          if (
            absent &&
            /No such (?:object|container|volume)|no such volume/i.test(
              String(stderr),
            )
          )
            return resolve(undefined);
          return reject(new GraphPlanError("GRAPH_DOCKER_COMMAND_FAILED"));
        }
        resolve(stdout);
      },
    );
  });
}
async function runtime(project: SelectedGraphProject): Promise<void> {
  await docker(["info", "--format", "{{.ServerVersion}}"], project);
  const version = await docker(["compose", "version", "--short"], project);
  if (!version || !/^v?[2-9]\./.test(version.trim()))
    fail("GRAPH_COMPOSE_UNSUPPORTED");
}
interface Resources {
  observations: GraphResourceObservation[];
  containerId?: string;
  running: boolean;
  ownedPorts: number[];
}
async function resources(
  project: SelectedGraphProject,
  owner: GraphOwnership,
): Promise<Resources> {
  const observations: GraphResourceObservation[] = [],
    ownedPorts: number[] = [];
  const text = await docker(
    ["container", "inspect", `${owner.composeProject}-${owner.service}-1`],
    project,
    undefined,
    true,
  );
  let containerId: string | undefined,
    running = false;
  if (text) {
    const row = JSON.parse(text)[0];
    observations.push({
      kind: "container",
      name: row.Name.replace(/^\//, ""),
      labels: row.Config.Labels ?? {},
      image: row.Config.Image,
    });
    containerId = row.Id;
    running = row.State.Running === true;
    for (const bindings of Object.values(
      row.HostConfig.PortBindings ?? {},
    ) as Array<Array<{ HostIp: string; HostPort: string }> | null>) {
      for (const binding of bindings ?? []) {
        if (binding.HostIp !== "127.0.0.1") fail("GRAPH_RESOURCE_CONFLICT");
        ownedPorts.push(Number(binding.HostPort));
      }
    }
    const expectedPorts = [
      owner.boltPort,
      ...(owner.httpPort === undefined ? [] : [owner.httpPort]),
    ];
    if (
      graphJson([...ownedPorts].sort()) !== graphJson([...expectedPorts].sort())
    )
      fail("GRAPH_RESOURCE_CONFLICT");
    const mounts = row.Mounts as Array<{
      Type: string;
      Name?: string;
      Destination: string;
    }>;
    const selected = mounts.filter(
      (m) =>
        m.Destination ===
        (owner.provider === "neo4j" ? "/data" : "/var/lib/memgraph"),
    );
    if (
      selected.length !== 1 ||
      selected[0].Type !== "volume" ||
      selected[0].Name !== owner.volume ||
      mounts.some((m) => m.Type === "bind")
    )
      fail("GRAPH_RESOURCE_CONFLICT");
  }
  const volume = await docker(
    ["volume", "inspect", owner.volume],
    project,
    undefined,
    true,
  );
  if (volume) {
    const row = JSON.parse(volume)[0];
    observations.push({
      kind: "volume",
      name: row.Name,
      labels: row.Labels ?? {},
    });
  }
  validateGraphResources(project, owner, observations);
  return { observations, containerId, running, ownedPorts };
}
async function busy(port: number): Promise<boolean> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", (error: { code?: string }) =>
      error.code === "EADDRINUSE"
        ? resolve(true)
        : reject(new GraphPlanError("GRAPH_PORT_CHECK_FAILED")),
    );
    server.listen(port, "127.0.0.1", () =>
      server.close((error) => (error ? reject(error) : resolve(false))),
    );
  });
}
async function selectedEnvConflicts(
  project: SelectedGraphProject,
): Promise<string[]> {
  const file = await safeFile(project, ".env.local");
  const body = await fs
    .readFile(file, "utf8")
    .catch((error: { code?: string }) => {
      if (error.code === "ENOENT") return "";
      throw error;
    });
  return [...body.matchAll(/^\s*(?:export\s+)?([A-Z_][A-Z0-9_]*)\s*=/gm)].map(
    (m) => m[1],
  );
}
async function observeFiles(project: SelectedGraphProject) {
  const files: Partial<Record<keyof typeof graphFiles, GraphFileObservation>> =
    {};
  let ownership: unknown;
  for (const [key, relative] of Object.entries(graphFiles)) {
    const file = await safeFile(project, relative),
      stat = await fs.lstat(file).catch((e: { code?: string }) => {
        if (e.code === "ENOENT") return undefined;
        throw e;
      });
    if (stat) {
      if (!stat.isFile() || stat.size > 65536)
        fail("GRAPH_USER_FILES_CONFLICT");
      files[key as keyof typeof graphFiles] = {
        kind: "file",
        mode: stat.mode & 0o777,
        hash: graphHash(await fs.readFile(file)),
      };
      if (key === "ownership") ownership = await jsonFile(file);
    }
  }
  return { files, ownership };
}
/** Missing Memgraph users may be initialized only after local ownership validation.
 * File preservation says nothing about whether the first authentication write committed. */
async function authenticatedReadiness(
  provider: GraphProvider,
  uri: string,
  credentials: GraphCredentials,
  allowOwnedBootstrap: boolean,
): Promise<void> {
  const { default: neo4j } = await import("neo4j-driver");
  const denied = (error: unknown) => /Security\.(?:Unauthorized|Unauthenticated|Forbidden)/
    .test(String((error as { code?: string }).code ?? ""));
  const run = async <T>(auth: ReturnType<typeof neo4j.auth.basic> | undefined,
    action: (session: ReturnType<ReturnType<typeof neo4j.driver>["session"]>) => Promise<T>) => {
    const driver = neo4j.driver(uri, auth, {
      connectionTimeout: 2000, connectionAcquisitionTimeout: 2000,
      maxTransactionRetryTime: 0, maxConnectionPoolSize: 2,
    });
    const session = driver.session();
    try { return await action(session); }
    finally { try { await session.close(); } finally { await driver.close(); } }
  };
  const end = Date.now() + 90000;
  while (true) {
    try {
      if (provider === "memgraph" && allowOwnedBootstrap) {
        try {
          await run(undefined, async (session) => {
            const users = await session.run("SHOW USERS");
            if (users.records.length === 0) {
              const literal = "'" + credentials.password.replace(/\\/g, "\\\\").replace(/'/g, "\\'") + "'";
              try { await session.run(`CREATE USER ${credentials.username} IDENTIFIED BY ${literal}`); }
              catch { fail("GRAPH_AUTH_BOOTSTRAP_OUTCOME_UNKNOWN"); }
            }
          });
        } catch (error) {
          // An authenticated existing user set is preserved; no reset or password change.
          if (!denied(error)) throw error;
        }
      }
      await run(neo4j.auth.basic(credentials.username, credentials.password),
        async (session) => { await session.run("RETURN 1 AS ready"); });
      break;
    } catch (error) {
      if (error instanceof GraphPlanError) throw error;
      if (denied(error)) fail("GRAPH_AUTHENTICATION_FAILED");
      if (Date.now() >= end) fail("GRAPH_READINESS_FAILED");
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  // Successful correct credentials alone do not prove that an empty Memgraph enforces auth.
  try {
    await run(neo4j.auth.basic(credentials.username, randomBytes(24).toString("base64url")),
      async (session) => { await session.run("RETURN 1 AS ready"); });
  } catch (error) {
    if (denied(error)) return;
    fail("GRAPH_AUTHENTICATION_CHECK_FAILED");
  }
  fail("GRAPH_AUTHENTICATION_UNENFORCED");
}
async function managedProbe(
  provider: GraphProvider,
  uri: string,
  credentials: GraphCredentials,
  initialize: boolean,
): Promise<void> {
  const sdk = await import("@cortexmemory/sdk");
  const adapter = new sdk.CypherGraphAdapter();
  try {
    await adapter.connect({ uri, ...credentials, connectionTimeout: 3000 });
    if (initialize) await sdk.initializeGraphSchema(adapter);
    await sdk.assertManagedGraphCompatibility(adapter);
  } catch {
    fail(
      "GRAPH_MANAGED_PROBE_FAILED: check credentials, then use explicit local setup or managed schema/rebuild preparation",
    );
  } finally {
    await adapter.disconnect();
  }
}
/** Read-only selected-project connection and private auth, shared with Task21. No ambient blending. */
export async function readSelectedGraphConfiguration(
  directory: string,
): Promise<{
  project: SelectedGraphProject;
  provider: GraphProvider;
  mode: "local" | "existing";
  uri: string;
  credentials: GraphCredentials;
  ownership?: GraphOwnership;
}> {
  const project = await selectedProject(directory);
  const local = await observeFiles(project);
  let provider: GraphProvider,
    mode: "local" | "existing",
    uri: string,
    ownership: GraphOwnership | undefined;
  if (local.ownership !== undefined) {
    const candidate = local.ownership as GraphOwnership;
    const plan = planGraphSetup(
      {
        graph: candidate.provider,
        graphMode: "local",
        graphUri: candidate.uri,
        boltPort: candidate.boltPort,
        httpPort: candidate.httpPort,
      },
      { project, ...local },
    );
    if (plan.mode !== "local") fail("GRAPH_CONFIGURATION_INVALID");
    ownership = plan.ownership;
    provider = ownership.provider;
    uri = ownership.uri;
    mode = "local";
  } else {
    const connection = (await jsonFile(
      await safeFile(project, connectionFile),
    )) as Connection;
    if (
      connection.version !== 1 ||
      connection.mode !== "existing" ||
      connection.projectId !== validateGraphProject(project) ||
      Object.keys(connection).sort().join() !==
        ["version", "projectId", "provider", "mode", "uri"].sort().join()
    )
      fail("GRAPH_CONFIGURATION_INVALID");
    const normalized = normalizeGraphOptions({
      graph: connection.provider,
      graphMode: "existing",
      graphUri: connection.uri,
    });
    if (normalized.provider === "none") fail("GRAPH_CONFIGURATION_INVALID");
    provider = normalized.provider;
    uri = normalized.uri;
    mode = "existing";
  }
  const privateMap = (await jsonFile(
    await safeFile(project, graphFiles.credentials),
    true,
  )) as Record<string, unknown>;
  const prefix = provider.toUpperCase();
  if (
    privateMap[`${prefix}_URI`] !== uri ||
    Object.keys(privateMap).sort().join() !==
      [`${prefix}_URI`, `${prefix}_USERNAME`, `${prefix}_PASSWORD`]
        .sort()
        .join()
  )
    fail("GRAPH_CONFIGURATION_INVALID");
  const credentials = credentialsFromMap(privateMap, provider);
  renderPrivateGraphEnvironment(provider, uri, credentials, mode);
  return { project, provider, mode, uri, credentials, ownership };
}
/** Private process environment for SDK/provider startup. The caller must never log this map. */
export async function readSelectedGraphEnvironment(
  directory: string,
): Promise<Record<string, string>> {
  const { provider, uri, credentials, mode } =
    await readSelectedGraphConfiguration(directory);
  const privateEnv = renderPrivateGraphEnvironment(
    provider,
    uri,
    credentials,
    mode,
  );
  return {
    ...(JSON.parse(privateEnv.bytes.toString()) as Record<string, string>),
    CORTEX_GRAPH_SYNC: "true",
    CORTEX_GRAPH_PROVIDER: provider,
  };
}
export async function setupGraph(
  directory: string,
  options: GraphServiceOptions = {},
): Promise<GraphSetupReceipt> {
  const inputs: GraphOptions = {
    graph: options.graph,
    skipGraph: options.skipGraph,
    graphMode: options.graphMode,
    graphUri: options.graphUri,
    boltPort: options.boltPort,
    httpPort: options.httpPort,
  };
  const normalized = normalizeGraphOptions(inputs);
  if (normalized.provider === "none")
    return {
      provider: "none",
      mode: "none",
      projectPath: path.resolve(directory),
      status: "disabled",
    };
  if (
    options.dryRun &&
    !(await fs
      .lstat(path.resolve(directory))
      .then(() => true)
      .catch((e: { code?: string }) => {
        if (e.code === "ENOENT") return false;
        throw e;
      }))
  ) {
    // New init destinations are planned by the installer without creating them.
    const parent = await selectedProject(path.dirname(path.resolve(directory)));
    const root = path.join(parent.root, path.basename(path.resolve(directory)));
    return {
      provider: normalized.provider,
      mode: normalized.mode,
      projectPath: root,
      uri: normalized.uri,
      status: "planned",
      dryRun: true,
    };
  }
  const project = await selectedProject(directory),
    observed = await observeFiles(project);
  const conflict = await selectedEnvConflicts(project);
  const base = {
    provider: normalized.provider,
    mode: normalized.mode,
    projectPath: project.root,
    uri: normalized.uri,
  } as const;
  if (normalized.mode === "existing") {
    if (observed.ownership !== undefined || observed.files.compose)
      fail("GRAPH_USER_FILES_CONFLICT");
    const stored = await fs
      .lstat(await safeFile(project, connectionFile))
      .catch((e: { code?: string }) => {
        if (e.code === "ENOENT") return undefined;
        throw e;
      });
    const selected = stored
      ? await readSelectedGraphConfiguration(directory)
      : undefined;
    if (
      selected &&
      (selected.provider !== normalized.provider ||
        selected.uri !== normalized.uri)
    )
      fail("GRAPH_OWNERSHIP_CONFLICT");
    if (!stored && observed.files.credentials)
      fail("GRAPH_USER_FILES_CONFLICT");
    const credentials =
      selected?.credentials ??
      (await newCredentials(options, normalized.provider, "existing"));
    planGraphSetup(inputs, { project, unownedEnvKeys: conflict });
    if (options.dryRun) return { ...base, status: "planned", dryRun: true };
    renderPrivateGraphEnvironment(
      normalized.provider,
      normalized.uri,
      credentials,
      "existing",
    );
    await authenticatedReadiness(
      normalized.provider,
      normalized.uri,
      credentials,
      false,
    );
    await managedProbe(normalized.provider, normalized.uri, credentials, false);
    if (!stored) {
      if (observed.files.credentials) fail("GRAPH_USER_FILES_CONFLICT");
      const privateEnv = renderPrivateGraphEnvironment(
        normalized.provider,
        normalized.uri,
        credentials,
        "existing",
      );
      await fs.mkdir(
        path.dirname(await safeFile(project, graphFiles.credentials)),
        { recursive: true, mode: 0o700 },
      );
      await fs.writeFile(
        await safeFile(project, graphFiles.credentials),
        privateEnv.bytes,
        { flag: "wx", mode: 0o600 },
      );
      await fs.writeFile(
        await safeFile(project, connectionFile),
        graphJson({
          version: 1,
          projectId: validateGraphProject(project),
          provider: normalized.provider,
          mode: "existing",
          uri: normalized.uri,
        }),
        { flag: "wx", mode: 0o644 },
      );
    }
    return {
      ...base,
      ...sdkConfigurationReceipt(),
      status: "ready",
      authentication: "verified",
      managedSchema: "verified",
    };
  }
  if (
    await fs
      .lstat(await safeFile(project, connectionFile))
      .then(() => true)
      .catch((e: { code?: string }) => {
        if (e.code === "ENOENT") return false;
        throw e;
      })
  )
    fail("GRAPH_USER_FILES_CONFLICT");
  const draft = planGraphSetup(inputs, {
    project,
    ...observed,
    unownedEnvKeys: conflict,
  });
  if (draft.mode !== "local") fail("GRAPH_CONFIGURATION_INVALID");
  if (options.dryRun)
    return {
      ...base,
      image: draft.ownership.image,
      projectId: draft.ownership.projectId,
      status: "planned",
      dryRun: true,
    };
  await runtime(project);
  const before = await resources(project, draft.ownership);
  const busyPorts: number[] = [];
  for (const port of [
    normalized.boltPort,
    ...(normalized.httpPort === undefined ? [] : [normalized.httpPort]),
  ])
    if (await busy(port)) busyPorts.push(port);
  const plan = planGraphSetup(inputs, {
    project,
    ...observed,
    unownedEnvKeys: conflict,
    resources: before.observations,
    busyPorts,
    ownedPorts: before.running ? before.ownedPorts : [],
  });
  if (plan.mode !== "local") fail("GRAPH_CONFIGURATION_INVALID");
  const credentials = plan.preserveCredentials
    ? (await readSelectedGraphConfiguration(directory)).credentials
    : await newCredentials(options, normalized.provider, "local");
  const privateEnv = renderPrivateGraphEnvironment(
    normalized.provider,
    normalized.uri,
    credentials,
    "local",
  );
  const environment = JSON.parse(privateEnv.bytes.toString()) as Record<
    string,
    string
  >;
  if (!plan.preserveCredentials) {
    await fs.mkdir(path.dirname(await safeFile(project, graphFiles.compose)), {
      recursive: true,
      mode: 0o700,
    });
    await fs.writeFile(
      await safeFile(project, graphFiles.credentials),
      privateEnv.bytes,
      { flag: "wx", mode: 0o600 },
    );
    await fs.writeFile(
      await safeFile(project, graphFiles.compose),
      plan.compose.bytes,
      { flag: "wx", mode: 0o644 },
    );
    await fs.writeFile(
      await safeFile(project, graphFiles.ownership),
      graphJson(plan.ownership),
      { flag: "wx", mode: 0o644 },
    );
  }
  const compose = [
    "compose",
    "--env-file",
    os.devNull,
    "--project-directory",
    project.root,
    "-p",
    plan.ownership.composeProject,
    "-f",
    await safeFile(project, graphFiles.compose),
  ];
  try {
    await docker(
      [...compose, "up", "-d", "--wait", "--wait-timeout", "90"],
      project,
      environment,
    );
    const actual = await resources(project, plan.ownership);
    await authenticatedReadiness(
      normalized.provider,
      normalized.uri,
      credentials,
      normalized.provider === "memgraph",
    );
    await managedProbe(normalized.provider, normalized.uri, credentials, true);
    return {
      ...base,
      ...sdkConfigurationReceipt(),
      image: plan.ownership.image,
      projectId: plan.ownership.projectId,
      status: "ready",
      authentication: "verified",
      managedSchema: "verified",
      containerId: actual.containerId,
      preserveVolume: true,
    };
  } catch (error) {
    if (!before.running) {
      const actual = await resources(project, plan.ownership);
      if (actual.containerId && actual.running)
        await docker(["stop", "--time", "20", actual.containerId], project);
    }
    throw error;
  }
}
export async function graphLifecycle(
  directory: string,
  action: "start" | "stop" | "status",
  dryRun = false,
): Promise<GraphSetupReceipt> {
  const selected = await readSelectedGraphConfiguration(directory),
    { project, provider, mode, uri, credentials, ownership } = selected;
  if (mode === "existing") {
    if (action !== "status") fail("GRAPH_EXTERNAL_LIFECYCLE_REFUSED");
    if (!dryRun) {
      await authenticatedReadiness(provider, uri, credentials, false);
      await managedProbe(provider, uri, credentials, false);
    }
    return {
      projectPath: project.root,
      provider,
      mode,
      uri,
      status: dryRun ? "planned" : "ready",
      ...(dryRun
        ? { dryRun: true }
        : { authentication: "verified", managedSchema: "verified" }),
    };
  }
  if (!ownership) fail("GRAPH_CONFIGURATION_INVALID");
  if (dryRun)
    return {
      projectPath: project.root,
      provider,
      mode,
      uri,
      status: "planned",
      dryRun: true,
      image: ownership.image,
      projectId: ownership.projectId,
    };
  await runtime(project);
  const actual = await resources(project, ownership);
  if (action === "start")
    return setupGraph(directory, {
      graph: provider,
      graphMode: "local",
      graphUri: uri,
      boltPort: ownership.boltPort,
      httpPort: ownership.httpPort,
    });
  if (action === "stop" && actual.containerId && actual.running)
    await docker(["stop", "--time", "20", actual.containerId], project);
  const after =
    action === "stop" ? await resources(project, ownership) : actual;
  if (action === "status" && after.running) {
    await authenticatedReadiness(provider, uri, credentials, false);
    await managedProbe(provider, uri, credentials, false);
  }
  return {
    projectPath: project.root,
    provider,
    mode,
    uri,
    image: ownership.image,
    projectId: ownership.projectId,
    status: after.running ? "ready" : "stopped",
    containerId: after.containerId,
    preserveVolume: true,
    ...(after.running
      ? {
          authentication: "verified" as const,
          managedSchema: "verified" as const,
        }
      : {}),
  };
}
