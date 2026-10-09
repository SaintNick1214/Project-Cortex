/** Nonexecuting bootstrap contract. Admission metadata describes eligibility, never runtime authority. */
import { AsyncLocalStorage } from "node:async_hooks";
import { constants } from "node:fs";
import { lstat, open, realpath, readdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { homedir } from "node:os";
import { dirname, isAbsolute, join, resolve } from "node:path";
import type { CLIConfig } from "../types.js";
import { composeDataConfig, validateConfigShape, validateDeploymentName } from "./config.js";
import { projectSearchDirectories } from "./project-discovery.js";

export const ADMISSION_VERSION = 1;
export const MAX_ADMISSION_BYTES = 8 * 1024 * 1024;
export interface CommandIntent {
  readonly path: readonly string[];
  readonly args: readonly unknown[];
  readonly options: Readonly<Record<string, unknown>>;
  readonly sources: Readonly<Record<string, string>>;
}
export interface AdmissionRecord {
  sessionId: string; ownerEpoch: string; proposedAlias: string; registeredAlias?: string;
  projectRealPath: string; configSourceIdentity: string; phase: string; everExposed: boolean; bindingDigest: string;
}
export interface AdmissionRegistry {
  version: 1; epoch: string; sessions: AdmissionRecord[];
}
export interface FileFingerprint { path: string; identity: string }
export interface DataSources {
  cwd: string; scope: string; userPath: string; sourcePath: string;
  user: Partial<CLIConfig>; project: Partial<CLIConfig>; overlay?: Partial<CLIConfig>;
  fingerprints: FileFingerprint[]; barriers: string[]; declarations: boolean;
}
export interface AdmissionContext {
  readonly mode: "ordinary-trusted" | "owned-data-only";
  readonly intent: CommandIntent;
  readonly cwd: string;
  readonly home: string;
  readonly data: DataSources;
  readonly registry: AdmissionRegistry;
  readonly selectedAlias?: string;
  readonly session?: AdmissionRecord;
}
const contexts = new WeakSet<AdmissionContext>();
const registryFingerprints = new WeakMap<AdmissionRegistry, FileFingerprint[]>();
const actionContext = new AsyncLocalStorage<AdmissionContext>();
const configContexts = new WeakMap<CLIConfig, AdmissionContext>();
export function currentAdmissionContext(): AdmissionContext | undefined { return actionContext.getStore(); }
export function contextForConfig(config: CLIConfig): AdmissionContext | undefined { return configContexts.get(config); }
export function attachAdmissionContext(config: CLIConfig, context: AdmissionContext): void { checkContext(context); configContexts.set(config, context); }
function checkContext(context: AdmissionContext): void {
  if (!contexts.has(context)) throw new Error("ADMISSION_CONTEXT_INVALID: obtain an internal admission context");
}
export function withAdmissionContext<T>(context: AdmissionContext, action: () => T): T {
  checkContext(context); return actionContext.run(context, action);
}
function missing(error: unknown): boolean { return Boolean(error && typeof error === "object" && "code" in error && error.code === "ENOENT"); }
function refusal(code: string): never { throw new Error(`${code}: use supported JSON configuration and inspect private restore metadata`); }
function hash(bytes: Buffer): string { return createHash("sha256").update(bytes).digest("hex"); }
/** Open without following symlinks, then validate and read that same descriptor. */
export async function readAdmissionFile(path: string, privateFile = false): Promise<{ bytes: Buffer; fingerprint: FileFingerprint } | undefined> {
  let handle;
  try { handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK); }
  catch (error) {
    if (missing(error)) return undefined;
    return refusal((error as { code?: string }).code === "ELOOP" ? "ADMISSION_SOURCE_UNSAFE" : "ADMISSION_SOURCE_UNREADABLE");
  }
  try {
    const before = await handle.stat(), started = before;
    if (!before.isFile() || before.size > MAX_ADMISSION_BYTES || !(before.mode & 0o444)) return refusal("ADMISSION_SOURCE_UNSAFE");
    if (privateFile && ((before.mode & 0o077) || (process.getuid && before.uid !== process.getuid()))) return refusal("ADMISSION_METADATA_PERMISSIONS");
    if ((await realpath(dirname(path))) !== dirname(path)) return refusal("ADMISSION_SOURCE_UNSAFE");
    const bytes = Buffer.alloc(started.size);
    let offset = 0;
    while (offset < bytes.length) {
      const { bytesRead } = await handle.read(bytes, offset, bytes.length - offset, offset);
      if (!bytesRead) return refusal("ADMISSION_SOURCE_CHANGED"); offset += bytesRead;
    }
    const tail = Buffer.alloc(1);
    if ((await handle.read(tail, 0, 1, offset)).bytesRead) return refusal("ADMISSION_SOURCE_CHANGED");
    // A second bounded positional read verifies byte stability independently of timestamps.
    // APFS may update ctime for metadata/xattrs without changing source bytes.
    const verified = Buffer.alloc(started.size);
    offset = 0;
    while (offset < verified.length) {
      const { bytesRead } = await handle.read(verified, offset, verified.length - offset, offset);
      if (!bytesRead) return refusal("ADMISSION_SOURCE_CHANGED"); offset += bytesRead;
    }
    const after = await handle.stat(); const current = await lstat(path);
    if (after.dev !== before.dev || after.ino !== before.ino || after.size !== before.size || after.mtimeMs !== before.mtimeMs || after.mode !== before.mode || after.uid !== before.uid || current.ino !== before.ino || current.dev !== before.dev || current.mode !== before.mode || current.uid !== before.uid || current.size !== before.size || current.mtimeMs !== before.mtimeMs || current.isSymbolicLink() || hash(bytes) !== hash(verified)) return refusal("ADMISSION_SOURCE_CHANGED");
    return { bytes, fingerprint: { path, identity: `${before.dev}:${before.ino}:${before.size}:${before.mtimeMs}:${before.mode}:${before.uid}:${hash(bytes)}` } };
  } finally { await handle.close(); }
}
function parse(bytes: Buffer): unknown {
  try { return JSON.parse(bytes.toString("utf8")); } catch { return refusal("ADMISSION_JSON_INVALID"); }
}
function object(value: unknown): value is Record<string, unknown> { return Boolean(value && typeof value === "object" && !Array.isArray(value)); }
function imports(value: unknown): boolean {
  return Boolean(object(value) && Object.entries(value).some(([key, child]) => key === "$import" || imports(child))) || (Array.isArray(value) && value.some(imports));
}
function hasOwned(value: unknown): boolean {
  return Boolean(object(value) && Object.entries(value).some(([key, child]) => key === "restoreRuntime" || (key === "kind" && child === "owned-restore") || hasOwned(child))) || (Array.isArray(value) && value.some(hasOwned));
}
export function refuseExecutableOwnedConfig(config: CLIConfig): void { if (hasOwned(config)) refusal("ADMISSION_EXECUTABLE_OWNED_UNSUPPORTED"); }
async function canonicalDirectory(path: string): Promise<string> {
  const canonical = await realpath(resolve(path));
  if (!(await lstat(canonical)).isDirectory()) return refusal("ADMISSION_PROJECT_INVALID"); return canonical;
}
/** Mirrors pinned cosmiconfig9 no-meta search order and empty/no-property skip semantics. */
export async function discoverDataSources(cwd: string, explicitProject?: string, home = homedir()): Promise<DataSources> {
  const canonicalCwd = await canonicalDirectory(cwd);
  const canonicalHome = await realpath(home).catch(error => {
    if (missing(error)) return resolve(home);
    throw error;
  });
  const fingerprints: FileFingerprint[] = []; const barriers: string[] = [];
  const userPath = join(resolve(home), ".cortexrc");
  async function read(path: string) {
    const result = await readAdmissionFile(path);
    fingerprints.push(result?.fingerprint ?? { path, identity: "absent" }); return result;
  }
  let user: Partial<CLIConfig> = {};
  try {
    const userFile = await read(userPath);
    if (userFile) { const raw = parse(userFile.bytes); validateConfigShape(raw); user = raw; if (imports(user)) barriers.push("User configuration import"); }
  } catch (error) {
    const reason = error instanceof Error && error.message.startsWith("ADMISSION_JSON_INVALID") ? "Malformed configuration syntax" : "unsafe or unreadable supported JSON source";
    throw new Error(`ADMISSION_USER_CONFIG_INVALID: Invalid user configuration; ${reason}`, { cause: error });
  }
  let declarations = hasOwned(user);
  async function project(directory: string) {
    let active: { path: string; config: Partial<CLIConfig> } | undefined; let blocked = false;
    // Meta-config factory is prohibited until ordinary-only proof. Inspect pinned actual order.
    let metaFound = false;
    for (const place of ["package.json", "package.yaml", ".config/config.json", ".config/config.yaml", ".config/config.yml", ".config/config.js", ".config/config.ts", ".config/config.cjs", ".config/config.mjs"]) {
      const file = await read(join(directory, place));
      if (!file || metaFound) continue;
      if (!place.endsWith(".json")) { barriers.push("active cosmiconfig meta source"); metaFound = true; continue; }
      const raw = parse(file.bytes);
      const meta = place === "package.json" ? (object(raw) ? raw.cosmiconfig : undefined) : raw;
      if (meta === undefined) continue;
      metaFound = true;
      if (!object(meta) || Object.keys(meta).length || imports(meta)) barriers.push("nondefault cosmiconfig meta configuration");
    }
    for (const place of ["cortex.config.json", "cortex.config.js", ".cortexrc", ".cortexrc.json", "package.json"]) {
      if (directory === canonicalHome && place === ".cortexrc") continue;
      const path = join(directory, place); const file = await read(path);
      if (!file) continue;
      if (place.endsWith(".js")) { if (!active && !blocked) { blocked = true; barriers.push("active executable Cortex configuration"); } continue; }
      if (!file.bytes.toString("utf8").trim()) continue;
      let raw: unknown;
      try { raw = JSON.parse(file.bytes.toString("utf8")); } catch {
        if (!active && !blocked) { blocked = true; barriers.push("active non-JSON Cortex configuration"); } continue;
      }
      const config = place === "package.json" ? (object(raw) ? raw.cortex : undefined) : raw;
      if (config === undefined || config === null) continue;
      declarations ||= hasOwned(config);
      if (!active && !blocked) {
        if (imports(config)) { blocked = true; barriers.push("Cortex configuration import"); continue; }
        validateConfigShape(config, true); active = { path, config };
      }
    }
    return { active, found: Boolean(active) || blocked || metaFound };
  }
  let nearest: { directory: string; active?: { path: string; config: Partial<CLIConfig> } } | undefined;
  for (const directory of projectSearchDirectories(canonicalCwd, canonicalHome)) {
    const result = await project(directory);
    if (result.found) { nearest = { directory, active: result.active }; break; }
  }
  const active = nearest?.active;
  const explicit = explicitProject ? await canonicalDirectory(explicitProject) : undefined;
  const overlay = explicit && explicit !== canonicalCwd ? (await project(explicit)).active : undefined;
  return { cwd: canonicalCwd, scope: explicit ?? nearest?.directory ?? canonicalCwd, userPath, sourcePath: overlay?.path ?? active?.path ?? userPath, user, project: active?.config ?? {}, ...(overlay ? { overlay: overlay.config } : {}), fingerprints, barriers, declarations };
}
export function admissionMetadataPaths(home: string): { root: string; registry: string; sessions: string } {
  const root = join(resolve(home), ".cortex", "restore"); return { root, registry: join(root, "admission-registry.json"), sessions: join(root, "sessions") };
}
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const phases = new Set(["creating", "private-paused", "modules-verified-empty", "source-audited", "uploading", "native-import-known", "native-completion-reconciled", "postexport-known", "audited-private", "release-intent", "native-running-confirmed", "ingress-open", "registered", "failed", "unknown", "in-progress", "stopped"]);
function record(value: unknown): asserts value is AdmissionRecord {
  const keys = ["sessionId", "ownerEpoch", "proposedAlias", "registeredAlias", "projectRealPath", "configSourceIdentity", "phase", "everExposed", "bindingDigest"];
  if (!object(value) || Object.keys(value).some(key => !keys.includes(key)) || typeof value.sessionId !== "string" || !uuid.test(value.sessionId) || typeof value.ownerEpoch !== "string" || !uuid.test(value.ownerEpoch) || typeof value.everExposed !== "boolean" || !phases.has(String(value.phase)) || !/^[a-f0-9]{64}$/.test(String(value.bindingDigest))) return refusal("ADMISSION_REGISTRY_INVALID");
  for (const field of ["projectRealPath", "configSourceIdentity"]) if (typeof value[field] !== "string" || !isAbsolute(value[field] as string) || resolve(value[field] as string) !== value[field]) return refusal("ADMISSION_REGISTRY_INVALID");
  if (typeof value.proposedAlias !== "string" || (value.registeredAlias !== undefined && typeof value.registeredAlias !== "string")) return refusal("ADMISSION_REGISTRY_INVALID");
  validateDeploymentName(value.proposedAlias); if (value.registeredAlias !== undefined) validateDeploymentName(value.registeredAlias as string);
  if ((value.phase === "registered" || value.registeredAlias !== undefined) && !value.everExposed) return refusal("ADMISSION_REGISTRY_INVALID");
}
async function privateDirectory(path: string): Promise<boolean> {
  try { const info = await lstat(path); if (!info.isDirectory() || info.isSymbolicLink() || (info.mode & 0o077) || (process.getuid && info.uid !== process.getuid()) || await realpath(path) !== path) return refusal("ADMISSION_METADATA_UNSAFE"); return true; }
  catch (error) { if (missing(error)) return false; throw error; }
}
/** Complete comparison against data-only summaries; runtime/credential records are never read. */
export async function readAdmissionRegistry(home: string): Promise<AdmissionRegistry> {
  const paths = admissionMetadataPaths(home);
  await privateDirectory(paths.root);
  const entries = await privateDirectory(paths.sessions) ? await readdir(paths.sessions, { withFileTypes: true }) : [];
  const file = await readAdmissionFile(paths.registry, true);
  if (!file) { if (entries.length) return refusal("ADMISSION_REGISTRY_INCOMPLETE"); const absent: AdmissionRegistry = { version: 1, epoch: "absent", sessions: [] }; registryFingerprints.set(absent, [{ path: paths.registry, identity: "absent" }]); return absent; }
  const fingerprints = [file.fingerprint];
  const raw = parse(file.bytes);
  if (!object(raw) || raw.version !== 1 || typeof raw.epoch !== "string" || !uuid.test(raw.epoch) || !Array.isArray(raw.sessions) || Object.keys(raw).some(key => !["version", "epoch", "sessions"].includes(key))) return refusal("ADMISSION_REGISTRY_INVALID");
  const ids = new Set<string>(); const aliases = new Set<string>();
  for (const entry of raw.sessions) {
    record(entry);
    if (ids.has(entry.sessionId) || aliases.has(entry.registeredAlias ?? entry.proposedAlias)) return refusal("ADMISSION_REGISTRY_INVALID");
    ids.add(entry.sessionId); aliases.add(entry.registeredAlias ?? entry.proposedAlias);
    if (await canonicalDirectory(entry.projectRealPath) !== entry.projectRealPath) return refusal("ADMISSION_REGISTRY_INVALID");
    const dir = join(paths.sessions, entry.sessionId); if (!await privateDirectory(dir)) return refusal("ADMISSION_REGISTRY_INCOMPLETE");
    const summary = await readAdmissionFile(join(dir, "admission.json"), true);
    if (!summary) return refusal("ADMISSION_REGISTRY_INCOMPLETE");
    fingerprints.push(summary.fingerprint);
    const decoded = parse(summary.bytes);
    if (!object(decoded) || decoded.version !== 1 || decoded.epoch !== raw.epoch || Object.keys(decoded).some(key => !["version", "epoch", "session"].includes(key))) return refusal("ADMISSION_REGISTRY_INVALID");
    record(decoded.session);
    if (JSON.stringify(Object.fromEntries(Object.entries(decoded.session).sort())) !== JSON.stringify(Object.fromEntries(Object.entries(entry).sort()))) return refusal("ADMISSION_REGISTRY_INCOMPLETE");
  }
  if (entries.length !== ids.size || entries.some(entry => !entry.isDirectory() || entry.isSymbolicLink() || !uuid.test(entry.name) || !ids.has(entry.name))) return refusal("ADMISSION_REGISTRY_INCOMPLETE");
  const complete = raw as unknown as AdmissionRegistry; registryFingerprints.set(complete, fingerprints); return complete;
}
export async function readScopedSelection(scope: string, home = homedir(), cwd = scope, compatibility?: { data: DataSources; explicit: boolean }): Promise<string | undefined> {
  const file = await readAdmissionFile(join(resolve(home), ".cortex-current"));
  if (!file) return undefined;
  const text = file.bytes.toString("utf8").trim();
  if (!text.startsWith("{")) { if (text) validateDeploymentName(text); return undefined; }
  const raw = parse(file.bytes);
  if (!object(raw) || raw.version !== 1 || !object(raw.selections)) return refusal("ADMISSION_SELECTION_INVALID");
  for (const [directory, name] of Object.entries(raw.selections)) { if (!isAbsolute(directory) || resolve(directory) !== directory || typeof name !== "string") return refusal("ADMISSION_SELECTION_INVALID"); validateDeploymentName(name); }
  if (Object.hasOwn(raw.selections, cwd)) {
    const name = raw.selections[cwd] as string;
    if (cwd !== scope && compatibility && !compatibility.explicit) {
      const { data } = compatibility;
      const before = data.user.deployments && Object.hasOwn(data.user.deployments, name) ? data.user.deployments[name] : undefined;
      const deployments = composeAdmissionConfig(data).deployments;
      const after = Object.hasOwn(deployments, name) ? deployments[name] : undefined;
      // The old cwd-only lookup used user configuration. A name alone cannot
      // prove that discovering an ancestor preserves its endpoint/credentials.
      if (data.barriers.length || !before || !after || ["url", "key", "deployment", "projectPath", "kind", "restoreRuntime"].some(field => JSON.stringify(before[field]) !== JSON.stringify(after[field])))
        throw new Error("ADMISSION_LEGACY_SELECTION_CHANGED: nearest project may change the directory-scoped target; choose explicit -d <name>, 'cortex use <name>' or 'cortex use --clear' before continuing");
    }
    return name;
  }
  return Object.hasOwn(raw.selections, scope) ? raw.selections[scope] as string : undefined;
}
export function composeAdmissionConfig(sources: DataSources): CLIConfig { return composeDataConfig(sources); }
const directIntent: CommandIntent = Object.freeze({ path: [], args: [], options: {}, sources: {} });
export function structuralProtected(intent: CommandIntent): boolean { return intent.path[0] === "snapshot" || intent.options.restoreBundle === true || intent.options.restoreSession !== undefined || intent.options.provenance !== undefined; }
export async function resolveAdmissionTarget(intent: CommandIntent, data: DataSources, registry: AdmissionRegistry, selection?: string): Promise<{ protected: boolean; selectedAlias?: string; session?: AdmissionRecord }> {
  const explicit = intent.options.deployment;
  if (explicit !== undefined && typeof explicit !== "string") return refusal("ADMISSION_TARGET_INVALID");
  const config = composeAdmissionConfig(data); const names = Object.keys(config.deployments);
  const selectedAlias = explicit as string | undefined ?? selection ?? (config.default || (names.length === 1 ? names[0] : undefined));
  const sessionId = intent.options.restoreSession ?? (intent.path[0] === "snapshot" && intent.path[1] !== "create" ? intent.args[0] : undefined);
  const session = sessionId === undefined ? undefined : registry.sessions.find(item => item.sessionId === sessionId);
  if (sessionId !== undefined && (typeof sessionId !== "string" || !uuid.test(sessionId) || !session)) return refusal("ADMISSION_SESSION_INVALID");
  const matchesAlias = (item: AdmissionRecord, alias: unknown) => typeof alias === "string" && (item.proposedAlias === alias || item.registeredAlias === alias);
  // Retained proposals are eligible through scope, inherited source/project or selected alias.
  // Lifecycle/readiness labels never grant runtime authority or remove this ambiguity barrier.
  const associated = (item: AdmissionRecord) => [data.cwd, data.scope].includes(item.projectRealPath)
    || [data.sourcePath, data.userPath].includes(item.configSourceIdentity);
  async function projectAssociated(item: AdmissionRecord): Promise<boolean> {
    const references = Object.values(config.deployments).flatMap(deployment => typeof deployment.projectPath === "string" ? [resolve(data.scope, deployment.projectPath)] : []);
    // Preflight the whole set before any canonical lookup: property order must never
    // cause an env-named reference to be inspected while eligibility is unresolved.
    if (references.some(reference => reference.split(/[\\/]/).some(component => component.toLowerCase().startsWith(".env"))))
      return refusal("ADMISSION_PROJECT_REFERENCE_ENV_FORBIDDEN");
    for (const reference of references) {
      if (reference === item.projectRealPath) return true;
      try { if (await realpath(reference) === item.projectRealPath) return true; }
      catch (error) { if (!missing(error) && !(object(error) && error.code === "ENOTDIR")) return refusal("ADMISSION_SOURCE_UNREADABLE"); }
    }
    return false;
  }
  const explicitJSONOrdinary = explicit !== undefined && !data.barriers.length && Object.hasOwn(config.deployments, explicit as string) && !hasOwned(config.deployments[explicit as string]);
  const explicitEligible = registry.sessions.filter(item => matchesAlias(item, explicit) && (associated(item) || !explicitJSONOrdinary));
  // Resolve project references only when required to decide an otherwise ordinary route.
  // A known protected route must never inspect irrelevant references (including env paths).
  if (explicitJSONOrdinary && !explicitEligible.length && !structuralProtected(intent) && !data.declarations) {
    for (const item of registry.sessions) if (matchesAlias(item, explicit) && await projectAssociated(item)) explicitEligible.push(item);
  }
  const explicitOrdinary = explicitJSONOrdinary && explicitEligible.length === 0;
  const eligible = explicitOrdinary ? [] : registry.sessions.filter(item => item.registeredAlias !== undefined || associated(item) || matchesAlias(item, selectedAlias));
  if (!explicitOrdinary && !eligible.length && !structuralProtected(intent) && !data.declarations) {
    for (const item of registry.sessions) if (await projectAssociated(item)) eligible.push(item);
  }
  const protectedRoute = structuralProtected(intent) || data.declarations || eligible.length > 0;
  if (protectedRoute && data.barriers.length) return refusal("ADMISSION_CONFIG_AMBIGUOUS");
  if (session && data.scope !== session.projectRealPath) return refusal("ADMISSION_SESSION_PROJECT_MISMATCH");
  if (session && data.sourcePath !== session.configSourceIdentity) return refusal("ADMISSION_SESSION_SOURCE_MISMATCH");
  for (const entry of registry.sessions) {
    if (entry.registeredAlias && [data.sourcePath, data.userPath].includes(entry.configSourceIdentity) && !hasOwned(config.deployments[entry.registeredAlias])) return refusal("ADMISSION_BINDING_INVALID");
  }
  for (const [name, deployment] of Object.entries(config.deployments)) {
    if (!hasOwned(deployment)) continue;
    const binding = deployment.restoreRuntime;
    if (!object(binding) || binding.version !== 1 || typeof binding.sessionId !== "string" || typeof binding.ownerEpoch !== "string" || typeof binding.bindingDigest !== "string") return refusal("ADMISSION_BINDING_INVALID");
    const entry = registry.sessions.find(item => item.sessionId === binding.sessionId);
    if (!entry || entry.registeredAlias !== name || entry.ownerEpoch !== binding.ownerEpoch || entry.bindingDigest !== binding.bindingDigest || !entry.everExposed || deployment.projectPath !== entry.projectRealPath || (entry.configSourceIdentity !== data.sourcePath && entry.configSourceIdentity !== data.userPath)) return refusal("ADMISSION_BINDING_INVALID");
  }
  if (protectedRoute && intent.options.envFile !== undefined) return refusal("ADMISSION_ENV_FILE_FORBIDDEN");
  if (protectedRoute && ["url", "key", "prod"].some(name => intent.sources[name] === "cli")) return refusal("ADMISSION_OVERRIDE_UNSUPPORTED");
  if (protectedRoute && selectedAlias && !Object.hasOwn(config.deployments, selectedAlias) && !session && !structuralProtected(intent)) return refusal("ADMISSION_TARGET_INVALID");
  return { protected: protectedRoute, selectedAlias, session };
}
export async function discoverAdmission(intent: CommandIntent = directIntent, cwd = process.cwd(), home = homedir()): Promise<AdmissionContext> {
  // Structural forbidden env is checked without stat/open even if metadata is corrupt.
  if (structuralProtected(intent) && intent.options.envFile !== undefined) return refusal("ADMISSION_ENV_FILE_FORBIDDEN");
  if (intent.options.restoreBundle === true && intent.sources.deployment !== "cli") return refusal("RESTORE_CAPTURE_ALIAS_REQUIRED");
  if (intent.options.restoreSession !== undefined && ["deployment", "url", "key", "prod", "local"].some(name => intent.sources[name] === "cli")) return refusal("ADMISSION_SESSION_SELECTOR_CONFLICT");
  const registry = await readAdmissionRegistry(home);
  const requestedSession = intent.options.restoreSession ?? (intent.path[0] === "snapshot" && intent.path[1] !== "create" ? intent.args[0] : undefined);
  const boundSession = registry.sessions.find(item => item.sessionId === requestedSession);
  const project = typeof intent.options.project === "string" ? intent.options.project : boundSession?.projectRealPath;
  const data = await discoverDataSources(cwd, project, home);
  if (data.sourcePath === data.userPath && ((intent.path[0] === "snapshot" && intent.path[1] === "create") || boundSession?.configSourceIdentity === join(data.scope, "cortex.config.json")))
    data.sourcePath = join(data.scope, "cortex.config.json");
  const explicitSelection = typeof intent.options.deployment === "string" || (intent.path[0] === "use" && (intent.args.length > 0 || intent.options.clear === true));
  const target = await resolveAdmissionTarget(intent, data, registry, await readScopedSelection(data.scope, home, data.cwd, { data, explicit: explicitSelection }));
  const context: AdmissionContext = Object.freeze({ mode: target.protected ? "owned-data-only" : "ordinary-trusted", intent, cwd: data.cwd, home: resolve(home), data, registry, selectedAlias: target.selectedAlias, session: target.session });
  contexts.add(context); return context;
}
export async function recheckAdmission(context: AdmissionContext): Promise<void> {
  checkContext(context);
  if (context.mode !== "owned-data-only") return;
  const fresh = await discoverAdmission(context.intent, context.cwd, context.home);
  const changed = fresh.mode !== context.mode ? "mode" : fresh.selectedAlias !== context.selectedAlias ? "selection"
    : JSON.stringify(registryFingerprints.get(fresh.registry)) !== JSON.stringify(registryFingerprints.get(context.registry)) ? "registry-source"
    : fresh.registry.epoch !== context.registry.epoch || JSON.stringify(fresh.registry) !== JSON.stringify(context.registry) ? "registry-records"
    : JSON.stringify(fresh.data.fingerprints) !== JSON.stringify(context.data.fingerprints) ? "configuration-source" : undefined;
  if (changed) {
    if (changed === "registry-source") {
      const before = registryFingerprints.get(context.registry) ?? [];
      const after = registryFingerprints.get(fresh.registry) ?? [];
      const index = after.findIndex((item, position) => JSON.stringify(item) !== JSON.stringify(before[position]));
      const fields = after[index]?.identity.split(":").map((part, field) => part !== before[index]?.identity.split(":")[field] ? field : -1).filter(field => field >= 0);
      return refusal(`ADMISSION_SOURCE_CHANGED (${changed}:${index}:${fields?.join(",")})`);
    }
    if (changed === "configuration-source") {
      const index = fresh.data.fingerprints.findIndex((item, position) => JSON.stringify(item) !== JSON.stringify(context.data.fingerprints[position]));
      return refusal(`ADMISSION_SOURCE_CHANGED (${changed}:${index})`);
    }
    return refusal(`ADMISSION_SOURCE_CHANGED (${changed})`);
  }
}
export async function refreshAdmissionAfterSave(context: AdmissionContext): Promise<void> {
  checkContext(context);
  const fresh = await discoverAdmission(context.intent, context.cwd, context.home);
  if (fresh.mode !== context.mode || JSON.stringify(fresh.registry) !== JSON.stringify(context.registry) || fresh.data.sourcePath !== context.data.sourcePath) return refusal("ADMISSION_SOURCE_CHANGED");
  context.data.fingerprints.splice(0, context.data.fingerprints.length, ...fresh.data.fingerprints);
  context.data.user = fresh.data.user; context.data.project = fresh.data.project; context.data.overlay = fresh.data.overlay;
}
