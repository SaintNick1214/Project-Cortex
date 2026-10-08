import * as fs from "node:fs/promises";
import { constants } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import {
  TemplateError,
  hashBytes,
  renderBaseline,
  stableJson,
  validateBaseline,
  validatePayloadPath,
  type CatalogTemplate,
  type TemplateBaseline,
  type TemplateId,
} from "./contract.js";
import { planTemplateUpdate, type TemplatePlan } from "./plan.js";
import {
  TemplateApplyError,
  applyTemplatePlan,
  readTemplateBaseline,
  readTemplateFiles,
  recoverTemplateUpdate,
  type ApplyOutcome,
} from "./apply.js";
import {
  resolveTemplateCatalog,
  selectResolvedTemplate,
  resolveTemplateCandidate,
  resolveCatalogSource,
  templateRuntimeVersions,
  type CandidatePackage,
  type ResolvedCatalog,
} from "./resolver.js";
import { satisfiesTemplateRange } from "./versions.js";
export interface CatalogOptions {
  templatesPackage?: string;
  catalogVersion?: string;
  registry?: (version: string) => Promise<string>;
}
export interface RenderOptions {
  projectName?: string;
  sdkPackage?: string;
  providerPackage?: string;
}
export interface PreparedTemplate {
  directory: string;
  catalog: ResolvedCatalog;
  template: CatalogTemplate;
  baseline: TemplateBaseline;
  candidates: Partial<Record<"sdk" | "provider", CandidatePackage>>;
  existingPlan?: TemplatePlan;
}
export interface PreparedTemplateUpdate extends PreparedTemplate {
  plan: TemplatePlan;
}
export function isRepeatedTemplate(prepared: PreparedTemplate): boolean {
  if (prepared.existingPlan) return true;
  if (!("plan" in prepared)) return false;
  const plan = (prepared as PreparedTemplateUpdate).plan;
  return (
    plan.changes.length === 0 && stableJson(plan.old) === stableJson(plan.next)
  );
}
export async function listCatalogTemplates(
  options: CatalogOptions = {},
): Promise<
  Array<{
    id: TemplateId;
    version: string;
    catalogVersion: string;
    manager: string;
    backend: boolean;
    graph: boolean;
    managerMinimum?: string;
  }>
> {
  const catalog = await resolveTemplateCatalog(
    await resolveCatalogSource(options, options.registry),
    options,
  );
  return catalog.catalog.templates.map(
    ({ id, version, manager, backend, graph, managerMinimum }) => ({
      id,
      version,
      catalogVersion: catalog.packageVersion,
      manager,
      backend,
      graph,
      ...(managerMinimum ? {managerMinimum}:{}),
    }),
  );
}
async function rendered(
  catalog: ResolvedCatalog,
  id: TemplateId,
  version: string | undefined,
  options: RenderOptions,
): Promise<Omit<PreparedTemplate, "directory" | "catalog">> {
  const chosen = selectResolvedTemplate(catalog, id, version),
    template = chosen.template;
  const candidates: PreparedTemplate["candidates"] = {};
  for (const component of ["sdk", "provider"] as const) {
    const source =
      options[component === "sdk" ? "sdkPackage" : "providerPackage"];
    if (source === undefined) continue;
    const range = template.compatibility[component];
    if (!range) throw new TemplateError("TEMPLATE_CANDIDATE_NOT_USED");
    candidates[component] = await resolveTemplateCandidate(
      source,
      component,
      range,
    );
  }
  const baseline = renderBaseline(
    template,
    new Map([...chosen.files].map(([name, file]) => [name, file.bytes])),
    {
      projectName: options.projectName,
      executable: [...chosen.files]
        .filter(([, f]) => f.executable)
        .map(([name]) => name),
      envExamples: template.envExamples,
    },
  );
  const packageFile = baseline.files["package.json"];
  if (!packageFile) throw new TemplateError("TEMPLATE_PACKAGE_INCOMPLETE");
  let app: Record<string, unknown>;
  try {
    app = JSON.parse(
      Buffer.from(packageFile.content, "base64").toString("utf8"),
    );
  } catch {
    throw new TemplateError("TEMPLATE_PACKAGE_INVALID");
  }
  if (
    !app ||
    typeof app !== "object" ||
    Array.isArray(app) ||
    typeof app.name !== "string" ||
    app.version !== template.version ||
    (app.packageManager !== undefined &&
      (typeof app.packageManager !== "string" ||
        app.packageManager.split("@")[0] !== template.manager))
  )
    throw new TemplateError("TEMPLATE_APP_IDENTITY_OR_MANAGER");
  for (const component of ["sdk", "provider"] as const) {
    const range = template.compatibility[component];
    if (!range) continue;
    const name =
      component === "sdk"
        ? "@cortexmemory/sdk"
        : "@cortexmemory/vercel-ai-provider";
    const declarations: string[] = [];
    for (const section of [
      "dependencies",
      "devDependencies",
      "optionalDependencies",
      "peerDependencies",
    ]) {
      const dependencies = app[section];
      if (
        dependencies &&
        typeof dependencies === "object" &&
        Object.hasOwn(dependencies, name)
      ) {
        const spec = (dependencies as Record<string, unknown>)[name];
        if (typeof spec !== "string")
          throw new TemplateError("TEMPLATE_PACKAGE_INVALID");
        declarations.push(spec);
      }
    }
    if (
      declarations.length !== 1 ||
      !satisfiesTemplateRange(
        templateRuntimeVersions[component],
        declarations[0],
      )
    )
      throw new TemplateError("TEMPLATE_CANDIDATE_DEPENDENCY_AMBIGUOUS");
  }
  if (Object.keys(candidates).length) {
    const file = baseline.files["package.json"];
    if (!file) throw new TemplateError("TEMPLATE_PACKAGE_INCOMPLETE");
    let manifest: Record<string, unknown>;
    try {
      manifest = JSON.parse(
        Buffer.from(file.content, "base64").toString("utf8"),
      );
    } catch {
      throw new TemplateError("TEMPLATE_PACKAGE_INVALID");
    }
    for (const candidate of Object.values(candidates)) {
      let matches = 0;
      for (const section of [
        "dependencies",
        "devDependencies",
        "optionalDependencies",
        "peerDependencies",
      ]) {
        const deps = manifest[section];
        if (
          deps &&
          typeof deps === "object" &&
          Object.hasOwn(deps, candidate.name)
        ) {
          (deps as Record<string, string>)[candidate.name] =
            candidate.specifier;
          matches++;
        }
      }
      if (matches !== 1)
        throw new TemplateError("TEMPLATE_CANDIDATE_DEPENDENCY_AMBIGUOUS");
    }
    const bytes = Buffer.from(JSON.stringify(manifest, null, 2) + "\n");
    baseline.files["package.json"] = {
      ...file,
      content: bytes.toString("base64"),
      hash: hashBytes(bytes),
    };
    validateBaseline(baseline);
  }
  return { template, baseline, candidates };
}
/** Validate the complete prospective manifest, including unchanged upstream/user overrides. */
function validateRuntimeDependencies(
  selection: Pick<PreparedTemplate, "template" | "candidates">,
  bytes: Buffer | undefined,
): void {
  if (!bytes) throw new TemplateError("TEMPLATE_RUNTIME_DEPENDENCY_MISSING");
  let value: unknown;
  try { value = JSON.parse(bytes.toString("utf8")); }
  catch { throw new TemplateError("TEMPLATE_PACKAGE_INVALID"); }
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new TemplateError("TEMPLATE_PACKAGE_INVALID");
  const manifest = value as Record<string, unknown>;
  const required = [
    { name: "@cortexmemory/sdk", version: selection.candidates.sdk?.version ?? templateRuntimeVersions.sdk,
      candidate: selection.candidates.sdk?.specifier },
    ...(selection.template.compatibility.provider ? [{ name: "@cortexmemory/vercel-ai-provider",
      version: selection.candidates.provider?.version ?? templateRuntimeVersions.provider,
      candidate: selection.candidates.provider?.specifier }] : []),
    { name: "convex", version: templateRuntimeVersions.convex, candidate: undefined },
  ];
  for (const dependency of required) {
    const specs: unknown[] = [];
    for (const section of ["dependencies", "devDependencies", "optionalDependencies", "peerDependencies"]) {
      const map = manifest[section];
      if (map && typeof map === "object" && !Array.isArray(map) && Object.hasOwn(map, dependency.name))
        specs.push((map as Record<string, unknown>)[dependency.name]);
    }
    if (specs.length === 0)
      throw new TemplateError(`TEMPLATE_RUNTIME_DEPENDENCY_MISSING: ${dependency.name}`);
    if (specs.length !== 1 || typeof specs[0] !== "string" ||
      !(dependency.candidate === specs[0] || satisfiesTemplateRange(dependency.version, specs[0])))
      throw new TemplateError(`TEMPLATE_RUNTIME_DEPENDENCY_INCOMPATIBLE: ${dependency.name} must admit selected ${dependency.version}; use a compatible declaration or explicit matching candidate`);
  }
}
async function catalogFor(options: CatalogOptions): Promise<ResolvedCatalog> {
  return resolveTemplateCatalog(
    await resolveCatalogSource(options, options.registry),
    options,
  );
}
const absent = (cause: unknown): boolean =>
  Boolean(
    cause &&
      typeof cause === "object" &&
      "code" in cause &&
      cause.code === "ENOENT",
  );
export async function prepareTemplateInit(
  directory: string,
  id: TemplateId,
  options: CatalogOptions & RenderOptions & { templateVersion?: string } = {},
): Promise<PreparedTemplate> {
  const target = path.resolve(directory),
    parent = path.dirname(target);
  const parentStat = await fs.lstat(parent);
  if (
    !parentStat.isDirectory() ||
    parentStat.isSymbolicLink() ||
    (await fs.realpath(parent)) !== parent
  )
    throw new TemplateError("TEMPLATE_ROOT_UNSAFE");
  const catalog = await catalogFor(options),
    selection = await rendered(catalog, id, options.templateVersion, {
      ...options,
      projectName: options.projectName ?? path.basename(target).toLowerCase().replace(/[^a-z0-9-]/g,"-"),
    });
  let exists = false;
  try {
    await fs.lstat(target);
    exists = true;
  } catch (cause) {
    if (!absent(cause)) throw cause;
  }
  if (exists) {
    const old = await readTemplateBaseline(target, id);
    if (
      !old ||
      stableJson(old.identity) !== stableJson(selection.baseline.identity) ||
      stableJson(old.files) !== stableJson(selection.baseline.files)
    )
      throw new TemplateError(
        "TEMPLATE_DESTINATION_EXISTS: use templates update for a different owned release",
      );
    const local = await readTemplateFiles(
        target,
        Object.keys(old.files),
        old.envExamples,
      ),
      existingPlan = planTemplateUpdate(old, selection.baseline, local);
    if (existingPlan.conflicts.length || existingPlan.changes.length)
      throw new TemplateError("TEMPLATE_CONFLICT");
    validateRuntimeDependencies(selection, local.get("package.json")?.bytes);
    return { directory: target, catalog, ...selection, existingPlan };
  }
  validateRuntimeDependencies(selection, Buffer.from(selection.baseline.files["package.json"].content, "base64"));
  return { directory: target, catalog, ...selection };
}
export async function prepareTemplateUpdate(
  directory: string,
  options: CatalogOptions &
    RenderOptions & { to: string; id?: TemplateId; adoptIdentical?: boolean },
): Promise<PreparedTemplateUpdate> {
  const target = path.resolve(directory),
    possible: TemplateBaseline[] = [];
  for (const id of options.id
    ? [options.id]
    : (["basic", "vercel-ai-quickstart", "chat-sdk"] as const)) {
    const baseline = await readTemplateBaseline(target, id);
    if (baseline) possible.push(baseline);
  }
  if (possible.length !== 1)
    throw new TemplateError(
      possible.length
        ? "TEMPLATE_OWNERSHIP_AMBIGUOUS"
        : "TEMPLATE_OWNERSHIP_REQUIRED",
    );
  const old = possible[0],
    catalog = await catalogFor(options);
  const selection = await rendered(catalog, old.identity.id, options.to, {
    ...options,
    projectName: old.parameters.projectName,
  });
  const names = [
    ...new Set([
      ...Object.keys(old.files),
      ...Object.keys(selection.baseline.files),
    ]),
  ];
  const local = await readTemplateFiles(target, names, [
    ...old.envExamples,
    ...selection.baseline.envExamples,
  ]);
  const actualVersions: Record<string, string> = {
    "@cortexmemory/sdk":
      selection.candidates.sdk?.version ?? templateRuntimeVersions.sdk,
    "@cortexmemory/vercel-ai-provider":
      selection.candidates.provider?.version ??
      templateRuntimeVersions.provider,
    convex: templateRuntimeVersions.convex,
  };
  const plan = planTemplateUpdate(old, selection.baseline, local, {
    adoptIdentical: options.adoptIdentical,
    compatibleVersion: (current, incoming, name) =>
      Boolean(
        actualVersions[name] &&
          satisfiesTemplateRange(actualVersions[name], current) &&
          satisfiesTemplateRange(actualVersions[name], incoming),
      ),
  });
  if (!plan.conflicts.length) {
    const change = plan.changes.find(row => row.path === "package.json");
    validateRuntimeDependencies(selection, change ? change.after?.bytes : local.get("package.json")?.bytes);
  }
  return { directory: target, catalog, ...selection, plan };
}
/** Effect-free preflight adapter for the delivered composer/graph integration supplied later. */
export interface TemplateIntegration {
  summary?:Record<string,unknown>;
  preflight(prepared: PreparedTemplate): Promise<{ apply(): Promise<void | Record<string,unknown>> }>;
}
export interface TemplateExecutionOutcome extends Omit<ApplyOutcome, "status"> {
  status: ApplyOutcome["status"] | "partial";
  identity: TemplateBaseline["identity"];
  projectPath?:string; sdkVersion?:string; convexVersion?:string; packageManager?:string; deployment?:string; backend?:unknown; graph?:unknown;
  integration:
    | "not-required"
    | "not-requested"
    | "succeeded"
    | "failed-or-unknown";
}
export class TemplateIntegrationError extends TemplateError {
  constructor(readonly outcome: TemplateExecutionOutcome) {
    super(
      "TEMPLATE_INTEGRATION_FAILED_OR_UNKNOWN; project ownership retained for explicit reconciliation",
    );
  }
}
// Kept separately from the file rollback journal: dependency and integration effects
// cannot be undone or silently replayed by restoring template-owned files.
function operationPath(prepared: PreparedTemplate): string {
  return path.join(prepared.directory, ".cortex/templates", prepared.template.id, "operation.json");
}
async function assertNoIncompleteOperation(prepared: PreparedTemplate): Promise<void> {
  let handle;
  try {
    handle = await fs.open(operationPath(prepared), constants.O_RDONLY | constants.O_NOFOLLOW);
    const stat = await handle.stat();
    if (!stat.isFile() || stat.size > 128 * 1024 || stat.nlink !== 1)
      throw new TemplateError("TEMPLATE_OPERATION_INVALID");
    throw new TemplateError("TEMPLATE_OPERATION_RECONCILIATION_REQUIRED: prior dependency/backend/graph outcome is incomplete; inspect operation.json and reconcile that original operation before removing its receipt; no automatic replay");
  } catch (cause) {
    if (!absent(cause)) throw cause;
  } finally { await handle?.close(); }
}
async function recordOperation(prepared: PreparedTemplate, outcome: TemplateExecutionOutcome, exclusive = false): Promise<void> {
  const target = operationPath(prepared), temporary = target + "." + randomUUID() + ".tmp";
  const bytes = stableJson({format: 1, identity: prepared.baseline.identity, status: outcome.status,
    changed: outcome.changed, dependency: outcome.dependency, integration: outcome.integration}) + "\n";
  if (exclusive) { await fs.writeFile(target, bytes, {flag: "wx", mode: 0o600}); return; }
  try { await fs.writeFile(temporary, bytes, {flag: "wx", mode: 0o600}); await fs.rename(temporary, target); }
  finally { await fs.rm(temporary, {force: true}); }
}
export async function applyPreparedTemplateUpdate(
  prepared: PreparedTemplateUpdate,
  options: {
    dryRun?: boolean;
    install?: () => Promise<{ exitCode: number }>;
    signal?: AbortSignal;
    integration?: TemplateIntegration;
  } = {},
): Promise<TemplateExecutionOutcome> {
  if (prepared.plan.conflicts.length)
    throw new TemplateError("TEMPLATE_CONFLICT");
  await assertNoIncompleteOperation(prepared);
  if (options.dryRun)
    return {
      ...(await applyTemplatePlan(prepared.directory, prepared.plan, {
        dryRun: true,
      })),
      identity: prepared.baseline.identity,
      integration: "not-requested",
    };
  if (isRepeatedTemplate(prepared))
    return {
      ...(await applyTemplatePlan(prepared.directory, prepared.plan, {
        signal: options.signal,
      })),
      identity: prepared.baseline.identity,
      integration: "not-requested",
    };
  if (prepared.template.backend && !options.integration)
    throw new TemplateError("TEMPLATE_INTEGRATION_REQUIRED");
  const integration = await options.integration?.preflight(prepared);
  const outcome: TemplateExecutionOutcome = { status: "partial", changed: prepared.plan.changes.length,
    dependency: options.install ? "failed-or-unknown" : "not-requested", identity: prepared.baseline.identity,
    integration: integration ? "failed-or-unknown" : "not-required" };
  await recordOperation(prepared, outcome, true);
  try {
    Object.assign(outcome, await applyTemplatePlan(prepared.directory, prepared.plan, options));
    if (integration) { Object.assign(outcome, await integration.apply()); outcome.integration = "succeeded"; }
    await fs.unlink(operationPath(prepared));
    return outcome;
  } catch (cause) {
    if (cause instanceof TemplateApplyError) Object.assign(outcome, cause.outcome);
    else outcome.status = "partial";
    if (cause instanceof TemplateApplyError && cause.outcome.status === "rolled-back" && cause.outcome.dependency === "not-requested")
      await fs.unlink(operationPath(prepared));
    else await recordOperation(prepared, outcome);
    if (cause instanceof TemplateApplyError) throw cause;
    throw new TemplateIntegrationError(outcome);
  }
}
/** New destination: stage secret-free owned bytes and baseline, then one exclusive rename. */
export async function applyPreparedTemplateInit(
  prepared: PreparedTemplate,
  options: {
    dryRun?: boolean;
    signal?: AbortSignal;
    integration?: TemplateIntegration;
    install?: () => Promise<{ exitCode: number }>;
  } = {},
): Promise<TemplateExecutionOutcome> {
  validateBaseline(prepared.baseline);
  if (prepared.existingPlan) {
    await assertNoIncompleteOperation(prepared);
    const result = await applyTemplatePlan(
      prepared.directory,
      prepared.existingPlan,
      { dryRun: options.dryRun, signal: options.signal },
    );
    return {
      ...result,
      identity: prepared.baseline.identity,
      integration: "not-requested",
    };
  }
  try {
    await fs.lstat(prepared.directory);
    throw new TemplateError("TEMPLATE_DESTINATION_EXISTS");
  } catch (cause) {
    if (!absent(cause)) throw cause;
  }
  const result: TemplateExecutionOutcome = {
    status: options.dryRun ? "dry-run" : "applied",
    changed: Object.keys(prepared.baseline.files).length,
    dependency: "not-requested",
    identity: prepared.baseline.identity,
    integration: "not-requested",
  };
  if (options.dryRun) return result;
  if (prepared.template.backend && !options.integration)
    throw new TemplateError("TEMPLATE_INTEGRATION_REQUIRED");
  const integration = await options.integration?.preflight(prepared);
  if (options.signal?.aborted) throw new TemplateError("TEMPLATE_CANCELLED");
  const parent = path.dirname(prepared.directory),
    staged = path.join(parent, ".cortex-template-init-" + randomUUID());
  if ((await fs.realpath(parent)) !== parent)
    throw new TemplateError("TEMPLATE_ROOT_UNSAFE");
  await fs.mkdir(prepared.directory, { mode: 0o700 });
  let published = false;
  try {
    await fs.mkdir(staged, { mode: 0o700 });
    for (const [name, file] of Object.entries(prepared.baseline.files)) {
      validatePayloadPath(name, prepared.baseline.envExamples);
      if (options.signal?.aborted)
        throw new TemplateError("TEMPLATE_CANCELLED");
      await fs.mkdir(path.dirname(path.join(staged, name)), {
        recursive: true,
        mode: 0o700,
      });
      await fs.writeFile(
        path.join(staged, name),
        Buffer.from(file.content, "base64"),
        { flag: "wx", mode: file.executable ? 0o755 : 0o644 },
      );
    }
    const metadata = path.join(
      staged,
      ".cortex/templates",
      prepared.baseline.identity.id,
    );
    await fs.mkdir(metadata, { recursive: true, mode: 0o700 });
    await fs.writeFile(
      path.join(metadata, "baseline.json"),
      stableJson(prepared.baseline) + "\n",
      { flag: "wx", mode: 0o600 },
    );
    await fs.writeFile(path.join(metadata, "operation.json"), stableJson({format: 1,
      identity: prepared.baseline.identity, status: "partial", changed: result.changed,
      dependency: options.install ? "failed-or-unknown" : "not-requested",
      integration: integration ? "failed-or-unknown" : "not-required"}) + "\n", {flag: "wx", mode: 0o600});
    // Exclusive mkdir reserved a new destination; preserve anything added meanwhile.
    if ((await fs.readdir(prepared.directory)).length)
      throw new TemplateError("TEMPLATE_DESTINATION_CHANGED");
    await fs.rename(staged, prepared.directory);
    published = true;
    if (options.install) {
      result.dependency = "failed-or-unknown";
      if ((await options.install()).exitCode !== 0)
        throw new TemplateError("TEMPLATE_DEPENDENCY_FAILED");
      result.dependency = "succeeded";
    }
    if (integration) {
      result.integration = "failed-or-unknown";
      Object.assign(result,await integration.apply());
      result.integration = "succeeded";
    } else result.integration = "not-required";
    await fs.unlink(operationPath(prepared));
    return result;
  } catch (cause) {
    if (published) {
      result.status = "partial";
      await recordOperation(prepared, result);
      throw new TemplateIntegrationError(result);
    }
    throw cause;
  } finally {
    if (!published) {
      await fs.rm(staged, { recursive: true, force: true });
      try {
        await fs.rmdir(prepared.directory);
      } catch {
        /* Preserve new nonempty local state. */
      }
    }
  }
}
export async function recoverCatalogTemplate(
  directory: string,
  id: TemplateId,
  options: { acknowledgeExternalEffects?: boolean } = {},
): Promise<ApplyOutcome & { externalEffects: "not-requested" | "reconciliation-required" | "acknowledged" }> {
  const outcome = await recoverTemplateUpdate(directory, id);
  const root = path.resolve(directory);
  const target = path.join(root, ".cortex/templates", id, "operation.json");
  // readTemplateBaseline validates the root and every metadata parent before the sibling receipt.
  const baseline = await readTemplateBaseline(root, id);
  if (!baseline) throw new TemplateError("TEMPLATE_OWNERSHIP_REQUIRED");
  let handle;
  try {
    handle = await fs.open(target, constants.O_RDONLY | constants.O_NOFOLLOW);
    const stat = await handle.stat();
    if (!stat.isFile() || stat.nlink !== 1 || stat.size > 128 * 1024) throw new TemplateError("TEMPLATE_OPERATION_INVALID");
    const record = JSON.parse(await handle.readFile("utf8")) as Record<string, unknown>;
    if (record.format !== 1 || !record.identity || typeof record.identity !== "object" ||
      (record.identity as {id?: unknown}).id !== id ||
      !["not-requested", "succeeded", "failed-or-unknown"].includes(String(record.dependency)) ||
      !["not-requested", "not-required", "succeeded", "failed-or-unknown"].includes(String(record.integration)))
      throw new TemplateError("TEMPLATE_OPERATION_INVALID");
    const external = record.dependency === "failed-or-unknown" || record.integration === "failed-or-unknown";
    if (outcome.status === "rollback-incomplete" || external && !options.acknowledgeExternalEffects)
      return { ...outcome, dependency: record.dependency as ApplyOutcome["dependency"], externalEffects: "reconciliation-required" };
    // --recover --yes is explicit human acknowledgement after inspecting/reconciling the
    // original npm/native/graph effects. It does not certify an external effect and never replays one.
    await fs.unlink(target);
    return { ...outcome, dependency: record.dependency as ApplyOutcome["dependency"],
      externalEffects: external ? "acknowledged" : "not-requested" };
  } catch (cause) {
    if (!absent(cause)) throw cause;
    return { ...outcome, externalEffects: "not-requested" };
  } finally { await handle?.close(); }
}
