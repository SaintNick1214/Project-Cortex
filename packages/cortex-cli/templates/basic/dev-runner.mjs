#!/usr/bin/env node
/** Watch the application only. Deployment, graph services and host config are separate commands. */
import { spawn } from "node:child_process";
import { pathToFileURL } from "node:url";
export function runDev(start = spawn) {
  const child = start(process.execPath, ["--env-file-if-exists=.env.local", "--import", "tsx", "--watch", "src/server.ts"], { stdio: "inherit", env: process.env });
  let stopping = false, timer;
  const stop = () => { if (stopping) return; stopping = true; child.kill("SIGTERM"); timer = setTimeout(() => child.kill("SIGKILL"), 5000); timer.unref(); };
  process.once("SIGINT", stop); process.once("SIGTERM", stop);
  child.once("close", code => { clearTimeout(timer); process.removeListener("SIGINT", stop); process.removeListener("SIGTERM", stop); if (!stopping) process.exitCode = code ?? 1; });
  child.once("error", () => { clearTimeout(timer); process.removeListener("SIGINT", stop); process.removeListener("SIGTERM", stop); console.error("Application watcher could not start."); process.exitCode = 1; });
  return child;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) runDev();
