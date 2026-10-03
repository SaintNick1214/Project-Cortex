import assert from "node:assert/strict";
import { ConvexError } from "convex/values";
import { randomUUID } from "node:crypto";
import { acceptedOperatorDenial } from "./operator-classifier.mjs";
import { localPreflight, writeEvidence } from "./guard.mjs";
localPreflight();
const name = "runtimeAuth:recheck", data = { version: 1, code: "FORBIDDEN", message: "Access denied", retryable: false, outcome: "not_dispatched" };
const payload = new ConvexError(data).message;
const body = new ConvexError(`[Request ID: abc123] Server Error\nUncaught ConvexError: ${payload}`).toString();
const accepted = `Failed to run function "${name}":\n${body}\n`;
const rows = [], base = { code: 1, signal: null, timedOut: false, overflow: false, stdout: "" };
function check(label, expected, stderr, patch = {}) { assert.equal(acceptedOperatorDenial(name, { ...base, stderr, ...patch }), expected, label); rows.push({ label, expected, passed: true }); }
// Exact independent cycle2 failures, unchanged expectations.
check("request-marker-in-proxy-description", false, `Failed to run function "${name}":\nConvexError: Proxy rejection contains [Request ID: abc123] Server Error\nUncaught ConvexError: ${payload}\n`);
check("wrong-function-plus-mentioned-envelope", false, `Failed to run function "runtimeAuth:authorize":\nError: diagnostic contains Failed to run function "${name}":\n${body}\n`);
check("literal-structured-json-lookalike", false, `Failed to run function "${name}":\nConvexError: EACCES reading deploy.env\nPrinted example: [Request ID: abc123] Server Error\nUncaught ConvexError: ${payload}\n`);
check("installed-logFailure-symbol-and-actual-ConvexError-body", true, `✖ ${accepted}`);
check("exact-body-without-stack", true, accepted);
check("ordinary-installed-stack-suffix", true, accepted.trimEnd() + "\n    at deny (convex/runtimeAuth.ts:46:9)\n    at async Object.handler (convex/runtimeAuth.ts:343:12)\n");
for (const [label, value] of [
  ["quoted-whole-envelope", JSON.stringify(accepted)],
  ["prefixed-example", "Printed example: " + accepted],
  ["proxy-prefix", "Proxy FORBIDDEN\n" + accepted],
  ["trailing-diagnostic-example", accepted + "Printed example\n"],
  ["nested-envelope-after-accepted-body", accepted + accepted],
  ["nested-envelope-in-stack", accepted.trimEnd() + `\n    at Failed to run function "${name}":\n`],
  ["quoted-request-id", accepted.replace("[Request ID: abc123]", '"[Request ID: abc123]"')],
  ["wrong-immediate-server-error-class", accepted.replace("ConvexError: [", "Error: [")],
  ["quoted-structured-json", accepted.replace(payload, JSON.stringify(payload))],
  ["duplicate-structured-key", accepted.replace('"version":1', '"version":1,"version":1')],
  ["noncanonical-json-whitespace", accepted.replace('"version":1', '"version": 1')],
  ["nonofficial-two-final-newlines", accepted + "\n"],
  ["mixed-function-envelope", accepted.replace(name, "sessions:incrementMessageCount")],
  ["marker-and-json-without-uncaught-boundary", accepted.replace("Uncaught ConvexError: ", "Printed example: ")],
]) check(label, false, value);
check("error-cannot-also-have-success-stdout", false, accepted, { stdout: "offline-success-standin" });
assert.equal(acceptedOperatorDenial(name, null), false); rows.push({ label: "invalid-result-shape", expected: false, passed: true });
writeEvidence(`classifier-adversarial-${randomUUID()}.json`, { evidenceKind: "OFFLINE exact official diagnostic controls; no live outcome", discovered: rows.length, passed: rows.length, skipped: 0, networkCalls: 0, serviceOutcomes: "UNEXECUTED", rows }, false);
process.stdout.write(JSON.stringify({ discovered: rows.length, passed: rows.length, skipped: 0, networkCalls: 0 }) + "\n");
