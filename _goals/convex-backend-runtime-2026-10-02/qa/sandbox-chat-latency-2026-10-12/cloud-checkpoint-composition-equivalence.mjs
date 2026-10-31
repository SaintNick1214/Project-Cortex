import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
const root = process.cwd(), require = createRequire(path.join(root, "package.json"));
const ts = require("typescript");
const base = "4c2bc7cff";
const output = path.join(root, "_goals/convex-backend-runtime-2026-10-02/qa/sandbox-chat-latency-2026-10-12/cloud-checkpoint-composition-equivalence.json");
const checks = [];
const printer = ts.createPrinter({ removeComments: true });
const source = (file, old = false) => ts.createSourceFile(file, old ? execFileSync("git", ["show", `${base}:${file}`], { encoding: "utf8" }) : fs.readFileSync(path.join(root, file), "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
const body = (sf, name, registration) => {
  let found;
  function visit(node) {
    if (!registration && ts.isFunctionDeclaration(node) && node.name?.text === name) found = node.body;
    if (registration && ts.isVariableDeclaration(node) && node.name.getText(sf) === name && ts.isCallExpression(node.initializer)) {
      const arg = node.initializer.arguments[0]; const handler = arg.properties.find(p => ts.isPropertyAssignment(p) && p.name.getText(sf) === "handler");
      found = handler.initializer.body;
    }
    ts.forEachChild(node, visit);
  }
  visit(sf); assert(found, `Missing ${name}`); return printer.printNode(ts.EmitHint.Unspecified, found, sf);
};
for (const [file, oldName, newName] of [
  ["convex-dev/runtimeModelPolicy.ts", "admit", "admitHandler"],
  ["convex-dev/runtimeModelPolicy.ts", "checkpoint", "checkpointHandler"],
  ["convex-dev/runtimeAgent.ts", "bindNativeOperation", "bindNativeOperationHandler"],
]) {
  assert.equal(body(source(file), newName, false), body(source(file, true), oldName, true));
  checks.push({ file, original: oldName, extracted: newName, unchangedBody: true });
}
const agent = source("convex-dev/runtimeAgent.ts"), oldAgent = source("convex-dev/runtimeAgent.ts", true);
for (const name of ["prepareModelOperation", "contextInputs", "finishOperation", "recordOutput", "saveContext", "hydrateExecution", "modelStep", "finalize", "observe", "toolStep", "endInterrupted", "onWorkflowComplete"]) {
  // Registrations may reference a named handler. For these the complete declaration remains unchanged.
  const declaration = sf => sf.statements.find(n => ts.isVariableStatement(n) && n.declarationList.declarations.some(d => d.name.getText(sf) === name));
  const before = declaration(oldAgent), after = declaration(agent);
  assert(before && after, `Missing registration ${name}`);
  assert.equal(printer.printNode(ts.EmitHint.Unspecified, after, agent), printer.printNode(ts.EmitHint.Unspecified, before, oldAgent));
  checks.push({ file: "convex-dev/runtimeAgent.ts", registration: name, unchanged: true });
}
for (const name of ["prepareModelOperationHandler", "beginOperationHandler", "startOperationHandler", "completedModelStepHandler", "executionContext", "contextInputsHandler", "toolStepHandler"]) {
  assert.equal(body(agent, name, false), body(oldAgent, name, false));
  checks.push({ file: "convex-dev/runtimeAgent.ts", handler: name, unchanged: true });
}
const modelTail = text => text.slice(text.indexOf("  let cancellationBridge:"), text.indexOf("export const modelStep ="));
assert.equal(modelTail(agent.text), modelTail(oldAgent.text));
checks.push({ file: "convex-dev/runtimeAgent.ts", unchangedModelExecutionAndCancellation: true });
const gateway = fs.readFileSync(path.join(root, "convex-dev/runtimeGateway.ts"), "utf8");
const oldGateway = execFileSync("git", ["show", `${base}:convex-dev/runtimeGateway.ts`], { encoding: "utf8" });
for (const marker of ["  const visible = async", "  async function terminal"]) {
  const tail = text => text.slice(text.indexOf(marker));
  assert(gateway.includes(marker) && oldGateway.includes(marker)); assert.equal(tail(gateway), tail(oldGateway));
  checks.push({ file: "convex-dev/runtimeGateway.ts", unchangedTail: marker.trim() });
}
const backend = source("convex-dev/runtimeGatewayBackend.ts"), oldBackend = source("convex-dev/runtimeGatewayBackend.ts", true);
const properties = sf => { const map = new Map(); function visit(n) { if (ts.isPropertyAssignment(n) && ["resolve", "admit", "checkpoint", "markVisible", "attachTerminalResult", "capture"].includes(n.name.getText(sf)) && (ts.isArrowFunction(n.initializer) || ts.isFunctionExpression(n.initializer))) map.set(n.name.getText(sf), printer.printNode(ts.EmitHint.Unspecified, n, sf)); ts.forEachChild(n, visit); } visit(sf); return map; };
for (const [name, text] of properties(oldBackend)) { assert.equal(properties(backend).get(name), text); checks.push({ file: "convex-dev/runtimeGatewayBackend.ts", genericPort: name, unchanged: true }); }
fs.writeFileSync(output, JSON.stringify({ version: 1, baseline: base, checks, passed: checks.length, outcome: "PASS", caveat: "Static AST equivalence complements controlled actual-handler tests; no hosted OCC or latency claim." }, null, 2) + "\n");
process.stdout.write(JSON.stringify({ outcome: "PASS", checks: checks.length, output }) + "\n");
