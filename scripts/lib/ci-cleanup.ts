import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

export interface CiResetTarget { url: string; key: string }
type Run = (command: string, args: string[], env: NodeJS.ProcessEnv) => string;

/** An independently configured allowlist and an explicit destructive opt-in are required. */
export function ciResetTarget(env: NodeJS.ProcessEnv): CiResetTarget {
  if (env.CI !== "true" || env.CORTEX_CI_ALLOW_DESTRUCTIVE_RESET !== "true")
    throw new Error("Native reset requires CI=true and CORTEX_CI_ALLOW_DESTRUCTIVE_RESET=true for a verified disposable CI deployment. No reset was performed.");
  if (!env.CONVEX_URL || !env.CORTEX_CI_EXPECTED_CONVEX_URL || env.CONVEX_URL !== env.CORTEX_CI_EXPECTED_CONVEX_URL)
    throw new Error("Native reset requires an exact match with the dedicated CORTEX_CI_EXPECTED_CONVEX_URL allowlist. No reset was performed.");
  let parsed: URL;
  try { parsed = new URL(env.CONVEX_URL); } catch { throw new Error("Invalid CI deployment URL. No reset was performed."); }
  if (parsed.username || parsed.password || parsed.search || parsed.hash || parsed.pathname !== "/"
    || !(parsed.protocol === "https:" || parsed.protocol === "http:" && ["127.0.0.1", "localhost", "[::1]"].includes(parsed.hostname)))
    throw new Error("Invalid CI deployment URL. No reset was performed.");
  if (!env.CONVEX_DEPLOY_KEY?.trim()) throw new Error("Native reset requires deployment authentication. No reset was performed.");
  return { url: env.CONVEX_URL, key: env.CONVEX_DEPLOY_KEY };
}

const run: Run = (command, args, env) => execFileSync(command, args, {
  env, encoding: "utf8", timeout: 600_000, maxBuffer: 4 * 1024 * 1024, stdio: ["ignore", "pipe", "pipe"],
});

/** Verify the native export, including all exported components and file storage.
 * System table definitions are metadata, not retained application documents. */
export function verifyEmptySnapshot(snapshot: string, env: NodeJS.ProcessEnv, execute: Run = run): number {
  const entries = execute("unzip", ["-Z1", snapshot], env).trim().split("\n");
  if (entries.some(name => name.startsWith("/") || name.includes("\\") || name.split("/").includes("..")))
    throw new Error("Native reset verification received an invalid snapshot directory.");
  const documents = entries.filter(name => name.endsWith("/documents.jsonl") && !/(^|\/)\_tables\/documents\.jsonl$/.test(name));
  if (!documents.includes("_storage/documents.jsonl"))
    throw new Error("Native reset verification did not include file storage.");
  if (entries.some(name => /(^|\/)\_storage\//.test(name) && !name.endsWith("/documents.jsonl") && !name.endsWith("/generated_schema.jsonl")))
    throw new Error("Native reset left file storage residuals; cleanup is incomplete.");
  if (execute("unzip", ["-p", snapshot, ...documents], env).trim())
    throw new Error("Native reset left application or component documents; cleanup is incomplete.");
  return documents.length;
}

/** Use native authenticated import semantics; application maintenance guards stay intact.
 * This resets database tables/storage, not deployment configuration or scheduled jobs. */
export function resetCiDeployment(env: NodeJS.ProcessEnv, execute: Run = run): { tables: number } {
  const target = ciResetTarget(env); // Refuse before files, subprocesses or network effects.
  const directory = mkdtempSync(join(tmpdir(), "cortex-ci-reset-"));
  try {
    const empty = join(directory, "empty.zip"), snapshot = join(directory, "verified.zip");
    // Storage is reset only when it is explicitly present in the native archive.
    // This ZIP contains one empty, stored `_storage/documents.jsonl` entry.
    writeFileSync(empty, Buffer.from("504b030414000000000000002100000000000000000000000000180000005f73746f726167652f646f63756d656e74732e6a736f6e6c504b01021403140000000000000021000000000000000000000000001800000000000000000000008001000000005f73746f726167652f646f63756d656e74732e6a736f6e6c504b0506000000000100010046000000360000000000", "hex"), { mode: 0o600 });
    const cli = fileURLToPath(new URL("../../node_modules/convex/bin/main.js", import.meta.url));
    const selection = ["--url", target.url, "--admin-key", target.key];
    try {
      execute(process.execPath, [cli, "import", empty, "--replace-all", "--yes", ...selection], env);
      execute(process.execPath, [cli, "export", "--include-file-storage", "--path", snapshot, ...selection], env);
      return { tables: verifyEmptySnapshot(snapshot, env, execute) };
    } catch (error) {
      if (error instanceof Error && error.message.startsWith("Native reset")) throw error;
      throw new Error("Native authenticated CI reset or verification failed; cleanup is incomplete. Inspect the deployment before retrying.");
    }
  } finally { rmSync(directory, { recursive: true, force: true }); }
}
