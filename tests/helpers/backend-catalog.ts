/** Portable catalog qualification. Historical source is data, never executable. */
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import ts from "typescript";
// Jest's normal TypeScript transform loads maintained CLI source directly. No
// dist build, private goal runner, fallback implementation, or service is needed.
import { applySelectedBackendPlan, planRuntimeBackend } from "../../packages/cortex-cli/src/utils/runtime-backend";

const fixtureRoot = fileURLToPath(new URL("../fixtures/backend-catalog/", import.meta.url));
const repository = fileURLToPath(new URL("../../", import.meta.url));
const manifestHash = "e0afd62a9711ba2ce4e4ebc89bb039cf0e8b35995ebb35b679a934d5c837ec74";
export const sha256 = (bytes: Buffer | string): string => createHash("sha256").update(bytes).digest("hex");

export function catalogFixtureBytes(name: string): Buffer {
  const manifestBytes = fs.readFileSync(path.join(fixtureRoot, "manifest.json"));
  assert.equal(sha256(manifestBytes), manifestHash, "Reviewed historical fixture manifest");
  const manifest = JSON.parse(manifestBytes.toString()) as { files: Record<string, string> };
  assert.ok(Object.hasOwn(manifest.files, name), "Known reviewed fixture only");
  const bytes = fs.readFileSync(path.join(fixtureRoot, name));
  assert.equal(sha256(bytes), manifest.files[name], `Historical fixture integrity: ${name}`);
  return bytes;
}

export function catalogFixture<T>(name: string): T {
  return JSON.parse(catalogFixtureBytes(name).toString()) as T;
}

export function backendSource(module: string): string {
  assert.match(module, /^[A-Za-z][A-Za-z0-9]*$/);
  return fs.readFileSync(path.join(repository, "convex-dev", `${module}.ts`), "utf8");
}

export interface AstDeclaration {
  name: string;
  declaration: string;
  validators: Record<string, string>;
}

/** Normalize trivia and optional trailing commas without changing literal values. */
export function canonicalValidator(source: string): string {
  const scanner = ts.createScanner(ts.ScriptTarget.Latest, true, ts.LanguageVariant.Standard, source);
  const tokens: string[] = [];
  for (let token = scanner.scan(); token !== ts.SyntaxKind.EndOfFileToken; token = scanner.scan())
    tokens.push(token === ts.SyntaxKind.StringLiteral ? JSON.stringify(scanner.getTokenValue()) : scanner.getTokenText());
  return tokens.filter((token, index) => token !== "," || !["}", ")", "]"].includes(tokens[index + 1])).join(" ");
}

export function catalogDeclarations(source: string): AstDeclaration[] {
  const ast = ts.createSourceFile("source.ts", source, ts.ScriptTarget.Latest, true);
  const objects = new Map<string, ts.ObjectLiteralExpression>();
  for (const statement of ast.statements) if (ts.isVariableStatement(statement)) {
    for (const declaration of statement.declarationList.declarations) {
      if (ts.isIdentifier(declaration.name) && declaration.initializer && ts.isObjectLiteralExpression(declaration.initializer))
        objects.set(declaration.name.text, declaration.initializer);
    }
  }
  function resolve(expression: ts.Expression, ancestors = new Set<string>()): Record<string, string> {
    if (ts.isIdentifier(expression)) {
      assert.ok(!ancestors.has(expression.text), "Acyclic explicit argument schema");
      const object = objects.get(expression.text);
      // Imported selector fragments are covered by actual exportArgs checks;
      // this source-only AST comparison retains the explicit local fields.
      if (!object) return {};
      return resolve(object, new Set([...ancestors, expression.text]));
    }
    assert.ok(ts.isObjectLiteralExpression(expression), "Explicit object argument schema");
    const fields: Record<string, string> = {};
    for (const property of expression.properties) {
      if (ts.isSpreadAssignment(property)) Object.assign(fields, resolve(property.expression, ancestors));
      else if (ts.isShorthandPropertyAssignment(property)) fields[property.name.text] = canonicalValidator(property.name.text);
      else {
        assert.ok(ts.isPropertyAssignment(property), "Explicit argument property");
        fields[property.name.getText(ast)] = canonicalValidator(property.initializer.getText(ast));
      }
    }
    return fields;
  }
  const rows: AstDeclaration[] = [];
  for (const statement of ast.statements) {
    if (!ts.isVariableStatement(statement)) continue;
    for (const declaration of statement.declarationList.declarations) {
      const call = declaration.initializer;
      if (!call || !ts.isCallExpression(call) || call.arguments.length === 0 || !ts.isObjectLiteralExpression(call.arguments[0])) continue;
      const args = call.arguments[0].properties.find(property => property.name?.getText(ast) === "args");
      if (!args || !ts.isPropertyAssignment(args)) continue;
      rows.push({
        name: declaration.name.getText(ast),
        declaration: statement.getText(ast),
        validators: resolve(args.initializer),
      });
    }
  }
  return rows;
}

export interface HistoricalModules {
  sourceHashes: Record<string, string>;
  originalModules: Record<string, { name: string; validators: Record<string, string> }[]>;
}

export interface CatalogEndpoint { path: string; kind: string; visibility: "public" | "internal" }
const builders = new Set(["query", "mutation", "action", "internalQuery", "internalMutation", "internalAction"]);

/** Resolve every imported registration builder and reject unclassified calls. */
export function catalogInventory(sources: Record<string, string>): {
  completeness: { unresolved: string[] }; endpoints: CatalogEndpoint[];
} {
  const endpoints: CatalogEndpoint[] = [];
  const unresolved: string[] = [];
  for (const [module, source] of Object.entries(sources)) {
    const ast = ts.createSourceFile(`${module}.ts`, source, ts.ScriptTarget.Latest, true);
    const aliases = new Map<string, string>();
    for (const statement of ast.statements) {
      if (ts.isExportDeclaration(statement)) unresolved.push(`${module}:re-export`);
      if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)
          || statement.moduleSpecifier.text !== "./_generated/server") continue;
      const bindings = statement.importClause?.namedBindings;
      if (bindings && ts.isNamedImports(bindings)) for (const binding of bindings.elements) {
        const builder = binding.propertyName?.text ?? binding.name.text;
        if (builders.has(builder)) aliases.set(binding.name.text, builder);
      }
    }
    const calls = new Set<ts.CallExpression>();
    const visit = (node: ts.Node): void => {
      if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && aliases.has(node.expression.text)) calls.add(node);
      ts.forEachChild(node, visit);
    };
    visit(ast);
    for (const statement of ast.statements) {
      if (!ts.isVariableStatement(statement) || !statement.modifiers?.some(modifier => modifier.kind === ts.SyntaxKind.ExportKeyword)) continue;
      for (const declaration of statement.declarationList.declarations) {
        const call = declaration.initializer;
        if (!ts.isIdentifier(declaration.name) || !call || !ts.isCallExpression(call) || !calls.has(call) || !ts.isIdentifier(call.expression)) continue;
        const kind = aliases.get(call.expression.text)!;
        endpoints.push({ path: `${module}:${declaration.name.text}`, kind, visibility: kind.startsWith("internal") ? "internal" : "public" });
        calls.delete(call);
      }
    }
    for (const call of calls) unresolved.push(`${module}:${call.getText(ast)}`);
  }
  return { completeness: { unresolved }, endpoints };
}

/** Exercise maintained plan/apply on a fresh ordinary SDK host; cleanup on error. */
export async function withComposedCatalog<T>(run: (directory: string, files: Record<string, Buffer>) => T | Promise<T>): Promise<T> {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "cortex-backend-catalog-"));
  try {
    const plan = await planRuntimeBackend(directory, repository);
    assert.deepEqual(plan.conflicts, []);
    await applySelectedBackendPlan(plan);
    const distribution = path.join(repository, "dist/backend/v1");
    const manifest = JSON.parse(fs.readFileSync(path.join(distribution, "manifest.json"), "utf8")) as {
      files: { path: string; sha256: string; sourcePath: string; sourceSha256: string }[];
    };
    for (const entry of manifest.files) {
      const source = fs.readFileSync(path.join(repository, entry.sourcePath));
      assert.equal(sha256(source), entry.sourceSha256, `Current backend source: ${entry.sourcePath}`);
      assert.equal(sha256(plan.files[entry.path]), entry.sha256, `Current installed backend byte closure: ${entry.path}`);
      assert.deepEqual(plan.files[entry.path], fs.readFileSync(path.join(distribution, entry.path)));
    }
    for (const [name, bytes] of Object.entries(plan.files)) {
      assert.deepEqual(fs.readFileSync(path.join(directory, plan.functions, name)), bytes, `Composed current SDK source: ${name}`);
    }
    const stable = await planRuntimeBackend(directory, repository);
    assert.deepEqual(stable.additions, []);
    assert.deepEqual(stable.updates, []);
    assert.deepEqual(stable.conflicts, []);
    return await run(directory, plan.files);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
    assert.equal(fs.existsSync(directory), false, "Owned catalog scratch cleanup");
  }
}

export interface NativeIndex { indexDescriptor: string; fields: string[] }
export interface NativeDefinition {
  table: string;
  exported: { indexes: NativeIndex[]; [key: string]: unknown };
}
export interface HistoricalRepair {
  preHashes: Record<string, string>; postHashes: Record<string, string>;
  before: { definitions: NativeDefinition[]; registrations: Record<string, unknown> };
  afterHash: string; tableCount: number; indexCountBefore: number; indexCountAfter: number;
  duplicateSequencesAfter: number; wholeByteAuthorizedEdits: number;
}

export function historicalRepairSources(): Record<string, string> {
  return Object.fromEntries(["schema", "runtimeArtifactAuth", "artifacts"].map(module =>
    [`convex-dev/${module}.ts`, catalogFixtureBytes(`historical-${module}.ts.txt`).toString()]));
}

export function repairedHistoricalSources(before: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.entries(before).map(([name, source]) => {
    const schema = name === "convex-dev/schema.ts";
    const needle = schema ? '    .index("by_runtime_scope", ["tenantId", "memorySpaceId"])\n' : '.withIndex("by_runtime_scope",';
    assert.equal(source.split(needle).length - 1, 1, `Sole historical index repair: ${name}`);
    return [name, source.replace(needle, schema ? "" : '.withIndex("by_tenant_space",')];
  }));
}

/** Whole-byte historical predicate/declaration proof, with exactly three edits. */
export function verifyHistoricalRepair(current: Record<string, string>): void {
  const fixture = catalogFixture<HistoricalRepair>("index-repair-historical.json");
  const before = historicalRepairSources();
  const expected = repairedHistoricalSources(before);
  for (const name of Object.keys(expected)) {
    assert.equal(sha256(before[name]), fixture.preHashes[name]);
    assert.equal(sha256(current[name]), fixture.postHashes[name]);
    assert.equal(current[name], expected[name], `Historical whole-byte authorized edit: ${name}`);
  }
}
