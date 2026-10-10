import { readFileSync, writeFileSync } from 'node:fs';
import ts from 'typescript';
const qa = '_goals/convex-backend-runtime-2026-10-02/qa/pipeline-version-docs-20261009/pipeline-execution';
const target = 'tests/unit/runtime/gateway-dispatch.test.ts';
const original = readFileSync(`${qa}/gateway-original.test.ts`, 'utf8');
const current = readFileSync('tests/unit/runtime/gateway-terminal-composition.test.ts', 'utf8');
function inventory(text) {
  const file = ts.createSourceFile('gateway.ts', text, ts.ScriptTarget.Latest, true);
  const cases = new Map(), functions = new Map();
  function visit(node) {
    if (ts.isFunctionDeclaration(node) && node.name) functions.set(node.name.text, node);
    if (ts.isExpressionStatement(node) && ts.isCallExpression(node.expression)) {
      const expression = node.expression, call = expression.expression;
      const plain = ts.isIdentifier(call) && call.text === 'it';
      const each = ts.isCallExpression(call) && ts.isPropertyAccessExpression(call.expression) && call.expression.name.text === 'each' && ts.isIdentifier(call.expression.expression) && call.expression.expression.text === 'it';
      if ((plain || each) && ts.isStringLiteral(expression.arguments[0])) {
        const title = expression.arguments[0].text;
        if (cases.has(title)) throw Error(`Duplicate case ${title}`);
        cases.set(title, node);
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(file);
  return { file, cases, functions };
}
const old = inventory(original), now = inventory(current);
const aliases = new Map([
  ['captures known charge durably before revocation denies ordinary settle', 'captures known charge durably before revocation denies private attachment'],
  ['cancel while terminal visibility is paused retains charge and never attaches or delivers the generated private result', 'cancel during capture retains full charge and never issues private attachment'],
  ['a delayed final visibility cannot consume the full model timeout after capture', 'a delayed atomic attachment cannot consume the full model timeout after capture'],
]);
const replacements = [], migrated = [], untouched = [];
for (const name of ['resolution', 'fixture']) {
  replacements.push({ start: old.functions.get(name).getStart(old.file), end: old.functions.get(name).getEnd(), text: now.functions.get(name).getText(now.file) });
}
for (const [title, node] of old.cases) {
  const updated = now.cases.get(aliases.get(title) ?? title);
  if (updated) {
    replacements.push({ start: node.getStart(old.file), end: node.getEnd(), text: updated.getText(now.file) });
    migrated.push({ from: title, to: aliases.get(title) ?? title });
  } else untouched.push(title);
}
let result = original;
for (const replacement of replacements.sort((a, b) => b.start - a.start)) result = result.slice(0, replacement.start) + replacement.text + result.slice(replacement.end);
const after = inventory(result);
if (after.cases.size !== old.cases.size) throw Error('Case count changed');
writeFileSync(target, result);
writeFileSync(`${qa}/gateway-migration.json`, JSON.stringify({ originalCaseDeclarations: old.cases.size, currentCaseDeclarations: after.cases.size, migrated, untouched }, null, 2));
console.log(JSON.stringify({ declarations: old.cases.size, migrated: migrated.length, untouched }));
