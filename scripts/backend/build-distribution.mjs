/** Build the installable backend source closure; never reads deployment credentials. */
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const output = path.join(root, "dist/backend/v1");
const hash = (value) => crypto.createHash("sha256").update(value).digest("hex");
const entries = new Map();
const sources = new Map();
const destination = (source) => source.startsWith("src/") ? `_cortex/shared/${source.slice(4)}` : source === "convex-dev/schema.ts" ? "_cortex/schema.ts" : source.slice("convex-dev/".length);
const parse = (name, text) => ts.createSourceFile(name, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
async function resolveLocal(from, name) {
  const base = path.resolve(root, path.dirname(from), name.replace(/\.js$/, ""));
  for (const candidate of [base + ".ts", path.join(base, "index.ts")]) {
    try { if ((await fs.stat(candidate)).isFile()) return path.relative(root, candidate).split(path.sep).join("/"); } catch { /* Try the next source suffix. */ }
  }
  throw new Error(`Unresolved backend source import: ${from}: ${name}`);
}
async function collect(source) {
  if (sources.has(source)) return;
  const text = await fs.readFile(path.join(root, source), "utf8");
  sources.set(source, text);
  const ast = parse(source, text);
  const replacements = [];
  for (const node of ast.statements) {
    if (!(ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) || !node.moduleSpecifier || !ts.isStringLiteral(node.moduleSpecifier)) continue;
    const specifier = node.moduleSpecifier.text;
    if (!specifier.startsWith(".")) continue;
    // Host bindings are produced by ordinary Convex codegen after additive installation.
    if (specifier.startsWith("./_generated/")) continue;
    const target = await resolveLocal(source, specifier);
    if (!target.startsWith("src/") && !target.startsWith("convex-dev/")) throw new Error(`Backend import outside its source closure: ${target}`);
    await collect(target);
    let rewritten = path.posix.relative(path.posix.dirname(destination(source)), target === "convex-dev/schema.ts" && source !== target ? "schema.ts" : destination(target)).replace(/\.ts$/, "");
    if (!rewritten.startsWith(".")) rewritten = "./" + rewritten;
    replacements.push({ start: node.moduleSpecifier.getStart(ast), end: node.moduleSpecifier.end, text: JSON.stringify(rewritten) });
  }
  let result = text;
  for (const edit of replacements.sort((a, b) => b.start - a.start)) result = result.slice(0, edit.start) + edit.text + result.slice(edit.end);
  if (source === "convex-dev/schema.ts") {
    const declaration = ast.statements.find((node) => ts.isExportAssignment(node));
    if (!declaration || !ts.isCallExpression(declaration.expression) || declaration.expression.expression.getText(ast) !== "defineSchema" || declaration.expression.arguments.length !== 1 || !ts.isObjectLiteralExpression(declaration.expression.arguments[0])) throw new Error("Cortex schema must export one explicit defineSchema object");
    // Reparse after import edits so source positions still refer to the rewritten file.
    const rewrittenAst = parse(source, result);
    const exported = rewrittenAst.statements.find((node) => ts.isExportAssignment(node));
    const tableObject = exported.expression.arguments[0].getText(rewrittenAst);
    result = result.slice(0, exported.getStart(rewrittenAst)) + `export const cortexTablesV1 = ${tableObject};\n`;
    result = result.replace('{ defineSchema, defineTable }', '{ defineTable }');
  }
  entries.set(destination(source), result);
}
const names = (await fs.readdir(path.join(root, "convex-dev"))).filter((name) => name.endsWith(".ts") && !["convex.config.ts", "auth.config.ts", "http.ts"].includes(name)).sort();
for (const name of names) await collect(`convex-dev/${name}`);
const tableNames = new Set();
function tablesFromObject(object, file) {
  for (const property of object.properties) {
    if (ts.isSpreadAssignment(property)) {
      const imported = parse(file, sources.get(file)).statements.filter(ts.isImportDeclaration).flatMap((node) => node.importClause?.namedBindings && ts.isNamedImports(node.importClause.namedBindings) ? node.importClause.namedBindings.elements.map((binding) => ({ name: binding.name.text, from: node.moduleSpecifier.text })) : []).find((binding) => binding.name === property.expression.getText());
      if (!imported) throw new Error(`Unresolved Cortex schema fragment ${property.expression.getText()}`);
      const target = path.posix.normalize(path.posix.join(path.posix.dirname(file), imported.from)) + ".ts";
      const targetAst = parse(target, sources.get(target));
      let initializer;
      for (const statement of targetAst.statements) if (ts.isVariableStatement(statement)) for (const declaration of statement.declarationList.declarations) if (declaration.name.getText() === imported.name) initializer = declaration.initializer;
      if (!initializer || !ts.isObjectLiteralExpression(initializer)) throw new Error(`Cortex schema fragment is not an explicit table map: ${target}`);
      tablesFromObject(initializer, target);
    } else if (property.name && (ts.isIdentifier(property.name) || ts.isStringLiteral(property.name))) {
      const name = property.name.text;
      if (tableNames.has(name)) throw new Error(`Duplicate Cortex table ${name}`);
      tableNames.add(name);
    } else throw new Error(`Unsupported Cortex schema table in ${file}`);
  }
}
const schemaAst = parse("convex-dev/schema.ts", sources.get("convex-dev/schema.ts"));
tablesFromObject(schemaAst.statements.find(ts.isExportAssignment).expression.arguments[0], "convex-dev/schema.ts");
const componentSource = await fs.readFile(path.join(root, "convex-dev/convex.config.ts"), "utf8");
const componentAst = parse("convex.config.ts", componentSource);
const imports = componentAst.statements.filter(ts.isImportDeclaration).filter((node) => node.moduleSpecifier.text !== "convex/server").map((node) => node.getText(componentAst));
const registrations = componentAst.statements.filter(ts.isExpressionStatement).map((node) => node.getText(componentAst));
const componentNames = registrations.map((registration) => /name:\s*["']([^"']+)["']/.exec(registration)?.[1]);
if (componentNames.some((name) => !name)) throw new Error("Every Cortex component must have an explicit stable name");
entries.set("_cortex/components.ts", `import type { AppDefinition } from "convex/server";\n${imports.join("\n")}\nexport function registerCortexComponentsV1(app: AppDefinition): void {\n${registrations.join("\n")}\n}\n`);
const pkg = JSON.parse(await fs.readFile(path.join(root, "package.json"), "utf8"));
const manifest = { formatVersion: 1, distributionId: `cortex-backend-v1-sdk-${pkg.version}`, sdkVersion: pkg.version, tables: [...tableNames].sort(), components: componentNames, httpRoutes: [], dependencies: { convex: pkg.peerDependencies.convex, ...pkg.dependencies }, files: [...entries].sort(([a], [b]) => a.localeCompare(b)).map(([name, text]) => ({ path: name, sha256: hash(text) })) };
await fs.rm(output, { recursive: true, force: true });
for (const [name, text] of entries) { await fs.mkdir(path.dirname(path.join(output, name)), { recursive: true }); await fs.writeFile(path.join(output, name), text); }
await fs.writeFile(path.join(output, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
console.log(`Built ${manifest.distributionId}: ${entries.size} source files, ${tableNames.size} tables, ${componentNames.length} components; no deployment.`);
