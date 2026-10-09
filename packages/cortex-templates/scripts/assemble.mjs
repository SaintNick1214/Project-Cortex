import { createHash } from "node:crypto";
import * as fs from "node:fs/promises";
import { constants } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

/** @typedef {import('../contract.js').TemplateSource} TemplateSource */
/** @typedef {import('../contract.js').Assembly} Assembly */
/** @typedef {import('../contract.js').AssemblyReceipt} AssemblyReceipt */
/** @typedef {import('../contract.js').CatalogTemplate} CatalogTemplate */
/** @typedef {import('../contract.js').TemplateCatalog} TemplateCatalog */
/** @typedef {import('../contract.js').SourceFileReceipt} SourceFileReceipt */

const releaseRange = "^0.38.0";
const versions = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[a-zA-Z0-9]+(?:[.-][a-zA-Z0-9]+)*)?$/;
const managers = { basic: "npm", "vercel-ai-quickstart": "npm", "chat-sdk": "pnpm" };
const excludedDirectories = new Set([
  ".git", ".convex", ".cortex", ".vercel", "node_modules", "dist", "build",
  "out", ".next", ".turbo", ".cache", ".parcel-cache", "coverage", "_generated",
]);
const excludedFiles = new Set([
  "package-lock.json", "npm-shrinkwrap.json", "pnpm-lock.yaml", "yarn.lock",
  "bun.lock", "bun.lockb", ".DS_Store", "credentials.json", "id_rsa", "id_ed25519",
]);
const dependencyMaps = ["dependencies", "devDependencies", "peerDependencies", "optionalDependencies"];

export class AssemblyError extends Error {
  /** @param {string} code */
  constructor(code) {
    super(code);
    this.name = "AssemblyError";
    this.code = code;
  }
}

/** @param {string} code @returns {never} */
function fail(code) { throw new AssemblyError(code); }
/** @param {unknown} value @returns {Record<string, unknown>} */
function object(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail("CATALOG_INPUT_INVALID");
  return /** @type {Record<string, unknown>} */ (value);
}
/** Same canonical JSON rule used by the CLI template contract. @param {unknown} value @returns {string} */
export function stableJson(value) {
  /** @param {unknown} item @returns {unknown} */
  const sort = (item) => Array.isArray(item)
    ? item.map(sort)
    : item && typeof item === "object"
      ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => compare(a, b)).map(([key, entry]) => [key, sort(entry)]))
      : item;
  const encoded = JSON.stringify(sort(value));
  if (encoded === undefined) fail("CATALOG_INPUT_INVALID");
  return encoded;
}
/** @param {string} a @param {string} b */
function compare(a, b) { return a < b ? -1 : a > b ? 1 : 0; }
/** @param {Uint8Array} bytes */
export function hashBytes(bytes) { return createHash("sha256").update(bytes).digest("hex"); }
/** Same path/byte aggregate as the CLI, without executable mode in this hash. @param {ReadonlyMap<string, Uint8Array>} files */
export function payloadHash(files) {
  return hashBytes(Buffer.from(stableJson([...files].sort(([a], [b]) => compare(a, b)).map(([name, bytes]) => [name, hashBytes(bytes)]))));
}
/** @param {string} relative */
function portablePath(relative) {
  if (typeof relative !== "string" || !relative || relative.length > 1024 || relative.includes("\\") || relative.includes(":") || relative.startsWith("/") || relative.endsWith("/") || [...relative].some(char => char.charCodeAt(0) <= 31 || char.charCodeAt(0) === 127) || relative.split("/").some(part => !part || part === "." || part === "..")) fail("CATALOG_PATH_INVALID");
}
/** Excluded paths are never read, including real environment files. @param {string} relative @param {ReadonlySet<string>} examples */
function eligible(relative, examples) {
  const parts = relative.split("/");
  const name = parts.at(-1) ?? "";
  if (parts.some(part => excludedDirectories.has(part) || excludedFiles.has(part)) || /\.(?:log|tsbuildinfo|pem|key|p12|pfx)$/i.test(name)) return false;
  if (parts.some(part => part.startsWith(".env"))) return examples.has(relative);
  return true;
}
/** @param {TemplateSource} selection */
function validateSelection(selection) {
  const input = object(selection);
  if (typeof input.id !== "string" || !Object.hasOwn(managers, input.id) || typeof input.version !== "string" || !versions.test(input.version) || typeof input.source !== "string" || !path.isAbsolute(input.source) || input.manager !== managers[/** @type {keyof typeof managers} */ (input.id)] || typeof input.backend !== "boolean" || typeof input.graph !== "boolean" || typeof input.provenance !== "string" || !/^[a-zA-Z0-9._@/-]{1,256}$/.test(input.provenance) || input.provenance.split("/").some(part => !part || part === "." || part === "..")) fail("CATALOG_SELECTION_INVALID");
  if (path.resolve(selection.source).endsWith("/packages/cortex-cli/templates/vercel-ai-quickstart")) fail("CATALOG_MIRROR_REFUSED");
  if (!Array.isArray(input.envNames) || input.envNames.some(name => typeof name !== "string" || !/^[A-Z][A-Z0-9_]*$/.test(name)) || new Set(input.envNames).size !== input.envNames.length) fail("CATALOG_ENV_METADATA_INVALID");
  if (input.envExamples !== undefined && (!Array.isArray(input.envExamples) || input.envExamples.some(name => typeof name !== "string" || !/^(.+\/)?\.env(?:\.[a-zA-Z0-9_-]+)*\.(example|sample)$/.test(name)) || new Set(input.envExamples).size !== input.envExamples.length)) fail("CATALOG_ENV_METADATA_INVALID");
  for (const example of selection.envExamples ?? []) {
    portablePath(example);
    if (example.split("/").some(part => excludedDirectories.has(part) || excludedFiles.has(part)) || example.split("/").slice(0, -1).some(part => part.startsWith(".env"))) fail("CATALOG_ENV_METADATA_INVALID");
  }
}

/** @param {TemplateSource} selection @returns {Promise<Map<string, {bytes: Buffer; executable: boolean}>>} */
async function readSource(selection) {
  const root = path.resolve(selection.source);
  const rootStat = await fs.lstat(root);
  if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) fail("CATALOG_SOURCE_KIND");
  const examples = new Set(selection.envExamples ?? []);
  /** @type {Map<string, {bytes: Buffer; executable: boolean}>} */
  const files = new Map();
  const folded = new Set();
  let total = 0;
  /** @param {string} directory @param {string} prefix */
  async function visit(directory, prefix) {
    const names = (await fs.readdir(directory)).sort(compare);
    for (const name of names) {
      const relative = prefix ? `${prefix}/${name}` : name;
      if (!eligible(relative, examples)) continue;
      portablePath(relative);
      const absolute = path.join(directory, name);
      const stat = await fs.lstat(absolute);
      if (stat.isSymbolicLink()) fail("CATALOG_SOURCE_LINK");
      if (stat.isDirectory()) { await visit(absolute, relative); continue; }
      if (!stat.isFile()) fail("CATALOG_SOURCE_KIND");
      if (stat.nlink !== 1) fail("CATALOG_SOURCE_LINK");
      if (stat.size > 8 * 1024 * 1024 || files.size >= 10000) fail("CATALOG_PAYLOAD_BUDGET");
      const opened = await readSourceFile(absolute), bytes = opened.bytes;
      total += bytes.length;
      if (bytes.length > 8 * 1024 * 1024 || total > 64 * 1024 * 1024) fail("CATALOG_PAYLOAD_BUDGET");
      if (folded.has(relative.toLowerCase())) fail("CATALOG_DUPLICATE_PATH");
      folded.add(relative.toLowerCase());
      files.set(relative, { bytes, executable: (opened.stat.mode & 0o111) !== 0 });
    }
  }
  await visit(root, "");
  for (const example of examples) if (!files.has(example)) fail("CATALOG_ENV_EXAMPLE_MISSING");
  return new Map([...files].sort(([a], [b]) => compare(a, b)));
}

/** All file checks and byte reads use the same descriptor. @param {string} absolute */
async function readSourceFile(absolute) {
  let handle;
  try { handle = await fs.open(absolute, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK); }
  catch (error) {
    if (/** @type {NodeJS.ErrnoException} */ (error).code === "ELOOP") fail("CATALOG_SOURCE_LINK");
    throw error;
  }
  try {
    const stat = await handle.stat();
    if (!stat.isFile()) fail("CATALOG_SOURCE_KIND");
    if (stat.nlink !== 1) fail("CATALOG_SOURCE_LINK");
    if (stat.size > 8 * 1024 * 1024) fail("CATALOG_PAYLOAD_BUDGET");
    const bytes = Buffer.alloc(stat.size);
    let offset = 0;
    while (offset < bytes.length) {
      const { bytesRead } = await handle.read(bytes, offset, bytes.length - offset, offset);
      if (!bytesRead) fail("CATALOG_SOURCE_CHANGED");
      offset += bytesRead;
    }
    if ((await handle.read(Buffer.alloc(1), 0, 1, offset)).bytesRead) fail("CATALOG_SOURCE_CHANGED");
    const after = await handle.stat();
    if (after.size !== stat.size || after.mtimeMs !== stat.mtimeMs || after.ctimeMs !== stat.ctimeMs || after.mode !== stat.mode || after.nlink !== stat.nlink) fail("CATALOG_SOURCE_CHANGED");
    return { bytes, stat };
  } finally { await handle.close(); }
}

/** @param {Buffer} bytes @param {TemplateSource} selection */
function rewriteManifest(bytes, selection) {
  let parsed;
  try { parsed = JSON.parse(bytes.toString("utf8")); } catch { fail("CATALOG_MANIFEST_INVALID"); }
  const manifest = object(parsed);
  if (manifest.version !== selection.version || typeof manifest.name !== "string" || !manifest.name) fail("CATALOG_MANIFEST_IDENTITY");
  if (selection.manager === "pnpm" ? typeof manifest.packageManager !== "string" || !/^pnpm@\d+\.\d+\.\d+(?:[-+].+)?$/.test(manifest.packageManager) : manifest.packageManager !== undefined && (typeof manifest.packageManager !== "string" || !/^npm@\d+\.\d+\.\d+(?:[-+].+)?$/.test(manifest.packageManager))) fail("CATALOG_MANAGER_MISMATCH");
  /** @type {Map<string, string>} */
  const specs = new Map();
  for (const field of dependencyMaps) {
    if (manifest[field] === undefined) continue;
    const dependencies = object(manifest[field]);
    for (const [name, value] of Object.entries(dependencies)) {
      if (typeof value !== "string" || !value.trim()) fail("CATALOG_DEPENDENCY_INVALID");
      if (name === "@cortexmemory/sdk" || name === "@cortexmemory/vercel-ai-provider") {
        if (specs.has(name)) fail("CATALOG_DEPENDENCY_DUPLICATE");
        if (!value.startsWith("file:") && value !== releaseRange) fail("CATALOG_RELEASE_SPEC_INVALID");
        dependencies[name] = releaseRange;
        specs.set(name, releaseRange);
      } else if (/^(?:file:|link:|workspace:|\.\.?\/|\/)/.test(value)) fail("CATALOG_LOCAL_DEPENDENCY_REFUSED");
    }
  }
  if (!specs.has("@cortexmemory/sdk") || (selection.id !== "basic" && !specs.has("@cortexmemory/vercel-ai-provider"))) fail("CATALOG_REQUIRED_DEPENDENCY");
  const convex = object(manifest.dependencies).convex;
  if (typeof convex !== "string" || !/^[~^<>=|*xX\d.\s-]+$/.test(convex) || !/\d/.test(convex)) fail("CATALOG_CONVEX_COMPATIBILITY");
  const engines = manifest.engines === undefined ? {} : object(manifest.engines);
  if (engines.npm !== undefined && (selection.manager !== "npm" || engines.npm !== ">=11.0.0")) fail("CATALOG_MANAGER_MINIMUM_UNSUPPORTED");
  return {
    ...(engines.npm === ">=11.0.0" ? {managerMinimum:"11.0.0"}:{}),
    bytes: Buffer.from(`${stableJson(manifest)}\n`),
    compatibility: { sdk: releaseRange, ...(specs.has("@cortexmemory/vercel-ai-provider") ? { provider: releaseRange } : {}), convex },
  };
}

/** Fully validates all supplied trees before output effects. No ambient configuration. @param {readonly TemplateSource[]} selections @param {string} [catalogVersion] @returns {Promise<Assembly>} */
export async function assembleCatalog(selections, catalogVersion = "1.0.0") {
  if (!versions.test(catalogVersion) || !Array.isArray(selections) || selections.length < 1 || selections.length > 100) fail("CATALOG_INPUT_INVALID");
  const keys = new Set();
  for (const selection of selections) {
    validateSelection(selection);
    const key = `${selection.id}@${selection.version}`;
    if (keys.has(key)) fail("CATALOG_SELECTION_DUPLICATE");
    keys.add(key);
  }
  /** @type {CatalogTemplate[]} */
  const templates = [];
  /** @type {Assembly['payloads']} */
  const payloads = new Map();
  /** @type {AssemblyReceipt['templates']} */
  const receipts = [];
  for (const selection of [...selections].sort((a, b) => compare(`${a.id}@${a.version}`, `${b.id}@${b.version}`))) {
    const source = await readSource(selection);
    const original = new Map([...source].map(([name, file]) => [name, file.bytes]));
    const manifest = source.get("package.json");
    if (!manifest) fail("CATALOG_MANIFEST_MISSING");
    const rewritten = rewriteManifest(manifest.bytes, selection);
    source.set("package.json", { bytes: rewritten.bytes, executable: false });
    const bytes = new Map([...source].map(([name, file]) => [name, file.bytes]));
    /** @type {SourceFileReceipt[]} */
    const files = [...source].map(([name, file]) => ({
      path: name, kind: "file", hash: hashBytes(file.bytes), bytes: file.bytes.length,
      executable: file.executable, sourceHash: hashBytes(original.get(name) ?? fail("CATALOG_SOURCE_INVALID")),
      transformed: !file.bytes.equals(original.get(name) ?? fail("CATALOG_SOURCE_INVALID")),
    }));
    const hash = payloadHash(bytes);
    templates.push({
      id: selection.id, version: selection.version, payloadHash: hash, manager: selection.manager,
      schemaVersion: 1, apiVersion: 1, provenance: selection.provenance,
      compatibility: rewritten.compatibility, envNames: [...selection.envNames].sort(compare),
      ...(selection.envExamples === undefined ? {} : { envExamples: [...selection.envExamples].sort(compare) }),
      backend: selection.backend, graph: selection.graph, ...(rewritten.managerMinimum ? {managerMinimum:rewritten.managerMinimum}:{}),
      files: files.map(file => ({ path: file.path, ...(file.storagePath ? {storagePath:file.storagePath}:{}), kind: file.kind, hash: file.hash, bytes: file.bytes, executable: file.executable })),
    });
    for (const file of files) {
      if ([".gitignore", ".npmignore", "next-env.d.ts"].includes(file.path.split("/").at(-1) ?? "")) file.storagePath = `__catalog_files/${file.hash}.bin`;
    }
    templates[templates.length-1].files = files.map(file => ({path:file.path,...(file.storagePath ? {storagePath:file.storagePath}:{}),kind:file.kind,hash:file.hash,bytes:file.bytes,executable:file.executable}));
    receipts.push({ id: selection.id, version: selection.version, provenance: selection.provenance, sourceHash: payloadHash(original), payloadHash: hash, files });
    const physical = new Set();
    for (const [name, file] of source) {
      const storagePath = files.find(entry => entry.path === name)?.storagePath ?? name;
      if (name.startsWith("__catalog_files/") || physical.has(storagePath.toLowerCase())) fail("CATALOG_STORAGE_COLLISION");
      physical.add(storagePath.toLowerCase());
      payloads.set(`payloads/${selection.id}/${selection.version}/${storagePath}`, file);
    }
  }
  /** @type {TemplateCatalog} */
  const catalog = { packageName: "@cortexmemory/templates", version: catalogVersion, schemaVersion: 1, apiVersion: 1, templates };
  const catalogBytes = Buffer.from(`${stableJson(catalog)}\n`);
  return { catalog, catalogBytes, payloads, receipt: { schemaVersion: 1, catalogHash: hashBytes(catalogBytes), templates: receipts }, sourceRoots: selections.map(selection => path.resolve(selection.source)) };
}

/** Write only a new explicitly selected data package. Existing output is never replaced. @param {string} output @param {Assembly} assembly */
export async function writeAssembly(output, assembly) {
  if (typeof output !== "string" || !path.isAbsolute(output)) fail("CATALOG_OUTPUT_INVALID");
  const destination = path.resolve(output);
  for (const root of assembly.sourceRoots) {
    const relative = path.relative(root, destination);
    if (!relative || (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative))) fail("CATALOG_OUTPUT_INSIDE_SOURCE");
  }
  if (hashBytes(assembly.catalogBytes) !== assembly.receipt.catalogHash) fail("CATALOG_OUTPUT_INVALID");
  // Parent must exist; no unrelated directory creation or output replacement.
  try { await fs.mkdir(destination); } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "EEXIST") fail("CATALOG_OUTPUT_EXISTS");
    throw error;
  }
  try {
    const packageManifest = {
      name: "@cortexmemory/templates", version: assembly.catalog.version,
      description: "Independently versioned Cortex application template catalog and payloads",
      type: "module", license: "FSL-1.1-Apache-2.0", files: ["catalog.json", "payloads", "README.md"],
      exports: { "./catalog": "./catalog.json", "./package.json": "./package.json" },
    };
    await fs.writeFile(path.join(destination, "package.json"), `${stableJson(packageManifest)}\n`, { flag: "wx", mode: 0o644 });
    await fs.writeFile(path.join(destination, "catalog.json"), assembly.catalogBytes, { flag: "wx", mode: 0o644 });
    await fs.writeFile(path.join(destination, "assembly.json"), `${stableJson(assembly.receipt)}\n`, { flag: "wx", mode: 0o644 });
    await fs.copyFile(fileURLToPath(new URL("../README.md", import.meta.url)), path.join(destination, "README.md"));
    for (const [relative, file] of assembly.payloads) {
      const absolute = path.join(destination, relative);
      await fs.mkdir(path.dirname(absolute), { recursive: true });
      await fs.writeFile(absolute, file.bytes, { flag: "wx", mode: file.executable ? 0o755 : 0o644 });
      await fs.chmod(absolute, file.executable ? 0o755 : 0o644);
    }
  } catch (error) {
    await fs.rm(destination, { recursive: true, force: true });
    throw error;
  }
  return { catalogHash: assembly.receipt.catalogHash, templates: assembly.catalog.templates.length };
}

async function main() {
  if (process.argv.length !== 4) fail("CATALOG_USAGE_CONFIG_OUTPUT_REQUIRED");
  let configuration;
  try { configuration = object(JSON.parse(await fs.readFile(process.argv[2], "utf8"))); } catch { fail("CATALOG_INPUT_INVALID"); }
  if (!Array.isArray(configuration.templates) || typeof configuration.catalogVersion !== "string") fail("CATALOG_INPUT_INVALID");
  const assembly = await assembleCatalog(/** @type {TemplateSource[]} */ (configuration.templates), configuration.catalogVersion);
  const result = await writeAssembly(process.argv[3], assembly);
  process.stdout.write(`${stableJson(result)}\n`);
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch(error => {
    process.stderr.write(`${error instanceof AssemblyError ? error.code : "CATALOG_ASSEMBLY_FAILED"}\n`);
    process.exitCode = 1;
  });
}
