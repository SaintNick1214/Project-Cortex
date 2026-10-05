import { resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { livePreflight, fixture, repo, writeInitialReceipt } from "./guard.mjs";
import { ProcessOwner } from "./process-owner.mjs";
const mode = process.argv[2];
if (!["deploy", "codegen"].includes(mode)) throw new Error("Select deploy or codegen.");
const name = `${mode}-${randomUUID()}.json`;
const { target, envFile, env, output: validatedOutput } = livePreflight(name);
// The current CLI's standalone codegen has no --env-file. dev --once enables
// authentic fixture codegen while remaining on the same guarded dev deployment.
const args = [resolve(repo, "node_modules/convex/bin/main.js"), "dev", "--once", "--codegen", mode === "codegen" ? "enable" : "disable", "--typecheck", "enable", "--tail-logs", "disable", "--env-file", envFile];
const startedAt = new Date().toISOString();
const owner = new ProcessOwner();
let code = -1, timedOut = false, failure;
try { const result = await owner.run(args, { cwd: fixture, env }, 120_000); code = result.code ?? -1; timedOut = result.timedOut; }
catch { failure = "deployment_or_process_failure"; }
finally { await owner.reapAll(); }
writeInitialReceipt(validatedOutput, { mode, startedAt, completedAt: new Date().toISOString(), deploymentName: target.deploymentName, exitCode: code,
  timedOut, failure, remainingOwnedGroups: owner.records.size, terminalVerifiedGroups: owner.verifiedGroups,
  processCleanup: owner.records.size === 0 ? "REAPED" : "FAIL", rawDiagnostics: "discarded for privacy" });
process.stdout.write(JSON.stringify({ mode, exitCode: code }) + "\n");
process.exitCode = code === 0 && !timedOut && owner.records.size === 0 ? 0 : 1;
