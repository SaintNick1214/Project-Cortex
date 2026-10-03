import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { spawnSync } from "node:child_process";
import ts from "typescript";

const qa = "_goals/convex-backend-runtime-2026-10-02/qa/task03b2a";
const cycle = `${qa}/cycle3`;
const hash = (file) => crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
const read = (file) => JSON.parse(fs.readFileSync(file, "utf8"));
const archives = [];
for (const [name, count] of [["cycle1-final", 69], ["cycle2-final", 101]]) {
  const base = `${qa}/history/${name}`;
  const preservation = read(`${base}/preservation.json`);
  assert.equal(preservation.records.length, count);
  for (const row of preservation.records) {
    const file = `${base}/${row.kind}/${row.path ?? row.file}${row.kind === "source" ? ".text" : ""}`;
    assert.equal(hash(file), row.sha256, file);
  }
  archives.push({ cycle: name, records: count, manifestSha256: hash(`${base}/preservation.json`), unchanged: true });
}
const sourceHashes = read(`${cycle}/source-hashes.json`);
const changedSources = [];
for (const row of sourceHashes) {
  assert.equal(hash(row.file), row.sha256);
  const old = fs.readFileSync(`${qa}/history/cycle2-final/source/${row.file}.text`, "utf8");
  const current = fs.readFileSync(row.file, "utf8");
  if (old !== current) changedSources.push(row.file);
  if (row.file === "convex-dev/immutable.ts") assert.equal(current, old.replace(
    '  return row ? versions(row).filter((version) => version.timestamp <= args.timestamp).at(-1) ?? null : null;',
    '  const history = row ? versions(row).filter((version) => version.timestamp <= args.timestamp) : [];\n  return history[history.length - 1] ?? null;'));
  else if (row.file === "convex-dev/users.ts") assert.equal(current, old.replace(
    '  const version = row ? versions(row).filter((value) => value.timestamp <= args.timestamp).at(-1) : undefined;',
    '  const history = row ? versions(row).filter((value) => value.timestamp <= args.timestamp) : [];\n  const version = history[history.length - 1];'));
  else if (row.file !== "tests/unit/runtimeMetadataAuth/registrations.test.ts") assert.equal(current, old, row.file);
}
assert.deepEqual(changedSources.sort(), ["convex-dev/immutable.ts", "convex-dev/users.ts", "tests/unit/runtimeMetadataAuth/registrations.test.ts"]);
const configs = [];
for (const file of ["convex-dev/tsconfig.json", `${qa}/tsconfig.backend.json`, `${qa}/tsconfig.tests.json`]) {
  const config = ts.readConfigFile(file, ts.sys.readFile);
  assert.equal(config.error, undefined);
  const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, path.dirname(file));
  assert.equal(parsed.errors.length, 0);
  assert.equal(parsed.options.strict, true);
  assert.ok(parsed.options.lib.includes("lib.es2021.d.ts"));
  assert.ok(parsed.options.lib.every((value) => !/es202[2-9]/.test(value)));
  configs.push({ file, strict: parsed.options.strict, lib: parsed.options.lib, sha256: hash(file) });
}
const originalConfig = spawnSync("git", ["show", "HEAD:convex-dev/tsconfig.json"], { encoding: "utf8" });
assert.equal(originalConfig.status, 0);
assert.equal(fs.readFileSync("convex-dev/tsconfig.json", "utf8"), originalConfig.stdout);
const baseline = read(`${qa}/baseline-unchanged.json`);
for (const row of baseline) {
  assert.equal(hash(row.file), row.sha256);
  const result = spawnSync("git", ["show", `HEAD:${row.file}`]);
  assert.equal(result.status, 0);
  assert.deepEqual(fs.readFileSync(row.file), result.stdout);
}
const catalog = read(`${qa}/catalog/public-path-inventory.json`);
const oldCatalog = read(`${qa}/history/cycle2-final/qa/catalog/public-path-inventory.json`);
assert.deepEqual(catalog.completeness.unresolved, []);
assert.deepEqual(catalog.completeness.counts, oldCatalog.completeness.counts);
assert.equal(catalog.completeness.counts.registered, 41);
assert.equal(catalog.completeness.counts.public, 36);
assert.equal(catalog.completeness.counts.internal, 5);
const omitLine = (entry) => {
  const row = { ...entry };
  delete row.line;
  return row;
};
assert.deepEqual(catalog.endpoints.map(omitLine), oldCatalog.endpoints.map(omitLine));
assert.deepEqual(read(`${qa}/framework-registration.json`), read(`${qa}/history/cycle2-final/qa/framework-registration.json`));
const jest = read(`${cycle}/jest-results.json`);
const oldJest = read(`${qa}/history/cycle2-final/qa/jest-results.json`);
assert.equal(jest.numTotalTests, 189);
assert.equal(jest.numPassedTests, 189);
assert.equal(jest.numFailedTests, 0);
assert.equal(jest.numPendingTests, 0);
assert.equal(jest.numTotalTestSuites, 2);
const names = (results) => results.testResults.flatMap((suite) => suite.assertionResults.map((result) => result.fullName));
assert.deepEqual(names(jest), names(oldJest));
assert.deepEqual(JSON.parse(fs.readFileSync(`${cycle}/checks/test-discovery.log`, "utf8").split("\n")[0]).sort(), [
  path.resolve("tests/unit/runtimeMetadataAuth/handlers.test.ts"), path.resolve("tests/unit/runtimeMetadataAuth/registrations.test.ts"),
].sort());
const timestamp = read(`${cycle}/checks/timestamp-outcomes.log`);
assert.equal(timestamp.total, 14);
assert.ok(timestamp.outcomes.every((row) => row.pass));
const preservation = read(`${cycle}/catalog-test-preservation.json`);
assert.equal(preservation.bytesUnchanged, true);
assert.deepEqual(preservation.before, preservation.after);
assert.equal(preservation.noTemporaryLeak, true);
assert.deepEqual(preservation.temporaryBefore, preservation.temporaryAfter);
const rootLog = fs.readFileSync(`${cycle}/checks/full-root-types.log`, "utf8");
assert.equal(rootLog, fs.readFileSync(`${qa}/history/cycle2-final/qa/checks/full-root-types.log`, "utf8"));
assert.equal([...rootLog.matchAll(/^src\/.+error TS2339:/gm)].length, 5);
assert.deepEqual(read(`${qa}/baseline-diagnostics.json`).diagnostics, []);
const receipts = read(`${cycle}/check-receipts.json`);
assert.equal(receipts.length, 13);
for (const row of receipts) assert.equal(row.exitCode, row.name === "full-root-types" ? 2 : 0);
const verification = { classification: "executor verification, fresh independent cycle3 judgment pending", verifiedAt: new Date().toISOString(),
  changedSources, archives, configs, sourceHashes, registered: { total: 41, public: 36, internal: 5, unresolved: 0, dispositionsUnchanged: true, nativeValidatorsUnchanged: true },
  tests: { total: 189, passed: 189, failed: 0, skipped: 0, suites: 2, namesUnchangedFromCycle2: true }, timestampOutcomes: 14,
  ordinaryTests: preservation, fullRoot: { exitCode: 2, introducedDownstreamDiagnostics: 5, rawBytesUnchangedFromCycle2: true, virtualBaselineDiagnostics: 0 },
  reviewed03ABaselineUnchanged: baseline, compilerConfigurationUnchanged: true };
fs.writeFileSync(`${cycle}/verification.json`, JSON.stringify(verification, null, 2) + "\n");
console.log(JSON.stringify({ archives: archives.map(({ cycle, records }) => ({ cycle, records })), registered: verification.registered,
  tests: verification.tests, timestampOutcomes: 14, actualBackendES2021: "PASS", fullRootDiagnostics: 5, baselineDiagnostics: 0 }, null, 2));
