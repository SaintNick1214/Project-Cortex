/** Start only a new disposable loopback target; never adopt or stop another service. */
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { spawn, execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import { openSync, closeSync } from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";

if (process.argv.length !== 2) throw new Error("This fixed local qualification target accepts no deployment selectors");
const pointer = "/tmp/cortex-external-native-target-path";
assert.equal(await fs.access(pointer).then(() => true, error => { if (error.code === "ENOENT") return false; throw error; }), false, "Existing owned-target pointer must be reconciled first");
const reservations = [];
try {
  for (const port of [3486, 3487]) {
    const server = net.createServer();
    await new Promise((resolve, reject) => { server.once("error", reject); server.listen(port, "127.0.0.1", resolve); });
    reservations.push(server);
  }
  const binary = path.join(os.homedir(), ".cache/convex/binaries/precompiled-2026-10-06-a3538c6/convex-local-backend");
  assert.ok((await fs.stat(binary)).isFile());
  const state = await fs.mkdtemp(path.join(os.tmpdir(), "cortex-external-native-")), secret = randomBytes(32).toString("hex"), name = "cortex-external-isolated-test";
  await fs.chmod(state, 0o700);
  let key;
  try { key = execFileSync(binary, ["keygen", "admin-key", "--instance-name", name, "--instance-secret", secret], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim(); }
  catch { await fs.rm(state, { recursive: true, force: true }); throw new Error("Local ephemeral key generation failed; arguments withheld"); }
  assert.ok(key.length > 20 && !/[\r\n]/.test(key));
  const config = { binary, state, name, secret, key, url: "http://127.0.0.1:3486", site: "http://127.0.0.1:3487", fresh: true, production: false };
  const targetPath = path.join(state, "target.json");
  await fs.writeFile(targetPath, JSON.stringify(config), { mode: 0o600, flag: "wx" });
  const environment = { ...process.env };
  for (const field of Object.keys(environment)) if (/^(?:CONVEX|CORTEX|OPENAI|ANTHROPIC|GOOGLE|GEMINI|NEO4J|MEMGRAPH)_/.test(field)) delete environment[field];
  environment.CONVEX_BEACON_DISABLED = "true";
  const log = openSync(path.join(state, "backend.log"), "a", 0o600);
  for (const server of reservations) await new Promise(resolve => server.close(resolve)); reservations.length = 0;
  let child;
  try { child = spawn(binary, ["--interface", "127.0.0.1", "--port", "3486", "--site-proxy-port", "3487", "--instance-name", name, "--instance-secret", secret,
    "--disable-beacon", "--local-storage", path.join(state, "storage"), path.join(state, "db.sqlite3")], { cwd: state, env: environment, detached: true, stdio: ["ignore", log, log] }); }
  finally { closeSync(log); }
  assert.ok(Number.isSafeInteger(child.pid)); child.unref();
  await fs.writeFile(path.join(state, "qualification.pid"), String(child.pid), { mode: 0o600 });
  await fs.writeFile(pointer, targetPath, { mode: 0o600, flag: "wx" });
  for (let attempt = 0; attempt < 100; attempt++) {
    try { const response = await fetch(config.url + "/version"); if (response.ok) { console.log(JSON.stringify({ url: config.url, site: config.site, pid: child.pid, fresh: true, production: false })); process.exit(0); } } catch { /* Wait only for this fixed loopback service. */ }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error("Fresh local backend readiness failed; reconcile the private target pointer before retry");
} finally { for (const server of reservations) await new Promise(resolve => server.close(resolve)); }
