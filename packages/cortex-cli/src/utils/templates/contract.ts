import { createHash } from "node:crypto";

export class TemplateError extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = "TemplateError";
  }
}
export const hashBytes = (bytes: Uint8Array): string =>
  createHash("sha256").update(bytes).digest("hex");
export function stableJson(value: unknown): string {
  const sort = (v: unknown): unknown =>
    Array.isArray(v)
      ? v.map(sort)
      : v && typeof v === "object"
        ? Object.fromEntries(
            Object.entries(v)
              .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
              .map(([k, x]) => [k, sort(x)]),
          )
        : v;
  return JSON.stringify(sort(value));
}
export type TemplateId = "basic" | "vercel-ai-quickstart" | "chat-sdk";
export type PackageManager = "npm" | "pnpm";
export interface TemplateIdentity {
  id: TemplateId;
  version: string;
  catalogVersion: string;
  catalogHash: string;
  payloadHash: string;
  manager: PackageManager;
}
export interface PayloadFile {
  path: string;
  /** Explicit data-package alias for npm-sensitive canonical files only. */
  storagePath?: string;
  kind: "file";
  hash: string;
  bytes: number;
  executable: boolean;
}
export interface CatalogTemplate
  extends Omit<TemplateIdentity, "catalogHash" | "catalogVersion"> {
  schemaVersion: 1;
  apiVersion: 1;
  provenance: string;
  compatibility: { sdk: string; provider?: string; convex: string };
  envNames: string[];
  envExamples?: string[];
  backend: boolean;
  graph: boolean;
  managerMinimum?: string;
  files: PayloadFile[];
}
export interface TemplateCatalog {
  packageName: "@cortexmemory/templates";
  version: string;
  schemaVersion: 1;
  apiVersion: 1;
  templates: CatalogTemplate[];
}
const ids = ["basic", "vercel-ai-quickstart", "chat-sdk"];
const sha = /^[a-f0-9]{64}$/;
const version =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[a-zA-Z0-9]+(?:[.-][a-zA-Z0-9]+)*)?$/;
export function validateIdentity(value: TemplateIdentity): void {
  if (
    !value ||
    !ids.includes(value.id) ||
    !version.test(value.version) ||
    !version.test(value.catalogVersion) ||
    !sha.test(value.catalogHash) ||
    !sha.test(value.payloadHash) ||
    !["npm", "pnpm"].includes(value.manager)
  )
    throw new TemplateError("TEMPLATE_IDENTITY_INVALID");
}
const excluded = new Set([
  ".git",
  ".convex",
  ".cortex",
  "node_modules",
  "dist",
  "build",
  ".next",
  ".turbo",
  "coverage",
  "_generated",
]);
const lockfiles = new Set([
  "package-lock.json",
  "npm-shrinkwrap.json",
  "pnpm-lock.yaml",
  "yarn.lock",
  "bun.lock",
  "bun.lockb",
]);
/** Relative portable files only. Explicit credential-free examples are opt-in data. */
export function validatePayloadPath(
  relative: string,
  examples: readonly string[] = [],
): void {
  if (
    typeof relative !== "string" ||
    !relative ||
    relative.length > 1024 ||
    relative.includes("\\") ||
    relative.includes(":") ||
    [...relative].some(
      (c) => c.charCodeAt(0) <= 31 || c.charCodeAt(0) === 127,
    ) ||
    relative.startsWith("/") ||
    relative.endsWith("/")
  )
    throw new TemplateError("TEMPLATE_PATH_INVALID");
  const parts = relative.split("/");
  if (
    parts.some((p) => !p || p === "." || p === ".." || excluded.has(p)) ||
    parts.some((p) => lockfiles.has(p))
  )
    throw new TemplateError("TEMPLATE_PATH_PROTECTED");
  if (
    parts.some((p) => p.startsWith(".env")) &&
    !(
      examples.includes(relative) &&
      /^\.env(?:\.[A-Za-z0-9_-]+)*\.(example|sample)$/.test(parts.at(-1)!)
    )
  )
    throw new TemplateError("TEMPLATE_ENV_PROTECTED");
}
export interface ArchiveEntry {
  path: string;
  kind: "file" | "directory" | "symlink" | "hardlink";
  bytes?: Uint8Array;
  executable?: boolean;
}
function validateManifest(
  expected: readonly PayloadFile[],
  examples: readonly string[],
): Map<string, PayloadFile> {
  if (!Array.isArray(expected) || expected.length > 10000)
    throw new TemplateError("TEMPLATE_ARCHIVE_BUDGET");
  const declared = new Map<string, PayloadFile>(),
    folded = new Set<string>(), storage = new Set<string>();
  for (const file of expected) {
    if (!file || typeof file !== "object")
      throw new TemplateError("TEMPLATE_FILE_INVALID");
    validatePayloadPath(file.path, examples);
    if (
      file.kind !== "file" ||
      !sha.test(file.hash) ||
      !Number.isSafeInteger(file.bytes) ||
      file.bytes < 0 ||
      file.bytes > 8 * 1024 * 1024 ||
      typeof file.executable !== "boolean"
    )
      throw new TemplateError("TEMPLATE_FILE_INVALID");
    if (declared.has(file.path) || folded.has(file.path.toLowerCase()))
      throw new TemplateError("TEMPLATE_DUPLICATE_PATH");
    if ((file.path === "__catalog_files" || file.path.startsWith("__catalog_files/"))) throw new TemplateError("TEMPLATE_STORAGE_PATH_RESERVED");
    if (file.storagePath !== undefined &&
      (![".gitignore", ".npmignore", "next-env.d.ts"].includes(file.path.split("/").at(-1)!) ||
       file.storagePath !== `__catalog_files/${file.hash}.bin`))
      throw new TemplateError("TEMPLATE_STORAGE_MAPPING_INVALID");
    const physical = file.storagePath ?? file.path;
    if (storage.has(physical.toLowerCase())) throw new TemplateError("TEMPLATE_DUPLICATE_STORAGE_PATH");
    storage.add(physical.toLowerCase());
    declared.set(file.path, file);
    folded.add(file.path.toLowerCase());
  }
  for (const name of declared.keys())
    if (
      name
        .split("/")
        .slice(0, -1)
        .some((_, i, parts) => declared.has(parts.slice(0, i + 1).join("/")))
    )
      throw new TemplateError("TEMPLATE_FILE_PARENT");
  return declared;
}
/** Validate bounded decoded archive entries before an adapter extracts anything. */
export function validateArchive(
  entries: readonly ArchiveEntry[],
  expected: readonly PayloadFile[],
  examples: readonly string[] = [],
): Map<string, Buffer> {
  if (entries.length > 20000 || expected.length > 10000)
    throw new TemplateError("TEMPLATE_ARCHIVE_BUDGET");
  const files = new Map<string, Buffer>(),
    seen = new Set<string>(),
    folded = new Set<string>();
  const declared = validateManifest(expected, examples);
  let total = 0;
  for (const entry of entries) {
    validatePayloadPath(entry.path, examples);
    const lower = entry.path.toLowerCase();
    if (seen.has(entry.path) || folded.has(lower))
      throw new TemplateError("TEMPLATE_DUPLICATE_PATH");
    seen.add(entry.path);
    folded.add(lower);
    if (entry.kind === "directory") {
      if (
        entry.bytes?.length ||
        !expected.some((file) => file.path.startsWith(entry.path + "/"))
      )
        throw new TemplateError("TEMPLATE_ARCHIVE_UNDECLARED");
      continue;
    }
    if (entry.kind !== "file" || !(entry.bytes instanceof Uint8Array))
      throw new TemplateError("TEMPLATE_ARCHIVE_KIND");
    const file = declared.get(entry.path);
    if (!file) throw new TemplateError("TEMPLATE_ARCHIVE_UNDECLARED");
    total += entry.bytes.length;
    if (total > 64 * 1024 * 1024)
      throw new TemplateError("TEMPLATE_ARCHIVE_BUDGET");
    if (
      file.bytes !== entry.bytes.length ||
      file.hash !== hashBytes(entry.bytes) ||
      file.executable !== entry.executable
    )
      throw new TemplateError("TEMPLATE_HASH_MISMATCH");
    files.set(entry.path, Buffer.from(entry.bytes));
  }
  if (files.size !== declared.size)
    throw new TemplateError("TEMPLATE_ARCHIVE_INCOMPLETE");
  for (const name of files.keys())
    if (
      name
        .split("/")
        .slice(0, -1)
        .some((_, i, parts) => files.has(parts.slice(0, i + 1).join("/")))
    )
      throw new TemplateError("TEMPLATE_FILE_PARENT");
  return files;
}
/** Schema compatibility is fixed; runtime range compatibility is supplied by the release resolver. */
export function selectCatalogTemplate(
  input: Uint8Array,
  selection: {
    id: TemplateId;
    catalogVersion: string;
    templateVersion: string;
    catalogHash: string;
  },
  compatible: (
    range: string,
    component: "sdk" | "provider" | "convex",
  ) => boolean,
): CatalogTemplate & TemplateIdentity {
  if (
    !(input instanceof Uint8Array) ||
    input.length > 8 * 1024 * 1024 ||
    hashBytes(input) !== selection.catalogHash
  )
    throw new TemplateError("TEMPLATE_CATALOG_HASH");
  let catalog: TemplateCatalog;
  try {
    catalog = JSON.parse(Buffer.from(input).toString("utf8"));
  } catch {
    throw new TemplateError("TEMPLATE_CATALOG_INVALID");
  }
  if (!catalog || typeof catalog !== "object")
    throw new TemplateError("TEMPLATE_CATALOG_INVALID");
  if (
    catalog.packageName !== "@cortexmemory/templates" ||
    catalog.schemaVersion !== 1 ||
    catalog.apiVersion !== 1 ||
    !version.test(catalog.version) ||
    !Array.isArray(catalog.templates)
  )
    throw new TemplateError("TEMPLATE_CATALOG_UNSUPPORTED");
  if (
    catalog.version !== selection.catalogVersion ||
    !sha.test(selection.catalogHash)
  )
    throw new TemplateError("TEMPLATE_VERSION_UNAVAILABLE");
  const tuples = new Set<string>();
  for (const item of catalog.templates) {
    validateIdentity({
      ...item,
      catalogVersion: catalog.version,
      catalogHash: selection.catalogHash,
    });
    const key = `${item.id}@${item.version}`;
    if (tuples.has(key)) throw new TemplateError("TEMPLATE_CATALOG_DUPLICATE");
    tuples.add(key);
    if (
      item.schemaVersion !== 1 ||
      item.apiVersion !== 1 ||
      !Array.isArray(item.files) ||
      !Array.isArray(item.envNames) ||
      item.envNames.some(
        (x) => typeof x !== "string" || !/^[A-Z][A-Z0-9_]*$/.test(x),
      ) ||
      typeof item.backend !== "boolean" ||
      typeof item.graph !== "boolean" ||
      (item.managerMinimum !== undefined && !version.test(item.managerMinimum)) ||
      typeof item.provenance !== "string" ||
      !/^[a-zA-Z0-9._@/-]{1,256}$/.test(item.provenance) ||
      item.provenance
        .split("/")
        .some((part) => !part || part === "." || part === "..") ||
      !item.compatibility ||
      typeof item.compatibility.sdk !== "string" ||
      typeof item.compatibility.convex !== "string"
    )
      throw new TemplateError("TEMPLATE_CATALOG_INVALID");
    if (
      item.envExamples !== undefined &&
      (!Array.isArray(item.envExamples) ||
        item.envExamples.some(
          (name) =>
            typeof name !== "string" ||
            !/^(.+\/)?\.env(?:\.[A-Za-z0-9_-]+)*\.(example|sample)$/.test(name),
        ))
    )
      throw new TemplateError("TEMPLATE_CATALOG_INVALID");
    validateManifest(item.files, item.envExamples ?? []);
  }
  const chosen = catalog.templates.find(
    (item) =>
      item.id === selection.id && item.version === selection.templateVersion,
  );
  if (!chosen) throw new TemplateError("TEMPLATE_VERSION_UNAVAILABLE");
  for (const component of ["sdk", "provider", "convex"] as const) {
    const range = chosen.compatibility[component];
    if (
      range !== undefined &&
      (typeof range !== "string" || !compatible(range, component))
    )
      throw new TemplateError("TEMPLATE_COMPATIBILITY_REFUSED");
  }
  return {
    ...structuredClone(chosen),
    catalogVersion: catalog.version,
    catalogHash: selection.catalogHash,
  };
}
export interface BaselineFile {
  content: string;
  hash: string;
  executable: boolean;
}
export interface TemplateBaseline {
  format: 1;
  identity: TemplateIdentity;
  parameters: { projectName?: string };
  envExamples: string[];
  files: Record<string, BaselineFile>;
  /** Explicit byte-identical adoption decisions; never inferred from a later hash match. */
  adoptions?: string[];
}
export function payloadHash(files: ReadonlyMap<string, Uint8Array>): string {
  return hashBytes(
    Buffer.from(
      stableJson(
        [...files]
          .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
          .map(([path, bytes]) => [path, hashBytes(bytes)]),
      ),
    ),
  );
}
/** Records actual rendered bytes, never host env values or arbitrary substitutions. */
export function renderBaseline(
  identity: TemplateIdentity,
  files: ReadonlyMap<string, Uint8Array>,
  options: {
    projectName?: string;
    executable?: readonly string[];
    envExamples?: readonly string[];
  } = {},
): TemplateBaseline {
  validateIdentity(identity);
  if (payloadHash(files) !== identity.payloadHash)
    throw new TemplateError("TEMPLATE_PAYLOAD_MISMATCH");
  if (
    options.projectName !== undefined &&
    !/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,99}$/.test(options.projectName)
  )
    throw new TemplateError("TEMPLATE_PARAMETER_INVALID");
  const envExamples = [...(options.envExamples ?? [])];
  const rendered: Record<string, BaselineFile> = Object.create(null);
  for (const [name, value] of files) {
    validatePayloadPath(name, envExamples);
    let bytes = Buffer.from(value);
    if (bytes.includes(Buffer.from("{{PROJECT_NAME}}"))) {
      if (
        !options.projectName ||
        !Buffer.from(bytes.toString("utf8")).equals(bytes)
      )
        throw new TemplateError("TEMPLATE_PARAMETER_REQUIRED");
      bytes = Buffer.from(
        bytes
          .toString("utf8")
          .replaceAll("{{PROJECT_NAME}}", options.projectName),
      );
    }
    rendered[name] = {
      content: bytes.toString("base64"),
      hash: hashBytes(bytes),
      executable: options.executable?.includes(name) ?? false,
    };
  }
  const baseline: TemplateBaseline = {
    format: 1,
    identity: {id:identity.id,version:identity.version,catalogVersion:identity.catalogVersion,catalogHash:identity.catalogHash,payloadHash:identity.payloadHash,manager:identity.manager},
    parameters:
      options.projectName === undefined
        ? {}
        : { projectName: options.projectName },
    envExamples,
    files: rendered,
  };
  validateBaseline(baseline);
  return baseline;
}
export function validateBaseline(input: TemplateBaseline): void {
  if (
    !input ||
    input.format !== 1 ||
    !input.files ||
    typeof input.files !== "object" ||
    Array.isArray(input.files) ||
    !Array.isArray(input.envExamples) ||
    !input.parameters ||
    Object.keys(input.parameters).some((k) => k !== "projectName") ||
    (input.parameters.projectName !== undefined &&
      !/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,99}$/.test(input.parameters.projectName))
  )
    throw new TemplateError("TEMPLATE_BASELINE_INVALID");
  validateIdentity(input.identity);
  let total = 0;
  for (const [name, file] of Object.entries(input.files)) {
    validatePayloadPath(name, input.envExamples);
    if (
      !file ||
      typeof file.content !== "string" ||
      file.content.length > Math.ceil((8 * 1024 * 1024) / 3) * 4 ||
      !sha.test(file.hash) ||
      typeof file.executable !== "boolean"
    )
      throw new TemplateError("TEMPLATE_BASELINE_INVALID");
    const bytes = Buffer.from(file.content, "base64");
    if (
      bytes.toString("base64") !== file.content ||
      bytes.length > 8 * 1024 * 1024 ||
      hashBytes(bytes) !== file.hash
    )
      throw new TemplateError("TEMPLATE_BASELINE_HASH");
    total += bytes.length;
  }
  if (Object.keys(input.files).length > 10000 || total > 64 * 1024 * 1024)
    throw new TemplateError("TEMPLATE_BASELINE_BUDGET");
  const names = Object.keys(input.files);
  if (
    input.adoptions !== undefined &&
    (!Array.isArray(input.adoptions) ||
      input.adoptions.some(
        (name) => typeof name !== "string" || !Object.hasOwn(input.files, name),
      ) ||
      new Set(input.adoptions).size !== input.adoptions.length)
  )
    throw new TemplateError("TEMPLATE_BASELINE_INVALID");
  if (new Set(names.map((name) => name.toLowerCase())).size !== names.length)
    throw new TemplateError("TEMPLATE_DUPLICATE_PATH");
  const paths = new Set(names);
  if (
    names.some((name) =>
      name
        .split("/")
        .slice(0, -1)
        .some((_, i, parts) => paths.has(parts.slice(0, i + 1).join("/"))),
    )
  )
    throw new TemplateError("TEMPLATE_FILE_PARENT");
}
