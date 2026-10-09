import * as fs from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import {
  decodePackageArchive,
  validatePackagePath,
  type PackageFile,
} from "./archive.js";
import {
  TemplateError,
  hashBytes,
  payloadHash,
  selectCatalogTemplate,
  validateArchive,
  type TemplateCatalog,
  type CatalogTemplate,
  type TemplateIdentity,
  type TemplateId,
} from "./contract.js";
import { compareTemplateVersions, exactTemplateVersion, satisfiesTemplateRange } from "./versions.js";
import { readRegularFile, UnsafeFileError } from "../safe-file.js";

export interface TemplateRuntimeVersions {
  sdk: string;
  provider: string;
  convex: string;
}
export const templateRuntimeVersions: TemplateRuntimeVersions = {
  sdk: "0.38.0",
  provider: "0.38.0",
  convex: "1.46.0",
};
export interface ResolvedCatalog {
  source: string;
  kind: "directory" | "tarball";
  packageVersion: string;
  catalog: TemplateCatalog;
  catalogBytes: Buffer;
  catalogHash: string;
  payloads: Map<string, Map<string, PackageFile>>;
}
function object(bytes: Buffer): Record<string, unknown> {
  try {
    const value: unknown = JSON.parse(bytes.toString("utf8"));
    if (value && typeof value === "object" && !Array.isArray(value))
      return value as Record<string, unknown>;
  } catch {
    /* Fixed errors do not disclose untrusted bytes. */
  }
  throw new TemplateError("TEMPLATE_PACKAGE_INVALID");
}
async function boundedFile(
  target: string,
  limit = 8 * 1024 * 1024,
): Promise<PackageFile> {
  try {
    const { bytes, stat } = await readRegularFile(target, { maxBytes: limit, singleLink: true });
    return { bytes, executable: Boolean(stat.mode & 0o111) };
  } catch (error) {
    if (error instanceof UnsafeFileError) throw new TemplateError("TEMPLATE_PACKAGE_KIND_OR_BUDGET");
    throw error;
  }
}
async function sourceReader(source: string): Promise<{
  source: string;
  kind: "directory" | "tarball";
  files?: Map<string, PackageFile>;
  read: (name: string) => Promise<PackageFile>;
}> {
  if (typeof source !== "string" || !source.trim())
    throw new TemplateError("TEMPLATE_PACKAGE_SOURCE_REQUIRED");
  const absolute = path.resolve(source),
    stat = await fs.lstat(absolute);
  if (stat.isSymbolicLink())
    throw new TemplateError("TEMPLATE_PACKAGE_KIND_OR_BUDGET");
  if (stat.isFile()) {
    const packed = await boundedFile(absolute, 64 * 1024 * 1024),
      files = decodePackageArchive(packed.bytes);
    return {
      source: absolute,
      kind: "tarball",
      files,
      read: async (name) => {
        const file = files.get(name);
        if (!file) throw new TemplateError("TEMPLATE_PACKAGE_INCOMPLETE");
        return file;
      },
    };
  }
  if (!stat.isDirectory() || (await fs.realpath(absolute)) !== absolute)
    throw new TemplateError("TEMPLATE_PACKAGE_KIND_OR_BUDGET");
  return {
    source: absolute,
    kind: "directory",
    read: async (name) => {
      validatePackagePath(name);
      let current = absolute;
      for (const part of name.split("/").slice(0, -1)) {
        current = path.join(current, part);
        const parent = await fs.lstat(current);
        if (!parent.isDirectory() || parent.isSymbolicLink())
          throw new TemplateError("TEMPLATE_PACKAGE_KIND_OR_BUDGET");
      }
      return boundedFile(path.join(absolute, name));
    },
  };
}
async function payloadEntries(
  reader: Awaited<ReturnType<typeof sourceReader>>,
): Promise<Map<string, PackageFile>> {
  if (reader.files)
    return new Map(
      [...reader.files].filter(([name]) => name.startsWith("payloads/")),
    );
  const result = new Map<string, PackageFile>();
  let total = 0;
  async function visit(relative: string): Promise<void> {
    const target = path.join(reader.source, relative),
      stat = await fs.lstat(target);
    if (stat.isSymbolicLink())
      throw new TemplateError("TEMPLATE_PACKAGE_KIND_OR_BUDGET");
    if (stat.isDirectory()) {
      for (const name of (await fs.readdir(target)).sort()) {
        const next = relative + "/" + name;
        validatePackagePath(next);
        await visit(next);
      }
    } else {
      const file = await reader.read(relative);
      total += file.bytes.length;
      if (result.size >= 10000 || total > 64 * 1024 * 1024)
        throw new TemplateError("TEMPLATE_ARCHIVE_BUDGET");
      result.set(relative, file);
    }
  }
  await visit("payloads");
  return result;
}
/** Local source is fully verified in memory. No extraction/cache/destination writes. */
export async function resolveTemplateCatalog(
  source: string,
  options: { catalogVersion?: string; versions?: TemplateRuntimeVersions } = {},
): Promise<ResolvedCatalog> {
  if (options.catalogVersion !== undefined)
    exactTemplateVersion(options.catalogVersion);
  const reader = await sourceReader(source),
    manifest = object((await reader.read("package.json")).bytes);
  if (manifest.name !== "@cortexmemory/templates")
    throw new TemplateError("TEMPLATE_PACKAGE_IDENTITY");
  const packageVersion = exactTemplateVersion(manifest.version);
  if (
    options.catalogVersion !== undefined &&
    options.catalogVersion !== packageVersion
  )
    throw new TemplateError("TEMPLATE_VERSION_UNAVAILABLE");
  for (const key of [
    "dependencies",
    "optionalDependencies",
    "peerDependencies",
  ])
    if (
      manifest[key] !== undefined &&
      (!manifest[key] ||
        typeof manifest[key] !== "object" ||
        Object.keys(manifest[key] as object).length)
    )
      throw new TemplateError("TEMPLATE_PACKAGE_RUNTIME_DEPENDENCY");
  const scripts = manifest.scripts;
  if (
    scripts &&
    typeof scripts === "object" &&
    [
      "preinstall",
      "install",
      "postinstall",
      "prepare",
      "prepack",
      "postpack",
    ].some((key) => Object.hasOwn(scripts, key))
  )
    throw new TemplateError("TEMPLATE_PACKAGE_LIFECYCLE");
  const catalogBytes = (await reader.read("catalog.json")).bytes,
    catalogHash = hashBytes(catalogBytes);
  const raw = object(catalogBytes);
  if (
    raw.version !== packageVersion ||
    !Array.isArray(raw.templates) ||
    !raw.templates.length ||
    raw.templates.length > 100
  )
    throw new TemplateError("TEMPLATE_CATALOG_INVALID");
  const versions = options.versions ?? templateRuntimeVersions,
    entries = await payloadEntries(reader),
    payloads = new Map<string, Map<string, PackageFile>>(),
    used = new Set<string>();
  let catalog: TemplateCatalog | undefined;
  for (const item of raw.templates as CatalogTemplate[]) {
    if (!item || typeof item !== "object")
      throw new TemplateError("TEMPLATE_CATALOG_INVALID");
    const chosen = selectCatalogTemplate(
      catalogBytes,
      {
        id: item.id,
        templateVersion: item.version,
        catalogVersion: packageVersion,
        catalogHash,
      },
      (range, component) => satisfiesTemplateRange(versions[component], range),
    );
    const prefix = `payloads/${chosen.id}/${chosen.version}/`,
      files = [...entries].filter(([name]) => name.startsWith(prefix));
    const physicalNames = chosen.files.map(file => prefix + (file.storagePath ?? file.path));
    if (new Set(physicalNames.map(name=>name.toLowerCase())).size !== physicalNames.length)
      throw new TemplateError("TEMPLATE_DUPLICATE_STORAGE_PATH");
    const actual = new Map(files);
    if (physicalNames.some(name=>!actual.has(name))) throw new TemplateError("TEMPLATE_ARCHIVE_INCOMPLETE");
    if (actual.size !== physicalNames.length) throw new TemplateError("TEMPLATE_ARCHIVE_UNDECLARED");
    const logical = chosen.files.map(file => [file.path, actual.get(prefix + (file.storagePath ?? file.path))!] as const);
    const decoded = validateArchive(
      logical.map(([name, file]) => ({ path:name,kind:"file",bytes:file.bytes,executable:file.executable })),
      chosen.files, chosen.envExamples ?? [],
    );
    if (payloadHash(decoded) !== chosen.payloadHash) throw new TemplateError("TEMPLATE_PAYLOAD_MISMATCH");
    for (const [name] of files) used.add(name);
    payloads.set(chosen.id + "@" + chosen.version,new Map(logical));
    catalog = JSON.parse(catalogBytes.toString("utf8")) as TemplateCatalog;
  }
  if (used.size !== entries.size)
    throw new TemplateError("TEMPLATE_ARCHIVE_UNDECLARED");
  if (
    reader.files &&
    [...reader.files.keys()].some(
      (name) =>
        !name.startsWith("payloads/") &&
        ![
          "package.json",
          "catalog.json",
          "README.md",
          "LICENSE",
          "LICENSE.md",
        ].includes(name),
    )
  )
    throw new TemplateError("TEMPLATE_ARCHIVE_UNDECLARED");
  return {
    source: reader.source,
    kind: reader.kind,
    packageVersion,
    catalog: catalog!,
    catalogBytes,
    catalogHash,
    payloads,
  };
}
export function selectResolvedTemplate(
  catalog: ResolvedCatalog,
  id: TemplateId,
  version?: string,
): {
  template: CatalogTemplate & TemplateIdentity;
  files: Map<string, PackageFile>;
} {
  if (version !== undefined) exactTemplateVersion(version);
  let matches = catalog.catalog.templates.filter(
    (item) =>
      item.id === id && (version === undefined || item.version === version),
  );
  if (!matches.length) throw new TemplateError("TEMPLATE_VERSION_UNAVAILABLE");
  // All admitted versions are stable exact releases. The default channel selects
  // the greatest numeric version; explicit versions retain immutable old tuples.
  if (version === undefined) {
    const latest = [...matches].sort((a, b) => compareTemplateVersions(b.version, a.version))[0].version;
    matches = matches.filter((item) => item.version === latest);
  }
  if (matches.length !== 1)
    throw new TemplateError("TEMPLATE_EXACT_VERSION_REQUIRED");
  const template = {
    ...structuredClone(matches[0]),
    catalogVersion: catalog.packageVersion,
    catalogHash: catalog.catalogHash,
  };
  return {
    template,
    files: new Map(
      [...catalog.payloads.get(id + "@" + template.version)!].map(
        ([name, file]) => [
          name,
          { bytes: Buffer.from(file.bytes), executable: file.executable },
        ],
      ),
    ),
  };
}
/** Registry resolution, when supplied by integration, is explicit-version-only. Current reads are offline. */
export async function resolveCatalogSource(
  options: { templatesPackage?: string; catalogVersion?: string },
  registry?: (exactVersion: string) => Promise<string>,
): Promise<string> {
  if (options.catalogVersion !== undefined)
    exactTemplateVersion(options.catalogVersion);
  if (options.templatesPackage !== undefined)
    return path.resolve(options.templatesPackage);
  const require = createRequire(import.meta.url);
  try {
    const selected = require.resolve("@cortexmemory/templates/package.json");
    const manifest = object((await boundedFile(selected)).bytes);
    if (
      options.catalogVersion === undefined ||
      manifest.version === options.catalogVersion
    )
      return path.dirname(selected);
  } catch {
    /* Missing offline package is an explicit resolution failure, not latest selection. */
  }
  if (options.catalogVersion !== undefined && registry)
    return registry(options.catalogVersion);
  throw new TemplateError(
    "TEMPLATE_CATALOG_SOURCE_UNAVAILABLE: supply --templates-package or an available exact catalog version",
  );
}
export interface CandidatePackage {
  name: string;
  version: string;
  specifier: string;
  source: string;
  sourceHash: string;
}
/** Inspect declared candidate identity/capability only; never import SDK/provider code. */
export async function resolveTemplateCandidate(
  source: string,
  component: "sdk" | "provider",
  range: string,
): Promise<CandidatePackage> {
  const reader = await sourceReader(source),
    manifestFile = await reader.read("package.json"),
    manifest = object(manifestFile.bytes),
    expected =
      component === "sdk"
        ? "@cortexmemory/sdk"
        : "@cortexmemory/vercel-ai-provider";
  if (manifest.name !== expected)
    throw new TemplateError("TEMPLATE_CANDIDATE_IDENTITY");
  const version = exactTemplateVersion(manifest.version);
  if (!satisfiesTemplateRange(version, range))
    throw new TemplateError("TEMPLATE_COMPATIBILITY_REFUSED");
  const declaredEntry = (value:unknown, fallback:string):string => {
    if (value === undefined) return fallback;
    if (typeof value !== "string" || !value.startsWith("./dist/")) throw new TemplateError("TEMPLATE_CANDIDATE_EXPORT_INVALID");
    const name=value.slice(2);validatePackagePath(name);return name;
  };
  const rootExports = manifest.exports && typeof manifest.exports === "object" ?
    (manifest.exports as Record<string,unknown>)["."] : undefined;
  const root = rootExports && typeof rootExports === "object" ? rootExports as Record<string,unknown> : {};
  const required = [declaredEntry(root.import ?? manifest.module,"dist/index.js"),
    declaredEntry(root.types ?? manifest.types,"dist/index.d.ts")];
  if(component === "sdk") required.push("convex-dev/schema.ts","convex-dev/lib/referenceLifecycle.ts");
  else {
    const react = manifest.exports && typeof manifest.exports === "object" ? (manifest.exports as Record<string,unknown>)["./react"] : undefined;
    if(!react || typeof react !== "object")throw new TemplateError("TEMPLATE_CANDIDATE_CAPABILITY");
    const entries=react as Record<string,unknown>;
    required.push(declaredEntry(entries.import,"dist/react/index.js"),declaredEntry(entries.types,"dist/react/index.d.ts"));
  }
  for (const file of required) if (!(await reader.read(file)).bytes.length)
    throw new TemplateError("TEMPLATE_CANDIDATE_CAPABILITY");
  const sourceHash =
    reader.kind === "tarball"
      ? hashBytes((await boundedFile(reader.source, 64 * 1024 * 1024)).bytes)
      : hashBytes(manifestFile.bytes);
  return {
    name: expected,
    version,
    source: reader.source,
    sourceHash,
    specifier: "file:" + reader.source,
  };
}

/** Same official schema/admin validation as installed-directory planning, without extraction. */
export async function readTemplateBackendCandidate(source:string):Promise<import("../schema-sync.js").BackendSdkView> {
  const reader=await sourceReader(source);
  let distribution: Record<string, Buffer> | undefined;
  if (reader.kind === "tarball" ? reader.files!.has("dist/backend/v1/manifest.json") : await fs.access(path.join(reader.source, "dist/backend/v1/manifest.json")).then(() => true, error => { if (error.code === "ENOENT") return false; throw error; })) {
    const manifest = (await reader.read("dist/backend/v1/manifest.json")).bytes;
    const decoded = JSON.parse(manifest.toString("utf8"));
    distribution = { "manifest.json": manifest };
    for (const entry of decoded.files) { validatePackagePath(entry.path); distribution[entry.path] = (await reader.read("dist/backend/v1/" + entry.path)).bytes; }
  }
  if(reader.kind==="directory") {
    const {discoverBackendFiles}=await import("../schema-sync.js");
    const {backendEntryNames}=await import("../template-backend.js");
    return {manifest:(await reader.read("package.json")).bytes,files:discoverBackendFiles(reader.source),entries:backendEntryNames(reader.source,"convex-dev"),distribution};
  }
  const selected=[...reader.files!].filter(([name])=>name.startsWith("convex-dev/") && !name.split("/").includes("_generated"));
  const files=Object.fromEntries(selected.filter(([name])=>name.endsWith(".ts") || name.endsWith("/tsconfig.json")).map(([name,file])=>[name.slice(11),Buffer.from(file.bytes)]).sort(([a],[b])=>String(a).localeCompare(String(b))));
  const entries=selected.map(([name])=>name.slice(11)).sort();
  return {manifest:(await reader.read("package.json")).bytes,files,entries,distribution,artifact:{path:reader.source,hash:hashBytes((await boundedFile(reader.source,64*1024*1024)).bytes)}};
}
