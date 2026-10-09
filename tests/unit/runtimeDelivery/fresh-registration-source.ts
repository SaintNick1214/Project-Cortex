/** Exact authorized transformation; historical baseline bytes and handler bodies remain pinned. */
import ts from "typescript";
import fs from "node:fs";
export const freshReadQa = "_goals/convex-backend-runtime-2026-10-02/qa/local-resume-2026-10-05/task03-final-query-expiry-functional-v2-20261008/author";
export function expectedFreshRegistrationSource(module: string, baseline: string): string {
  const inventory = JSON.parse(fs.readFileSync(`${freshReadQa}/read-inventory1.json`, "utf8")) as { converted: { module: string; name: string }[] };
  const names = new Set(inventory.converted.filter(row => row.module === module).map(row => row.name));
  const ast = ts.createSourceFile(module, baseline, ts.ScriptTarget.Latest, true);
  const edits: { start: number; end: number; value: string }[] = [];
  for (const statement of ast.statements) if (ts.isVariableStatement(statement)) for (const item of statement.declarationList.declarations) {
    if (names.has(item.name.getText(ast)) && item.initializer && ts.isCallExpression(item.initializer)
      && item.initializer.expression.getText(ast) === "query") {
      edits.push({ start: item.initializer.expression.getStart(ast), end: item.initializer.expression.end, value: "mutation" });
    }
  }
  if (edits.length !== names.size) throw new Error("Incomplete declared fresh-read transformation");
  const registrationImport = ast.statements.find((statement): statement is ts.ImportDeclaration =>
    ts.isImportDeclaration(statement) && ts.isStringLiteral(statement.moduleSpecifier) && statement.moduleSpecifier.text === "./_generated/server");
  const bindings = registrationImport?.importClause?.namedBindings;
  if (!bindings || !ts.isNamedImports(bindings)) throw new Error("Missing registration imports");
  const imports = bindings.elements.map(item => item.name.text);
  if (!imports.includes("mutation")) imports.push("mutation");
  if (!["agents", "memorySpaces"].includes(module)) imports.splice(imports.indexOf("query"), 1);
  edits.push({ start: bindings.getStart(ast), end: bindings.end, value: `{ ${imports.join(", ")} }` });
  let expected = baseline;
  for (const edit of edits.sort((a, b) => b.start - a.start)) expected = expected.slice(0, edit.start) + edit.value + expected.slice(edit.end);
  return expected;
}
