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
export interface BackendInstallationOptions { trustedJwtProvider?: TrustedJwtProvider }
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
  capabilities: { authConfigured: boolean; bootstrap: "trusted-operator-required"; execution: "task07-required" };
}
const digest = (text: string | Buffer) => createHash("sha256").update(text).digest("hex");
const parse = (name: string, text: string) => ts.createSourceFile(name, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
const safeRelative = (value: string): boolean => Boolean(value) && !path.isAbsolute(value) && !value.split(/[\\/]/).some((piece) => !piece || piece === "." || piece === "..");
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
function addSchema(text: string, tables: string[]): string {
  const ast = parse("schema.ts", text);
  const exported = ast.statements.filter(ts.isExportAssignment);
  if (exported.length !== 1 || !ts.isCallExpression(exported[0].expression) || exported[0].expression.expression.getText(ast) !== "defineSchema" || !ts.isObjectLiteralExpression(exported[0].expression.arguments[0])) throw new Error("Schema is not an explicit default defineSchema({...}); review the proposed Cortex table-map import and merge.");
  const object = exported[0].expression.arguments[0];
  const cortexImport = ast.statements.some((statement) => ts.isImportDeclaration(statement) && ts.isStringLiteral(statement.moduleSpecifier) && statement.moduleSpecifier.text === "./_cortex/schema" && statement.importClause?.namedBindings && ts.isNamedImports(statement.importClause.namedBindings) && statement.importClause.namedBindings.elements.some((element) => element.name.text === "cortexTablesV1"));
  let managed = false;
  for (const property of object.properties) {
    if (ts.isSpreadAssignment(property)) {
      if (cortexImport && property.expression.getText(ast) === "cortexTablesV1" && !managed) { managed = true; continue; }
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
  await fs.ensureDir(project);
  const sdk = path.resolve(sdkPath);
  const distribution = path.join(sdk, "dist/backend/v1");
  const manifest: BackendDistributionManifest = await fs.readJson(path.join(distribution, "manifest.json"));
  if (manifest.formatVersion !== 1 || !Array.isArray(manifest.files) || !Array.isArray(manifest.tables) || !Array.isArray(manifest.components) || !manifest.dependencies || !manifest.distributionId) throw new Error("Unsupported or incomplete Cortex backend distribution; rebuild/install the SDK package.");
  const configText = await readOptional(path.join(project, "convex.json"));
  const config: Record<string, unknown> = configText === null ? {} : JSON.parse(configText);
  if (!config || Array.isArray(config) || typeof config !== "object" || (config.functions !== undefined && typeof config.functions !== "string")) throw new Error("Invalid host convex.json; repair it before additive installation.");
  const functions = (config.functions as string | undefined) ?? "convex/";
  const normalized = functions.replace(/[\\/]$/, "");
  if (!safeRelative(normalized)) throw new Error("Convex functions directory must stay inside the explicit host project.");
  await rejectSymlinks(project, normalized);
  const target = path.join(project, normalized);
  const plan: BackendInstallationPlan = { version: 1, distributionId: manifest.distributionId, projectPath: project, functionsDirectory: functions, changes: [], unchanged: [], conflicts: [], requiredDependencies: { ...manifest.dependencies }, capabilities: { authConfigured: false, bootstrap: "trusted-operator-required", execution: "task07-required" } };
  async function proposed(relative: string, content: string, reason: string, merge?: (current: string) => string) {
    await rejectSymlinks(project, relative);
    const current = await readOptional(path.join(project, relative));
    if (current !== null && merge) {
      try { content = merge(current); } catch (error) { plan.conflicts.push({ path: relative, reason: (error as Error).message, proposedContent: content, currentContent: current }); return; }
    } else if (current !== null && current !== content) { plan.conflicts.push({ path: relative, reason: "Existing file differs from the selected versioned Cortex source; review a merge instead of overwriting it.", proposedContent: content, currentContent: current }); return; }
    if (current === content) plan.unchanged.push(relative);
    else plan.changes.push({ path: relative, beforeSha256: current === null ? null : digest(current), content, reason });
  }
  const seen = new Set<string>();
  let componentSource = "";
  for (const entry of manifest.files) {
    if (!safeRelative(entry.path) || seen.has(entry.path) || !/^[a-f0-9]{64}$/.test(entry.sha256)) throw new Error("Unsafe or duplicate backend distribution path.");
    seen.add(entry.path);
    await rejectSymlinks(distribution, entry.path);
    const content = await fs.readFile(path.join(distribution, entry.path), "utf8");
    if (digest(content) !== entry.sha256) throw new Error(`Backend distribution digest mismatch: ${entry.path}`);
    if (entry.path === "_cortex/components.config.ts") componentSource = content;
    await proposed(path.join(normalized, entry.path), content, "versioned Cortex backend source");
  }
  if (!seen.has("_cortex/schema.ts") || !seen.has("_cortex/components.config.ts")) throw new Error("Backend distribution lacks additive schema/component helpers.");
  const registrations = componentRegistrations(componentSource, manifest.components);
  await proposed(path.join(normalized, "schema.ts"), 'import { defineSchema } from "convex/server";\nimport { cortexTablesV1 } from "./_cortex/schema";\nexport default defineSchema({ ...cortexTablesV1 });\n', "add Cortex table map while preserving host tables and options", (current) => addSchema(current, manifest.tables));
  await proposed(path.join(normalized, "convex.config.ts"), addComponents('import { defineApp } from "convex/server";\nconst app = defineApp();\nexport default app;\n', registrations), "register qualified Cortex components with direct root imports alongside host components", (current) => addComponents(current, registrations));
  if (configText === null) await proposed("convex.json", JSON.stringify({ functions }, null, 2) + "\n", "initialize absent functions configuration");
  const authPath = path.join(normalized, "auth.config.ts");
  if (options.trustedJwtProvider) {
    validateProvider(options.trustedJwtProvider);
    await proposed(authPath, `import type { AuthConfig } from "convex/server";\nexport default { providers: [${JSON.stringify(options.trustedJwtProvider)}] } satisfies AuthConfig;\n`, "integrate explicitly selected verified JWT provider", (current) => addAuth(current, options.trustedJwtProvider!));
    plan.capabilities.authConfigured = !plan.conflicts.some((entry) => entry.path === authPath);
  } else plan.capabilities.authConfigured = (await readOptional(path.join(target, "auth.config.ts"))) !== null;
  // Core has no HTTP routes. Existing HTTP/auth routers and deployment config are host-owned.
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
