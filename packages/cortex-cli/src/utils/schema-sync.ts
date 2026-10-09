/** Ownership-aware backend planning. No schema text is automatically merged. */
import fs from "node:fs";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { readRegularFileSync, UnsafeFileError } from "./safe-file.js";

import {
  appContractHash, isRecognizedAppContractHash, canonicalDependencies, isCanonicalTemplate, backendEntryNames, assertCanonicalSdkTree,
  SCHEMA_COMPOSER, isRecognizedSchemaComposerHash, TRANSFORM_CONTRACT_HASH, isRecognizedTransformContractHash, transformCanonicalSdk,
  type CanonicalTemplate,
} from "./template-backend.js";

export const BACKEND_MANIFEST = ".cortex/backend.json";
export const SDK_VERSION = "0.38.0";
// Reviewed current runtime admin helpers; registrations still require the strict grammar.
const SDK_ADMIN_RUNTIME_SOURCE_HASH = "8b2eb63eaf6ff4fc41cdb64085840ad70f49bf377f394afd194f7ab08d450345";
export interface BackendOwnership {
  format: 1;
  sdk: { name: "@cortexmemory/sdk"; version: string; sourceHash: string };
  functions: string;
  files: Record<string, string>;
}
export interface BackendPlan {
  projectPath: string;
  sdkPath: string;
  sdkView?: BackendSdkView;
  functions: string;
  files: Record<string, Buffer>;
  previous: Record<string, string | null>;
  additions: string[];
  updates: string[];
  conflicts: string[];
  ownership: BackendOwnership | ComposedBackendOwnership;
  /** App/config/shim dependencies are observed, never SDK-owned. */
  dependencies?: Record<string, string>;
  sourceBefore?: Record<string, string>;
  backendEntriesBefore?: string[];
  manifestBefore: string | null;
  /** Exact configuration existence/bytes from the first preflight. */
  configBefore: string | null;
}
export interface SchemaSyncResult {
  synced: boolean;
  filesUpdated: string[];
  filesAdded: string[];
  sdkVersion: string;
  sdkConvexPath: string;
  projectConvexPath: string;
  error?: string;
  isDevOverride?: boolean;
  conflicts?: string[];
  backupPath?: string;
}
export function hashBytes(bytes: Buffer | string): string {
  return createHash("sha256").update(bytes).digest("hex");
}
/** Reject symlinks, non-directories and traversal before touching a project path. */
export function assertSafePath(root: string, relative: string): string {
  if (
    !relative ||
    relative.includes("\\") ||
    path.isAbsolute(relative) ||
    relative.split(/[\\/]/).some((part) => part === ".." || part === ".")
  )
    throw new Error(`Unsafe project path: ${relative}`);
  const destination = path.resolve(root, relative);
  if (!destination.startsWith(`${path.resolve(root)}${path.sep}`))
    throw new Error("Path escapes project");
  let current = path.resolve(root);
  for (const part of relative.split(/[\\/]/).filter(Boolean)) {
    current = path.join(current, part);
    if (fs.existsSync(current) || isSymlink(current)) {
      const stat = fs.lstatSync(current);
      if (stat.isSymbolicLink())
        throw new Error(`Symlink boundary refused: ${relative}`);
      if (current !== destination && !stat.isDirectory())
        throw new Error(`Not a directory: ${relative}`);
    }
  }
  return destination;
}
function isSymlink(file: string): boolean {
  try {
    return fs.lstatSync(file).isSymbolicLink();
  } catch {
    return false;
  }
}
export function resolveProjectDirectory(directory: string): string {
  const target = path.resolve(directory);
  let current = path.parse(target).root;
  for (const part of target.split(path.sep).filter(Boolean)) {
    current = path.join(current, part);
    if (isSymlink(current) && !["/tmp", "/var"].includes(current))
      throw new Error("Symlink project boundary refused");
    if (fs.existsSync(current) && !fs.statSync(current).isDirectory())
      throw new Error("Project destination is not a directory");
  }
  if ([path.parse(target).root, process.env.HOME].includes(target))
    throw new Error("Refusing filesystem root or home as project");
  return target;
}
export function discoverBackendFiles(sdkPath: string): Record<string, Buffer> {
  const root = path.join(sdkPath, "convex-dev");
  if (fs.lstatSync(root).isSymbolicLink())
    throw new Error("SDK backend symlink refused");
  const files: Record<string, Buffer> = {};
  const walk = (relative: string): void => {
    for (const entry of fs
      .readdirSync(path.join(root, relative), { withFileTypes: true })
      .sort((a, b) => a.name.localeCompare(b.name))) {
      if (entry.name === "_generated") continue;
      const name = relative ? `${relative}/${entry.name}` : entry.name;
      if (entry.isSymbolicLink())
        throw new Error(`SDK backend symlink refused: ${name}`);
      if (entry.isDirectory()) walk(name);
      else if (
        entry.isFile() &&
        (entry.name.endsWith(".ts") || entry.name === "tsconfig.json")
      )
        files[name] = fs.readFileSync(path.join(root, name));
    }
  };
  walk("");
  if (!files["schema.ts"] || !files["admin.ts"])
    throw new Error("SDK backend schema/admin capability missing");
  return files;
}
interface AdminToken {
  value: string;
  kind: "identifier" | "string" | "punctuation";
}
/** A deliberately narrow lexer: inspect source text; never import or execute it. */
function adminTokens(source: string): AdminToken[] {
  const tokens: AdminToken[] = [];
  let offset = 0;
  while (offset < source.length) {
    const rest = source.slice(offset);
    if (/^\s/.test(rest)) {
      offset++;
      continue;
    }
    if (rest.startsWith("//")) {
      const end = source.indexOf("\n", offset + 2);
      offset = end < 0 ? source.length : end + 1;
      continue;
    }
    if (rest.startsWith("/*")) {
      const end = source.indexOf("*/", offset + 2);
      if (end < 0)
        throw new Error("Unsupported SDK admin source: unterminated comment");
      offset = end + 2;
      continue;
    }
    const quote = source[offset];
    if (quote === '"' || quote === "'") {
      const start = offset++;
      while (offset < source.length && source[offset] !== quote) {
        if (source[offset] === "\\") offset += 2;
        else if (source[offset] === "\n" || source[offset] === "\r")
          throw new Error("Unsupported SDK admin source string");
        else offset++;
      }
      if (source[offset] !== quote)
        throw new Error("Unsupported SDK admin source: unterminated string");
      offset++;
      tokens.push({ value: source.slice(start, offset), kind: "string" });
      continue;
    }
    const identifier = /^[A-Za-z_$][A-Za-z0-9_$]*/.exec(rest)?.[0];
    if (identifier) {
      tokens.push({ value: identifier, kind: "identifier" });
      offset += identifier.length;
      continue;
    }
    const number = /^\d+(?:\.\d+)?/.exec(rest)?.[0];
    if (number) {
      tokens.push({ value: number, kind: "punctuation" });
      offset += number.length;
      continue;
    }
    if (!"{}()[];,.:=?!+-*<>&|%".includes(quote))
      throw new Error("Unsupported SDK admin source syntax");
    tokens.push({ value: quote, kind: "punctuation" });
    offset++;
  }
  return tokens;
}
/** Accept only canonical unaliased factory imports and direct registrations. */
function validateAdminRegistrations(source: string): void {
  const tokens = adminTokens(source);
  const registrations: Record<string, string> = {
    listTable: "internalQuery",
    deleteRecord: "internalMutation",
    clearTable: "internalMutation",
    countTable: "internalQuery",
    getAllCounts: "internalQuery",
  };
  const factories = new Set(["internalQuery", "internalMutation"]);
  const imports = new Set<string>();
  const found = new Set<string>();
  let offset = 0;
  const fail = (): never => {
    throw new Error(
      "SDK fixed internal-admin registration binding rejected: canonical unaliased imports and direct internal registrations required",
    );
  };
  const expect = (value: string): void => {
    if (tokens[offset++]?.value !== value) fail();
  };
  while (tokens[offset]?.value === "import") {
    expect("import");
    expect("{");
    const names: string[] = [];
    do {
      const name = tokens[offset++];
      if (name?.kind !== "identifier" || names.includes(name.value)) fail();
      names.push(name.value);
      if (tokens[offset]?.value !== ",") break;
      offset++;
      if (tokens[offset]?.value === "}") break;
    } while (offset < tokens.length);
    expect("}");
    expect("from");
    const module = tokens[offset++];
    if (module?.kind !== "string") fail();
    const origin = module.value.slice(1, -1);
    if (imports.has(origin)) fail();
    imports.add(origin);
    if (origin === "./_generated/server") {
      if (names.length !== 2 || names.some((name) => !factories.has(name)))
        fail();
    } else if (origin === "convex/values") {
      if (names.length !== 1 || names[0] !== "v") fail();
    } else if (origin === "./lib/referenceLifecycle") {
      // The reviewed Task23 admin writer adds this ordinary same-transaction hook.
      // This exception cannot approve another admin body or a caller-selected helper.
      if (
        names.length !== 1 ||
        names[0] !== "markDeletedRow" ||
        hashBytes(source) !==
          "e99cb954e5f805feb42e5f19e43f9b9eeb312263de1b3a3b42aba92f66b9ee6c"
      )
        fail();
    } else if (origin === "./runtimeWorkerAuth") {
      const approved = ["assertMaintenanceTable", "assertDeletionSupported", "boundedInteger", "deleteMaintenanceRecord", "maintenanceTable"];
      if (names.length !== approved.length || names.some((name, index) => name !== approved[index]) || hashBytes(source) !== SDK_ADMIN_RUNTIME_SOURCE_HASH) fail();
    } else fail();
    expect(";");
  }
  if (!imports.has("./_generated/server")) fail();
  while (offset < tokens.length) {
    expect("export");
    expect("const");
    const name = tokens[offset++];
    if (
      name?.kind !== "identifier" ||
      !Object.hasOwn(registrations, name.value) ||
      found.has(name.value)
    )
      fail();
    found.add(name.value);
    expect("=");
    expect(registrations[name.value]);
    expect("(");
    expect("{");
    const stack = ["}"];
    while (stack.length) {
      const token = tokens[offset++];
      if (!token) fail();
      // No aliasing, assignment, nested parameter/variable shadowing or dynamic imports.
      // Even property names matching a factory are conservatively unsupported.
      if (
        token.kind === "identifier" &&
        (factories.has(token.value) ||
          ["import", "export"].includes(token.value))
      )
        fail();
      if (token.kind !== "punctuation") continue;
      if (token.value === "{") stack.push("}");
      else if (token.value === "(") stack.push(")");
      else if (token.value === "[") stack.push("]");
      else if (
        ["}", ")", "]"].includes(token.value) &&
        stack.pop() !== token.value
      )
        fail();
    }
    expect(")");
    expect(";");
  }
  if (found.size !== Object.keys(registrations).length) fail();
}
export interface BackendSdkView {
  manifest:Buffer;
  files:Record<string,Buffer>;
  entries:string[];
  artifact?:{path:string;hash:string};
  distribution?:Record<string,Buffer>;
}
export function validateSdkPackage(sdkPath: string,view?:BackendSdkView): {
  name: "@cortexmemory/sdk";
  version: string;
  sourceHash: string;
} {
  const manifest = JSON.parse(
    view ? view.manifest.toString("utf8") : fs.readFileSync(path.join(sdkPath, "package.json"), "utf8"),
  );
  if (manifest.name !== "@cortexmemory/sdk" || manifest.version !== SDK_VERSION)
    throw new Error(
      `Use a fixed @cortexmemory/sdk@${SDK_VERSION} candidate; package identity/version rejected`,
    );
  const files = view?.files ?? discoverBackendFiles(sdkPath);
  if(!files["schema.ts"] || !files["admin.ts"])throw new Error("SDK backend schema/admin capability missing");
  const distribution = view?.distribution ?? (() => {
    const file = path.join(sdkPath, "dist/backend/v1/manifest.json");
    if (!fs.existsSync(file)) return undefined;
    const manifest = JSON.parse(readRegularFileSync(file, { maxBytes: 1048576 }).bytes.toString("utf8"));
    return Object.fromEntries(["manifest.json", ...manifest.files.map((entry: {path:string}) => entry.path)].map(name => {
      const target = assertSafePath(sdkPath, `dist/backend/v1/${name}`);
      return [name, readRegularFileSync(target, { maxBytes: 8388608 }).bytes];
    }));
  })();
  if (distribution) {
    const manifest = JSON.parse(distribution["manifest.json"].toString("utf8"));
    if (manifest.formatVersion !== 1 || manifest.sdkVersion !== SDK_VERSION || !Array.isArray(manifest.files) || !manifest.files.length) throw new Error("Invalid current backend distribution");
    const paths = new Set<string>();
    for (const entry of manifest.files) {
      assertSafePath(sdkPath, `dist/backend/v1/${entry.path}`);
      if (paths.has(entry.path) || !distribution[entry.path] || hashBytes(distribution[entry.path]) !== entry.sha256) throw new Error("Current backend distribution digest mismatch");
      paths.add(entry.path);
    }
  } else validateAdminRegistrations(files["admin.ts"].toString("utf8"));
  return {
    name: "@cortexmemory/sdk",
    version: manifest.version,
    sourceHash: hashBytes(
      Object.entries(files)
        .map(([file, bytes]) => `${file}:${hashBytes(bytes)}`)
        .join("\n"),
    ),
  };
}
export function getFunctionsDirectory(project: string, prospective?: ProspectiveBackendFiles): string {
  const bytes = readBackendProjectFile(project, "convex.json", prospective);
  if (bytes === null) return "convex";
  const config = JSON.parse(bytes.toString("utf8"));
  const functions = config.functions ?? "convex";
  if (typeof functions !== "string")
    throw new Error("convex.json.functions must be a relative directory");
  const clean = functions.replace(/\/$/, "").replace(/^\.\//, "");
  if (
    ["node_modules", ".convex", ".cortex", "_generated"].some((name) =>
      clean.split(/[\\/]/).includes(name),
    )
  )
    throw new Error("Reserved functions directory refused");
  assertSafePath(project, clean);
  return clean;
}
function currentHash(file: string): string | null {
  const bytes = regularProjectBytes(file, file);
  return bytes === null ? null : hashBytes(bytes);
}
function regularProjectBytes(file: string, label: string): Buffer | null {
  try { return readRegularFileSync(file).bytes; }
  catch (error) {
    if ((error as { code?: string }).code === "ENOENT") return null;
    if (error instanceof UnsafeFileError) throw new Error(`Expected regular file: ${label}`, { cause: error });
    throw error;
  }
}
/** An explicit prospective overlay is data only; absent keys retain observed project bytes. */
export type ProspectiveBackendFiles = ReadonlyMap<string, Buffer | null>;
export function readBackendProjectFile(project:string, relative:string, prospective?:ProspectiveBackendFiles):Buffer|null {
  const file=assertSafePath(project,relative);
  if(prospective?.has(relative)){const bytes=prospective.get(relative);return bytes===null || bytes===undefined ? null : Buffer.from(bytes);}
  return regularProjectBytes(file, relative);
}
function projectHash(project:string,relative:string,prospective?:ProspectiveBackendFiles):string|null {
  const bytes=readBackendProjectFile(project,relative,prospective);return bytes===null ? null : hashBytes(bytes);
}
/** Reusable file planner for init, install, sync and future recognized-template composition. */
export function planBackendSync(
  projectPath: string,
  sdkPath: string,
  preparation?: { template?: CanonicalTemplate; prospectiveFiles?: ProspectiveBackendFiles; sdkView?:BackendSdkView },
): BackendPlan {
  const project = resolveProjectDirectory(projectPath);
  const sdk = validateSdkPackage(sdkPath,preparation?.sdkView);
  const view=preparation?.prospectiveFiles;
  for(const [name,bytes] of view ?? []){assertSafePath(project,name);if(bytes!==null && !Buffer.isBuffer(bytes))throw new Error("Invalid prospective backend bytes");}
  const configBefore = projectHash(project, "convex.json", view);
  const functions = getFunctionsDirectory(project, view);
  const manifestBefore = projectHash(project, BACKEND_MANIFEST, view);
  const decoded: unknown = manifestBefore === null ? undefined : JSON.parse(readBackendProjectFile(project,BACKEND_MANIFEST,view)!.toString("utf8"));
  if (preparation?.template || (isObject(decoded) && decoded.format === 2)) {
    return planComposedBackend(project, sdkPath, sdk, functions, configBefore, manifestBefore, decoded, preparation);
  }
  let previousOwnership: BackendOwnership | undefined;
  if (manifestBefore !== null) {
    previousOwnership = JSON.parse(readBackendProjectFile(project,BACKEND_MANIFEST,view)!.toString("utf8"));
    if (
      previousOwnership?.format !== 1 ||
      previousOwnership.sdk?.name !== sdk.name ||
      previousOwnership.functions !== functions ||
      !previousOwnership.files ||
      Object.values(previousOwnership.files).some(
        (hash) => typeof hash !== "string" || !/^[a-f0-9]{64}$/.test(hash),
      )
    )
      throw new Error("Invalid or incompatible backend ownership manifest");
    for (const name of Object.keys(previousOwnership.files))
      assertSafePath(project, `${functions}/${name}`);
  }
  const files = preparation?.sdkView?.files ?? discoverBackendFiles(sdkPath);
  const previous: BackendPlan["previous"] = {};
  const additions: string[] = [],
    updates: string[] = [],
    conflicts: string[] = [];
  const hashes: Record<string, string> = {};
  for (const [name, bytes] of Object.entries(files)) {
    previous[name] = projectHash(project, `${functions}/${name}`, view);
    hashes[name] = hashBytes(bytes);
    if (previous[name] === null) {
      additions.push(name);
      if (previousOwnership?.files[name]) conflicts.push(name);
    } else if (previous[name] !== hashes[name]) {
      updates.push(name);
      if (previousOwnership?.files[name] !== previous[name])
        conflicts.push(name);
    }
  }
  // Never delete obsolete or generated files. Keep ownership so later conflicts remain visible.
  const ownership: BackendOwnership = {
    format: 1,
    sdk,
    functions,
    files: { ...previousOwnership?.files, ...hashes },
  };
  return {
    projectPath: project,
    sdkPath,
    sdkView:preparation?.sdkView,
    functions,
    files,
    previous,
    additions,
    updates,
    conflicts,
    ownership,
    manifestBefore,
    configBefore,
  };
}
type SourceEntry = { target: string; sourceHash: string; outputHash: string; role: "unchanged" | "registration-import-v1" | "schema" } | { disposition: "preserve-app-config"; sourceHash: string };
interface RetiredEntry {
  sdk: BackendOwnership["sdk"];
  target: string;
  sourceHash: string;
  outputHash: string;
  disposition: "preserve-owned-no-delete";
}
export interface ComposedBackendOwnership {
  format: 2;
  sdk: BackendOwnership["sdk"];
  functions: string;
  layout: {
    kind: "canonical-template-composition"; version: 1; template: CanonicalTemplate;
    sdkSchema: "cortex.schema.ts"; appSchema: "app.schema.ts"; composer: "schema.ts"; composerVersion: 1;
    shim: "sdk.registration.ts"; registrationMode: "next-private-v1"; transformVersion: 1;
    contractHash: string; appContractHash: string; configDisposition: "preserve-app-config" | "copy-sdk-config";
  };
  sources: Record<string, SourceEntry>;
  files: Record<string, string>;
  outputHash: string;
  retired: Record<string, RetiredEntry>;
}
function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function exactKeys(value: Record<string, unknown>, keys: string[]): boolean {
  return JSON.stringify(Object.keys(value).sort()) === JSON.stringify(keys.sort());
}
function digest(value: unknown): value is string { return typeof value === "string" && /^[a-f0-9]{64}$/.test(value); }
function ledgerHash(files: Record<string, string>): string {
  return hashBytes(Object.keys(files).sort((a, b) => a.localeCompare(b)).map(name => `${name}:${files[name]}`).join("\n"));
}
function validateIdentity(value: unknown): asserts value is BackendOwnership["sdk"] {
  if (!isObject(value) || !exactKeys(value, ["name", "version", "sourceHash"]) || value.name !== "@cortexmemory/sdk" || typeof value.version !== "string" || !/^\d+\.\d+\.\d+$/.test(value.version) || !digest(value.sourceHash)) throw new Error("Invalid recorded SDK identity");
}
function validateSourceName(project: string, functions: string, name: string): void {
  assertSafePath(project, `${functions}/${name}`);
  if (name.split("/").includes("_generated") || !(name.endsWith(".ts") || name === "tsconfig.json") || ["schema.ts", "app.schema.ts", "sdk.registration.ts", "cortex.schema.ts"].includes(name) && name !== "schema.ts") throw new Error("Invalid SDK source ownership path");
}
function validateComposedOwnership(value: unknown, project: string, functions: string): asserts value is ComposedBackendOwnership {
  function fail(): never { throw new Error("Invalid or incompatible format2 backend ownership manifest"); }
  if (!isObject(value) || !exactKeys(value, ["format", "sdk", "functions", "layout", "sources", "files", "outputHash", "retired"]) || value.format !== 2 || value.functions !== functions) fail();
  validateIdentity(value.sdk);
  const layout = value.layout;
  if (!isObject(layout) || !exactKeys(layout, ["kind", "version", "template", "sdkSchema", "appSchema", "composer", "composerVersion", "shim", "registrationMode", "transformVersion", "contractHash", "appContractHash", "configDisposition"]) || !isCanonicalTemplate(layout.template) || layout.kind !== "canonical-template-composition" || layout.version !== 1 || layout.sdkSchema !== "cortex.schema.ts" || layout.appSchema !== "app.schema.ts" || layout.composer !== "schema.ts" || layout.composerVersion !== 1 || layout.shim !== "sdk.registration.ts" || layout.registrationMode !== "next-private-v1" || layout.transformVersion !== 1 || !isRecognizedTransformContractHash(layout.contractHash) || !isRecognizedAppContractHash(layout.template, layout.appContractHash) || !["preserve-app-config", "copy-sdk-config"].includes(String(layout.configDisposition))) fail();
  if (!isObject(value.sources) || !isObject(value.files) || !isObject(value.retired) || !digest(value.outputHash)) fail();
  const raw: Record<string, string> = {}, targets = new Set<string>();
  for (const [name, source] of Object.entries(value.sources)) {
    validateSourceName(project, functions, name);
    if (!isObject(source) || !digest(source.sourceHash)) fail();
    raw[name] = source.sourceHash;
    if (source.disposition === "preserve-app-config") {
      if (!exactKeys(source, ["disposition", "sourceHash"]) || name !== "tsconfig.json" || layout.configDisposition !== "preserve-app-config") fail();
      continue;
    }
    const target = name === "schema.ts" ? "cortex.schema.ts" : name;
    if (!exactKeys(source, ["target", "sourceHash", "outputHash", "role"]) || source.target !== target || !digest(source.outputHash) || !["unchanged", "registration-import-v1", "schema"].includes(String(source.role)) || (name === "schema.ts") !== (source.role === "schema") || source.role !== "registration-import-v1" && source.outputHash !== source.sourceHash || targets.has(target) || value.files[target] !== source.outputHash) fail();
    targets.add(target);
  }
  if (!raw["schema.ts"] || !raw["admin.ts"] || ledgerHash(raw) !== value.sdk.sourceHash) fail();
  for (const [name, entry] of Object.entries(value.retired)) {
    validateSourceName(project, functions, name);
    if (Object.hasOwn(raw, name) || !isObject(entry) || !exactKeys(entry, ["sdk", "target", "sourceHash", "outputHash", "disposition"])) fail();
    validateIdentity(entry.sdk);
    const target = name === "schema.ts" ? "cortex.schema.ts" : name;
    if (entry.target !== target || !digest(entry.sourceHash) || !digest(entry.outputHash) || entry.disposition !== "preserve-owned-no-delete" || targets.has(target) || value.files[target] !== entry.outputHash) fail();
    targets.add(target);
  }
  if (!isRecognizedSchemaComposerHash(value.files["schema.ts"])) fail();
  targets.add("schema.ts");
  if (Object.keys(value.files).length !== targets.size || Object.entries(value.files).some(([name, hash]) => !targets.has(name) || !digest(hash)) || ledgerHash(value.files as Record<string, string>) !== value.outputHash) fail();
}
function planComposedBackend(project: string, sdkPath: string, sdk: BackendOwnership["sdk"], functions: string, configBefore: string | null, manifestBefore: string | null, decoded: unknown, preparation?: { template?: CanonicalTemplate; prospectiveFiles?:ProspectiveBackendFiles; sdkView?:BackendSdkView }): BackendPlan {
  const view=preparation?.prospectiveFiles;
  let previous: ComposedBackendOwnership | undefined;
  let legacy: BackendOwnership | undefined;
  if (decoded !== undefined) {
    if (isObject(decoded) && decoded.format === 1 && preparation?.template) {
      // Conversion is explicit, never inferred. Known legacy Vercel data must be recreated.
      if (preparation.template === "vercel-ai-quickstart") throw new Error("Legacy Vercel fixture requires private-auth retirement/recreation");
      if (!exactKeys(decoded, ["format", "sdk", "functions", "files"]) || decoded.functions !== functions || !isObject(decoded.files)) throw new Error("Invalid legacy backend ownership");
      validateIdentity(decoded.sdk);
      for (const [name, hash] of Object.entries(decoded.files)) {
        validateSourceName(project, functions, name);
        if (!digest(hash) || projectHash(project, `${functions}/${name}`,view) !== hash) throw new Error("Dirty legacy backend ownership refused");
      }
      legacy = decoded as unknown as BackendOwnership;
    } else {
      validateComposedOwnership(decoded, project, functions);
      previous = decoded;
    }
  }
  const template = previous?.layout.template ?? preparation?.template;
  if (!isCanonicalTemplate(template) || preparation?.template && template !== preparation.template) throw new Error("Recognized canonical preparation required");
  if (!previous && template === "vercel-ai-quickstart" && fs.existsSync(assertSafePath(project, ".convex"))) throw new Error("Legacy or uncertain Vercel fixture refused before writes");
  assertCanonicalSdkTree(sdkPath,preparation?.sdkView?.entries);
  const raw = preparation?.sdkView?.files ?? discoverBackendFiles(sdkPath), transformed = transformCanonicalSdk(raw);
  const dependencies = canonicalDependencies(project, functions, template, !previous,view);
  const preserveConfig = previous ? previous.layout.configDisposition === "preserve-app-config" : Object.hasOwn(dependencies, "tsconfig.json");
  const sources: ComposedBackendOwnership["sources"] = {}, sourceBefore: Record<string, string> = {};
  for (const [name, bytes] of Object.entries(raw)) {
    const sourceHash = hashBytes(bytes); sourceBefore[name] = sourceHash;
    if (name === "tsconfig.json" && preserveConfig) {
      sources[name] = { disposition: "preserve-app-config", sourceHash }; delete transformed[name];
    } else {
      const target = name === "schema.ts" ? "cortex.schema.ts" : name;
      const outputHash = hashBytes(transformed[target]);
      sources[name] = { target, sourceHash, outputHash, role: name === "schema.ts" ? "schema" : sourceHash === outputHash ? "unchanged" : "registration-import-v1" };
    }
  }
  if (ledgerHash(sourceBefore) !== sdk.sourceHash) throw new Error("SDK source changed during discovery");
  transformed["schema.ts"] = Buffer.from(SCHEMA_COMPOSER);
  const retired: ComposedBackendOwnership["retired"] = { ...previous?.retired };
  for (const [name, entry] of Object.entries(previous?.sources ?? {})) {
    if (!Object.hasOwn(sources, name) && "target" in entry) retired[name] = { sdk: previous!.sdk, target: entry.target, sourceHash: entry.sourceHash, outputHash: entry.outputHash, disposition: "preserve-owned-no-delete" };
  }
  for (const name of Object.keys(sources)) delete retired[name];
  const before: BackendPlan["previous"] = {}, conflicts = new Set<string>(), additions: string[] = [], updates: string[] = [];
  const hashes: Record<string, string> = {};
  // Protect removed/missing/modified old outputs even when no new source targets them.
  for (const [name, hash] of Object.entries(previous?.files ?? {})) {
    before[name] = projectHash(project, `${functions}/${name}`,view);
    if (before[name] !== hash) conflicts.add(name);
  }
  for (const [name, bytes] of Object.entries(transformed)) {
    const hash = hashBytes(bytes); hashes[name] = hash;
    const current = projectHash(project, `${functions}/${name}`,view); before[name] = current;
    const oldHash = previous?.files[name] ?? legacy?.files[name];
    if (current === null) additions.push(name);
    else if (current !== hash) {
      updates.push(name);
      if (oldHash !== current) conflicts.add(name);
    } else if (!oldHash && name !== "schema.ts") conflicts.add(name);
  }
  for (const entry of Object.values(retired)) hashes[entry.target] = entry.outputHash;
  for(const name of backendEntryNames(project,functions,view)) {
    if(name.endsWith("/"))continue;
    if(name.endsWith(".ts") || name==="tsconfig.json") {
      if(Object.hasOwn(hashes,name) || Object.hasOwn(dependencies,name))continue;
      if(["auth.config.ts","crons.ts"].includes(name)) {
        const text=readBackendProjectFile(project,`${functions}/${name}`,view)!.toString("utf8");
        const approved=name==="auth.config.ts" ? "export default { providers: [] };\n" : "// app-owned cron sentinel\n";
        if(text!==approved)throw new Error(`Unreviewed callable configuration: ${name}`);
        dependencies[name]=hashBytes(text);
      }else throw new Error(`Unrecognized app/SDK module collision: ${name}`);
    }else if(/\.(?:js|mjs|cjs|tsx)$/.test(name))throw new Error(`Unsupported backend entry: ${name}`);
  }
  const ownership: ComposedBackendOwnership = {
    format: 2, sdk, functions,
    layout: { kind: "canonical-template-composition", version: 1, template, sdkSchema: "cortex.schema.ts", appSchema: "app.schema.ts", composer: "schema.ts", composerVersion: 1, shim: "sdk.registration.ts", registrationMode: "next-private-v1", transformVersion: 1, contractHash: TRANSFORM_CONTRACT_HASH, appContractHash: appContractHash(template), configDisposition: preserveConfig ? "preserve-app-config" : "copy-sdk-config" },
    sources, files: hashes, outputHash: ledgerHash(hashes), retired,
  };
  validateComposedOwnership(ownership, project, functions);
  return { projectPath: project, sdkPath, sdkView:preparation?.sdkView, functions, files: transformed, previous: before, additions, updates, conflicts: [...conflicts].sort(), ownership, manifestBefore, configBefore, dependencies, sourceBefore, backendEntriesBefore: backendEntryNames(project, functions,view) };
}
export function assertBackendPlanCurrent(plan: BackendPlan): void {
  const project = resolveProjectDirectory(plan.projectPath);
  if (
    currentHash(assertSafePath(project, "convex.json")) !== plan.configBefore ||
    getFunctionsDirectory(project) !== plan.functions
  )
    throw new Error("Convex configuration changed since preflight");
  if (
    currentHash(assertSafePath(plan.projectPath, BACKEND_MANIFEST)) !==
    plan.manifestBefore
  )
    throw new Error("Backend ownership changed since preflight");
  if (plan.backendEntriesBefore && JSON.stringify(backendEntryNames(project, plan.functions)) !== JSON.stringify(plan.backendEntriesBefore)) throw new Error("Backend entrypoint set changed since preflight");
  if(plan.sdkView?.artifact && hashBytes(fs.readFileSync(plan.sdkView.artifact.path))!==plan.sdkView.artifact.hash)throw new Error("SDK artifact changed since preflight");
  if (plan.sourceBefore) {
    assertCanonicalSdkTree(plan.sdkPath,plan.sdkView?.artifact ? plan.sdkView.entries : undefined);
    const current = plan.sdkView?.artifact ? plan.sdkView.files : discoverBackendFiles(plan.sdkPath);
    if (JSON.stringify(Object.keys(current).sort()) !== JSON.stringify(Object.keys(plan.sourceBefore).sort())) throw new Error("SDK source set changed since preflight");
    for (const [name, bytes] of Object.entries(current)) if (hashBytes(bytes) !== plan.sourceBefore[name]) throw new Error(`SDK source changed since preflight: ${name}`);
  }
  for (const [name, hash] of Object.entries(plan.dependencies ?? {})) {
    if (currentHash(assertSafePath(project, `${plan.functions}/${name}`)) !== hash) throw new Error(`App dependency changed since preflight: ${name}`);
  }
  for (const [name, hash] of Object.entries(plan.previous))
    if (
      currentHash(
        assertSafePath(plan.projectPath, `${plan.functions}/${name}`),
      ) !== hash
    )
      throw new Error(`Backend changed since preflight: ${name}`);
}
/** Second-pass validation followed by narrowly scoped transactional writes and recovery. */
export function applyBackendPlan(
  plan: BackendPlan,
  options: { overwrite?: boolean; dryRun?: boolean } = {},
): string | undefined {
  if (plan.conflicts.length && (plan.ownership.format === 2 || !options.overwrite))
    throw new Error(
      `Backend conflicts: ${plan.conflicts.join(", ")}. Preserve/resolve edits or use --overwrite with backup.`,
    );
  assertBackendPlanCurrent(plan);
  if (options.dryRun) return;
  const paths = [...plan.additions, ...plan.updates].map(
    (name) => `${plan.functions}/${name}`,
  );
  const configBytes = Buffer.from(
    JSON.stringify({ functions: `${plan.functions}/` }) + "\n",
  );
  if (plan.configBefore === null) paths.push("convex.json");
  const manifestBytes = Buffer.from(
    JSON.stringify(plan.ownership, null, 2) + "\n",
  );
  if (
    currentHash(assertSafePath(plan.projectPath, BACKEND_MANIFEST)) !==
    hashBytes(manifestBytes)
  )
    paths.push(BACKEND_MANIFEST);
  if (!paths.length) return;
  const backups = new Map<string, Buffer | null>();
  for (const name of paths) {
    const file = assertSafePath(plan.projectPath, name);
    backups.set(name, fs.existsSync(file) ? fs.readFileSync(file) : null);
  }
  // Recheck after reading recovery bytes, immediately before the first write.
  assertBackendPlanCurrent(plan);
  let backupPath: string | undefined;
  if (plan.conflicts.length) {
    backupPath = `.cortex/backups/${randomUUID()}`;
    for (const [name, bytes] of backups)
      if (bytes) {
        const file = assertSafePath(plan.projectPath, `${backupPath}/${name}`);
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(file, bytes, { mode: 0o600, flag: "wx" });
      }
  }
  const createdDirectories: string[] = [];
  try {
    for (const name of paths) {
      const file = assertSafePath(plan.projectPath, name);
      let parent = path.dirname(file);
      const missing: string[] = [];
      while (!fs.existsSync(parent)) {
        missing.unshift(parent);
        parent = path.dirname(parent);
      }
      for (const dir of missing) {
        fs.mkdirSync(dir);
        createdDirectories.push(dir);
      }
      const temp = `${file}.cortex-${randomUUID()}`;
      try {
        const bytes =
          name === "convex.json"
            ? configBytes
            : name === BACKEND_MANIFEST
              ? manifestBytes
              : plan.files[name.slice(plan.functions.length + 1)];
        fs.writeFileSync(temp, bytes, {
          mode: name === BACKEND_MANIFEST ? 0o600 : 0o644,
          flag: "wx",
        });
        fs.renameSync(temp, file);
      } finally {
        if (fs.existsSync(temp)) fs.unlinkSync(temp);
      }
    }
  } catch (error) {
    for (const [name, bytes] of backups) {
      const file = assertSafePath(plan.projectPath, name);
      if (bytes) fs.writeFileSync(file, bytes);
      else if (fs.existsSync(file)) fs.unlinkSync(file);
    }
    for (const dir of createdDirectories.reverse())
      if (fs.existsSync(dir) && !fs.readdirSync(dir).length) fs.rmdirSync(dir);
    throw error;
  }
  return backupPath;
}
export function findInstalledSdk(project: string): string {
  // Only the selected project; no environment override or ancestor SDK fallback.
  const sdk = path.join(project, "node_modules/@cortexmemory/sdk");
  if (!fs.existsSync(sdk))
    throw new Error(
      `@cortexmemory/sdk@${SDK_VERSION} missing; run cortex install --sdk-package <candidate> before release publication`,
    );
  return fs.realpathSync(sdk);
}
export async function syncConvexSchema(
  projectPath: string,
  options: {
    dryRun?: boolean;
    force?: boolean;
    overwrite?: boolean;
    quiet?: boolean;
  } = {},
): Promise<SchemaSyncResult> {
  const result: SchemaSyncResult = {
    synced: false,
    filesAdded: [],
    filesUpdated: [],
    sdkVersion: "unknown",
    sdkConvexPath: "",
    projectConvexPath: "",
  };
  try {
    const { planSelectedBackend, applySelectedBackendPlan } = await import("./runtime-backend.js");
    const plan = await planSelectedBackend(projectPath, findInstalledSdk(projectPath));
    Object.assign(result, {
      synced: Boolean(plan.additions.length || plan.updates.length),
      filesAdded: plan.additions,
      filesUpdated: plan.updates,
      sdkVersion: plan.ownership.sdk.version,
      sdkConvexPath: path.join(plan.sdkPath, "convex-dev"),
      projectConvexPath: path.join(plan.projectPath, plan.functions),
      conflicts: plan.conflicts,
    });
    if (options.force)
      throw new Error(
        "--force is retired; use explicit --overwrite with backup",
      );
    result.backupPath = await applySelectedBackendPlan(plan, options);
  } catch (error) {
    result.error =
      error instanceof Error ? error.message : "Schema sync failed";
  }
  return result;
}
export function printSyncResult(
  result: SchemaSyncResult,
  quiet?: boolean,
): void {
  if (quiet) return;
  if (result.error) console.error(`Schema sync failed: ${result.error}`);
  else
    console.error(
      `SDK ${result.sdkVersion}: ${result.filesAdded.length} additions, ${result.filesUpdated.length} updates`,
    );
}
export async function checkSchemaSync(projectPath: string): Promise<{
  needsSync: boolean;
  filesOutdated: string[];
  filesMissing: string[];
  sdkVersion: string;
  error?: string;
}> {
  const result = await syncConvexSchema(projectPath, { dryRun: true });
  return {
    needsSync: result.synced,
    filesOutdated: result.filesUpdated,
    filesMissing: result.filesAdded,
    sdkVersion: result.sdkVersion,
    error: result.error,
  };
}
