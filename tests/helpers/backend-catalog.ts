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
import { applyBackendPlan, planBackendSync } from "../../packages/cortex-cli/src/utils/schema-sync";

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

export function catalogDeclarations(source: string): AstDeclaration[] {
  const ast = ts.createSourceFile("source.ts", source, ts.ScriptTarget.Latest, true);
  const rows: AstDeclaration[] = [];
  for (const statement of ast.statements) {
    if (!ts.isVariableStatement(statement)) continue;
    for (const declaration of statement.declarationList.declarations) {
      const call = declaration.initializer;
      if (!call || !ts.isCallExpression(call) || call.arguments.length === 0 || !ts.isObjectLiteralExpression(call.arguments[0])) continue;
      const args = call.arguments[0].properties.find(property => property.name?.getText(ast) === "args");
      if (!args || !ts.isPropertyAssignment(args) || !ts.isObjectLiteralExpression(args.initializer)) continue;
      rows.push({
        name: declaration.name.getText(ast),
        declaration: statement.getText(ast),
        validators: Object.fromEntries(args.initializer.properties.filter(ts.isPropertyAssignment)
          .map(property => [property.name.getText(ast), property.initializer.getText(ast)])),
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
export function withComposedCatalog<T>(run: (directory: string, files: Record<string, Buffer>) => T): T {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "cortex-backend-catalog-"));
  try {
    const plan = planBackendSync(directory, repository);
    assert.deepEqual(plan.conflicts, []);
    applyBackendPlan(plan);
    for (const [name, bytes] of Object.entries(plan.files)) {
      assert.deepEqual(fs.readFileSync(path.join(directory, plan.functions, name)), bytes, `Composed current SDK source: ${name}`);
    }
    const stable = planBackendSync(directory, repository);
    assert.deepEqual(stable.additions, []);
    assert.deepEqual(stable.updates, []);
    assert.deepEqual(stable.conflicts, []);
    return run(directory, plan.files);
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
