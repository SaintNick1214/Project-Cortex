import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
const directory = path.dirname(fileURLToPath(import.meta.url));
const sourcePaths = ["src/graph/runtime/CypherProjectionConnector.ts", "src/graph/runtime/worker.ts", "src/graph/runtime/index.ts", "package.json",
  "tests/unit/graph/runtime-projection-worker.test.ts", "tests/unit/graph/runtime-projection-connector.test.ts"];
const refs = () => sourcePaths.map(p => { const body = fs.readFileSync(p); return { path: p, bytes: body.length, sha256: crypto.createHash("sha256").update(body).digest("hex") }; });
const before = refs();
const commands = [
  { name: "sdk-types2", executable: "node", args: ["node_modules/typescript/bin/tsc", "--noEmit", "--pretty", "false"] },
  { name: "root-lint2", executable: "node", args: ["node_modules/eslint/bin/eslint.js", "src/graph/runtime", "tests/unit/graph", "--report-unused-disable-directives"] },
  { name: "controlled-unit3", executable: "node", args: ["--experimental-vm-modules", "node_modules/jest/bin/jest.js", "--config", path.join(directory, "jest.config.mjs"), "--runInBand", "--json", "--outputFile", path.join(directory, "unit-results3.json")] },
];
const outcomes = await Promise.all(commands.map(c => new Promise(resolve => {
  const fd = fs.openSync(path.join(directory, c.name + ".log"), "w", 0o600), started = Date.now();
  const child = spawn(c.executable, c.args, { cwd: process.cwd(), env: process.env, stdio: ["ignore", fd, fd] });
  child.once("error", error => { fs.writeSync(fd, String(error)); });
  child.once("close", (code, signal) => {
    fs.closeSync(fd); resolve({ name: c.name, executable: c.executable, arguments: c.args, exitCode: code,
      signal, elapsedMs: Date.now() - started, log: c.name + ".log" });
  });
})));
const after = refs(), unchanged = JSON.stringify(before) === JSON.stringify(after);
const output = { version: 1, scope: "ROOT_NODE_CONNECTOR_CONTROLLED_CHECKS", node: process.version,
  sourceBefore: before, sourceAfter: after, unchangedSelectedRootSource: unchanged, outcomes,
  actualGraphWorkerAcceptance: false, status: unchanged && outcomes.every(c => c.exitCode === 0) ? "PASS" : "FAIL" };
fs.writeFileSync(path.join(directory, "checks-run2.json"), JSON.stringify(output, null, 2) + "\n");
process.stdout.write(JSON.stringify({ status: output.status, unchanged, outcomes }) + "\n");
if (output.status !== "PASS") process.exitCode = 1;
