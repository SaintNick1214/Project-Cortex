import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { canonical, livePreflight, scratch, writeInitialReceipt } from "./guard.mjs";
import { operator } from "./operator.mjs";
import { ProcessOwner } from "./process-owner.mjs";
const name = process.argv[2];
if (!/^owned-[a-f0-9-]{36}\.json$/.test(name ?? "")) throw new Error("Select a private owned-fixture ledger basename.");
const output = `cleanup-${randomUUID()}.json`;
const { target, output: validatedOutput } = livePreflight(output);
let completed = 0, failed = 0, failure;
const owner = new ProcessOwner(), deadline = Date.now() + 600_000;
try {
  const path = canonical(resolve(scratch, name), scratch, { privateFile: true, existing: true });
  const ledger = JSON.parse(readFileSync(path, "utf8"));
  if (ledger.deploymentName !== target.deploymentName || !/^[a-f0-9-]{36}$/.test(ledger.runId) || name !== `owned-${ledger.runId}.json`
    || !Array.isArray(ledger.owned) || !Array.isArray(ledger.attemptedScopes) || ledger.owned.length + ledger.attemptedScopes.length > 100) throw new Error("Cleanup ledger rejected before dispatch.");
  const scopePrefix = `task03c2-${ledger.runId}-`;
  for (const entry of ledger.owned) {
    if (!entry.scope?.tenantId?.startsWith(scopePrefix) || !entry.scope.memorySpaceId?.startsWith(`space-${ledger.runId}-`)
      || !entry.subject?.startsWith(`subject-${ledger.runId}-`) || !entry.userId?.startsWith(`user-${ledger.runId}-`)
      || typeof entry.reference?.principalId !== "string") throw new Error("Cleanup ownership rejected before dispatch.");
  }
  for (const scope of ledger.attemptedScopes) {
    if (!scope?.tenantId?.startsWith(scopePrefix) || !scope.memorySpaceId?.startsWith(`space-${ledger.runId}-`)
      || Object.keys(scope).sort().join(",") !== "memorySpaceId,tenantId") throw new Error("Cleanup attempted scope rejected before dispatch.");
  }
  const scopes = new Map([...ledger.owned.map((entry) => entry.scope), ...ledger.attemptedScopes].map((scope) => [scope.tenantId, scope]));
  const principals = new Set(ledger.owned.map((entry) => entry.reference.principalId));
  for (const scope of scopes.values()) {
    if (Date.now() + 25_000 > deadline) { failed++; continue; }
    try { await operator("runtimeAuth:deleteScope", { tenantId: scope.tenantId }, owner); completed++; } catch { failed++; }
  }
  for (const principalId of principals) {
    if (Date.now() + 25_000 > deadline) { failed++; continue; }
    try { await operator("runtimeAuth:deletePrincipal", { principalId }, owner); completed++; } catch { failed++; }
  }
} catch {
  failed++; failure = "cleanup_validation_or_operation_failure";
} finally {
  await owner.reapAll();
}
writeInitialReceipt(validatedOutput, { operation: "fence-owned-qualification-fixtures", deploymentName: target.deploymentName, completed, failed, failure,
  remainingOwnedGroups: owner.records.size, terminalVerifiedGroups: owner.verifiedGroups,
  processCleanup: owner.records.size === 0 ? "REAPED" : "FAIL", retainedTombstones: true,
  partialProvisioning: "attempted scopes fenced; principals absent from journal require exact project retirement",
  physicalCleanup: "parent must retire/delete this exact qualification project via trusted service tool", globalPurge: false });
process.stdout.write(JSON.stringify({ completed, failed, retirement: "pending-parent" }) + "\n");
process.exitCode = failed === 0 && owner.records.size === 0 ? 0 : 1;
