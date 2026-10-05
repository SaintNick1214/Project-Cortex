import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { randomUUID } from "node:crypto";
import ts from "typescript";
import { localPreflight, root, writeEvidence } from "./guard.mjs";
localPreflight();
const source = readFileSync(resolve(root, "scripts/client.ts"), "utf8");
const tree = ts.createSourceFile("client.ts", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
const guardedCalls = [];
function walk(node) {
  if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) && ["query", "mutation", "create", "get", "update", "end", "expireIdle", "withHttpAuth", "getAuthorizationHeaders", "close", "shutdown"].includes(node.expression.name.text)) {
    // Ignore local collection getters and the fake offline null fetch. Every
    // actual Convex/SDK service or shutdown promise must have a 12s boundary.
    const receiver = node.expression.expression.getText(tree);
    if (receiver !== "Reflect" && !receiver.startsWith("results") && !receiver.startsWith("owned") && !receiver.startsWith("names")) {
      let parent = node.parent, protectedCall = false;
      while (parent && !ts.isStatement(parent)) {
        if (ts.isCallExpression(parent) && ts.isIdentifier(parent.expression) && ["bounded", "denied"].includes(parent.expression.text)) protectedCall = true;
        parent = parent.parent;
      }
      assert(protectedCall, `Unbounded service/shutdown call at line ${tree.getLineAndCharacterOfPosition(node.pos).line + 1}`);
      guardedCalls.push({ method: node.expression.name.text, line: tree.getLineAndCharacterOfPosition(node.pos).line + 1 });
    }
  }
  ts.forEachChild(node, walk);
}
walk(tree);
assert(guardedCalls.length >= 50);
const operator = readFileSync(resolve(root, "scripts/operator.mjs"), "utf8"), driver = readFileSync(resolve(root, "scripts/driver.mjs"), "utf8"), engine = readFileSync(resolve(root, "scripts/driver-engine.mjs"), "utf8"), cleanup = readFileSync(resolve(root, "scripts/cleanup.mjs"), "utf8");
assert(operator.includes("25_000")); assert(driver.includes("12_000")); assert(engine.includes("wholeMs = 600_000")); assert(cleanup.includes("deadline = Date.now() + 600_000"));
writeEvidence(`bounds-${randomUUID()}.json`, { evidenceKind: "offline AST boundary coverage; not live timing evidence", discovered: guardedCalls.length + 4, passed: guardedCalls.length + 4, skipped: 0,
  guardedServiceAndShutdownCalls: guardedCalls, requestMs: 12_000, operatorMs: 25_000, wholeMs: 600_000, networkCalls: 0 }, false);
process.stdout.write(JSON.stringify({ guardedServiceAndShutdownCalls: guardedCalls.length, passed: guardedCalls.length + 4, skipped: 0, networkCalls: 0 }) + "\n");
