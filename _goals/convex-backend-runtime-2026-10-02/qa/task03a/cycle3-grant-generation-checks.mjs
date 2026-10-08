import fs from "node:fs";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

const base = "_goals/convex-backend-runtime-2026-10-02/qa/task03a";
const output = `${base}/checks/cycle3-grant-generation-fix`;
fs.mkdirSync(output, { recursive: true });
const before = JSON.parse(fs.readFileSync(`${base}/history/cycle3-pre-grant-invariant/public-path-inventory.json`, "utf8"));
const npm12 = ["exec", "--offline", "--package=npm@12.2.0", "--", "npm", "exec", "--offline", "--"];
const checks = [
  { name: "inventory-retained", command: "node", args: [`${base}/inventory.mjs`] },
  { name: "inventory-reproduction", command: "node", args: [`${base}/reproduction/inventory.mjs`] },
  { name: "backend-strict", command: "npm", args: [...npm12, "tsc", "--project", `${base}/tsconfig.authority-backend.json`, "--noEmit"] },
  { name: "root-strict", command: "npm", args: [...npm12, "tsc", "--project", `${base}/tsconfig.authority-root.json`, "--noEmit"] },
  { name: "affected-eslint", command: "npm", args: [...npm12, "eslint", "convex-dev/runtimeAuth.ts", "convex-dev/runtimeAuthSchema.ts", "convex-dev/schema.ts", "src/auth/verified.ts", "tests/unit/runtimeAuth", `${base}/inventory.mjs`, `${base}/reproduction/inventory.mjs`, "--report-unused-disable-directives"] },
  { name: "all-authority-and-portable-policy-unit", command: "npm", args: [...npm12, "node", "--experimental-vm-modules", "node_modules/jest/bin/jest.js", "--testPathPatterns=tests/unit/runtimeAuth", "--runInBand", "--forceExit"],
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
const semantic = (entry) => Object.fromEntries(
  Object.entries(entry).filter(([key]) => key !== "file" && key !== "line"),
);
assert.deepEqual(current.completeness.counts, before.completeness.counts);
assert.deepEqual(current.endpoints.map(semantic), before.endpoints.map(semantic));
const hashChanges = current.completeness.sourceHashes.filter((entry) => {
  const previous = before.completeness.sourceHashes.find((candidate) => candidate.file === entry.file);
  assert.ok(previous);
  return entry.sha256 !== previous.sha256;
}).map((entry) => ({ file: entry.file, before: before.completeness.sourceHashes.find((candidate) => candidate.file === entry.file).sha256, after: entry.sha256 }));
assert.deepEqual(hashChanges.map((entry) => entry.file), ["convex-dev/runtimeAuth.ts"]);
const shiftedLocations = current.endpoints.flatMap((entry) => {
  const previous = before.endpoints.find((candidate) => candidate.path === entry.path);
  assert.ok(previous);
  assert.equal(entry.file, previous.file);
  return entry.line === previous.line ? [] : [{ path: entry.path, file: entry.file, beforeLine: previous.line, afterLine: entry.line }];
});
assert.equal(shiftedLocations.length, 8);
assert.ok(shiftedLocations.every((entry) => entry.path.startsWith("runtimeAuth:")));
fs.writeFileSync(`${output}/historical-qualification.json`, JSON.stringify({ countsUnchanged: true, allPolicySemanticsUnchangedFromPreFixCycle3: true,
  intentionalSourceHashChanges: hashChanges, otherBackendSourceHashesUnchanged: 21, expectedRegistrationLocationShifts: shiftedLocations,
  priorInventoryPolicyChanges: "21 intentional non-auth policy changes are preserved in history/cycle3-pre-grant-invariant/historical-qualification.json; this helper fix changes none of those policy semantics.",
  supersedes: "Original55 helper outcomes no longer certify the changed helper; all current authority and portable policy suites were rerun." }, null, 2) + "\n");
if (receipts.some((receipt) => receipt.exitCode !== 0)) process.exitCode = 1;
