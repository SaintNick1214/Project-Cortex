import assert from "node:assert/strict";
import { ConvexError } from "convex/values";
import { randomUUID } from "node:crypto";
import { acceptedOperatorDenial } from "/workspace/Project-Cortex/_goals/convex-backend-runtime-2026-10-02/qa/task03c2-live-resume-fixture/scripts/operator-classifier.mjs";
import { localPreflight, writeEvidence } from "./evidence-adapter.mjs";
localPreflight();
const boundary = { version: 1, code: "FORBIDDEN", message: "Access denied", retryable: false, outcome: "not_dispatched" };
// Actual installed ConvexError serialization and the installed official run.ts
// envelope. This is an offline protocol control, not an observed server denial.
const diagnostic = (name, data) => `Failed to run function "${name}":\n${new ConvexError(`[Request ID: abc123] Server Error\nUncaught ${new ConvexError(data).toString()}\n    at deny (runtimeAuth.ts:46:9)`).toString()}\n`;
const result = (stderr, patch = {}) => ({ code: 1, signal: null, timedOut: false, overflow: false, stderr, stdout: "", ...patch });
const name = "runtimeAuth:recheck", accepted = diagnostic(name, boundary), rows = [];
const check = (label, expected, value, functionName = name) => { assert.equal(acceptedOperatorDenial(functionName, value), expected, label); rows.push({ label, expected, passed: true }); };
check("accepted-runtime-structured-denial", true, result(accepted));
check("accepted-session-native-denial", true, result(diagnostic("sessions:incrementMemoryCount", { code: "FORBIDDEN", message: "Access denied" })), "sessions:incrementMemoryCount");
check("accepted-session-boundary-denial", true, result(diagnostic("sessions:incrementMemoryCount", boundary)), "sessions:incrementMemoryCount");
check("accepted-ansi-envelope", true, result(`\u001b[31m${accepted}\u001b[39m`));
for (const [label, stderr] of [
  ["proxy-forbidden", "Proxy network FORBIDDEN Access denied"],
  ["envfile-permission-denied", "EACCES Access denied reading private env file"],
  ["official-envelope-network-forbidden", `Failed to run function "${name}":\nError: Network FORBIDDEN Access denied`],
  ["internal-function-not-found", `Failed to run function "${name}":\nError: Could not find internal function FORBIDDEN`],
  ["cli-authentication", `Failed to run function "${name}":\nError: Unauthorized deploy key FORBIDDEN`],
  ["wrong-function-context", accepted.replace(name, "runtimeAuth:authorize")],
  ["no-official-envelope", accepted.slice(accepted.indexOf("ConvexError:"))],
  ["no-server-request-marker", accepted.replace("[Request ID: abc123] Server Error", "Network Error")],
  ["generic-error-named-forbidden", accepted.replace("Uncaught ConvexError:", "Uncaught Error:")],
  ["duplicate-envelope", accepted + accepted],
  ["malformed-json", accepted.replace('"version":1', '"version":')],
]) check(label, false, result(stderr));
for (const [label, patch] of [["timeout", { timedOut: true }], ["overflow", { overflow: true }], ["signal", { signal: "SIGKILL" }], ["successful-exit", { code: 0 }], ["wrong-exit", { code: 2 }]]) check(label, false, result(accepted, patch));
for (const [label, data] of [["wrong-code", { ...boundary, code: "INVALID_INPUT" }], ["wrong-message", { ...boundary, message: "Network Access denied" }], ["extra-private-data", { ...boundary, payload: "offline standin" }], ["wrong-retry", { ...boundary, retryable: true }], ["wrong-version", { ...boundary, version: 2 }], ["wrong-outcome", { ...boundary, outcome: "dispatched" }], ["unstructured-keyword", "FORBIDDEN Access denied"]]) check(label, false, result(diagnostic(name, data)));
check("unknown-function-family", false, result(diagnostic("other:recheck", boundary)), "other:recheck");
writeEvidence(`classifier-${randomUUID()}.json`, { evidenceKind: "offline official-contract controls only", discovered: rows.length, passed: rows.length, skipped: 0, networkCalls: 0, serviceOutcomes: "UNEXECUTED", rows }, false);
process.stdout.write(JSON.stringify({ discovered: rows.length, passed: rows.length, skipped: 0, networkCalls: 0 }) + "\n");
