/** Run only the selected project's pinned native CLI. No shell or package download. */
import fs from "node:fs";
import path from "node:path";
import { StringDecoder } from "node:string_decoder";
import { execFileSync, spawn, type ChildProcess } from "node:child_process";
import { assertSafePath, resolveProjectDirectory } from "./schema-sync.js";
import { CONVEX_VERSION } from "./install.js";
import {
  acquireForegroundSignalHandler,
  setupClientCleanup,
} from "./client.js";

export interface NativeResult {
  code: number;
  signal: string | null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
}
export function resolveInstalledConvex(project: string): string {
  const root = resolveProjectDirectory(project);
  const modules = assertSafePath(root, "node_modules");
  const selected = path.join(modules, "convex");
  const missing = () => new Error(
    `Install convex@${CONVEX_VERSION} in the selected project; no global or npx fallback`,
  );
  if (!fs.existsSync(selected)) throw missing();
  if (!fs.statSync(modules).isDirectory())
    throw new Error("Selected project node_modules must be a directory");
  let packageRoot = selected;
  const selectedKind = fs.lstatSync(selected);
  if (selectedKind.isSymbolicLink()) {
    // pnpm's one package link is permitted; its target tree retains strict file guards.
    const target = path.resolve(modules, fs.readlinkSync(selected));
    if (!target.startsWith(modules + path.sep))
      throw new Error("Symlink installed Convex target must remain inside selected node_modules");
    const safeTarget = assertSafePath(modules, path.relative(modules, target));
    packageRoot = fs.realpathSync(safeTarget);
    if (!packageRoot.startsWith(fs.realpathSync(modules) + path.sep))
      throw new Error("Symlink installed Convex target must remain inside selected node_modules");
  } else if (!selectedKind.isDirectory())
    throw new Error("Installed Convex package must be a directory");
  if (!fs.statSync(packageRoot).isDirectory())
    throw new Error("Installed Convex package must be a directory");
  const packagePath = assertSafePath(packageRoot, "package.json");
  if (!fs.existsSync(packagePath)) throw missing();
  if (!fs.statSync(packagePath).isFile())
    throw new Error("Installed Convex manifest must be a regular file");
  const manifest = JSON.parse(fs.readFileSync(packagePath, "utf8"));
  if (manifest.name !== "convex" || manifest.version !== CONVEX_VERSION)
    throw new Error(
      `Selected project requires installed convex@${CONVEX_VERSION}`,
    );
  const entry =
    typeof manifest.bin === "string" ? manifest.bin : manifest.bin?.convex;
  if (typeof entry !== "string")
    throw new Error("Installed Convex binary metadata is invalid");
  const bin = assertSafePath(
    path.dirname(packagePath),
    entry.replace(/^\.\//, ""),
  );
  if (!fs.existsSync(bin) || !fs.statSync(bin).isFile())
    throw new Error("Installed Convex binary is missing");
  return bin;
}
export function nativeEnvironment(
  overrides: Record<string, string | undefined> = {},
): Record<string, string | undefined> {
  const env = { ...process.env };
  for (const key of Object.keys(env))
    if (
      /^(CONVEX_|LOCAL_CONVEX_|CLOUD_CONVEX_|ENV_CONVEX_|NEXT_PUBLIC_CONVEX_|VITE_CONVEX_|CORTEX_SDK_DEV_PATH|NODE_OPTIONS|DOTENV_)/.test(
        key,
      )
    )
      delete env[key];
  // Empty selectors also prevent native dotenv from filling them from unrelated .env files.
  for (const key of [
    "CONVEX_DEPLOY_KEY",
    "CONVEX_DEPLOYMENT",
    "CONVEX_DEPLOYMENT_TOKEN",
    "CONVEX_SELF_HOSTED_URL",
    "CONVEX_SELF_HOSTED_ADMIN_KEY",
    "CONVEX_OVERRIDE_ACCESS_TOKEN",
  ])
    env[key] = "";
  return { ...env, ...overrides };
}
export function redactNative(text: string, secrets: readonly string[]): string {
  for (const secret of secrets.filter(Boolean))
    text = text.split(secret).join("***");
  return text;
}
export interface NativeOptions {
  env?: Record<string, string | undefined>;
  secrets?: readonly string[];
  timeoutMs?: number;
  capture?: boolean;
  /** Fixed protocol callers may inspect stdout and finish only after a validated response. */
  protocol?: (
    child: ChildProcess,
    complete: () => void,
    fail: () => void,
  ) => void;
  maxOutputBytes?: number;
}
export async function runConvex(
  project: string,
  argv: readonly string[],
  options: NativeOptions = {},
): Promise<NativeResult> {
  const bin = resolveInstalledConvex(project);
  return await runInstalledProcess(project, bin, argv, options);
}
/** npm tool delivery is independent of Convex delivery; install only selected specs. */
export async function runNpmInstall(
  project: string,
  specs: readonly string[],
  options: NativeOptions = {},
): Promise<NativeResult> {
  if (process.platform === "win32")
    throw new Error(
      "Native npm dependency apply on Windows is not supported by this candidate; use the displayed npm command manually",
    );
  let entry: string;
  try {
    entry = fs.realpathSync(
      execFileSync("which", ["npm"], {
        encoding: "utf8",
        timeout: 5000,
      }).trim(),
    );
  } catch {
    throw new Error("npm is required for selected dependency apply");
  }
  if (path.basename(entry) !== "npm-cli.js")
    throw new Error(
      "Cannot verify npm's installed JavaScript entrypoint; use the displayed npm command manually",
    );
  return await runInstalledProcess(
    project,
    entry,
    ["install", "--ignore-scripts", "--save-exact", ...specs],
    { ...options, timeoutMs: 600000 },
  );
}
async function runInstalledProcess(
  project: string,
  bin: string,
  argv: readonly string[],
  options: NativeOptions,
): Promise<NativeResult> {
  if (argv.some((arg) => typeof arg !== "string" || arg.includes("\0")))
    throw new Error("Invalid native argument");
  const timeout = options.timeoutMs ?? 120000;
  if (!Number.isSafeInteger(timeout) || timeout < 0 || timeout > 3600000)
    throw new Error("Invalid native timeout");
  const secrets = options.secrets ?? [];
  setupClientCleanup();
  let resolveDrain: () => void = () => {};
  const drained = new Promise<void>((resolve) => {
    resolveDrain = resolve;
  });
  let forwardSignal: (signal: "SIGINT" | "SIGTERM") => void = () => {};
  const releaseSignal = acquireForegroundSignalHandler(async (signal) => {
    forwardSignal(signal);
    await drained;
  });
  return await new Promise((resolve) => {
    const child = spawn(process.execPath, [bin, ...argv], {
      cwd: project,
      env: nativeEnvironment(options.env),
      shell: false,
      detached: process.platform !== "win32",
      stdio: [options.protocol ? "pipe" : "inherit", "pipe", "pipe"],
    });
    let stdout = "",
      stderr = "",
      timedOut = false,
      forcedCode: number | undefined;
    let closed = false,
      killTimer: ReturnType<typeof setTimeout> | undefined;
    const kill = (signal: "SIGINT" | "SIGTERM" | "SIGKILL"): void => {
      if (!child.pid || closed) return;
      try {
        if (process.platform !== "win32") process.kill(-child.pid, signal);
        else child.kill(signal);
      } catch {
        /* The owned process group has already exited. */
      }
    };
    const stop = (code: number): void => {
      forcedCode = code;
      kill("SIGTERM");
      killTimer ??= setTimeout(() => kill("SIGKILL"), 2000);
    };
    const interrupted = (signal: "SIGINT" | "SIGTERM" | "SIGKILL"): void => {
      forcedCode = signal === "SIGINT" ? 130 : 143;
      kill(signal);
      killTimer ??= setTimeout(() => kill("SIGKILL"), 2000);
    };
    forwardSignal = interrupted;
    const onExit = () => kill("SIGKILL");
    process.on("exit", onExit);
    const timer =
      timeout > 0
        ? setTimeout(() => {
            timedOut = true;
            stop(124);
          }, timeout)
        : undefined;
    const finish = (code: number, signal: string | null): void => {
      if (closed) return;
      // Kill only any surviving descendants of the owned child, never scan ports/PIDs.
      kill("SIGKILL");
      closed = true;
      clearTimeout(timer);
      clearTimeout(killTimer);
      process.off("exit", onExit);
      releaseSignal();
      resolveDrain();
      resolve({
        code: forcedCode ?? code,
        signal,
        stdout: redactNative(stdout, secrets),
        stderr: redactNative(stderr, secrets),
        timedOut,
      });
    };
    let outLine = "",
      errLine = "",
      outputBytes = 0;
    const outDecoder = new StringDecoder("utf8"),
      errDecoder = new StringDecoder("utf8");
    const output = (data: Buffer, error: boolean, flush = false): void => {
      if (
        outputBytes + data.byteLength >
        (options.maxOutputBytes ?? 8 * 1024 * 1024)
      ) {
        stop(1);
        return;
      }
      outputBytes += data.byteLength;
      const decoder = error ? errDecoder : outDecoder;
      const value = flush ? decoder.end() : decoder.write(data);
      if (error) stderr += value;
      else stdout += value;
      if (!options.capture && !options.protocol) {
        let pending = (error ? errLine : outLine) + value;
        const lines = pending.split("\n");
        pending = lines.pop() ?? "";
        for (const line of lines)
          (error ? process.stderr : process.stdout).write(
            redactNative(line, secrets) + "\n",
          );
        if (error) errLine = pending;
        else outLine = pending;
      }
    };
    child.stdout?.on("data", (data: Buffer) => output(data, false));
    child.stderr?.on("data", (data: Buffer) => output(data, true));
    child.once("error", () => {
      stderr += "Could not start selected native Convex binary";
      finish(1, null);
    });
    child.once("exit", () => kill("SIGKILL"));
    child.once("close", (code, signal) => {
      output(Buffer.alloc(0), false, true);
      output(Buffer.alloc(0), true, true);
      if (!options.capture && !options.protocol) {
        if (outLine) process.stdout.write(redactNative(outLine, secrets));
        if (errLine) process.stderr.write(redactNative(errLine, secrets));
      }
      finish(
        code ?? (signal === "SIGINT" ? 130 : signal === "SIGTERM" ? 143 : 1),
        signal,
      );
    });
    try {
      options.protocol?.(
        child,
        () => stop(0),
        () => stop(1),
      );
    } catch {
      stop(1);
    }
  });
}
export function propagateNativeResult(result: NativeResult): boolean {
  if (result.code === 0) return true;
  process.exitCode = result.code;
  console.error(
    result.timedOut
      ? "Native Convex operation timed out"
      : `Native Convex operation failed (exit ${result.code})`,
  );
  return false;
}
