import fs from "node:fs";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

const base = "_goals/convex-backend-runtime-2026-10-02/qa/task03a";
const output = `${base}/checks/cycle3-inventory-portability-fix`;
fs.mkdirSync(output, { recursive: true });
const previous = JSON.parse(fs.readFileSync(`${base}/history/cycle2/public-path-inventory.json`, "utf8"));
const npm12 = ["exec", "--offline", "--package=npm@12.2.0", "--", "npm", "exec", "--offline", "--"];
const checks = [
  { name: "inventory-retained", command: "node", args: [`${base}/inventory.mjs`] },
  { name: "inventory-reproduction", command: "node", args: [`${base}/reproduction/inventory.mjs`] },
  { name: "root-strict-policy-tests", command: "npm", args: [...npm12, "tsc", "--project", `${base}/tsconfig.policy-tests.json`, "--noEmit"] },
  { name: "policy-scoped-eslint", command: "npm", args: [...npm12, "eslint", "tests/unit/runtimeAuth/inventory.test.ts", `${base}/inventory.mjs`, `${base}/reproduction/inventory.mjs`, "--report-unused-disable-directives"] },
  { name: "portable-fixture-policy-unit", command: "npm", args: [...npm12, "node", "--experimental-vm-modules", "node_modules/jest/bin/jest.js", "--testPathPatterns=tests/unit/runtimeAuth/inventory.test.ts", "--runInBand", "--forceExit"],
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
// This is explicit historical QA, not an active unit-test constraint on future source changes.
const current = JSON.parse(fs.readFileSync(`${base}/public-path-inventory.json`, "utf8"));
const expected = [
  "facts:fetchFactsByIds", "memories:fetchMemoriesByIds", "memories:keywordSearchMemories",
  "admin:listTable", "admin:deleteRecord", "admin:clearTable", "admin:countTable", "admin:getAllCounts",
  "agents:purgeAll", "artifacts:purgeAll", "attachments:purgeAll", "contexts:purgeAll", "conversations:purgeAll",
  "facts:purgeAll", "graphSync:purgeAll", "immutable:purgeAll", "memories:purgeAll", "memorySpaces:purgeAll", "mutable:purgeAll",
  "governance:purgeAllPolicies", "governance:purgeAllEnforcement",
].sort();
assert.deepEqual(current.completeness.counts, previous.completeness.counts);
assert.deepEqual(current.completeness.sourceHashes, previous.completeness.sourceHashes);
const changes = current.endpoints.flatMap((entry) => {
  const before = previous.endpoints.find((candidate) => candidate.path === entry.path);
  assert.ok(before);
  const fields = Object.keys(entry).filter((field) => JSON.stringify(entry[field]) !== JSON.stringify(before[field]));
  return fields.length ? [{ path: entry.path, changedFields: fields }] : [];
});
assert.deepEqual(changes.map((change) => change.path).sort(), expected);
assert.deepEqual(current.endpoints.filter((entry) => entry.path.startsWith("runtimeAuth:")), previous.endpoints.filter((entry) => entry.path.startsWith("runtimeAuth:")));
assert.equal(fs.readFileSync(`${base}/inventory.mjs`, "utf8"), fs.readFileSync(`${base}/reproduction/inventory.mjs`, "utf8"));
fs.writeFileSync(`${output}/historical-qualification.json`, JSON.stringify({ countsUnchanged: true, sourceHashesUnchanged: true,
  authPoliciesUnchanged: true, retainedRunnersIdentical: true, intentionalNonAuthChanges: changes,
  policyTestIsolation: "Both actual retained generators run from independent OS temporary AST fixtures; child work parent and runner absent before/after, production bytes/counts never loaded by active tests." }, null, 2) + "\n");
if (receipts.some((receipt) => receipt.exitCode !== 0)) process.exitCode = 1;
