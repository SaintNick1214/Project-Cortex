/** Build the installable backend source closure; never reads deployment credentials. */
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const hash = (value) => crypto.createHash("sha256").update(value).digest("hex");
const parse = (name, text) => ts.createSourceFile(name, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);

/** Build in memory before publishing, so an ambiguous module mapping preserves the last bundle. */
export async function buildBackendDistribution({ sourceRoot, outputRoot }) {
  const root = path.resolve(sourceRoot);
  const output = path.resolve(outputRoot);
  const entries = new Map();
  const sources = new Map();
  const origins = new Map();
  const sharedPrefixes = new Map();
  function destination(source) {
    if (!source.startsWith("src/")) {
      const name = source === "convex-dev/schema.ts" ? "_cortex/schema.ts" : source.slice("convex-dev/".length);
      if (!name.split("/").every(piece => /^[A-Za-z0-9_.]+$/.test(piece))) throw new Error(`Invalid public Convex module path: ${source}`);
      return name;
    }
    const pieces = source.slice(4).split("/");
    const normalized = pieces.map(piece => piece.replace(/[^A-Za-z0-9_.]/g, "_"));
    // Check directories too: two distinct source directories must not silently merge.
    for (let i = 1; i <= pieces.length; i++) {
      const name = `_cortex/shared/${normalized.slice(0, i).join("/")}`;
      const original = `src/${pieces.slice(0, i).join("/")}`;
      const previous = sharedPrefixes.get(name);
      if (previous && previous !== original) throw new Error(`Backend module normalization collision: ${previous} and ${original} map to ${name}`);
      sharedPrefixes.set(name, original);
    }
    return `_cortex/shared/${normalized.join("/")}`;
  }
  function relativeModuleLiterals(ast) {
    const literals = [];
    function visit(node) {
      if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) literals.push(node.moduleSpecifier);
      else if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument) && ts.isStringLiteral(node.argument.literal)) literals.push(node.argument.literal);
      else if (ts.isCallExpression(node) && (node.expression.kind === ts.SyntaxKind.ImportKeyword || (ts.isIdentifier(node.expression) && node.expression.text === "require")) && node.arguments.length === 1 && ts.isStringLiteral(node.arguments[0])) literals.push(node.arguments[0]);
      else if (ts.isExternalModuleReference(node) && node.expression && ts.isStringLiteral(node.expression)) literals.push(node.expression);
      ts.forEachChild(node, visit);
    }
    visit(ast);
    return literals.filter(node => node.text.startsWith("."));
  }
  async function resolveLocal(from, name) {
    const base = path.resolve(root, path.dirname(from), name.replace(/\.js$/, ""));
    for (const candidate of [base + ".ts", path.join(base, "index.ts")]) {
      try { if ((await fs.stat(candidate)).isFile()) return path.relative(root, candidate).split(path.sep).join("/"); } catch { /* Try the next source suffix. */ }
    }
    throw new Error(`Unresolved backend source import: ${from}: ${name}`);
  }
  async function collect(source) {
    if (sources.has(source)) return;
    const name = destination(source);
    const previous = origins.get(name);
    if (previous && previous !== source) throw new Error(`Backend module destination collision: ${previous} and ${source} map to ${name}`);
    origins.set(name, source);
    const text = await fs.readFile(path.join(root, source), "utf8");
    sources.set(source, text);
    const ast = parse(source, text);
    const replacements = [];
    for (const node of relativeModuleLiterals(ast)) {
      const specifier = node.text;
      // Host bindings are produced by ordinary Convex codegen after additive
      // installation. Nested entry points still bind to the host root, never a
      // packaged/generated snapshot or a second _generated namespace.
      const binding = path.posix.normalize(path.posix.join(path.posix.dirname(source), specifier));
      if (binding.startsWith("convex-dev/_generated/")) {
        let rewritten = path.posix.relative(path.posix.dirname(name), binding.slice("convex-dev/".length));
        if (!rewritten.startsWith(".")) rewritten = "./" + rewritten;
        replacements.push({start: node.getStart(ast), end: node.end, text: JSON.stringify(rewritten)});
        continue;
      }
      const target = await resolveLocal(source, specifier);
      if (!target.startsWith("src/") && !target.startsWith("convex-dev/")) throw new Error(`Backend import outside its source closure: ${target}`);
      await collect(target);
      let rewritten = path.posix.relative(path.posix.dirname(name), target === "convex-dev/schema.ts" && source !== target ? "schema.ts" : destination(target)).replace(/\.ts$/, "");
      if (!rewritten.startsWith(".")) rewritten = "./" + rewritten;
      replacements.push({ start: node.getStart(ast), end: node.end, text: JSON.stringify(rewritten) });
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
    entries.set(name, result);
  }
  async function entrySources(directory) {
    const names = [];
    for (const item of await fs.readdir(path.join(root, directory), {withFileTypes: true})) {
      const source = path.posix.join(directory, item.name);
      // Libraries enter only through the reachable import closure. In particular,
      // an obsolete domain snapshot is not a second runtime contract by presence.
      if (item.isDirectory() && !["_generated", "lib"].includes(item.name)) names.push(...await entrySources(source));
      else if (item.isFile() && item.name.endsWith(".ts") && !item.name.endsWith(".d.ts") && !["convex.config.ts", "auth.config.ts", "http.ts"].includes(item.name)) names.push(source);
    }
    return names;
  }
  for (const source of (await entrySources("convex-dev")).sort()) await collect(source);
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
  // Configuration metadata must not be analyzed as an ordinary Convex function module.
  // The official CLI excludes multi-dot .config.ts files from those entry points.
  entries.set("_cortex/components.config.ts", `import type { AppDefinition } from "convex/server";\n${imports.join("\n")}\nexport function registerCortexComponentsV1(app: AppDefinition): void {\n${registrations.join("\n")}\n}\n`);
  origins.set("_cortex/components.config.ts", "convex-dev/convex.config.ts");
  sources.set("convex-dev/convex.config.ts", componentSource);
  // HTTP routes are a digest-bound additive fragment; never replace a host router.
  const httpRoutes = [];
  let httpSource;
  try { httpSource = await fs.readFile(path.join(root, "convex-dev/http.ts"), "utf8"); } catch (error) { if (error.code !== "ENOENT") throw error; }
  if (httpSource !== undefined) {
    const httpAst = parse("convex-dev/http.ts", httpSource);
    const imported = httpAst.statements.filter(ts.isImportDeclaration).filter(node => ["./runtimeAssetsHttp", "./runtimeMediaHttp"].includes(node.moduleSpecifier.text));
    if (imported.length !== 2 || new Set(imported.map(node => node.moduleSpecifier.text)).size !== 2) throw new Error("Asset/media HTTP routes require both fixed handler modules");
    const handlers = new Map();
    for (const node of imported) {
      if (!node.importClause?.namedBindings || !ts.isNamedImports(node.importClause.namedBindings) || node.importClause.name) throw new Error("Private HTTP requires direct named handlers");
      for (const binding of node.importClause.namedBindings.elements) {
        if (handlers.has(binding.name.text)) throw new Error("Duplicate private HTTP handler");
        handlers.set(binding.name.text, { module: node.moduleSpecifier.text, exported: binding.propertyName?.text ?? binding.name.text });
      }
    }
    const expectedHandlers = new Map([
      ["POST /cortex/assets/upload", ["./runtimeAssetsHttp", "uploadAsset"]],
      ["GET /cortex/assets/download", ["./runtimeAssetsHttp", "downloadAsset"]],
      ["OPTIONS /cortex/assets/upload", ["./runtimeAssetsHttp", "assetOptions"]],
      ["OPTIONS /cortex/assets/download", ["./runtimeAssetsHttp", "assetOptions"]],
      ["POST /cortex/media/video/webhook", ["./runtimeMediaHttp", "videoWebhook"]],
    ]);
    const routes = httpAst.statements.filter(ts.isExpressionStatement).filter(node => ts.isCallExpression(node.expression) && node.expression.expression.getText(httpAst) === "http.route");
    if (routes.length !== 5) throw new Error("Expected five explicit private asset/media HTTP routes");
    for (const route of routes) {
      const call = route.expression;
      if (call.arguments.length !== 1 || !ts.isObjectLiteralExpression(call.arguments[0])) throw new Error("Invalid HTTP route declaration");
      const fields = new Map(call.arguments[0].properties.map(node => [node.name?.getText(httpAst), node.initializer]));
      const routePath = fields.get("path"); const method = fields.get("method"); const handler = fields.get("handler");
      if (fields.size !== 3 || !routePath || !method || !handler || !ts.isStringLiteral(routePath) || !ts.isStringLiteral(method) || !ts.isIdentifier(handler)) throw new Error("Invalid asset HTTP route fields");
      const key = `${method.text} ${routePath.text}`;
      if (httpRoutes.includes(key)) throw new Error("Duplicate asset HTTP route");
      const expectedHandler = expectedHandlers.get(key); const actualHandler = handlers.get(handler.text);
      if (expectedHandler && (!actualHandler || actualHandler.module !== expectedHandler[0] || actualHandler.exported !== expectedHandler[1])) throw new Error("Private HTTP handler does not match route");
      httpRoutes.push(key);
    }
    const expected = ["POST /cortex/assets/upload", "GET /cortex/assets/download", "OPTIONS /cortex/assets/upload", "OPTIONS /cortex/assets/download", "POST /cortex/media/video/webhook"];
    if (expected.some(key => !httpRoutes.includes(key))) throw new Error("Unsupported asset HTTP route");
    const helper = `import type { HttpRouter } from "convex/server";\n${imported.map(node => node.getText(httpAst).replace('"./runtimeAssetsHttp"', '"../runtimeAssetsHttp"').replace('"./runtimeMediaHttp"', '"../runtimeMediaHttp"')).join("\n")}\nexport function registerCortexHttpRoutesV1(http: HttpRouter): void {\n${routes.map(node => node.getText(httpAst)).join("\n")}\n}\n`;
    entries.set("_cortex/http.ts", helper); origins.set("_cortex/http.ts", "convex-dev/http.ts"); sources.set("convex-dev/http.ts", httpSource);
  }
  const pkg = JSON.parse(await fs.readFile(path.join(root, "package.json"), "utf8"));
  const manifest = { formatVersion: 1, distributionId: `cortex-backend-v1-sdk-${pkg.version}`, sdkVersion: pkg.version, tables: [...tableNames].sort(), components: componentNames, httpRoutes: httpRoutes.sort(), dependencies: { convex: pkg.peerDependencies.convex, ...pkg.dependencies }, files: [...entries].sort(([a], [b]) => a.localeCompare(b)).map(([name, text]) => ({ path: name, sha256: hash(text), sourcePath: origins.get(name), sourceSha256: hash(sources.get(origins.get(name))) })) };
  await fs.rm(output, { recursive: true, force: true });
  for (const [name, text] of entries) { await fs.mkdir(path.dirname(path.join(output, name)), { recursive: true }); await fs.writeFile(path.join(output, name), text); }
  await fs.writeFile(path.join(output, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
  return manifest;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
  const manifest = await buildBackendDistribution({ sourceRoot: root, outputRoot: path.join(root, "dist/backend/v1") });
  console.log(`Built ${manifest.distributionId}: ${manifest.files.length} source files, ${manifest.tables.length} tables, ${manifest.components.length} components; no deployment.`);
}
