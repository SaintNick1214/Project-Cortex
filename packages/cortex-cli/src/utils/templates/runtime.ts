import { spawn } from "node:child_process";
import * as fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { TemplateError } from "./contract.js";
import { exactTemplateVersion } from "./versions.js";
import { resolveTemplateCatalog } from "./resolver.js";
import type { PackageManager } from "./contract.js";

export interface TemplateProcessResult {
  exitCode: number;
  stdout: string;
}
export type TemplateProcessRunner = (
  command: string,
  args: string[],
  cwd: string,
  environment?: Record<string, string | undefined>,
) => Promise<TemplateProcessResult>;

/** Wait for the actual child close, including cancellation. Never print raw manager diagnostics. */
export const runTemplateProcess: TemplateProcessRunner = (command, args, cwd, environment) =>
  new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      env: environment,
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
    });
    const chunks: Buffer[] = [];
    let size = 0,
      failed = false,
      interrupted = false;
    let escalation: ReturnType<typeof setTimeout> | undefined;
    const cancel = (signal: "SIGINT" | "SIGTERM") => {
      interrupted = true;
      child.kill(signal);
      escalation ??= setTimeout(() => child.kill("SIGKILL"), 3000);
    };
    const interrupt = () => cancel("SIGINT");
    const terminate = () => cancel("SIGTERM");
    process.on("SIGINT", interrupt);
    process.on("SIGTERM", terminate);
    const timer = setTimeout(
      () => {
        failed = true;
        child.kill("SIGKILL");
      },
      15 * 60 * 1000,
    );
    child.stdout.on("data", (value: Buffer) => {
      size += value.length;
      if (size > 1024 * 1024) {
        failed = true;
        child.kill("SIGKILL");
      } else chunks.push(Buffer.from(value));
    });
    // Drain stderr without publishing registry credentials or untrusted response text.
    child.stderr.resume();
    let spawnFailure = false;
    child.once("error", () => {
      spawnFailure = true;
    });
    child.once("close", (code) => {
      clearTimeout(timer);
      clearTimeout(escalation);
      process.off("SIGINT", interrupt);
      process.off("SIGTERM", terminate);
      if (spawnFailure || failed || interrupted)
        reject(
          new TemplateError(
            interrupted
              ? "TEMPLATE_PROCESS_CANCELLED_OR_UNKNOWN"
              : "TEMPLATE_PROCESS_FAILED_OR_UNKNOWN",
          ),
        );
      else
        resolve({
          exitCode: code ?? 1,
          stdout: Buffer.concat(chunks).toString("utf8"),
        });
    });
  });

/** Version-only preflight runs before catalog publication; never downloads or switches tools. */
export async function verifyTemplateManager(manager:PackageManager,minimum:string|undefined,run:TemplateProcessRunner=runTemplateProcess):Promise<string|undefined> {
  if (!['npm','pnpm'].includes(manager)) throw new TemplateError("TEMPLATE_MANAGER_INVALID");
  if (minimum === undefined) return undefined;
  const expected=exactTemplateVersion(minimum), result=await run(manager,["--version"],process.cwd());
  const actual=result.stdout.trim();
  if (result.exitCode !== 0 || !/^\d+\.\d+\.\d+$/.test(actual)) throw new TemplateError("TEMPLATE_MANAGER_VERSION_UNAVAILABLE");
  const found=actual.split(".").map(Number),required=expected.split(".").map(Number);
  let comparison=0;for(let i=0;i<3;i++){if(found[i]!==required[i]){comparison=found[i]>required[i]?1:-1;break;}}
  if (comparison<0)throw new TemplateError(`TEMPLATE_MANAGER_UPGRADE_REQUIRED: this template requires ${manager} >=${minimum}; found ${actual}; upgrade explicitly with npm install -g npm@11, then retry; no project writes occurred`);
  return actual;
}
/** Existing manager/lock ownership is checked before invoking either supported manager. */
export async function installTemplateDependencies(
  directory: string,
  manager: PackageManager,
  run: TemplateProcessRunner = runTemplateProcess,
): Promise<{ exitCode: number }> {
  if (!["npm", "pnpm"].includes(manager))
    throw new TemplateError("TEMPLATE_MANAGER_INVALID");
  const selected = path.resolve(directory),
    stat = await fs.lstat(selected);
  if (
    !stat.isDirectory() ||
    stat.isSymbolicLink() ||
    (await fs.realpath(selected)) !== selected
  )
    throw new TemplateError("TEMPLATE_ROOT_UNSAFE");
  for (const name of manager === "npm"
    ? ["pnpm-lock.yaml", "yarn.lock", "bun.lock", "bun.lockb"]
    : [
        "package-lock.json",
        "npm-shrinkwrap.json",
        "yarn.lock",
        "bun.lock",
        "bun.lockb",
      ]) {
    try {
      await fs.lstat(path.join(selected, name));
      throw new TemplateError("TEMPLATE_MANAGER_MIGRATION_REQUIRED");
    } catch (cause) {
      if (
        !cause ||
        typeof cause !== "object" ||
        !("code" in cause) ||
        cause.code !== "ENOENT"
      )
        throw cause;
    }
  }
  const args =
    manager === "npm"
      ? [
          "install",
          "--ignore-scripts",
          "--workspaces=false",
          "--no-audit",
          "--no-fund",
        ]
      : ["install", "--ignore-scripts", "--no-frozen-lockfile"];
  return { exitCode: (await run(manager, args, selected)).exitCode };
}

/** Only an explicitly requested exact release may populate this isolated cache. */
export function createCatalogRegistry(
  options: { cacheRoot?: string; run?: TemplateProcessRunner } = {},
): (version: string) => Promise<string> {
  return async (version) => {
    exactTemplateVersion(version);
    const cache = path.resolve(
        options.cacheRoot ??
          path.join(os.homedir(), ".cache/cortex/template-catalog"),
      ),
      destination = path.join(cache, version + ".tgz");
    await fs.mkdir(cache, { recursive: true, mode: 0o700 });
    const stat = await fs.lstat(cache);
    if (
      !stat.isDirectory() ||
      stat.isSymbolicLink() ||
      (await fs.realpath(cache)) !== cache
    )
      throw new TemplateError("TEMPLATE_CACHE_UNSAFE");
    try {
      await fs.lstat(destination);
      await resolveTemplateCatalog(destination, { catalogVersion: version });
      return destination;
    } catch (cause) {
      if (
        !cause ||
        typeof cause !== "object" ||
        !("code" in cause) ||
        cause.code !== "ENOENT"
      )
        throw cause;
    }
    const temporary = await fs.mkdtemp(path.join(cache, ".download-"));
    try {
      const result = await (options.run ?? runTemplateProcess)(
        "npm",
        [
          "pack",
          `@cortexmemory/templates@${version}`,
          "--ignore-scripts",
          "--json",
          "--cache",
          path.join(temporary, "npm-cache"),
          "--pack-destination",
          temporary,
        ],
        temporary,
      );
      if (result.exitCode !== 0)
        throw new TemplateError("TEMPLATE_VERSION_UNAVAILABLE");
      let filename: unknown;
      try {
        const rows: unknown = JSON.parse(result.stdout);
        if (Array.isArray(rows) && rows.length === 1)
          filename = rows[0]?.filename;
      } catch {
        /* Fixed diagnostic below. */
      }
      if (
        typeof filename !== "string" ||
        filename !== path.basename(filename) ||
        !/^[A-Za-z0-9_.-]+\.tgz$/.test(filename)
      )
        throw new TemplateError("TEMPLATE_REGISTRY_RESULT_INVALID");
      const packed = path.join(temporary, filename);
      await resolveTemplateCatalog(packed, { catalogVersion: version });
      // Exclusive publication prevents replacing another verified concurrent release.
      try {
        await fs.copyFile(packed, destination, 1);
      } catch (cause) {
        if (
          !cause ||
          typeof cause !== "object" ||
          !("code" in cause) ||
          cause.code !== "EEXIST"
        )
          throw cause;
        await resolveTemplateCatalog(destination, { catalogVersion: version });
      }
      return destination;
    } finally {
      await fs.rm(temporary, { recursive: true, force: true });
    }
  };
}
