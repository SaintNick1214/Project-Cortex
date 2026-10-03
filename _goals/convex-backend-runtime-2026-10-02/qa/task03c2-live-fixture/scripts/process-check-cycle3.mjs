import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createRequire, syncBuiltinESMExports } from "node:module";
import { randomUUID } from "node:crypto";
import { drive } from "./driver-engine.mjs";
import { ProcessOwner } from "./process-owner.mjs";
import { linuxGroupMembers, terminal } from "./process-terminal.mjs";
import { cases } from "./cases.mjs";
import { localPreflight, scratch, repo, writeDriverReceipt, writeEvidence } from "./guard.mjs";
localPreflight();
const require = createRequire(import.meta.url), fs = require("node:fs");
const rows = [], receipts = [];
const check = (name, fn) => { fn(); rows.push({ name, passed: true }); };
const safeEnv = { PATH: process.env.PATH };
const state = (pid) => { try { const text = readFileSync(`/proc/${pid}/stat`, "utf8"); return text.slice(text.lastIndexOf(")") + 2).split(" ")[0]; } catch (error) { if (error.code === "ENOENT") return "ABSENT"; throw error; } };
async function run(label, fault) {
  const owner = new ProcessOwner(), records = [], spawn = owner.spawn.bind(owner);
  owner.spawn = (...args) => { const record = spawn(...args); records.push(record); return record; };
  const runId = randomUUID(), output = localPreflight(`qualify-${runId}.json`), pidFile = resolve(scratch, "offline-cycle3", `grandchild-${runId}.pid`);
  let operatorPid, finishSnapshot;
  const originals = { readdirSync: fs.readdirSync, readFileSync: fs.readFileSync };
  const fakePid = "2147483000";
  if (fault) {
    fs.readdirSync = (...args) => args[0] === "/proc" ? [...originals.readdirSync(...args), fakePid] : originals.readdirSync(...args);
    fs.readFileSync = (...args) => {
      if (args[0] !== `/proc/${fakePid}/stat`) return originals.readFileSync(...args);
      if (fault === "unavailable") { const error = new Error("OFFLINE_VERIFICATION_UNAVAILABLE"); error.code = "EACCES"; throw error; }
      return `${fakePid} (offline-verification-standin) R 1 ${operatorPid ?? 1} 1 ${"0 ".repeat(25)}`;
    };
    syncBuiltinESMExports();
  }
  let receipt;
  try {
    receipt = await drive({ owner,
      args: [resolve(scratch, "offline-cycle2/process-child.mjs")],
      env: { ...safeEnv, PROBE_SCENARIO: "whole-operator-hang", PROBE_PIDFILE: pidFile }, cwd: repo,
      bootstrap: { version: 1, phase: "offline-probe", runId, endpoint: "https://offline-fixture-123.convex.cloud", timeoutMs: 12_000, quietMs: 750 },
      wholeMs: 300, caseMs: 2_000,
      sign: async () => { throw new Error("UNEXPECTED_SIGNING"); }, checkpoint: async () => {},
      operator: async () => {
        const promise = owner.run(["-e", 'const cp=require("node:child_process"),fs=require("node:fs");const child=cp.spawn(process.execPath,["-e",\'process.on("SIGTERM",()=>{});setInterval(()=>{},1000)\'],{stdio:"ignore"});fs.writeFileSync(process.env.OFFLINE_PIDFILE,String(child.pid),{mode:384,flag:"wx"});process.on("SIGTERM",()=>{});setInterval(()=>{},1000)'], { env: { ...safeEnv, OFFLINE_PIDFILE: pidFile }, cwd: repo }, 25_000);
        operatorPid = records.at(-1).child.pid;
        await promise; throw new Error("OPERATOR_UNAVAILABLE");
      },
      finish: async (value) => {
        const grandchild = Number(originals.readFileSync(pidFile, "utf8"));
        finishSnapshot = { directChildrenWaited: records.every((record) => record.exited), grandchildState: state(grandchild),
          remainingGroups: owner.records.size, terminalVerifiedGroups: owner.verifiedGroups };
        if (!fault) for (const record of records) assert(terminal(linuxGroupMembers(record.child.pid, Date.now() + 2_000)));
        writeDriverReceipt(output, { ...value, evidenceKind: "OFFLINE cycle3 reached-whole-timeout/process control only", atFinish: finishSnapshot });
      },
    });
  } finally { Object.assign(fs, originals); syncBuiltinESMExports(); }
  check(`${label}-41-exact-cases-active-fail-dependent-blocked`, () => {
    assert.equal(receipt.discovered, 41); assert.deepEqual(receipt.results.map((row) => row.name), cases);
    assert.equal(receipt.results[0].status, "FAIL"); assert.equal(receipt.results[0].reason, "whole_timeout");
    assert(receipt.results.slice(1).every((row) => row.status === "BLOCKED" && row.reason === "dependency_blocked"));
    assert.equal(receipt.status, "FAIL"); assert.equal(receipt.ownedProcessGroups, 2);
    assert.equal(finishSnapshot.directChildrenWaited, true);
    if (!fault) assert(["Z", "X", "ABSENT"].includes(finishSnapshot.grandchildState));
    assert.equal(JSON.parse(originals.readFileSync(output, "utf8")).discovered, 41);
  });
  check(`${label}-terminal-verification-required-before-reaped`, () => {
    if (fault) { assert.equal(receipt.processCleanup, "FAIL"); assert(receipt.remainingOwnedGroups > 0); assert(receipt.terminalVerifiedGroups < receipt.ownedProcessGroups); }
    else { assert.equal(receipt.processCleanup, "REAPED"); assert.equal(receipt.remainingOwnedGroups, 0); assert.equal(receipt.terminalVerifiedGroups, 2); }
    assert.throws(() => writeDriverReceipt(output, receipt));
  });
  // The instrumentation cannot leave a running child even in the deliberately
  // unverifiable case. Real /proc confirms after hooks have been restored.
  const end = Date.now() + 2_000;
  for (const record of records) {
    while (!terminal(linuxGroupMembers(record.child.pid, end))) { assert(Date.now() < end); await new Promise((done) => setTimeout(done, 20)); }
  }
  receipts.push({ label, basename: output.split("/").at(-1), processCleanup: receipt.processCleanup, remainingOwnedGroups: receipt.remainingOwnedGroups, atFinish: finishSnapshot });
}
for (let index = 0; index < 10; index++) await run(`actual-owned-group-${index + 1}`);
await run("forced-observed-nonterminal", "nonterminal");
await run("forced-proc-unavailable", "unavailable");
check("actual-owned-group-reader-and-terminal-semantics", () => {
  const group = Number(readFileSync("/proc/self/stat", "utf8").split(") ")[1].split(" ")[2]);
  assert(linuxGroupMembers(group, Date.now() + 2_000).some((row) => row.pid === process.pid));
  assert.equal(terminal([{ pid: 1, state: "R" }]), false); assert.equal(terminal([{ pid: 1, state: "Z" }, { pid: 2, state: "X" }]), true);
  assert.throws(() => linuxGroupMembers(group, Date.now() - 1));
});
writeEvidence(`process-cycle3-${randomUUID()}.json`, { evidenceKind: "OFFLINE Linux group/ledger verification only; no waitpid claim over PID1 zombies", discovered: rows.length, passed: rows.length, skipped: 0, networkCalls: 0, signedTokens: 0, serviceEffects: 0, rows, receipts }, false);
process.stdout.write(JSON.stringify({ discovered: rows.length, passed: rows.length, skipped: 0, networkCalls: 0, serviceEffects: 0 }) + "\n");
