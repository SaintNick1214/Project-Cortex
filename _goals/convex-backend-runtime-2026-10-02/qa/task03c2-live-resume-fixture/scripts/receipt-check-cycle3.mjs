import assert from "node:assert/strict";
import { mkdirSync, readFileSync, writeFileSync, symlinkSync, linkSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { ProcessOwner } from "./process-owner.mjs";
import { root, repo, scratch, localPreflight, writeInitialReceipt, writeEvidence } from "./guard.mjs";
localPreflight();
const rows = [], outcomes = [], owner = new ProcessOwner();
const check = (name, fn) => { fn(); rows.push({ name, passed: true }); };
const privateRoot = resolve(scratch, "offline-cycle3");
for (const scenario of ["deploy-success", "codegen-success", "deploy-throw", "deploy-exit-fail", "deploy-timeout", "deploy-process-fail", "cleanup-success", "cleanup-operator-fail", "cleanup-invalid-ledger"]) {
  const runId = randomUUID(), folder = resolve(privateRoot, runId), auditPath = resolve(folder, "audit.json"); mkdirSync(folder, { mode: 0o700 });
  const scope = { tenantId: `task03c2-${runId}-receipt`, memorySpaceId: `space-${runId}-receipt` };
  const ledger = { runId, deploymentName: "offline-initial-binding-123", owned: [{ scope, subject: `subject-${runId}-receipt`, userId: `user-${runId}-receipt`, reference: { principalId: "offline-principal-owned-standin" } }], attemptedScopes: [scope] };
  writeFileSync(resolve(folder, `owned-${runId}.json`), scenario === "cleanup-invalid-ledger" ? "{" : JSON.stringify(ledger), { flag: "wx", mode: 0o600 });
  const cleanup = scenario.startsWith("cleanup"), mode = scenario === "codegen-success" ? "codegen" : "deploy";
  const result = await owner.run(["--import", resolve(privateRoot, "receipt-register.mjs"), resolve(root, `scripts/${cleanup ? "cleanup" : "deploy"}.mjs`), cleanup ? `owned-${runId}.json` : mode],
    { cwd: repo, env: { PATH: process.env.PATH, OFFLINE_RUN_ID: runId, OFFLINE_AUDIT_PATH: auditPath, OFFLINE_CASE: scenario } }, 12_000);
  const audit = JSON.parse(readFileSync(auditPath, "utf8")), receiptPath = resolve(root, "evidence", audit.output), receipt = JSON.parse(readFileSync(receiptPath, "utf8"));
  check(`${scenario}-exact-receipt-after-private-preflight-unavailable`, () => {
    const success = ["deploy-success", "codegen-success", "cleanup-success"].includes(scenario);
    assert.equal(result.code, success ? 0 : 1); assert.equal(result.timedOut, false); assert.equal(result.overflow, false);
    assert.equal(audit.preflightCalls, 1); assert.equal(audit.writes, 1); assert.equal(receipt.privatePreflightCalls, 1);
    assert.equal(receipt.deploymentName, "offline-initial-binding-123"); assert(receipt.evidenceKind.startsWith("OFFLINE"));
    assert.equal(owner.records.size, 0); assert.equal(owner.verifiedGroups, outcomes.length + 1);
    const emitted = JSON.stringify(receipt) + result.stdout + result.stderr;
    assert(!emitted.includes("PRIVATE_OFFLINE_DIAGNOSTIC_MUST_NOT_ESCAPE"));
    if (cleanup) {
      assert.equal(receipt.completed, success ? 2 : 0); assert.equal(receipt.failed, success ? 0 : scenario === "cleanup-invalid-ledger" ? 1 : 2);
      assert.equal(audit.operatorCalls, scenario === "cleanup-invalid-ledger" ? 0 : 2); assert.equal(receipt.globalPurge, false);
    } else {
      assert.equal(audit.cliCalls, 1); assert.equal(audit.operatorCalls, 0);
      assert.deepEqual(audit.args, [resolve(repo, "node_modules/convex/bin/main.js"), "dev", "--once", "--codegen", mode === "codegen" ? "enable" : "disable", "--typecheck", "enable", "--tail-logs", "disable", "--env-file", "OFFLINE_SELECTOR_NOT_PRESENT"]);
      if (scenario === "deploy-timeout") assert.equal(receipt.timedOut, true);
      if (scenario === "deploy-process-fail") { assert.equal(receipt.remainingOwnedGroups, 1); assert.equal(receipt.processCleanup, "FAIL"); }
    }
    assert.throws(() => writeInitialReceipt(receiptPath, {}));
  });
  outcomes.push({ scenario, basename: audit.output, preflightCalls: audit.preflightCalls, writes: audit.writes, cliCalls: audit.cliCalls, operatorCalls: audit.operatorCalls, exitCode: result.code });
}
for (const kind of ["symlink", "hardlink", "prior"]) {
  const output = localPreflight(`cleanup-${randomUUID()}.json`), standin = resolve(privateRoot, `standin-${randomUUID()}.json`);
  writeFileSync(standin, "{}", { flag: "wx", mode: 0o600 });
  if (kind === "symlink") symlinkSync(standin, output); else if (kind === "hardlink") linkSync(standin, output); else writeFileSync(output, "original-owned-evidence", { flag: "wx", mode: 0o600 });
  try { check(`initial-bound-output-rejects-${kind}-without-replacement`, () => { assert.throws(() => writeInitialReceipt(output, { replaced: true })); assert.equal(readFileSync(output, "utf8"), kind === "prior" ? "original-owned-evidence" : "{}"); }); }
  finally { rmSync(output); rmSync(standin); }
}
check("initial-bound-output-rejects-wrong-origin-and-basename", () => { assert.throws(() => writeInitialReceipt(resolve(privateRoot, `cleanup-${randomUUID()}.json`), {})); assert.throws(() => writeInitialReceipt(resolve(root, "evidence/unrelated.json"), {})); });
writeEvidence(`receipt-cycle3-${randomUUID()}.json`, { evidenceKind: "OFFLINE actual deploy/cleanup module paths with explicit dependency interceptions only", discovered: rows.length, passed: rows.length, skipped: 0, networkCalls: 0, serviceEffects: 0, actualOperatorCliCalls: 0, ownedProbeGroupsTerminalVerified: owner.verifiedGroups, rows, outcomes }, false);
process.stdout.write(JSON.stringify({ discovered: rows.length, passed: rows.length, skipped: 0, networkCalls: 0, serviceEffects: 0 }) + "\n");
