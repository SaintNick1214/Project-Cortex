/** Versioned, per-file backend installation. Host objects are composed, never replaced. */
import fs from "fs-extra";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";
import ts from "typescript";

export interface BackendDistributionManifest {
  formatVersion: 1;
  distributionId: string;
  sdkVersion: string;
  tables: string[];
  components: string[];
  httpRoutes: string[];
  dependencies: Record<string, string>;
  files: { path: string; sha256: string }[];
}
export interface TrustedJwtProvider {
  type: "customJwt";
  issuer: string;
  jwks: string;
  algorithm: "RS256" | "ES256";
  applicationID: string;
}
export interface BackendInstallationOptions { trustedJwtProvider?: TrustedJwtProvider; prospectiveFiles?: ReadonlyMap<string, Buffer | null>; distributionFiles?: ReadonlyMap<string, Buffer> }
export interface BackendFileChange { path: string; beforeSha256: string | null; content: string; reason: string }
export interface BackendInstallationPlan {
  version: 1;
  distributionId: string;
  projectPath: string;
  functionsDirectory: string;
  changes: BackendFileChange[];
  unchanged: string[];
  conflicts: { path: string; reason: string; proposedContent?: string; currentContent?: string }[];
  requiredDependencies: Record<string, string>;
  observedFiles?: Record<string, string | null>;
  capabilities: { authConfigured: boolean; bootstrap: "trusted-operator-required"; execution: "task07-required" };
}
const digest = (text: string | Buffer) => createHash("sha256").update(text).digest("hex");
const parse = (name: string, text: string) => ts.createSourceFile(name, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
const safeRelative = (value: string): boolean => Boolean(value) && !path.isAbsolute(value) && !value.split(/[\\/]/).some((piece) => !piece || piece === "." || piece === "..");
// Convex 1.46's functions-root defaults, compatible with TypeScript 6.
// Existing host configs remain owned by the host, including comments and formatting.
const defaultFunctionsTsconfig = JSON.stringify({
  compilerOptions: {
    allowJs: true,
    strict: true,
    moduleResolution: "Bundler",
    jsx: "react-jsx",
    skipLibCheck: true,
    allowSyntheticDefaultImports: true,
    target: "ESNext",
    lib: ["ES2023", "dom"],
    forceConsistentCasingInFileNames: true,
    module: "ESNext",
    isolatedModules: true,
    noEmit: true,
  },
  include: ["./**/*"],
  exclude: ["./_generated"],
}, null, 2) + "\n";
async function readOptional(file: string): Promise<string | null> {
  try { return await fs.readFile(file, "utf8"); } catch (error) { if ((error as { code?: string }).code === "ENOENT") return null; throw error; }
}
async function rejectSymlinks(root: string, relative: string): Promise<void> {
  let current = root;
  for (const piece of relative.split(path.sep)) {
    current = path.join(current, piece);
    try { if ((await fs.lstat(current)).isSymbolicLink()) throw new Error(`Cortex installation refuses a symbolic-link destination: ${relative}`); }
    catch (error) { if ((error as { code?: string }).code !== "ENOENT") throw error; }
  }
}
function bindingAvailable(ast: ts.SourceFile, name: string): boolean {
  let found = false;
  const visit = (node: ts.Node) => { if (ts.isIdentifier(node) && node.text === name) found = true; ts.forEachChild(node, visit); };
  visit(ast); return !found;
}
function addSchema(text: string, tables: string[], appTables?: string[]): string {
  const ast = parse("schema.ts", text);
  const exported = ast.statements.filter(ts.isExportAssignment);
  if (exported.length !== 1 || !ts.isCallExpression(exported[0].expression) || exported[0].expression.expression.getText(ast) !== "defineSchema" || !ts.isObjectLiteralExpression(exported[0].expression.arguments[0])) throw new Error("Schema is not an explicit default defineSchema({...}); review the proposed Cortex table-map import and merge.");
  const object = exported[0].expression.arguments[0];
  const cortexImport = ast.statements.some((statement) => ts.isImportDeclaration(statement) && ts.isStringLiteral(statement.moduleSpecifier) && statement.moduleSpecifier.text === "./_cortex/schema" && statement.importClause?.namedBindings && ts.isNamedImports(statement.importClause.namedBindings) && statement.importClause.namedBindings.elements.some((element) => element.name.text === "cortexTablesV1"));
  let managed = false;
  for (const property of object.properties) {
    if (ts.isSpreadAssignment(property)) {
      if (cortexImport && property.expression.getText(ast) === "cortexTablesV1" && !managed) { managed = true; continue; }
      if (appTables && property.expression.getText(ast) === "appSchema.tables"
        && ast.statements.some(statement => ts.isImportDeclaration(statement) && ts.isStringLiteral(statement.moduleSpecifier) && statement.moduleSpecifier.text === "./app.schema" && statement.importClause?.name?.text === "appSchema")) {
        if (appTables.some(name => tables.includes(name))) throw new Error("Host app table conflicts with Cortex table");
        continue;
      }
      throw new Error("An unrecognized schema spread can conceal a Cortex table collision; review and merge the explicit table maps.");
    }
    if (!property.name || !(ts.isIdentifier(property.name) || ts.isStringLiteral(property.name))) throw new Error("Computed schema table names require a reviewed merge.");
    if (tables.includes(property.name.text)) throw new Error(`Host table ${property.name.text} conflicts with a Cortex table; existing installations cannot be reset or adopted.`);
  }
  if (managed) return text;
  if (!bindingAvailable(ast, "cortexTablesV1")) throw new Error("Host binding cortexTablesV1 conflicts with the additive schema import.");
  return 'import { cortexTablesV1 } from "./_cortex/schema";\n' + text.slice(0, object.getStart(ast) + 1) + "\n  ...cortexTablesV1," + text.slice(object.getStart(ast) + 1);
}
type ComponentRegistration = { name: string; module: string };
/** Convex1.46 discovers component edges between .config files, not through ordinary helpers. */
function componentRegistrations(text: string, names: string[]): ComponentRegistration[] {
  const ast = parse("components.config.ts", text);
  const imports = new Map<string, string>();
  for (const statement of ast.statements) {
    if (ts.isImportDeclaration(statement) && ts.isStringLiteral(statement.moduleSpecifier) && statement.importClause?.name) {
      imports.set(statement.importClause.name.text, statement.moduleSpecifier.text);
    }
  }
  const helper = ast.statements.find((statement): statement is ts.FunctionDeclaration =>
    ts.isFunctionDeclaration(statement) && statement.name?.text === "registerCortexComponentsV1");
  if (!helper?.body || helper.parameters.length !== 1 || !ts.isIdentifier(helper.parameters[0].name)) throw new Error("Backend component helper requires static named registrations.");
  const app = helper.parameters[0].name.text;
  const result: ComponentRegistration[] = [];
  for (const statement of helper.body.statements) {
    if (!ts.isExpressionStatement(statement) || !ts.isCallExpression(statement.expression)) throw new Error("Dynamic backend component registration requires a reviewed merge.");
    const call = statement.expression;
    if (!ts.isPropertyAccessExpression(call.expression) || call.expression.expression.getText(ast) !== app || call.expression.name.text !== "use"
      || call.arguments.length !== 2 || !ts.isIdentifier(call.arguments[0]) || !ts.isObjectLiteralExpression(call.arguments[1])) throw new Error("Backend component registration is not a static app.use().");
    const options = call.arguments[1].properties;
    if (options.length !== 1 || !ts.isPropertyAssignment(options[0]) || options[0].name.getText(ast) !== "name" || !ts.isStringLiteral(options[0].initializer)) throw new Error("Backend components require explicit names and supported static options.");
    const name = options[0].initializer.text;
    const module = imports.get(call.arguments[0].text);
    if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(name) || !module || !/\/convex\.config(?:\.[cm]?[jt]s)?$/.test(module)) throw new Error("Backend component lacks a direct static configuration import.");
    result.push({ name, module });
  }
  if (new Set(names).size !== names.length || result.length !== names.length || result.some(entry => !names.includes(entry.name))
    || new Set(result.map(entry => entry.name)).size !== result.length) throw new Error("Backend component registrations differ from the versioned manifest.");
  return result;
}
const componentBinding = (name: string) => `_cortex_component_${name}`;
function addComponents(text: string, components: ComponentRegistration[]): string {
  const ast = parse("convex.config.ts", text);
  const exported = ast.statements.filter(ts.isExportAssignment);
  if (exported.length !== 1 || !ts.isIdentifier(exported[0].expression)) throw new Error("Component configuration must export a named defineApp() instance; review the proposed registration helper.");
  const app = exported[0].expression.text;
  const declaration = ast.statements.filter(ts.isVariableStatement).flatMap((statement) => [...statement.declarationList.declarations]).find((entry) => ts.isIdentifier(entry.name) && entry.name.text === app);
  if (!declaration?.initializer || !ts.isCallExpression(declaration.initializer) || declaration.initializer.expression.getText(ast) !== "defineApp") throw new Error("Cannot identify the host defineApp() instance safely; review the registration helper.");
  const imports = new Map<string, string>();
  for (const statement of ast.statements) if (ts.isImportDeclaration(statement) && ts.isStringLiteral(statement.moduleSpecifier) && statement.importClause?.name) imports.set(statement.importClause.name.text, statement.moduleSpecifier.text);
  const managed = new Set<string>();
  const visit = (node: ts.Node) => {
    if (ts.isCallExpression(node) && node.expression.getText(ast) === "registerCortexComponentsV1") {
      throw new Error("Indirect Cortex component registration requires a reviewed merge to direct root component imports.");
    }
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) && node.expression.expression.getText(ast) === app && node.expression.name.text === "use") {
      const options = node.arguments[1];
      if (!options || !ts.isObjectLiteralExpression(options)) throw new Error("Host component has an implicit or dynamic name; review names before Cortex registration.");
      const name = options.properties.find((entry) => ts.isPropertyAssignment(entry) && entry.name.getText(ast) === "name");
      if (!name || !ts.isPropertyAssignment(name) || !ts.isStringLiteral(name.initializer)) throw new Error("Host component has a dynamic name; review names before Cortex registration.");
      const componentName = name.initializer.text;
      const component = components.find(entry => entry.name === componentName);
      if (component) {
        if (node.arguments.length !== 2 || !ts.isIdentifier(node.arguments[0]) || node.arguments[0].text !== componentBinding(component.name)
          || options.properties.length !== 1 || imports.get(node.arguments[0].text) !== component.module || managed.has(component.name)) throw new Error(`Host component ${component.name} conflicts with Cortex registration.`);
        if (!ts.isExpressionStatement(node.parent) || node.parent.parent !== ast) throw new Error("Cortex component registration must remain at the root configuration's top level.");
        managed.add(component.name);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(ast);
  const missing = components.filter(component => !managed.has(component.name));
  if (!missing.length) return text;
  for (const component of missing) if (!bindingAvailable(ast, componentBinding(component.name))) throw new Error(`Host binding ${componentBinding(component.name)} conflicts with Cortex registration.`);
  const addedImports = missing.map(component => `import ${componentBinding(component.name)} from ${JSON.stringify(component.module)};\n`).join("");
  const registrations = missing.map(component => `${app}.use(${componentBinding(component.name)}, { name: ${JSON.stringify(component.name)} });\n`).join("");
  return addedImports + text.slice(0, exported[0].getStart(ast)) + registrations + text.slice(exported[0].getStart(ast));
}
type HttpRoute = { method: string; path: string; prefix: boolean };
const httpHelper = "registerCortexHttpRoutesV1";
const httpMethods = new Set(["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"]);
function httpRoute(call: ts.CallExpression): HttpRoute {
  if (call.arguments.length !== 1 || !ts.isObjectLiteralExpression(call.arguments[0])) throw new Error("HTTP routes require explicit static method/path declarations; review the merge.");
  const fields = new Map<string, ts.Expression>();
  for (const field of call.arguments[0].properties) {
    if (!ts.isPropertyAssignment(field) || !(ts.isIdentifier(field.name) || ts.isStringLiteral(field.name)) || fields.has(field.name.text)) throw new Error("Dynamic or duplicate HTTP route fields require a reviewed merge.");
    fields.set(field.name.text, field.initializer);
  }
  const method = fields.get("method"), exact = fields.get("path"), prefix = fields.get("pathPrefix"), routePath = exact ?? prefix;
  if (fields.size !== 3 || !fields.has("handler") || Boolean(exact) === Boolean(prefix) || !method || !ts.isStringLiteral(method) || !httpMethods.has(method.text)
    || !routePath || !ts.isStringLiteral(routePath) || !routePath.text.startsWith("/") || (prefix && !routePath.text.endsWith("/"))) throw new Error("HTTP routes require supported literal method/path/handler fields; review the merge.");
  return { method: method.text, path: routePath.text, prefix: Boolean(prefix) };
}
function overlappingHttpRoute(left: HttpRoute, right: HttpRoute): boolean {
  return left.method === right.method && (left.path === right.path || (left.prefix && right.path.startsWith(left.path)) || (right.prefix && left.path.startsWith(right.path)));
}
/** The exact routes come from the digest-checked helper, never a caller-selected handler. */
function httpRegistrations(text: string, names: string[]): HttpRoute[] {
  if (names.some(name => typeof name !== "string" || !/^(GET|POST|PUT|DELETE|OPTIONS|PATCH) \/[^\s?#]*$/.test(name)) || new Set(names).size !== names.length) throw new Error("Backend HTTP manifest requires unique exact METHOD /path entries.");
  const ast = parse("_cortex/http.ts", text);
  const handlers = new Set<string>();
  const mediaHandlers = new Set<string>();
  for (const statement of ast.statements) {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier) || statement.importClause?.isTypeOnly) continue;
    const bindings = statement.importClause?.namedBindings;
    if (/^\.\.\/runtimeAssetsHttp(?:\.js)?$/.test(statement.moduleSpecifier.text)) {
      if (bindings && ts.isNamedImports(bindings)) for (const binding of bindings.elements) if (!binding.isTypeOnly) handlers.add(binding.name.text);
    } else if (/^\.\.\/runtimeMediaHttp(?:\.js)?$/.test(statement.moduleSpecifier.text)) {
      if (statement.importClause?.name || !bindings || !ts.isNamedImports(bindings)) throw new Error("Backend media HTTP requires the direct named runtimeMediaHttp.videoWebhook import.");
      for (const binding of bindings.elements) {
        if (binding.isTypeOnly) continue;
        if ((binding.propertyName ?? binding.name).text !== "videoWebhook" || mediaHandlers.has(binding.name.text)) throw new Error("Backend media HTTP requires only the fixed videoWebhook export.");
        mediaHandlers.add(binding.name.text);
      }
    }
  }
  if ([...mediaHandlers].some(name => handlers.has(name))) throw new Error("Backend HTTP handler bindings must not overlap asset and media modules.");
  const helpers = ast.statements.filter((statement): statement is ts.FunctionDeclaration => ts.isFunctionDeclaration(statement) && statement.name?.text === httpHelper);
  const helper = helpers[0];
  if (helpers.length !== 1 || !helper?.body || !helper.modifiers?.some(modifier => modifier.kind === ts.SyntaxKind.ExportKeyword)
    || helper.parameters.length !== 1 || !ts.isIdentifier(helper.parameters[0].name)) throw new Error("Backend HTTP helper requires one exported static router registration.");
  const router = helper.parameters[0].name.text, result: HttpRoute[] = [];
  for (const statement of helper.body.statements) {
    if (!ts.isExpressionStatement(statement) || !ts.isCallExpression(statement.expression)) throw new Error("Dynamic backend HTTP registration requires a reviewed merge.");
    const call = statement.expression;
    if (!ts.isPropertyAccessExpression(call.expression) || !ts.isIdentifier(call.expression.expression) || call.expression.expression.text !== router || call.expression.name.text !== "route") throw new Error("Backend HTTP registration must be a static router.route().");
    const route = httpRoute(call);
    const handler = (call.arguments[0] as ts.ObjectLiteralExpression).properties.find(field => ts.isPropertyAssignment(field) && (ts.isIdentifier(field.name) || ts.isStringLiteral(field.name)) && field.name.text === "handler");
    if (!handler || !ts.isPropertyAssignment(handler) || !ts.isIdentifier(handler.initializer)
      || (!handlers.has(handler.initializer.text) && !mediaHandlers.has(handler.initializer.text))) throw new Error("Backend HTTP handlers must be direct static runtimeAssetsHttp imports or the fixed runtimeMediaHttp.videoWebhook import.");
    const mediaHandler = mediaHandlers.has(handler.initializer.text), mediaRoute = route.method === "POST" && route.path === "/cortex/media/video/webhook" && !route.prefix;
    if (mediaHandler !== mediaRoute) throw new Error("runtimeMediaHttp.videoWebhook must register only the exact POST /cortex/media/video/webhook route.");
    if (route.prefix || result.some(prior => overlappingHttpRoute(prior, route))) throw new Error("Backend HTTP helper requires unique exact routes.");
    result.push(route);
  }
  if (result.length !== names.length || result.some(route => !names.includes(`${route.method} ${route.path}`))) throw new Error("Backend HTTP registrations differ from the versioned manifest.");
  return result;
}
function addHttpRoutes(text: string, routes: HttpRoute[]): string {
  const ast = parse("http.ts", text), exported = ast.statements.filter(ts.isExportAssignment);
  if (exported.length !== 1 || exported[0].isExportEquals || !ts.isIdentifier(exported[0].expression)) throw new Error("HTTP configuration must default-export a named httpRouter() instance; review the proposed merge.");
  const router = exported[0].expression.text;
  const factories = new Set<string>();
  let managedImport = false;
  for (const statement of ast.statements) {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier) || statement.importClause?.isTypeOnly) continue;
    const bindings = statement.importClause?.namedBindings;
    if (!bindings || !ts.isNamedImports(bindings)) continue;
    for (const binding of bindings.elements) {
      if (binding.isTypeOnly) continue;
      if (statement.moduleSpecifier.text === "convex/server" && (binding.propertyName ?? binding.name).text === "httpRouter") factories.add(binding.name.text);
      if (binding.name.text === httpHelper && (binding.propertyName ?? binding.name).text === httpHelper && statement.moduleSpecifier.text === "./_cortex/http") managedImport = true;
    }
  }
  const declarations = ast.statements.filter(ts.isVariableStatement).flatMap(statement => [...statement.declarationList.declarations]).filter(entry => ts.isIdentifier(entry.name) && entry.name.text === router);
  const declaration = declarations[0];
  if (declarations.length !== 1 || !declaration?.initializer || !ts.isCallExpression(declaration.initializer) || declaration.initializer.arguments.length !== 0
    || !ts.isIdentifier(declaration.initializer.expression) || !factories.has(declaration.initializer.expression.text)
    || !(declaration.parent.flags & ts.NodeFlags.Const)) throw new Error("Cannot identify the host's immutable official httpRouter() instance; review the merge.");
  const allowed = new Set<ts.Node>([declaration.name, exported[0].expression]);
  let managedCalls = 0;
  const visit = (node: ts.Node) => {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === httpHelper) {
      if (!managedImport || node.arguments.length !== 1 || !ts.isIdentifier(node.arguments[0]) || node.arguments[0].text !== router
        || !ts.isExpressionStatement(node.parent) || node.parent.parent !== ast || ++managedCalls !== 1) throw new Error("Cortex HTTP registration must be one direct top-level call on the exported router.");
      allowed.add(node.arguments[0]);
    }
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) && ts.isIdentifier(node.expression.expression) && node.expression.expression.text === router && node.expression.name.text === "route") {
      if (!ts.isExpressionStatement(node.parent) || node.parent.parent !== ast) throw new Error("Nested HTTP route registration requires a reviewed merge.");
      allowed.add(node.expression.expression);
      const route = httpRoute(node);
      if (routes.some(cortex => overlappingHttpRoute(route, cortex))) throw new Error(`Host HTTP route ${route.method} ${route.path}${route.prefix ? "*" : ""} conflicts with Cortex registration.`);
    }
    ts.forEachChild(node, visit);
  };
  visit(ast);
  const checkUses = (node: ts.Node) => {
    if (ts.isIdentifier(node) && node.text === router && !allowed.has(node)) throw new Error("Aliased or dynamic host HTTP router use requires a reviewed merge.");
    ts.forEachChild(node, checkUses);
  };
  checkUses(ast);
  if (managedCalls) return text;
  if (!managedImport && !bindingAvailable(ast, httpHelper)) throw new Error("Host binding registerCortexHttpRoutesV1 conflicts with the additive HTTP import.");
  return (managedImport ? "" : `import { ${httpHelper} } from "./_cortex/http";\n`) + text.slice(0, exported[0].getStart(ast)) + `${httpHelper}(${router});\n` + text.slice(exported[0].getStart(ast));
}
function validateProvider(provider: TrustedJwtProvider): void {
  if (provider.type !== "customJwt" || !["RS256", "ES256"].includes(provider.algorithm) || !provider.issuer || !provider.jwks) throw new Error("Explicit issuer, JWKS and asymmetric algorithm are required for trusted JWT integration.");
  const issuer = new URL(provider.issuer);
  if (issuer.protocol !== "https:" || issuer.username || issuer.password || issuer.hash) throw new Error("Trusted JWT issuer must use HTTPS without credentials or fragments.");
  if (provider.jwks.startsWith("data:")) {
    const encoded = /^data:(?:application\/json|text\/plain)(?:;charset=utf-8)?;base64,([A-Za-z0-9+/]+={0,2})$/.exec(provider.jwks);
    if (!encoded) throw new Error("Inline JWKS must be a base64 JSON public-key data URI.");
    let keySet: { keys?: Record<string, unknown>[] };
    try { keySet = JSON.parse(Buffer.from(encoded[1], "base64").toString("utf8")); }
    catch { throw new Error("Inline JWKS must contain a valid JSON public-key set."); }
    if (!keySet || !Array.isArray(keySet.keys) || !keySet.keys.length) throw new Error("Inline JWKS must contain public signing keys.");
    const ids = new Set<string>();
    for (const key of keySet.keys) {
      if (!key || typeof key.kid !== "string" || !key.kid || ids.has(key.kid) ||
        (provider.algorithm === "RS256" ? key.kty !== "RSA" || typeof key.n !== "string" || !key.n || typeof key.e !== "string" || !key.e : key.kty !== "EC" || key.crv !== "P-256" || typeof key.x !== "string" || !key.x || typeof key.y !== "string" || !key.y) ||
        (key.alg !== undefined && key.alg !== provider.algorithm) || ["d", "p", "q", "dp", "dq", "qi", "k", "oth"].some((field) => field in key)) throw new Error("Inline JWKS must contain unique public signing keys without private key material.");
      ids.add(key.kid);
    }
  } else {
    const jwks = new URL(provider.jwks);
    if (jwks.protocol !== "https:" || jwks.username || jwks.password || jwks.hash) throw new Error("Trusted JWKS must use HTTPS or an inline public-key data URI.");
  }
  if (!provider.applicationID) throw new Error("An explicit JWT application audience is required for Cortex provider integration.");
}
function addAuth(text: string, provider: TrustedJwtProvider): string {
  const ast = parse("auth.config.ts", text);
  const assignment = ast.statements.find(ts.isExportAssignment);
  let expression = assignment?.expression;
  if (expression && ts.isSatisfiesExpression(expression)) expression = expression.expression;
  if (!expression || !ts.isObjectLiteralExpression(expression)) throw new Error("Host auth configuration is dynamic; review the proposed trusted provider without replacing existing auth.");
  const providers = expression.properties.find((property) => ts.isPropertyAssignment(property) && property.name.getText(ast) === "providers");
  if (!providers || !ts.isPropertyAssignment(providers) || !ts.isArrayLiteralExpression(providers.initializer)) throw new Error("Host auth providers are not an explicit array; review the additive provider proposal.");
  const desired = JSON.stringify(provider);
  for (const entry of providers.initializer.elements) {
    if (!ts.isObjectLiteralExpression(entry)) throw new Error("A dynamic host auth provider may overlap the Cortex issuer; review the merge.");
    const values: Record<string, string> = {};
    for (const field of entry.properties) {
      if (!ts.isPropertyAssignment(field) || !ts.isStringLiteral(field.initializer)) throw new Error("Dynamic host auth-provider fields require a reviewed merge.");
      values[field.name.getText(ast).replace(/^["']|["']$/g, "")] = field.initializer.text;
    }
    if (values.issuer === provider.issuer || values.domain === provider.issuer) {
      if (JSON.stringify(Object.fromEntries(Object.entries(values).sort())) === JSON.stringify(Object.fromEntries(Object.entries(provider).sort()))) return text;
      throw new Error("The configured issuer already has different JWT verification settings; review the conflict.");
    }
  }
  const array = providers.initializer;
  return text.slice(0, array.getStart(ast) + 1) + `\n    ${desired},` + text.slice(array.getStart(ast) + 1);
}
export async function planAdditiveBackendInstallation(projectPath: string, sdkPath: string, options: BackendInstallationOptions = {}): Promise<BackendInstallationPlan> {
  const project = path.resolve(projectPath);
  const sdk = path.resolve(sdkPath);
  const distribution = path.join(sdk, "dist/backend/v1");
  const distributionFile = async (name: string): Promise<string> => {
    if (!safeRelative(name)) throw new Error("Unsafe backend distribution path.");
    if (options.distributionFiles) {
      const bytes = options.distributionFiles.get(name); if (!bytes) throw new Error(`Backend distribution missing: ${name}`);
      return bytes.toString("utf8");
    }
    await rejectSymlinks(distribution, name);
    return fs.readFile(path.join(distribution, name), "utf8");
  };
  const observedFiles: Record<string, string | null> = {};
  const readProject = async (relative: string): Promise<string | null> => {
    if (!safeRelative(relative)) throw new Error("Unsafe prospective project path.");
    await rejectSymlinks(project, relative);
    const content = options.prospectiveFiles?.has(relative) ? options.prospectiveFiles.get(relative)?.toString("utf8") ?? null : await readOptional(path.join(project, relative));
    observedFiles[relative] = content === null ? null : digest(content);
    return content;
  };
  const manifest: BackendDistributionManifest = JSON.parse(await distributionFile("manifest.json"));
  if (manifest.formatVersion !== 1 || !Array.isArray(manifest.files) || !Array.isArray(manifest.tables) || !Array.isArray(manifest.components) || !Array.isArray(manifest.httpRoutes) || !manifest.dependencies || !manifest.distributionId) throw new Error("Unsupported or incomplete Cortex backend distribution; rebuild/install the SDK package.");
  const configText = await readProject("convex.json");
  const config: Record<string, unknown> = configText === null ? {} : JSON.parse(configText);
  if (!config || Array.isArray(config) || typeof config !== "object" || (config.functions !== undefined && typeof config.functions !== "string")) throw new Error("Invalid host convex.json; repair it before additive installation.");
  const functions = (config.functions as string | undefined) ?? "convex/";
  const normalized = functions.replace(/[\\/]$/, "");
  if (!safeRelative(normalized)) throw new Error("Convex functions directory must stay inside the explicit host project.");
  await rejectSymlinks(project, normalized);
  const plan: BackendInstallationPlan = { version: 1, distributionId: manifest.distributionId, projectPath: project, functionsDirectory: functions, changes: [], unchanged: [], conflicts: [], observedFiles, requiredDependencies: { ...manifest.dependencies }, capabilities: { authConfigured: false, bootstrap: "trusted-operator-required", execution: "task07-required" } };
  async function proposed(relative: string, content: string, reason: string, merge?: (current: string) => string) {
    await rejectSymlinks(project, relative);
    const current = await readProject(relative);
    if (current !== null && merge) {
      try { content = merge(current); } catch (error) { plan.conflicts.push({ path: relative, reason: (error as Error).message, proposedContent: content, currentContent: current }); return; }
    } else if (current !== null && current !== content) { plan.conflicts.push({ path: relative, reason: "Existing file differs from the selected versioned Cortex source; review a merge instead of overwriting it.", proposedContent: content, currentContent: current }); return; }
    if (current === content) plan.unchanged.push(relative);
    else plan.changes.push({ path: relative, beforeSha256: current === null ? null : digest(current), content, reason });
  }
  const seen = new Set<string>();
  let componentSource = "";
  let httpSource = "";
  for (const entry of manifest.files) {
    if (!safeRelative(entry.path) || seen.has(entry.path) || !/^[a-f0-9]{64}$/.test(entry.sha256)) throw new Error("Unsafe or duplicate backend distribution path.");
    seen.add(entry.path);
    const content = await distributionFile(entry.path);
    if (digest(content) !== entry.sha256) throw new Error(`Backend distribution digest mismatch: ${entry.path}`);
    if (entry.path === "_cortex/components.config.ts") componentSource = content;
    if (entry.path === "_cortex/http.ts") httpSource = content;
    await proposed(path.join(normalized, entry.path), content, "versioned Cortex backend source");
  }
  if (!seen.has("_cortex/schema.ts") || !seen.has("_cortex/components.config.ts")) throw new Error("Backend distribution lacks additive schema/component helpers.");
  const registrations = componentRegistrations(componentSource, manifest.components);
  // A recognized private app schema is inspected as data, never imported/executed.
  const hostSchema = await readProject(path.join(normalized, "schema.ts"));
  let usesAppSchema = false;
  if (hostSchema !== null) {
    const ast = parse("schema.ts", hostSchema);
    const visit = (node: ts.Node) => { if (ts.isSpreadAssignment(node) && node.expression.getText(ast) === "appSchema.tables") usesAppSchema = true; ts.forEachChild(node, visit); };
    visit(ast);
  }
  const appSource = usesAppSchema ? await readProject(path.join(normalized, "app.schema.ts")) : null;
  if (usesAppSchema && appSource === null) throw new Error("Private app schema source is required for additive composition");
  let appTables: string[] | undefined;
  if (appSource !== null) {
    const ast = parse("app.schema.ts", appSource), exports = ast.statements.filter(ts.isExportAssignment);
    if (exports.length !== 1 || !ts.isCallExpression(exports[0].expression) || exports[0].expression.expression.getText(ast) !== "defineSchema" || !ts.isObjectLiteralExpression(exports[0].expression.arguments[0])) throw new Error("Private app schema needs an explicit table map for additive composition");
    appTables = exports[0].expression.arguments[0].properties.map(property => {
      if (!ts.isPropertyAssignment(property) || !(ts.isIdentifier(property.name) || ts.isStringLiteral(property.name))) throw new Error("Dynamic app schema tables require a reviewed merge");
      return property.name.text;
    });
    if (new Set(appTables).size !== appTables.length) throw new Error("Duplicate private app table");
  }

  await proposed(path.join(normalized, "schema.ts"), 'import { defineSchema } from "convex/server";\nimport { cortexTablesV1 } from "./_cortex/schema";\nexport default defineSchema({ ...cortexTablesV1 });\n', "add Cortex table map while preserving host tables and options", (current) => addSchema(current, manifest.tables, appTables));
  await proposed(path.join(normalized, "convex.config.ts"), addComponents('import { defineApp } from "convex/server";\nconst app = defineApp();\nexport default app;\n', registrations), "register qualified Cortex components with direct root imports alongside host components", (current) => addComponents(current, registrations));
  if (manifest.httpRoutes.length && !seen.has("_cortex/http.ts")) throw new Error("Backend distribution lacks the digest-bound HTTP helper.");
  if (seen.has("_cortex/http.ts")) {
    const routes = httpRegistrations(httpSource, manifest.httpRoutes);
    if (routes.some(route => route.method === "POST" && route.path === "/cortex/media/video/webhook") && !seen.has("runtimeMediaHttp.ts")) throw new Error("Backend media HTTP requires the digest-bound runtimeMediaHttp.ts source in the versioned manifest.");
    if (routes.length) {
      const fresh = 'import { httpRouter } from "convex/server";\nconst http = httpRouter();\nexport default http;\n';
      await proposed(path.join(normalized, "http.ts"), addHttpRoutes(fresh, routes), "register authenticated Cortex HTTP routes while preserving host routes", current => addHttpRoutes(current, routes));
    }
  }
  if (configText === null) await proposed("convex.json", JSON.stringify({ functions }, null, 2) + "\n", "initialize absent functions configuration");
  await proposed(path.join(normalized, "tsconfig.json"), defaultFunctionsTsconfig, "initialize absent Convex functions typecheck configuration", current => current);
  const authPath = path.join(normalized, "auth.config.ts");
  if (options.trustedJwtProvider) {
    validateProvider(options.trustedJwtProvider);
    await proposed(authPath, `import type { AuthConfig } from "convex/server";\nexport default { providers: [${JSON.stringify(options.trustedJwtProvider)}] } satisfies AuthConfig;\n`, "integrate explicitly selected verified JWT provider", (current) => addAuth(current, options.trustedJwtProvider!));
    plan.capabilities.authConfigured = !plan.conflicts.some((entry) => entry.path === authPath);
  } else plan.capabilities.authConfigured = (await readProject(path.join(normalized, "auth.config.ts"))) !== null;
  // An empty route manifest retains the historical no-HTTP installation behavior.
  return plan;
}
export class BackendMergeRequiredError extends Error {
  constructor(public readonly proposalPath: string, public readonly conflicts: BackendInstallationPlan["conflicts"]) {
    super(`Cortex additive installation requires a reviewed merge (${conflicts.length} conflicts). Proposal: ${proposalPath}`);
  }
}
export async function applyAdditiveBackendInstallation(plan: BackendInstallationPlan): Promise<{ installed: string[]; unchanged: string[]; capabilities: BackendInstallationPlan["capabilities"] }> {
  if (plan.version !== 1) throw new Error("Unsupported Cortex installation plan.");
  if (plan.conflicts.length) {
    const proposal = path.join(plan.projectPath, `cortex-backend-merge-proposal-${digest(JSON.stringify(plan)).slice(0, 12)}.json`);
    await fs.writeFile(proposal, JSON.stringify({ ...plan, changes: plan.changes.map((entry) => ({ ...entry, content: entry.content })) }, null, 2) + "\n", { flag: "wx" }).catch((error: { code?: string }) => { if (error.code !== "EEXIST") throw error; });
    throw new BackendMergeRequiredError(proposal, plan.conflicts);
  }
  for (const [relative, hash] of Object.entries(plan.observedFiles ?? {})) {
    if (!safeRelative(relative)) throw new Error("Unsafe observed installation path.");
    await rejectSymlinks(plan.projectPath, relative);
    const current = await readOptional(path.join(plan.projectPath, relative));
    if ((current === null ? null : digest(current)) !== hash) throw new Error(`Host file changed after installation planning: ${relative}; replan and review.`);
  }
  // Validate every preimage before the first write. A partial interrupted install is retried
  // by replanning: already-identical versioned files are retained, conflicting edits stop it.
  for (const change of plan.changes) {
    if (!safeRelative(change.path)) throw new Error("Unsafe installation change path.");
    await rejectSymlinks(plan.projectPath, change.path);
    const current = await readOptional(path.join(plan.projectPath, change.path));
    if ((current === null ? null : digest(current)) !== change.beforeSha256) throw new Error(`Host file changed after installation planning: ${change.path}; replan and review.`);
  }
  const installed = [];
  for (const change of plan.changes) {
    const file = path.join(plan.projectPath, change.path);
    await fs.ensureDir(path.dirname(file));
    await rejectSymlinks(plan.projectPath, change.path);
    const current = await readOptional(file);
    if ((current === null ? null : digest(current)) !== change.beforeSha256) throw new Error(`Host file changed during installation: ${change.path}; replan and review.`);
    if (change.beforeSha256 === null) await fs.writeFile(file, change.content, { flag: "wx" });
    else {
      // Keep the precise original for review/recovery, rather than moving the host tree.
      const backup = `${file}.cortex-v1-before-${change.beforeSha256}.txt`;
      await fs.writeFile(backup, current!, { flag: "wx" }).catch((error: { code?: string }) => { if (error.code !== "EEXIST") throw error; });
      const temporary = `${file}.cortex-v1-${randomUUID()}.tmp`;
      try {
        await fs.writeFile(temporary, change.content, { flag: "wx", mode: (await fs.stat(file)).mode });
        if (digest(await fs.readFile(file)) !== change.beforeSha256) throw new Error(`Host file changed before atomic installation: ${change.path}; replan and review.`);
        await fs.rename(temporary, file);
      } finally { await fs.remove(temporary); }
    }
    installed.push(change.path);
  }
  return { installed, unchanged: plan.unchanged, capabilities: plan.capabilities };
}
export async function installAdditiveBackend(projectPath: string, sdkPath: string, options: BackendInstallationOptions = {}) {
  return applyAdditiveBackendInstallation(await planAdditiveBackendInstallation(projectPath, sdkPath, options));
}
