import fs from "node:fs";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import ts from "../../../../node_modules/typescript/lib/typescript.js";
const root = new URL("../../../../", import.meta.url), sourceCommit = "7fecfebd36704ed397b3f8c755ad651dc49c814f";
const oldText = execFileSync("git", ["show", `${sourceCommit}:convex-dev/runtimeAgent.ts`], { cwd: root, encoding: "utf8" });
const currentText = fs.readFileSync(new URL("convex-dev/runtimeAgent.ts", root), "utf8");
const parse = text => ts.createSourceFile("runtimeAgent.ts", text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
const old = parse(oldText), current = parse(currentText), hash = text => crypto.createHash("sha256").update(text).digest("hex");
function named(source, name) {
  let found;
  ts.forEachChild(source, node => {
    if (ts.isFunctionDeclaration(node) && node.name?.text === name) found = node;
    if (ts.isVariableStatement(node)) for (const declaration of node.declarationList.declarations) if (declaration.name.getText(source) === name) found = declaration.initializer;
  }); if (!found) throw new Error(`Missing ${name}`); return found;
}
function body(source, name) {
  const node = named(source, name);
  if (ts.isFunctionDeclaration(node)) return node.body.getText(source);
  const handler = node.arguments[0].properties.find(property => property.name?.getText(source) === "handler");
  return handler.initializer.body.getText(source);
}
const stable = ["executionContext", "contextInputsHandler", "executeTurn", "prepareContext", "startContext", "contextBarrier", "failContext", "prepareModelOperationHandler", "admitModelOperationHandler", "modelStepHandler", "recordOutput", "finalize", "onWorkflowComplete"];
const checks = stable.map(name => ({ name, equal: body(old, name) === body(current, name), oldBodySha256: hash(body(old, name)), currentBodySha256: hash(body(current, name)) }));
checks.push({ name: "saveContext extracted original body", equal: body(old, "saveContext") === body(current, "saveContextHandler"), oldBodySha256: hash(body(old, "saveContext")), currentBodySha256: hash(body(current, "saveContextHandler")) });
const prefixEnd = '  traceRuntimePhase(args.runId, args.attemptNumber, "context.end");';
const oldBody = body(old, "executeTurn"), freshBody = body(current, "executeTurnV2");
checks.push({ name: "fresh Workflow retains exact model/tool/approval/finalization/title tail", equal: oldBody.slice(oldBody.indexOf(prefixEnd)) === freshBody.slice(freshBody.indexOf(prefixEnd)) });
const barrierEnd = '  traceRuntimePhase(args.runId, args.attemptNumber, "context.begin");';
checks.push({ name: "fresh Workflow retains exact original strict barrier/sleep prefix", equal: oldBody.slice(0, oldBody.indexOf(barrierEnd)) === freshBody.slice(0, freshBody.indexOf(barrierEnd)) });
function args(source, name) { return named(source, name).arguments[0].properties.find(property => property.name?.getText(source) === "args").initializer.getText(source); }
checks.push({ name: "saveContext validators unchanged", equal: args(old, "saveContext") === args(current, "saveContext") });
checks.push({ name: "new internal mutation accepts original Attempt schema only", equal: args(current, "prepareEmptyContext") === "agentAttempt" });
checks.push({ name: "fresh start changes only original Workflow function identity", equal: body(current, "startExecution") === body(old, "startExecution").replace('"runtimeAgent:executeTurn"', '"runtimeAgent:executeTurnV2"') });
const workflowFile = new URL("node_modules/@convex-dev/workflow/src/client/step.ts", root), workflowText = fs.readFileSync(workflowFile, "utf8");
const out = { sourceCommit, oldSourceSha256: hash(oldText), currentSourceSha256: hash(currentText), checks, passed: checks.every(check => check.equal),
  installedPrimaryContract: { package: "@convex-dev/workflow", version: "0.4.8", file: "node_modules/@convex-dev/workflow/src/client/step.ts", sha256: hash(workflowText),
    excerpt: workflowText.slice(workflowText.indexOf("        if (message.inline)"), workflowText.indexOf("        const commonFields")),
    meaning: "Inline target executes on the parent mutation ctx; success/failure is persisted through journal startSteps. Actions cannot execute inline. Completed entries are consumed before startSteps; changed args fail journal matching." } };
fs.writeFileSync(new URL("cloud-empty-context-inline-equivalence.json", import.meta.url), JSON.stringify(out, null, 2) + "\n");
console.log(JSON.stringify({ passed: out.passed, count: checks.length })); if (!out.passed) process.exitCode = 1;
