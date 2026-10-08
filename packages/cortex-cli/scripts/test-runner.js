import { spawn } from "node:child_process";
import { mkdtemp, mkdir, rm, realpath } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import { cliTestTarget } from "../tests/helpers/test-environment.js";

const cli = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const projects = {
  unit: ["unit"],
  commands: ["commands"],
  fast: ["unit", "commands"],
  e2e: ["e2e"],
  all: ["unit", "commands", "e2e"],
};
const toolInputs = [
  "CORTEX_BOOTSTRAP_NPM_ROOT",
  "CORTEX_BOOTSTRAP_DEPENDENCY_ROOT",
  "CORTEX_BOOTSTRAP_DEPENDENCY_BINDING",
  "CORTEX_RUNTIME_GUARD",
  "CORTEX_RUNTIME_NODE_MINIMUM",
  "CORTEX_RUNTIME_NODE20_0",
  "CORTEX_RUNTIME_NODE20_20",
];

/** Fresh HOME precedes Jest startup. Optional tool inputs never select a data target. */
export function testEnvironment(input, root, live) {
  const environment = {
    HOME: join(root, "home"),
    CORTEX_TEST_HOME_ROOT: join(root, "home"),
    CORTEX_BOOTSTRAP_PROOF_ROOT: join(root, "bootstrap"),
    TMPDIR: join(root, "tmp"),
    PATH: input.PATH ?? dirname(process.execPath),
  };
  for (const name of [
    "SystemRoot",
    "COMSPEC",
    "PATHEXT",
    "TERM",
    "CI",
    "NO_COLOR",
    "FORCE_COLOR",
    "LANG",
    "LC_ALL",
    ...toolInputs,
  ])
    if (typeof input[name] === "string") environment[name] = input[name];
  if (live) environment.CONVEX_URL_CLI = cliTestTarget(input);
  return environment;
}

/** jestEntry is a test seam for an owned child fixture, never a CLI/env override. */
export async function runCliTests(
  mode,
  args = [],
  { environment = process.env, jestEntry, stdio = "inherit" } = {},
) {
  if (!Object.hasOwn(projects, mode)) throw new Error("Unknown CLI test mode.");
  if (
    args.some((arg) =>
      /^(?:-c$|--(?:forceExit|force-exit|config|projects|selectProjects|select-projects)(?:=|$))/.test(
        arg,
      ),
    )
  )
    throw new Error(
      "Use the canonical test mode/config; forceExit is disabled.",
    );
  const live = mode === "all" || mode === "e2e";
  if (live) cliTestTarget(environment);
  const entry =
    jestEntry ?? createRequire(import.meta.url).resolve("jest/bin/jest");
  let root = await mkdtemp(join(tmpdir(), "cortex-cli-tests-"));
  let child, cancellation, killTimer;
  const cancel = (signal) => {
    cancellation ??= signal;
    if (child && child.exitCode === null && child.signalCode === null) {
      child.kill(signal);
      killTimer ??= setTimeout(() => child.kill("SIGKILL"), 5000);
      killTimer.unref();
    }
  };
  const interrupt = () => cancel("SIGINT"),
    terminate = () => cancel("SIGTERM");
  try {
    root = await realpath(root);
    for (const directory of ["home", "bootstrap", "tmp"])
      await mkdir(join(root, directory), { mode: 0o700 });
    process.on("SIGINT", interrupt);
    process.on("SIGTERM", terminate);
    child = spawn(
      process.execPath,
      [
        "--experimental-vm-modules",
        entry,
        "--config",
        join(cli, "jest.config.js"),
        "--selectProjects",
        ...projects[mode],
        ...args,
      ],
      {
        cwd: cli,
        env: testEnvironment(environment, root, live),
        stdio,
      },
    );
    const result = await new Promise((resolveResult, reject) => {
      let spawnError;
      child.once("error", (error) => {
        spawnError = error;
      });
      child.once("close", (code, signal) => {
        if (spawnError) reject(new Error("Unable to start Jest child."));
        else resolveResult({ code, signal });
      });
    });
    return cancellation === "SIGINT" || result.signal === "SIGINT"
      ? 130
      : cancellation === "SIGTERM" || result.signal === "SIGTERM"
        ? 143
        : (result.code ?? 1);
  } finally {
    if (killTimer) clearTimeout(killTimer);
    process.removeListener("SIGINT", interrupt);
    process.removeListener("SIGTERM", terminate);
    await rm(root, { recursive: true, force: true });
  }
}

if (
  process.argv[1] &&
  pathToFileURL(resolve(process.argv[1])).href === import.meta.url
) {
  try {
    process.exitCode = await runCliTests(
      process.argv[2] ?? "all",
      process.argv.slice(3),
    );
  } catch (error) {
    console.error(`CLI test runner: ${error.message}`);
    process.exitCode = 1;
  }
}
