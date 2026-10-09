#!/usr/bin/env node
/** Stage trusted native test fixtures separately from the published backend. */
import { cp, mkdtemp, mkdir, readdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const url = process.env.CONVEX_URL;
const key = process.env.CONVEX_DEPLOY_KEY;
if (process.env.CI !== "true" || process.env.CORTEX_CI_PREPARE_NATIVE_FIXTURES !== "true" ||
    process.env.CORTEX_CI_TARGET_CLASS !== "isolated-native" ||
    !/^[a-f0-9]{12,64}$/.test(process.env.CORTEX_CI_NATIVE_CONTAINER_ID ?? "") ||
    !/^[A-Za-z0-9_-]{1,160}$/.test(process.env.CORTEX_CI_NATIVE_OWNER ?? "") ||
    !url || url !== process.env.CORTEX_CI_EXPECTED_CONVEX_URL || url !== process.env.CORTEX_TEST_EXPECTED_CONVEX_URL || !key?.trim() || /[\r\n\0]/.test(key))
  throw new Error("Native fixture preparation requires explicit CI opt-in, exact expected deployment URLs, and deployment authentication.");
const selected = new URL(url);
if (selected.origin !== url || selected.username || selected.password || selected.protocol !== "http:" || !selected.port ||
    !["localhost", "127.0.0.1", "[::1]"].includes(selected.hostname))
  throw new Error("Native fixture preparation requires a qualified deployment origin.");
const stage = await mkdtemp(join(tmpdir(), "cortex-native-ci-"));
try {
  await cp(join(root, "convex-dev"), join(stage, "convex-dev"), { recursive: true });
  await symlink(join(root, "node_modules"), join(stage, "node_modules"), "dir");
  const manifest = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
  await writeFile(join(stage, "package.json"), JSON.stringify({ name: "cortex-native-ci-fixture", private: true, type: "module", dependencies: { ...manifest.peerDependencies, ...manifest.devDependencies, ...manifest.dependencies } }));
  await writeFile(join(stage, "convex.json"), JSON.stringify({ functions: "convex-dev/" }));
  await mkdir(join(stage, "convex-dev"), { recursive: true });
  for (const name of await readdir(join(root, "tests/fixtures/native"))) {
    if (!name.endsWith(".ts")) continue;
    const source = await readFile(join(root, "tests/fixtures/native", name), "utf8");
    await writeFile(join(stage, "convex-dev", name), source.replaceAll("../../../convex-dev/", "./"));
  }
  // The genuine CLI generates bindings in the temporary project and deploys to
  // this exact URL. No private fixture enters the SDK's convex-dev directory.
  const envFile = join(stage, ".env.native-ci");
  await writeFile(envFile, `CONVEX_SELF_HOSTED_URL=${url}\nCONVEX_SELF_HOSTED_ADMIN_KEY=${key}\n`, { mode: 0o600 });
  const env = { ...process.env };
  for (const name of ["CONVEX_DEPLOY_KEY", "CONVEX_DEPLOYMENT", "CONVEX_URL", "CONVEX_SELF_HOSTED_URL", "CONVEX_SELF_HOSTED_ADMIN_KEY"]) delete env[name];
  try {
    const result = await promisify(execFile)(process.execPath, [join(root, "node_modules/convex/bin/main.js"), "dev", "--once", "--typecheck", "enable", "--codegen", "enable", "--tail-logs", "disable", "--env-file", envFile], { cwd: stage, env, timeout: 600000, maxBuffer: 8 * 1024 * 1024 });
    process.stdout.write((result.stdout + result.stderr).replaceAll(key, "[private]"));
  } catch (error) {
    throw new Error(`Native fixture deployment failed: ${String(error.stdout ?? "")}${String(error.stderr ?? error.message)}`.replaceAll(key, "[private]"));
  }
  console.log("Prepared canonical backend with trusted internal native CI fixtures.");
} finally {
  await rm(stage, { recursive: true, force: true });
}
