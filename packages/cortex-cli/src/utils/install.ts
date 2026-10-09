/** Reproducible npm installer shared by the SDK entrypoints. */
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { execFileSync, spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import {
  applyBackendPlan,
  assertBackendPlanCurrent,
  assertSafePath,
  findInstalledSdk,
  hashBytes,
  planBackendSync,
  resolveProjectDirectory,
  SDK_VERSION,
  validateSdkPackage,
} from "./schema-sync.js";

export const CONVEX_VERSION = "1.46.0";
export interface InstallOptions {
  yes?: boolean;
  local?: boolean;
  cloud?: boolean;
  template?: string;
  install?: boolean;
  deploy?: boolean;
  dryRun?: boolean;
  overwrite?: boolean;
  sdkPackage?: string;
  skipGraph?: boolean;
  graph?: string;
  graphMode?: string;
  graphUri?: string;
  start?: boolean;
  quiet?: boolean;
}
interface Source {
  directory: string;
  spec: string;
  cleanup: () => void;
}
export function validateInstallOptions(options: InstallOptions): void {
  if (options.local && options.cloud)
    throw new Error("--local and --cloud are mutually exclusive");
  if (options.start)
    throw new Error("--start is retired; run cortex dev separately");
  if (options.template && !["basic", "none"].includes(options.template))
    throw new Error(
      "Use cortex templates init <directory> --template vercel-ai-quickstart|chat-sdk for application templates",
    );
  if (options.skipGraph && options.graph && options.graph !== "none")
    throw new Error("--skip-graph conflicts with an enabled --graph");
  if (options.graph && !["none", "neo4j", "memgraph"].includes(options.graph))
    throw new Error("--graph must be none, neo4j or memgraph");
  if (
    (options.graph && options.graph !== "none") ||
    options.graphMode ||
    options.graphUri
  )
    throw new Error(
      "Enabled graph setup requires the shared graph setup service; it is not available in this installer candidate yet",
    );
  if (options.install === false && options.deploy !== false)
    throw new Error(
      "--no-install requires --no-deploy; install dependencies before explicit dev/codegen",
    );
  if (options.cloud && options.deploy !== false)
    throw new Error(
      "Configure a cloud development target explicitly with native Convex first; use --no-deploy to stage without cloud credentials",
    );
}
export function validateNpmProject(project: string): Record<string, unknown> {
  assertSafePath(project, "node_modules");
  const file = assertSafePath(project, "package.json");
  const manifest = JSON.parse(fs.readFileSync(file, "utf8")) as Record<
    string,
    unknown
  >;
  if (
    manifest.packageManager !== undefined &&
    (typeof manifest.packageManager !== "string" ||
      !/^npm@\d+\.\d+\.\d+(?:[-+].*)?$/.test(manifest.packageManager))
  )
    throw new Error(
      "Only existing npm projects are supported; keep your declared package manager",
    );
  for (const name of [
    "pnpm-lock.yaml",
    "yarn.lock",
    "bun.lock",
    "bun.lockb",
    "npm-shrinkwrap.json",
  ]) {
    const lock = assertSafePath(project, name);
    if (fs.existsSync(lock))
      throw new Error(
        `Unsupported or ambiguous lockfile: ${name}; use an npm project with package-lock.json`,
      );
  }
  const lock = assertSafePath(project, "package-lock.json");
  if (fs.existsSync(lock)) {
    const parsed = JSON.parse(fs.readFileSync(lock, "utf8"));
    if (![1, 2, 3].includes(parsed.lockfileVersion))
      throw new Error("Unsupported npm lockfile format");
  }
  for (const section of [
    "dependencies",
    "devDependencies",
    "optionalDependencies",
    "peerDependencies",
  ]) {
    if (
      manifest[section] !== undefined &&
      (typeof manifest[section] !== "object" ||
        manifest[section] === null ||
        Array.isArray(manifest[section]))
    )
      throw new Error(`Invalid package.json ${section}`);
  }
  if (manifest.workspaces)
    throw new Error(
      "Select a standalone npm package; workspace installations require explicit workspace coordination",
    );
  return manifest;
}
function sdkSource(project: string, options: InstallOptions): Source {
  if (!options.sdkPackage && (options.dryRun || options.install === false)) {
    const directory = findInstalledSdk(project);
    validateSdkPackage(directory);
    return { directory, spec: SDK_VERSION, cleanup: () => {} };
  }
  const supplied = options.sdkPackage && path.resolve(options.sdkPackage);
  if (
    supplied &&
    (!fs.existsSync(supplied) || fs.lstatSync(supplied).isSymbolicLink())
  )
    throw new Error(
      "--sdk-package must be an existing regular package directory or tarball",
    );
  if (supplied && fs.statSync(supplied).isDirectory()) {
    const directory = fs.realpathSync(supplied);
    validateSdkPackage(directory);
    return { directory, spec: `file:${directory}`, cleanup: () => {} };
  }
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), "cortex-sdk-source-"));
  const cleanup = () => fs.rmSync(temp, { recursive: true, force: true });
  try {
    let tarball = supplied;
    if (!tarball) {
      try {
        const result = execFileSync(
          "npm",
          [
            "pack",
            `@cortexmemory/sdk@${SDK_VERSION}`,
            "--ignore-scripts",
            "--json",
            "--pack-destination",
            temp,
          ],
          { cwd: temp, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
        );
        tarball = path.join(temp, JSON.parse(result)[0].filename);
      } catch {
        throw new Error(
          `@cortexmemory/sdk@${SDK_VERSION} registry release unavailable; provide --sdk-package <fixed candidate>. No older SDK fallback.`,
        );
      }
    }
    const entries = execFileSync("tar", ["-tzf", tarball], { encoding: "utf8" })
      .trim()
      .split("\n");
    if (
      entries.some(
        (entry) =>
          !entry.startsWith("package/") ||
          entry.split("/").includes("..") ||
          entry.includes("\\"),
      )
    )
      throw new Error("Unsafe SDK archive path");
    const listing = execFileSync("tar", ["-tvzf", tarball], {
      encoding: "utf8",
    })
      .trim()
      .split("\n");
    if (listing.some((entry) => !["-", "d"].includes(entry[0])))
      throw new Error("SDK archive links/special files refused");
    execFileSync("tar", ["-xzf", tarball, "-C", temp], { stdio: "pipe" });
    const directory = path.join(temp, "package");
    validateSdkPackage(directory);
    return {
      directory,
      spec: supplied ? `file:${supplied}` : SDK_VERSION,
      cleanup,
    };
  } catch (error) {
    cleanup();
    throw error;
  }
}
function templateFiles(
  name: string,
  projectName: string,
): Record<string, Buffer> {
  if (name === "none")
    return {
      "package.json": Buffer.from(
        JSON.stringify(
          {
            name: projectName,
            version: "1.0.0",
            private: true,
            type: "module",
            packageManager: "npm@12.2.0",
            engines: { node: ">=24.15.0" },
            devDependencies: { typescript: "~6.0.3", "@types/node": "^26.6.4" },
          },
          null,
          2,
        ) + "\n",
      ),
    };
  const root = fileURLToPath(
    new URL("../../templates/basic/", import.meta.url),
  );
  const files: Record<string, Buffer> = {};
  const excluded = new Set([
    "node_modules",
    "dist",
    "coverage",
    ".convex",
    ".cortex",
    "_generated",
    ".DS_Store",
    "package-lock.json",
  ]);
  const walk = (relative: string): void => {
    for (const entry of fs.readdirSync(path.join(root, relative), {
      withFileTypes: true,
    })) {
      if (
        excluded.has(entry.name) ||
        (entry.name.startsWith(".env") && !entry.name.endsWith(".example"))
      )
        continue;
      const name = relative ? `${relative}/${entry.name}` : entry.name;
      if (entry.isSymbolicLink()) throw new Error("Template symlinks refused");
      if (entry.isDirectory()) walk(name);
      else if (entry.isFile())
        files[name] = fs.readFileSync(path.join(root, name));
    }
  };
  walk("");
  const manifest = JSON.parse(files["package.json"].toString());
  manifest.name = projectName;
  files["package.json"] = Buffer.from(JSON.stringify(manifest, null, 2) + "\n");
  return files;
}
function child(
  command: string,
  args: string[],
  cwd: string,
  env = process.env,
  quiet = false,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const processChild = spawn(command, args, {
      cwd,
      env,
      stdio: ["inherit", "pipe", "pipe"],
      shell: false,
    });
    if (!quiet) {
      processChild.stdout?.pipe(process.stderr);
      processChild.stderr?.pipe(process.stderr);
    }
    const forward = (signal: "SIGINT" | "SIGTERM") => processChild.kill(signal);
    const interrupt = () => forward("SIGINT"),
      terminate = () => forward("SIGTERM");
    process.on("SIGINT", interrupt);
    process.on("SIGTERM", terminate);
    const cleanup = () => {
      process.off("SIGINT", interrupt);
      process.off("SIGTERM", terminate);
    };
    processChild.once("error", (error) => {
      cleanup();
      reject(error);
    });
    processChild.once("exit", (code, signal) => {
      cleanup();
      if (code === 0) resolve();
      else reject(new Error(`${command} failed (${signal ?? code})`));
    });
  });
}
export async function installSdk(
  directory: string,
  options: InstallOptions = {},
  initialize = false,
): Promise<Record<string, unknown>> {
  validateInstallOptions(options);
  const project = resolveProjectDirectory(directory);
  const existed = fs.existsSync(project);
  if (!initialize && !existed)
    throw new Error(
      "Existing npm project required; use cortex init for a new project",
    );
  if (initialize && existed && fs.readdirSync(project).length)
    throw new Error(
      "Init destination must be empty; use cortex install for existing projects",
    );
  const name = path
    .basename(project)
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-");
  if (!name || !/^[a-z0-9]/.test(name))
    throw new Error("Choose a valid project directory name");
  const scaffold = initialize
    ? templateFiles(options.template ?? "basic", name)
    : {};
  let manifest = initialize
    ? JSON.parse(scaffold["package.json"].toString())
    : validateNpmProject(project);
  const source = sdkSource(project, options);
  try {
    const backend = planBackendSync(project, source.directory);
    if (backend.conflicts.length && !options.overwrite)
      throw new Error(
        `Backend conflicts: ${backend.conflicts.join(", ")}; use schema sync --dry-run to inspect or --overwrite with backup`,
      );
    const writes: Record<string, Buffer> = { ...scaffold };
    manifest = {
      ...manifest,
      dependencies: {
        ...((manifest.dependencies as Record<string, string>) ?? {}),
        "@cortexmemory/sdk": source.spec,
        convex: CONVEX_VERSION,
      },
    };
    // Remove duplicate dependency declarations for these two selected packages only.
    for (const section of ["devDependencies", "optionalDependencies"])
      if (manifest[section]) {
        const dependencies = {
          ...(manifest[section] as Record<string, string>),
        };
        delete dependencies["@cortexmemory/sdk"];
        delete dependencies.convex;
        manifest[section] = dependencies;
      }
    writes["package.json"] = Buffer.from(
      JSON.stringify(manifest, null, 2) + "\n",
    );
    // Default convex.json is part of backend apply, after its second preflight.
    for (const name of Object.keys(writes)) assertSafePath(project, name);
    const shouldDeploy =
      options.deploy !== false && Boolean(options.local || initialize);
    if (shouldDeploy && !initialize)
      throw new Error(
        "Existing-project install stages files only; use --no-deploy, then explicit targeted cortex dev/codegen",
      );
    if (shouldDeploy && !options.local)
      throw new Error(
        "Select --local for deterministic anonymous init or --no-deploy for offline staging",
      );
    const result = {
      projectPath: project,
      sdkVersion: SDK_VERSION,
      convexVersion: CONVEX_VERSION,
      packageManager: "npm",
      functions: backend.functions,
      additions: backend.additions,
      updates: backend.updates,
      conflicts: backend.conflicts,
      writes: Object.keys(writes).filter(
        (name) =>
          !fs.existsSync(path.join(project, name)) ||
          hashBytes(fs.readFileSync(path.join(project, name))) !==
            hashBytes(writes[name]),
      ),
      deployment: shouldDeploy ? "anonymous-local" : "staged",
      dryRun: Boolean(options.dryRun),
    };
    if (backend.configBefore === null) result.writes.push("convex.json");
    if (options.dryRun) return result;
    assertBackendPlanCurrent(backend);
    const before = new Map<string, Buffer | null>();
    for (const name of Object.keys(writes)) {
      const file = path.join(project, name);
      before.set(name, fs.existsSync(file) ? fs.readFileSync(file) : null);
    }
    const lockPath = assertSafePath(project, "package-lock.json");
    before.set(
      "package-lock.json",
      fs.existsSync(lockPath) ? fs.readFileSync(lockPath) : null,
    );
    // Recovery reads must not leave a stale configuration window before our first write.
    assertBackendPlanCurrent(backend);
    const createdDirectories: string[] = [];
    let backendApplied = false;
    try {
      for (const [name, bytes] of Object.entries(writes)) {
        const file = assertSafePath(project, name);
        if (
          before.get(name) &&
          hashBytes(before.get(name)!) === hashBytes(bytes)
        )
          continue;
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
          fs.writeFileSync(temp, bytes, { flag: "wx" });
          fs.renameSync(temp, file);
        } finally {
          if (fs.existsSync(temp)) fs.unlinkSync(temp);
        }
      }
      if (options.install !== false)
        await child(
          "npm",
          [
            "install",
            "--prefix",
            project,
            "--workspaces=false",
            "--ignore-scripts",
            "--no-audit",
            "--no-fund",
          ],
          project,
          process.env,
          Boolean(options.quiet),
        );
      // npm may have changed files; repeat the complete backend preflight before writes.
      assertBackendPlanCurrent(backend);
      const backupPath = applyBackendPlan(backend, {
        overwrite: options.overwrite,
      });
      backendApplied = true;
      if (shouldDeploy) {
        const native = path.join(project, "node_modules/convex/bin/main.js");
        const installed = JSON.parse(
          fs.readFileSync(
            path.join(project, "node_modules/convex/package.json"),
            "utf8",
          ),
        );
        if (installed.version !== CONVEX_VERSION)
          throw new Error(
            "Installed Convex version differs from pinned installer baseline",
          );
        const env = Object.fromEntries(
          Object.entries(process.env).filter(
            ([key]) => !key.startsWith("CONVEX_") && !key.startsWith("CORTEX_"),
          ),
        );
        env.CONVEX_AGENT_MODE = "anonymous";
        // Native 1.46 selects/creates its project-local anonymous target, then plain dev.
        await child(
          process.execPath,
          [native, "dev", "--once", "--typecheck", "enable"],
          project,
          env,
          Boolean(options.quiet),
        );
      }
      return { ...result, backupPath };
    } catch (error) {
      if (backendApplied)
        throw new Error(
          `Project staged; native setup failed. Preserve local state and retry explicit cortex dev: ${error instanceof Error ? error.message : "native failure"}`,
          { cause: error },
        );
      // Restore only installer-owned manifest/lock/scaffold bytes. Preserve native state,
      // generated bindings and node_modules so failures can be inspected and retried.
      for (const [name, bytes] of before) {
        const file = assertSafePath(project, name);
        if (bytes) fs.writeFileSync(file, bytes);
        else if (fs.existsSync(file)) fs.unlinkSync(file);
      }
      for (const dir of createdDirectories.reverse())
        if (fs.existsSync(dir) && !fs.readdirSync(dir).length)
          fs.rmdirSync(dir);
      throw error;
    }
  } finally {
    source.cleanup();
  }
}
