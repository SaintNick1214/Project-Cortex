/** Read-only source inventory; explicit output directory must be supplied. Ordinary tests use mkdtemp/finally cleanup. */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import ts from 'typescript';
const destination = process.argv[2];
if (!destination) throw new Error('Provide an explicit output directory');
const original = JSON.parse(fs.readFileSync('_goals/convex-backend-runtime-2026-10-02/qa/task03a/public-path-inventory.json', 'utf8'));
const modules = ['agents', 'memorySpaces', 'contexts'];
const excluded = ['agents:computeStats', 'memorySpaces:getStats'];
const expected = original.endpoints.filter((endpoint) => modules.includes(endpoint.path.split(':')[0]) && !excluded.includes(endpoint.path)).map((endpoint) => endpoint.path).sort();
const endpoints = []; const unresolved = []; let calls = 0;
for (const module of modules) {
  const file = `convex-dev/${module}.ts`; const source = fs.readFileSync(file, 'utf8');
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true); const aliases = new Map();
  for (const node of ast.statements) if (ts.isImportDeclaration(node) && node.moduleSpecifier.text.endsWith('/_generated/server')) {
    const bindings = node.importClause?.namedBindings;
    if (bindings && ts.isNamedImports(bindings)) for (const item of bindings.elements) aliases.set(item.name.text, item.propertyName?.text ?? item.name.text);
  }
  const builders = new Set(['query', 'mutation', 'internalMutation']); const registrations = new Set();
  const visit = (node) => {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && builders.has(aliases.get(node.expression.text))) { calls++; registrations.add(node); }
    ts.forEachChild(node, visit);
  };
  visit(ast);
  for (const statement of ast.statements) if (ts.isVariableStatement(statement) && statement.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword)) {
    for (const declaration of statement.declarationList.declarations) {
      const call = declaration.initializer; if (!call || !registrations.has(call)) continue;
      registrations.delete(call); const name = declaration.name.getText(ast); const endpointPath = `${module}:${name}`;
      if (excluded.includes(endpointPath)) continue;
      const configuration = call.arguments[0]; const args = configuration.properties.find((field) => field.name?.getText(ast) === 'args');
      const originalEndpoint = original.endpoints.find((endpoint) => endpoint.path === endpointPath);
      endpoints.push({ path: endpointPath, file, line: ast.getLineAndCharacterOfPosition(call.getStart()).line + 1,
        kind: aliases.get(call.expression.text), disposition: name === 'purgeAll' ? 'operator internal' : 'guarded public',
        argsExpression: args.getText(ast), originalDisposition: originalEndpoint?.disposition,
        authority: name === 'purgeAll' ? 'trusted internal deployment operator; retained metadata/source/auth fences' : 'exact verified issuer/subject; independent current capability/resource/owner/fences; retained refs and canonical witnesses',
        scope: 'trusted tenant and actual optional/concrete memory space; owner predicates precede ordinary selection/hydration/limit',
        collisionException: aliases.get(call.expression.text) === 'mutation' ? 'Exact authorized key Boolean-only existence/uniqueness fence; Convex necessarily hydrates server documents then immediately discards them, never processed/authorized/logged/delivered' : undefined,
        pendingSeam: endpointPath === 'contexts:getByConversation' ? 'fails closed without reading conversations until Task03T/05 trusted canonical owner/anchor adapter' : undefined,
      });
    }
  }
  for (const registration of registrations) unresolved.push(`${file}:${ast.getLineAndCharacterOfPosition(registration.getStart()).line + 1}`);
}
endpoints.sort((a, b) => a.path.localeCompare(b.path));
if (JSON.stringify(endpoints.map((endpoint) => endpoint.path).sort()) !== JSON.stringify(expected)) throw new Error('Selected paths differ from frozen Task03A inventory');
if (unresolved.length || calls !== 48 || endpoints.length !== 46) throw new Error(JSON.stringify({ calls, selected: endpoints.length, unresolved }));
const dependencies = ['convex-dev/agents.ts', 'convex-dev/memorySpaces.ts', 'convex-dev/contexts.ts', 'convex-dev/runtimeRegistryAuth.ts', 'convex-dev/schema.ts', 'convex-dev/runtimeAuth.ts', 'convex-dev/runtimeAuthSchema.ts', 'src/auth/verified.ts', 'convex-dev/tsconfig.json'];
const hashes = dependencies.map((file) => ({ file, sha256: crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex') }));
const catalog = { version: 1, counts: { selected: 46, public: 43, internal: 3, moduleRegistrations: 48, excludedStats: 2, unresolved: 0 },
  selection: 'exact frozen Task03A paths: agents10 + memorySpaces14 + contexts22, excluding cross-data stats2 and A2A4',
  pending: ['stats2', 'A2A4', 'whole03B2B52', 'MF/source bridge', 'Task03T/05 canonical conversation/anchor delivery', 'Task08/12/15 durable derived cascade', 'wholeTask03', 'wholeGoal'], hashes, endpoints };
fs.mkdirSync(destination, { recursive: true });
fs.writeFileSync(path.join(destination, 'selected-path-inventory.json'), JSON.stringify(catalog, null, 2) + '\n');
fs.writeFileSync(path.join(destination, 'selected-path-inventory.md'), '# Bounded Task03B2B1 path closure inventory\n\n46 selected native registrations:43 guarded public +3 trusted operator internal purges. Stats2 and A2A4 remain pending.\n\n| Path | Kind | Closure |\n|---|---|---|\n' + endpoints.map((endpoint) => `| \`${endpoint.path}\` | ${endpoint.kind} | ${endpoint.disposition} |`).join('\n') + '\n');
process.stdout.write(JSON.stringify(catalog.counts) + '\n');
