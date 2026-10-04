import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import ts from "typescript";

const goal = process.argv[2] ?? "_goals/convex-backend-runtime-2026-10-02/qa/task03a";
const builders = new Set(["query", "mutation", "action", "httpAction", "internalQuery", "internalMutation", "internalAction"]);
const walkFiles = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((item) => {
  const file = path.join(dir, item.name);
  return item.isDirectory() ? (item.name === "_generated" ? [] : walkFiles(file)) : /\.[cm]?[jt]s$/.test(file) ? [file] : [];
});
const functionsDir = JSON.parse(fs.readFileSync("convex.json", "utf8")).functions.replace(/\/$/, "");
const files = walkFiles(functionsDir).sort();
const endpoints = [];
const sources = [];
const unresolved = [];
const routes = [];
let calls = 0;

for (const file of files) {
  const source = fs.readFileSync(file, "utf8");
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
  const aliases = new Map();
  const namespaces = new Set();
  for (const node of ast.statements) {
    if (ts.isImportDeclaration(node) && /(?:_generated\/server|convex\/server)$/.test(node.moduleSpecifier.text)) {
      const bindings = node.importClause?.namedBindings;
      if (bindings && ts.isNamedImports(bindings)) for (const item of bindings.elements) {
        const imported = item.propertyName?.text ?? item.name.text;
        if (builders.has(imported)) aliases.set(item.name.text, imported);
      }
      if (bindings && ts.isNamespaceImport(bindings)) namespaces.add(bindings.name.text);
    }
  }
  const builderOf = (expression) => ts.isIdentifier(expression) ? aliases.get(expression.text)
    : ts.isPropertyAccessExpression(expression) && ts.isIdentifier(expression.expression)
      && namespaces.has(expression.expression.text) && builders.has(expression.name.text) ? expression.name.text : undefined;
  const declarations = new Map();
  const exported = new Map();
  for (const node of ast.statements) {
    if (ts.isVariableStatement(node)) for (const declaration of node.declarationList.declarations) {
      if (ts.isIdentifier(declaration.name) && declaration.initializer) {
        declarations.set(declaration.name.text, declaration.initializer);
        if (node.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword)) exported.set(declaration.name.text, declaration.name.text);
      }
    }
    if (ts.isExportDeclaration(node)) {
      if (node.moduleSpecifier) unresolved.push(`${file}: external/re-export requires explicit traversal`);
      if (node.exportClause && ts.isNamedExports(node.exportClause)) for (const item of node.exportClause.elements) {
        exported.set(item.name.text, item.propertyName?.text ?? item.name.text);
      }
    }
  }
  const registrations = new Map();
  const visit = (node) => {
    if (ts.isCallExpression(node)) {
      const builder = builderOf(node.expression);
      if (builder) { calls++; registrations.set(node, builder); }
      if (ts.isPropertyAccessExpression(node.expression) && node.expression.name.text === "route") {
        routes.push({ file, line: ast.getLineAndCharacterOfPosition(node.getStart()).line + 1, expression: node.getText(ast) });
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(ast);
  for (const [name, local] of exported) {
    let expression = declarations.get(local);
    const seen = new Set();
    while (expression && ts.isIdentifier(expression) && !seen.has(expression.text)) {
      seen.add(expression.text); expression = declarations.get(expression.text);
    }
    if (!expression || !ts.isCallExpression(expression)) continue;
    const kind = registrations.get(expression);
    if (!kind) continue;
    registrations.delete(expression);
    const config = expression.arguments[0];
    const fields = config && ts.isObjectLiteralExpression(config) ? config.properties : [];
    const args = fields.find((field) => field.name?.getText(ast) === "args");
    const validators = args && ts.isPropertyAssignment(args) && ts.isObjectLiteralExpression(args.initializer)
      ? Object.fromEntries(args.initializer.properties.filter(ts.isPropertyAssignment)
        .map((field) => [field.name.getText(ast), field.initializer.getText(ast)])) : {};
    const handler = fields.find((field) => field.name?.getText(ast) === "handler");
    const body = handler?.getText(ast) ?? expression.getText(ast);
    const tables = [...new Set([...body.matchAll(/\.query\("([^"]+)"\)/g)].map((match) => match[1]))];
    const indexes = [...new Set([...body.matchAll(/\.withIndex\("([^"]+)"/g)].map((match) => match[1]))];
    const pathName = `${path.relative(functionsDir, file).replace(/\.[cm]?[jt]s$/, "")}:${name}`;
    endpoints.push({ path: pathName, file, line: ast.getLineAndCharacterOfPosition(expression.getStart()).line + 1,
      kind, visibility: kind.startsWith("internal") ? "internal" : "public", validators, tables, indexes,
      usesStorage: /ctx\.storage\./.test(body), existingVerifiedIdentityCheck: /getUserIdentity\(/.test(body),
      globalIdLookup: indexes.some((index) => /^by_(?:conversationId|memoryId|factId|artifactId|attachmentId|agentId|contextId|shareId|sessionId|type_id|namespace_key)$/.test(index)),
      callerIdentityFields: Object.keys(validators).filter((field) => /userId|grantedBy|revokedBy|approvedBy|participantId|agentId|tenantId|memorySpaceId/i.test(field)),
      conditionalScopeFilter: /if\s*\(args\.(?:tenantId|memorySpaceId|userId)/.test(body),
    });
  }
  for (const [registration] of registrations) unresolved.push(`${file}:${ast.getLineAndCharacterOfPosition(registration.getStart()).line + 1}: builder call is not a resolved exported binding`);
  sources.push({ file, sha256: crypto.createHash("sha256").update(source).digest("hex") });
}

const background = new Set([
  "sessions:expireIdle", "sessions:incrementMessageCount", "sessions:incrementMemoryCount",
  "factHistory:logEvent", "factHistory:deleteByFactId", "factHistory:deleteByUserId", "factHistory:deleteByMemorySpace", "factHistory:purgeOldEvents",
  "governance:enforce", "conversationShares:incrementViewCount", "artifacts:setFileRef",
]);
const privateBytes = new Set(["attachments:generateUploadUrl", "attachments:getUrl", "artifacts:generateArtifactUploadUrl", "artifacts:getArtifactFileUrl"]);
const rowKeys = {
  runtimeMemory: "trusted concrete tenant/space; pinned principal/grant source revision/profile; current source/derived lineage",
  memories: "(trusted tenantId, memorySpaceId, memoryId); source/current version for history/search",
  facts: "(trusted tenantId, memorySpaceId, factId); supersession peers and source revisions",
  conversations: "(trusted tenantId, memorySpaceId, conversationId); canonical participant/owner + transcript revision",
  conversationSnapshots: "snapshotId -> canonical scoped conversation; snapshot creator binding",
  conversationShares: "shareId -> canonical scoped conversation/source space; grant actor, expiry, revocation and redaction policy",
  artifacts: "(trusted tenantId, memorySpaceId, artifactId); current artifact/version, linked conversation and owned storage receipt",
  attachments: "(trusted tenantId, memorySpaceId, attachmentId); owned upload receipt and every linked resource",
  memorySpaces: "(trusted tenantId, memorySpaceId); participant metadata never a membership grant",
  contexts: "(trusted tenantId, memorySpaceId, contextId); parent/root/children/participants and every cross-space link",
  a2a: "conversationId -> canonical tenant and both participating memory spaces; both source and recipient grants",
  agents: "(trusted tenantId, agentId); immutable deployed configuration version; metadata is not authority",
  users: "(trusted tenantId, immutable type=user, bound metadataUserId); owner binding or explicit cross-principal grant",
  sessions: "sessionId -> trusted tenant, optional space and bound principal; userId cannot select another owner",
  factHistory: "eventId/factId -> canonical fact tenant + space; join authoritative fact/source before historical reads",
  immutable: "(trusted tenantId, type, id); every requested version uses the same trusted scope",
  mutable: "(trusted tenantId, namespace, key); every transaction/purge member checked before effect",
  governance: "trusted tenant + scope -> policy/enforcement; add tenant ownership for currently unscoped policy rows",
  graphSync: "queueItem -> canonical tenant/space/source + stored authority reference; authorize worker reads and projection commits",
  admin: "deployment-wide dynamic table/row access: deployment operator only",
  runtimeAuth: "trusted control tables only; internal deployment operator or inherited verified auth for authorize",
};
for (const endpoint of endpoints) {
  const [module, name] = endpoint.path.split(":");
  if (!(module in rowKeys)) unresolved.push(`${endpoint.path}: missing explicit module resource policy`);
  const destructiveGlobal = /^(?:purgeAll|purgeAllPolicies|purgeAllEnforcement)$/.test(name);
  const reads = endpoint.kind === "query" || endpoint.kind === "internalQuery" || endpoint.kind === "action";
  const internalize = module === "admin" || module === "graphSync" || destructiveGlobal || background.has(endpoint.path) || privateBytes.has(endpoint.path);
  endpoint.disposition = endpoint.visibility === "internal" ? "retain-internal" : internalize ? "internalize" : "guard";
  endpoint.requiredCapability = module === "admin" || module === "governance" || module === "agents"
    || (module === "memorySpaces" && endpoint.kind !== "query") ? "admin"
    : endpoint.usesStorage || /Upload|FileRef|FileUrl/.test(name) ? reads ? "storage:read" : "storage:write"
    : module === "graphSync" ? "tool" : reads ? "read" : "write";
  endpoint.scope = ["admin"].includes(module) ? "deployment-operator"
    : ["immutable", "mutable", "users", "agents", "governance"].includes(module) ? "trusted tenant; explicitly space-scoped if resource/policy supports it"
    : "trusted tenant + memorySpace; omitted selectors derive one eligible scope or deny ambiguity";
  endpoint.resourceLookup = rowKeys[module];
  endpoint.ownership = module === "admin" ? "deployment operator"
    : "ownerPrincipalId must match for own access; cross-principal access within a tenant requires explicit space/tenant resourceAccess; admin never implies read/write/run";
  endpoint.backgroundCheck = endpoint.visibility === "internal" || internalize
    ? "reload principal/membership/grant versions, tenant/space epochs, expiry and tombstones before sensitive read/effect/commit; internal visibility alone does not authorize a background job"
    : "check verified identity and current authority on every invocation/subscription reevaluation; scheduled follow-up stores immutable reference";
  endpoint.reason = privateBytes.has(endpoint.path) ? "raw storage bearer URL surface; replace with scoped admission/private HTTP delivery in Tasks12/13"
    : module === "admin" ? "unscoped arbitrary-table list/count/delete/clear bypass"
    : module === "graphSync" ? "unscoped background projection queue and cleanup exposure"
    : destructiveGlobal ? "deployment-wide purge cannot be selected by a caller tenant or admin metadata"
    : background.has(endpoint.path) ? "background/helper effect must use trusted reference, not public caller IDs"
    : endpoint.visibility === "internal" ? "already internal helper; add scope/currentness to prevent action-mediated confused deputy"
    : "retain modern direct API with verified scoped grants; replace conditional caller filters/global ID lookup with trusted scope and row checks";
  if (module === "conversations" || module === "conversationSnapshots") endpoint.transcriptContract = "reads canonical Agent store; direct writes require applicable write capability + trusted admin unlock, same-store revision/invalidation, never a second writer (Task05)";
  if (module === "conversationShares") endpoint.shareContract = "existing management routes require scoped verified grants; later dedicated share view allowlists redacted canonical fields, read-only, no run/tool/private memory/storage privilege; caller email/domain/user fields never prove identity";
  if (module === "attachments" || module === "artifacts") endpoint.storageContract = "storage reference must resolve to an owned, scoped upload/materialization receipt; all linked resources authorized; private authenticated bytes and callback fences at Tasks12/13, <=20000000 bytes";
  if (module === "admin" || destructiveGlobal) {
    const adminTargets = {
      listTable: "allowlisted Cortex table selector -> deployment-wide rows for trusted operator inspection",
      deleteRecord: "allowlisted Cortex table and exact record ID -> operator maintenance target and owned references",
      clearTable: "allowlisted Cortex table selector -> deployment-wide batch maintenance targets and owned references",
      countTable: "allowlisted Cortex table selector -> deployment-wide count for trusted operator inspection",
      getAllCounts: "fixed allowlisted Cortex tables -> deployment-wide counts for trusted operator inspection",
    };
    if (module === "admin" && !(name in adminTargets)) unresolved.push(`${endpoint.path}: missing explicit operator maintenance policy`);
    endpoint.requiredCapability = "trusted deployment-operator internal invocation";
    endpoint.scope = "deployment-operator";
    endpoint.resourceLookup = module === "admin" ? adminTargets[name]
      : `${module} deployment-wide Cortex records and owned references; retain lifecycle/tombstone fences and reference-aware cleanup`;
    endpoint.ownership = "trusted deployment operator controls deployment-wide Cortex maintenance targets; tenant runtime capabilities and resource-owner claims cannot authorize invocation";
    endpoint.backgroundCheck = "trusted operator maintenance does not authenticate through a target's current tenant/background grant, which may already be revoked/deleted; preserve deletion fences and reference-aware cleanup; no runtime admin/write/tool/storage prerequisite";
    endpoint.reason = "deployment-wide maintenance must internalize for trusted operator invocation; never public tenant admin or target-grant authorization";
  }
  if (module === "runtimeMemory") {
    endpoint.requiredCapability = name === "remember" || name === "writeSource" || name === "writeDerived" ? "write" : name === "checkAuthority" ? "validated requested read/write capability" : "read";
    endpoint.reason = endpoint.visibility === "internal" ? "trusted reference and current source/derived revision fences in accepted domain repository" : "verified authority then explicit unconfigured model capability outcome; qualified policy/inference wiring required in04/08";
    endpoint.backgroundCheck = "reload pinned principal/membership/grant/epochs, source tombstone/revision before sensitive read/effect/commit; modern domain02 review and current service validation required";
  }
  // Auth control boundaries are not data mutations and cannot inherit the generic builder policy.
  if (module === "runtimeAuth") {
    if (name === "authorize") {
      endpoint.requiredCapability = "requirement.capability";
      endpoint.scope = "trusted memberships/grants resolved from inherited Convex-verified issuer/subject; omitted selectors require one eligible scope";
      endpoint.resourceLookup = "exact verified issuer/subject -> principal, membership, grant, scope epochs and optional canonical resource";
      endpoint.ownership = "verified principal and explicit own/space/tenant resourceAccess; canonical ownerPrincipalId must match for own access";
      endpoint.backgroundCheck = "action authorization adapter consumes inherited ctx.auth.getUserIdentity; reload current trusted controls, capability, expiry, epochs and tombstones on invocation";
      endpoint.reason = "internal adapter for verified external action identity; not operator provisioning or sessionless background reference authorization";
    } else if (name === "recheck") {
      endpoint.requiredCapability = "requirement.capability";
      endpoint.scope = "exact trusted persisted reference principal/membership/grant IDs and versions, tenant/space epochs and optional memorySpaceId equality including absence";
      endpoint.resourceLookup = "exact trusted persisted authority reference -> current control records and optional canonical resource/tombstone";
      endpoint.ownership = "trusted persisted reference binds principal; current explicit own/space/tenant resourceAccess checks canonical resource; reference is never a public credential";
      endpoint.backgroundCheck = "sessionless background adapter reloads exact pinned versions, capability, expiry, scope epochs and tombstones before sensitive read/effect/commit; no active JWT required";
      endpoint.reason = "internal currentness check for admitted background work; cannot widen the persisted optional space scope";
    } else {
      const targets = {
        provision: "exact operator-supplied issuer/subject -> principal, tenant membership, scope records and immutable grant generation",
        revokeGrant: "exact target grant ID -> retained grant revocation fence, including already revoked/deleted target",
        revokeMembership: "exact target membership ID -> retained membership revocation/version fence, including already revoked/deleted target",
        deletePrincipal: "exact target principal ID -> retained principal deletion/version fence, including already revoked/deleted target",
        deleteScope: "exact tenantId and optional memorySpaceId -> scope epoch/deletion fence and idempotent tombstone, including absent/deleted target",
        tombstoneResource: "exact tenantId, optional memorySpaceId, resourceType and resourceId -> idempotent retained resource tombstone",
      };
      if (!(name in targets)) unresolved.push(`${endpoint.path}: missing explicit auth control policy`);
      endpoint.requiredCapability = "trusted deployment-operator internal invocation";
      endpoint.scope = "deployment-operator";
      endpoint.resourceLookup = targets[name];
      endpoint.ownership = "trusted deployment operator controls trusted records; public JWT admin, tenant write and resource-owner claims cannot authorize invocation";
      endpoint.backgroundCheck = "operator bootstrap/lifecycle control does not authenticate through the target's current background grant, which may already be revoked/deleted; enforce each handler's target lifecycle checks and idempotence";
      endpoint.reason = "internal trusted deployment-operator control, not tenant data write or public admin impersonation";
    }
  }
}

if (routes.length) unresolved.push("HTTP routes exist and need a per-route canonical handler classification");
if (unresolved.length) throw new Error(JSON.stringify(unresolved, null, 2));
const counts = {
  modules: files.length, registered: endpoints.length, public: endpoints.filter((e) => e.visibility === "public").length,
  internal: endpoints.filter((e) => e.visibility === "internal").length, httpRoutes: routes.length,
  registeredBuilderCalls: calls, resolvedExports: endpoints.length,
  guard: endpoints.filter((e) => e.disposition === "guard").length,
  internalize: endpoints.filter((e) => e.disposition === "internalize").length,
};
const inventory = { version: 1, functionsDirectory: functionsDir, completeness: {
  method: "TypeScript AST import-aware builder-call and exported-binding resolution, recursive configured functions directory; fail on unresolved registrations/re-exports/routes/unclassified module",
  counts, unresolved, sourceHashes: sources,
  statement: "Classification only: existing public paths are not yet protected. Task03B must close every public entry and recheck internal background helpers.",
}, routes, endpoints };
fs.mkdirSync(goal, { recursive: true });
fs.writeFileSync(`${goal}/public-path-inventory.json`, JSON.stringify(inventory, null, 2) + "\n");
const rows = endpoints.map((e) => `| \`${e.path}\` | ${e.kind} | ${e.disposition} | ${e.requiredCapability} | ${e.resourceLookup} |`);
fs.writeFileSync(`${goal}/public-path-inventory.md`, `# Task03A frozen public-path inventory\n\nClassification only; no existing endpoint closure is claimed. JSON records per-path validators, indexes, risk flags, trusted scope/ownership, background checks and extension contracts.\n\n${JSON.stringify(counts)}\n\nAll ${counts.registeredBuilderCalls} AST-recognized registered builder calls resolve to exported endpoints. No HTTP routes or callbacks are registered in the configured baseline. Non-HTTP storage-upload completion handlers are included below.\n\n| Endpoint | Builder | Required disposition | Capability | Canonical resource lookup |\n|---|---|---|---|---|\n${rows.join("\n")}\n`);
process.stdout.write(JSON.stringify({ counts, unresolved, output: `${goal}/public-path-inventory.json` }, null, 2) + "\n");
