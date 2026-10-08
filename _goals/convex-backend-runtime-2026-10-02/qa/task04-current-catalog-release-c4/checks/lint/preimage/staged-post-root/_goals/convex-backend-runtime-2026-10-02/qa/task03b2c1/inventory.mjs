import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import ts from "typescript";
const base = "_goals/convex-backend-runtime-2026-10-02/qa/task03b2c1";
const source = fs.readFileSync("convex-dev/artifacts.ts", "utf8");
const frozen = JSON.parse(fs.readFileSync(path.join(base, "frozen-catalog.json"), "utf8"));
const baseline = fs.readFileSync(path.join(base, "excluded-baseline.ts.text"), "utf8");
function catalog(text) {
  const ast = ts.createSourceFile("artifacts.ts", text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const rows = [];
  for (const statement of ast.statements) {
    if (!ts.isVariableStatement(statement) || !statement.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)) continue;
    for (const declaration of statement.declarationList.declarations) {
      const call = declaration.initializer;
      if (!ts.isIdentifier(declaration.name) || !call || !ts.isCallExpression(call) || !ts.isIdentifier(call.expression)) continue;
      const builder = call.expression.text;
      if (!["query", "mutation", "internalQuery", "internalMutation", "action", "internalAction"].includes(builder)) continue;
      rows.push({ name: declaration.name.text, builder, line: ast.getLineAndCharacterOfPosition(statement.getStart(ast)).line + 1, text: declaration.getText(ast) });
    }
  }
  return rows;
}
const current = catalog(source); const prior = catalog(baseline);
const names = new Set(frozen.endpoints.map((row) => row.path.split(":")[1]));
const selected = current.filter((row) => names.has(row.name));
const pending = current.filter((row) => !names.has(row.name));
const endpoints = selected.map((row) => ({ ...frozen.endpoints.find((old) => old.path === `artifacts:${row.name}`), builder: row.builder, visibility: row.builder.startsWith("internal") ? "internal" : "public", line: row.line }));
const frozenFilePaths = pending.map((row) => ({ path: `artifacts:${row.name}`, unchanged: prior.find((old) => old.name === row.name)?.text === row.text }));
const result = { version: 1, scope: frozen.scope, counts: { registered: selected.length, public: endpoints.filter((row) => row.visibility === "public").length, internal: endpoints.filter((row) => row.visibility === "internal").length, unresolved: names.size - selected.length, pendingFileRegistrations: pending.length }, sourceHash: crypto.createHash("sha256").update(source).digest("hex"), endpoints, frozenFilePaths };
const output = process.argv[2]; if (!output) throw new Error("Explicit scratch output required");
fs.mkdirSync(output, { recursive: true }); fs.writeFileSync(path.join(output, "public-path-inventory.json"), JSON.stringify(result, null, 2) + "\n");
console.log(JSON.stringify(result));
if (result.counts.registered !== 22 || result.counts.public !== 21 || result.counts.internal !== 1 || result.counts.unresolved !== 0 || pending.length !== 5 || !frozenFilePaths.every((row) => row.unchanged)) process.exitCode = 1;
