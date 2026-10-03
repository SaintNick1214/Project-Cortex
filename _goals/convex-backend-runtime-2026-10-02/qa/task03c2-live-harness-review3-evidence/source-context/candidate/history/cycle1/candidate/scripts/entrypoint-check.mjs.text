import assert from "node:assert/strict";
import { createRequire, syncBuiltinESMExports } from "node:module";
import { randomUUID } from "node:crypto";
import { root, localPreflight, writeEvidence } from "./guard.mjs";
localPreflight();
const require = createRequire(import.meta.url);
const cp = require("node:child_process"), fs = require("node:fs");
const originals = { spawn: cp.spawn, spawnSync: cp.spawnSync, writeFileSync: fs.writeFileSync };
const originalFetch = globalThis.fetch;
const counts = { subprocess: 0, output: 0, network: 0 };
const oldArgv = process.argv;
const previousReceipt = process.env.CORTEX_QUALIFICATION_TARGET_RECEIPT;
const previousEnv = process.env.CORTEX_QUALIFICATION_DEPLOY_ENV;
delete process.env.CORTEX_QUALIFICATION_TARGET_RECEIPT;
delete process.env.CORTEX_QUALIFICATION_DEPLOY_ENV;
cp.spawn = cp.spawnSync = () => { counts.subprocess++; throw new Error("UNEXPECTED_SUBPROCESS"); };
fs.writeFileSync = () => { counts.output++; throw new Error("UNEXPECTED_OUTPUT"); };
globalThis.fetch = async () => { counts.network++; throw new Error("UNEXPECTED_NETWORK"); };
syncBuiltinESMExports();
const cases = [["deploy", "deploy"], ["deploy", "codegen"], ["qualify", undefined], ["cleanup", `owned-${randomUUID()}.json`]];
try {
  for (const [entry, arg] of cases) {
    process.argv = [process.execPath, `${root}/scripts/${entry}.mjs`, ...(arg ? [arg] : [])];
    await assert.rejects(import(`./${entry}.mjs?offline-case=${randomUUID()}`), /Qualification preflight rejected/);
    assert.deepEqual(counts, { subprocess: 0, output: 0, network: 0 });
  }
} finally {
  Object.assign(cp, { spawn: originals.spawn, spawnSync: originals.spawnSync }); fs.writeFileSync = originals.writeFileSync;
  syncBuiltinESMExports(); process.argv = oldArgv;
  globalThis.fetch = originalFetch;
  if (previousReceipt === undefined) delete process.env.CORTEX_QUALIFICATION_TARGET_RECEIPT; else process.env.CORTEX_QUALIFICATION_TARGET_RECEIPT = previousReceipt;
  if (previousEnv === undefined) delete process.env.CORTEX_QUALIFICATION_DEPLOY_ENV; else process.env.CORTEX_QUALIFICATION_DEPLOY_ENV = previousEnv;
}
writeEvidence(`entrypoints-${randomUUID()}.json`, { discovered: cases.length, passed: cases.length, skipped: 0, counts, evidenceKind: "offline intercepted live entrypoints with no parent target" }, false);
process.stdout.write(JSON.stringify({ discovered: cases.length, passed: cases.length, counts }) + "\n");
