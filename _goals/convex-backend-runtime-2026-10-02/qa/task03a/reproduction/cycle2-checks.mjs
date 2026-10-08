import fs from "node:fs";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

const base = "_goals/convex-backend-runtime-2026-10-02/qa/task03a";
const output = `${base}/checks/cycle2-inventory-policy-fix`;
fs.mkdirSync(output, { recursive: true });
const previous = JSON.parse(fs.readFileSync(`${base}/public-path-inventory.json`, "utf8"));
const npm12 = ["exec", "--offline", "--package=npm@12.2.0", "--", "npm", "exec", "--offline", "--"];
const checks = [
  { name: "inventory-work", command: "node", args: ["work/backend-runtime/task03a/inventory.mjs"] },
  { name: "inventory-reproduction", command: "node", args: [`${base}/reproduction/inventory.mjs`] },
  { name: "root-strict-inventory-tests", command: "npm", args: [...npm12, "tsc", "--project", "work/backend-runtime/task03a/tsconfig.root.json", "--noEmit"] },
  { name: "inventory-scoped-eslint", command: "npm", args: [...npm12, "eslint", "tests/unit/runtimeAuth/inventory.test.ts", "work/backend-runtime/task03a/inventory.mjs", `${base}/reproduction/inventory.mjs`, "--report-unused-disable-directives"] },
  { name: "inventory-policy-unit", command: "npm", args: [...npm12, "node", "--experimental-vm-modules", "node_modules/jest/bin/jest.js", "--testPathPatterns=tests/unit/runtimeAuth/inventory.test.ts", "--runInBand", "--forceExit"],
    environment: { CONVEX_URL: "http://127.0.0.1:1", CONVEX_TEST_MODE: "local" } },
];
const receipts = [];
for (const check of checks) {
  const startedAt = new Date().toISOString();
  const result = spawnSync(check.command, check.args, { cwd: process.cwd(), encoding: "utf8", timeout: 60000,
    env: { ...process.env, ...check.environment }, maxBuffer: 10 * 1024 * 1024 });
  fs.writeFileSync(`${output}/${check.name}.stdout.log`, result.stdout ?? "");
  fs.writeFileSync(`${output}/${check.name}.stderr.log`, result.stderr ?? "");
  receipts.push({ ...check, cwd: process.cwd(), startedAt, finishedAt: new Date().toISOString(), exitCode: result.status,
    signal: result.signal, error: result.error?.message, stdout: `${output}/${check.name}.stdout.log`, stderr: `${output}/${check.name}.stderr.log` });
  process.stdout.write(`${check.name}: ${result.status === 0 ? "PASS" : "FAIL"}\n`);
}
fs.writeFileSync(`${output}/commands.json`, JSON.stringify(receipts, null, 2) + "\n");
const current = JSON.parse(fs.readFileSync(`${base}/public-path-inventory.json`, "utf8"));
assert.deepEqual(current.completeness.counts, previous.completeness.counts);
assert.deepEqual(current.completeness.sourceHashes, previous.completeness.sourceHashes);
assert.deepEqual(current.endpoints.filter((endpoint) => !endpoint.path.startsWith("runtimeAuth:")),
  previous.endpoints.filter((endpoint) => !endpoint.path.startsWith("runtimeAuth:")));
assert.equal(fs.readFileSync("work/backend-runtime/task03a/inventory.mjs", "utf8"), fs.readFileSync(`${base}/reproduction/inventory.mjs`, "utf8"));
fs.writeFileSync(`${output}/preserved-boundaries.json`, JSON.stringify({ countsUnchanged: true, sourceHashesUnchanged: true,
  nonAuthPoliciesUnchanged: true, retainedRunnersIdentical: true, authPoliciesCorrected: 8 }, null, 2) + "\n");
if (receipts.some((receipt) => receipt.exitCode !== 0)) process.exitCode = 1;
