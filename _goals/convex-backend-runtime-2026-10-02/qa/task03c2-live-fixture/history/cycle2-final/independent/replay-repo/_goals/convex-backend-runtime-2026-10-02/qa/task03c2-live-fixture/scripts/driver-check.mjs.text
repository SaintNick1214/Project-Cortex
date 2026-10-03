import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { drive } from "./driver-engine.mjs";
import { ProcessOwner } from "./process-owner.mjs";
import { sdkEnvironment, AuthorityProtocol, validateMessage } from "./protocol.mjs";
import { cases } from "./cases.mjs";
import { localPreflight, repo, root, scratch, writeDriverReceipt, writeEvidence } from "./guard.mjs";
localPreflight();
const startedAt = new Date().toISOString(), rows = [];
const check = (name, fn) => { fn(); rows.push({ name, passed: true }); };
const probes = resolve(scratch, "offline-cycle2"), receipts = [];
const secretSentinel = "dev:offline-standin|DEVKEY_BOUNDARY_STANDIN";
const safeEnv = sdkEnvironment({ ...process.env, CONVEX_DEPLOY_KEY: secretSentinel, CONVEX_DEPLOYMENT: "dev:standin", CORTEX_QUALIFICATION_TARGET_RECEIPT: "private-standin", OPENAI_API_KEY: "inference-standin", ANTHROPIC_API_KEY: "inference-standin" });
check("environment-excludes-keys-selectors-and-inference", () => {
  for (const name of ["CONVEX_DEPLOY_KEY", "CONVEX_DEPLOYMENT", "CORTEX_QUALIFICATION_TARGET_RECEIPT", "OPENAI_API_KEY", "ANTHROPIC_API_KEY"]) assert.equal(safeEnv[name], undefined);
  assert(!Object.values(safeEnv).includes(secretSentinel));
});
const fakeAuthority = (args) => ({ principalId: "offline-principal", principalVersion: 1, membershipId: "offline-membership", membershipVersion: 1,
  grantId: "offline-grant", grantVersion: 1, tenantId: args.tenantId, tenantEpoch: 1, memorySpaceId: args.memorySpaceId, memorySpaceEpoch: 1,
  actorKind: "user", userId: args.metadataUserId, capabilities: [...args.capabilities].sort(), resourceAccess: args.resourceAccess });
async function probe(name, { sdk = false, unavailable = false, wholeMs = 5_000, caseMs = 1_000, phase = "offline-probe" } = {}) {
  const owner = new ProcessOwner(), runId = randomUUID(), basename = `qualify-${runId}.json`, output = localPreflight(basename);
  const pidFile = resolve(probes, `descendant-${runId}.pid`), callbacks = { sign: 0, operator: 0, checkpoint: 0, finish: 0 };
  const args = sdk ? ["--import", resolve(probes, "intercept-child.mjs"), "--import", resolve(repo, "node_modules/tsx/dist/loader.mjs"), resolve(root, "scripts/client.ts")] : [resolve(probes, "process-child.mjs")];
  const receipt = await drive({ owner, args, env: sdk ? safeEnv : { ...safeEnv, PROBE_SCENARIO: name, PROBE_PIDFILE: pidFile }, cwd: repo,
    bootstrap: { version: 1, phase, runId, endpoint: "https://offline-fixture-123.convex.cloud", timeoutMs: 12_000, quietMs: 750 },
    wholeMs, caseMs,
    sign: async () => { callbacks.sign++; return "header.body.signature"; },
    operator: async (functionName, operatorArgs) => {
      callbacks.operator++;
      if (["operator-hang", "whole-operator-hang"].includes(name)) {
        const result = await owner.run(["-e", 'const cp=require("node:child_process"),fs=require("node:fs");const child=cp.spawn(process.execPath,["-e",\'process.on("SIGTERM",()=>{});setInterval(()=>{},1000)\'],{stdio:"ignore"});fs.writeFileSync(process.env.OPERATOR_PROBE_PIDFILE,String(child.pid),{mode:384,flag:"wx"});process.on("SIGTERM",()=>{});setInterval(()=>{},1000)'], { env: { ...safeEnv, OPERATOR_PROBE_PIDFILE: pidFile }, cwd: repo }, name === "operator-hang" ? 150 : 25_000);
        if (name === "operator-hang") assert.equal(result.timedOut, true);
        throw new Error("OPERATOR_UNAVAILABLE");
      }
      if (unavailable) throw new Error("OPERATOR_UNAVAILABLE");
      assert.equal(functionName, "runtimeAuth:provision"); return fakeAuthority(operatorArgs);
    },
    checkpoint: async () => { callbacks.checkpoint++; },
    finish: async (value) => { callbacks.finish++; assert.equal(owner.records.size, 0); writeDriverReceipt(output, { ...value, evidenceKind: "OFFLINE interception only; not live qualification" }); },
  });
  receipts.push({ name, basename, status: receipt.status, discovered: receipt.discovered, skipped: receipt.skipped, processCleanup: receipt.processCleanup });
  check(`${name}-append-only-41-case-receipt-and-process-reaping`, () => {
    assert.equal(callbacks.finish, 1); assert.equal(receipt.discovered, 41); assert.deepEqual(receipt.results.map((row) => row.name), cases);
    assert.equal(receipt.remainingOwnedGroups, 0); assert.equal(owner.records.size, 0); assert.equal(receipt.processCleanup, "REAPED");
    assert.equal(JSON.parse(readFileSync(output, "utf8")).discovered, 41);
    assert.throws(() => writeDriverReceipt(output, receipt));
    assert.equal(receipt.phase, phase);
  });
  return { receipt, callbacks, pidFile };
}
const actual = await probe("actual-sdk-child", { sdk: true, wholeMs: 20_000, caseMs: 15_000 });
check("actual-sdk-child-zero-private-key-reads-values-selectors-protocol-and-network", () => {
  assert.equal(actual.receipt.completed, true); assert.equal(actual.receipt.results[0].status, "PASS"); assert.equal(actual.receipt.status, "INCOMPLETE");
  assert.equal(actual.callbacks.operator, 1); assert.equal(actual.callbacks.sign, 1); assert.equal(actual.receipt.offlineAudits.length, 1);
  assert.deepEqual(actual.receipt.offlineAudits[0], { type: "offline-audit", sensitiveReads: 0, keyValues: 0, selectorVariables: 0, networkAttempts: 0, privateProtocolFields: 0 });
});
const unavailable = await probe("actual-sdk-setup-unavailable", { sdk: true, unavailable: true, wholeMs: 20_000, caseMs: 15_000 });
check("actual-sdk-operator-setup-blocks-dependent-cases", () => {
  assert.equal(unavailable.receipt.results[0].status, "BLOCKED"); assert.equal(unavailable.receipt.results[0].reason, "operator_setup_unavailable");
  assert.equal(unavailable.receipt.skipped, 41); assert.equal(unavailable.receipt.status, "INCOMPLETE"); assert.equal(unavailable.callbacks.sign, 0);
});
for (const [name, options, reason] of [["crash", {}, undefined], ["sigkill", {}, undefined], ["whole-hang", { wholeMs: 300, caseMs: 2_000 }, "whole_timeout"], ["case-hang", { wholeMs: 2_000, caseMs: 300 }, "case_timeout"], ["descendant", { caseMs: 300 }, "case_timeout"]]) {
  const value = await probe(name, options);
  check(`${name}-reached-fail-dependent-blocked`, () => { assert.equal(value.receipt.status, "FAIL"); assert.equal(value.receipt.results[0].status, "FAIL"); if (reason) assert.equal(value.receipt.results[0].reason, reason); assert(value.receipt.results.slice(1).every((row) => row.status === "BLOCKED" && row.reason === "dependency_blocked")); });
  if (name === "descendant") {
    const pid = Number(readFileSync(value.pidFile, "utf8"));
    check("owned-grandchild-has-no-running-process-after-receipt", () => {
      try { const stat = readFileSync(`/proc/${pid}/stat`, "utf8"); assert(["Z", "X"].includes(stat.slice(stat.lastIndexOf(")") + 2).split(" ")[0])); }
      catch (error) { if (error.code !== "ENOENT") throw error; }
    });
  }
}
const hungOperator = await probe("operator-hang");
check("operator-timeout-is-blocked-setup-never-negative-pass", () => { assert.equal(hungOperator.receipt.results[0].status, "BLOCKED"); assert.equal(hungOperator.receipt.status, "INCOMPLETE"); assert.equal(hungOperator.receipt.operatorEffects[0].status, "unavailable"); assert.equal(hungOperator.receipt.ownedProcessGroups, 2); });
function noRunningDescendant(value) {
  const pid = Number(readFileSync(value.pidFile, "utf8"));
  try { const stat = readFileSync(`/proc/${pid}/stat`, "utf8"); assert(["Z", "X"].includes(stat.slice(stat.lastIndexOf(")") + 2).split(" ")[0])); }
  catch (error) { if (error.code !== "ENOENT") throw error; }
}
check("operator-grandchild-not-running-before-receipt", () => noRunningDescendant(hungOperator));
const wholeOperator = await probe("whole-operator-hang", { wholeMs: 300, caseMs: 2_000 });
check("whole-ceiling-kills-inflight-operator-and-descendant-before-41-receipt", () => {
  assert.equal(wholeOperator.receipt.status, "FAIL"); assert.equal(wholeOperator.receipt.results[0].reason, "whole_timeout");
  assert.equal(wholeOperator.receipt.ownedProcessGroups, 2); assert.equal(wholeOperator.receipt.operatorEffects[0].status, "unavailable");
  assert(wholeOperator.receipt.results.slice(1).every((row) => row.status === "BLOCKED")); noRunningDescendant(wholeOperator);
});
const startupCrash = await probe("startup-crash");
check("startup-crash-retains-all-41-unreached-blocked-and-driver-fail", () => {
  assert.equal(startupCrash.receipt.status, "FAIL"); assert.equal(startupCrash.receipt.skipped, 41); assert.equal(startupCrash.receipt.executed, 0);
  assert(startupCrash.receipt.results.every((row) => row.status === "BLOCKED")); assert.equal(startupCrash.callbacks.operator, 0);
});
for (const name of ["unknown-operator", "foreign-sign", "extra-private-field", "offline-audit-in-live"]) {
  const value = await probe(name, name === "offline-audit-in-live" ? { phase: "live" } : {});
  check(`${name}-rejected-before-authority-effects`, () => { assert.equal(value.receipt.status, "FAIL"); assert.equal(value.receipt.results[0].reason, "protocol_rejected"); assert.equal(value.callbacks.operator, 0); assert.equal(value.callbacks.sign, 0); assert.equal(value.callbacks.checkpoint, 0); });
}
check("protocol-rejects-unsuccessful-observer-and-private-payload", () => {
  const metric = { type: "metric", name: "sdk-logout", baseline: 41, updated: 42, before: 1, after: 1, quietMs: 750, payloadFields: ["value"], observedValues: [41] };
  validateMessage(metric);
  for (const patch of [{ before: 0, after: 0, observedValues: [] }, { after: 2 }, { observedValues: [42] }, { payloadFields: ["value", "private"] }, { quietMs: 0 }]) assert.throws(() => validateMessage({ ...metric, ...patch }));
});
check("child-transitive-local-import-graph-excludes-trusted-modules", () => {
  for (const name of ["client.ts", "parent-channel.ts", "reactive-transport.mjs", "cases.mjs"]) {
    const source = readFileSync(resolve(root, "scripts", name), "utf8");
    assert(!/from\s+["'](?:node:(?:fs|crypto|child_process)|\.\/guard|\.\/operator|\.\/driver|\.\/process-owner)/.test(source));
    assert(!/deploy\.env|jwt-private\.pem|CONVEX_DEPLOY_KEY|rsaSign|livePreflight/.test(source));
  }
});
check("failed-accepted-authority-result-is-protocol-failure", () => {
  const protocol = new AuthorityProtocol(randomUUID());
  const args = { issuer: "https://cortex-qualification.invalid", subject: `subject-${protocol.runId}-probe`, actorKind: "user", metadataUserId: `user-${protocol.runId}-probe`, tenantId: `task03c2-${protocol.runId}-probe`, memorySpaceId: `space-${protocol.runId}-probe`, capabilities: ["read"], resourceAccess: "own" };
  protocol.validateOperator("runtimeAuth:provision", args);
  assert.throws(() => protocol.enroll(args, { ...fakeAuthority(args), resourceAccess: "space" }));
  assert.throws(() => protocol.enroll(args, { ...fakeAuthority(args), capabilities: ["admin"] }));
  assert.equal(protocol.owned.length, 0); assert.equal(protocol.attemptedScopes.size, 1);
});
// Snapshot private probe filenames for complete evidence accounting; no keys,
// service payload or tokens are written here.
const probeInventory = readdirSync(probes).filter((name) => /descendant-.+\.pid$/.test(name));
writeEvidence(`driver-check-${randomUUID()}.json`, { startedAt, completedAt: new Date().toISOString(), evidenceKind: "OFFLINE only; fake parent operator/sign values cannot certify service", discovered: rows.length, passed: rows.length, skipped: 0,
  liveCaseDiscovery: 41, networkAttempts: 0, privateKeyReadsBySdk: 0, signedTokens: 0, serviceEffects: 0, rows, receipts, privateProbeFiles: probeInventory.length }, false);
process.stdout.write(JSON.stringify({ discovered: rows.length, passed: rows.length, skipped: 0, networkAttempts: 0, serviceEffects: 0, liveCases: 41 }) + "\n");
