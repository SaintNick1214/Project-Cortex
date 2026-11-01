/** Current runtime distribution and legacy operator composition have distinct registration contracts. */
import fs from "node:fs";
import path from "node:path";
import { planAdditiveBackendInstallation, applyAdditiveBackendInstallation, type BackendInstallationPlan } from "./init/additive-backend.js";
import { planBackendSync, applyBackendPlan, assertBackendPlanCurrent, hashBytes, validateSdkPackage, assertSafePath, type BackendPlan, type BackendSdkView, type ProspectiveBackendFiles } from "./schema-sync.js";

export interface RuntimeBackendPlan extends BackendPlan { runtime: BackendInstallationPlan }
export type SelectedBackendPlan = BackendPlan | RuntimeBackendPlan;
export function hasRuntimeDistribution(sdkPath: string, view?: BackendSdkView): boolean {
  return view ? Boolean(view.distribution) : fs.existsSync(path.join(sdkPath, "dist/backend/v1/manifest.json"));
}
/** Planning observes prospective template bytes without creating the destination. */
export async function planRuntimeBackend(project: string, sdkPath: string, preparation: { prospectiveFiles?: ProspectiveBackendFiles; sdkView?: BackendSdkView } = {}): Promise<RuntimeBackendPlan> {
  const sdk = validateSdkPackage(sdkPath, preparation.sdkView);
  if (!hasRuntimeDistribution(sdkPath, preparation.sdkView)) throw new Error("CURRENT_RUNTIME_DISTRIBUTION_REQUIRED");
  const runtime = await planAdditiveBackendInstallation(project, sdkPath, {
    prospectiveFiles: preparation.prospectiveFiles,
    distributionFiles: preparation.sdkView?.distribution ? new Map(Object.entries(preparation.sdkView.distribution)) : undefined,
  });
  const functions = runtime.functionsDirectory.replace(/\/$/, "");
  const files: Record<string, Buffer> = {}, previous: Record<string, string | null> = {};
  for (const change of runtime.changes) {
    if (change.path.startsWith(functions + "/")) {
      const name = change.path.slice(functions.length + 1); files[name] = Buffer.from(change.content); previous[name] = change.beforeSha256;
    }
  }
  for (const relative of runtime.unchanged) if (relative.startsWith(functions + "/")) {
    const bytes = preparation.prospectiveFiles?.has(relative) ? preparation.prospectiveFiles.get(relative) : fs.readFileSync(assertSafePath(project, relative));
    if (!bytes) throw new Error("CURRENT_RUNTIME_PROSPECTIVE_FILE_MISSING");
    const name = relative.slice(functions.length + 1); files[name] = Buffer.from(bytes); previous[name] = hashBytes(bytes);
  }
  const config = preparation.prospectiveFiles?.has("convex.json") ? preparation.prospectiveFiles.get("convex.json") : fs.existsSync(path.join(project, "convex.json")) ? fs.readFileSync(path.join(project, "convex.json")) : null;
  return { projectPath: path.resolve(project), sdkPath, sdkView: preparation.sdkView, functions, files, previous,
    additions: Object.keys(files).filter(name => previous[name] === null), updates: Object.keys(files).filter(name => previous[name] !== null && previous[name] !== hashBytes(files[name])),
    conflicts: runtime.conflicts.map(item => `${item.path}: ${item.reason}`),
    ownership: { format: 1, sdk, functions, files: Object.fromEntries(Object.entries(files).map(([name, bytes]) => [name, hashBytes(bytes)])) },
    configBefore: config ? hashBytes(config) : null, manifestBefore: null, runtime };
}
export async function planSelectedBackend(project: string, sdkPath: string, preparation: { prospectiveFiles?: ProspectiveBackendFiles; sdkView?: BackendSdkView } = {}): Promise<SelectedBackendPlan> {
  return hasRuntimeDistribution(sdkPath, preparation.sdkView) ? planRuntimeBackend(project, sdkPath, preparation) : planBackendSync(project, sdkPath, preparation);
}
export function assertSelectedBackendPlanCurrent(plan: SelectedBackendPlan): void {
  if (!("runtime" in plan)) { assertBackendPlanCurrent(plan); return; }
  for (const [relative, expected] of Object.entries(plan.runtime.observedFiles ?? {})) {
    const file = assertSafePath(plan.projectPath, relative), current = fs.existsSync(file) ? hashBytes(fs.readFileSync(file)) : null;
    if (current !== expected) throw new Error(`Host file changed after runtime planning: ${relative}`);
  }
  for (const change of plan.runtime.changes) {
    const file = assertSafePath(plan.projectPath, change.path);
    const before = fs.existsSync(file) ? hashBytes(fs.readFileSync(file)) : null;
    if (before !== change.beforeSha256) throw new Error(`Host file changed after runtime planning: ${change.path}`);
  }
}
export async function applySelectedBackendPlan(plan: SelectedBackendPlan, options: { overwrite?: boolean; dryRun?: boolean } = {}): Promise<string | undefined> {
  if (!("runtime" in plan)) return applyBackendPlan(plan, options);
  if (options.dryRun) return undefined;
  // Existing differing runtime/host bytes always require a reviewed merge, even --overwrite.
  await applyAdditiveBackendInstallation(plan.runtime);
  return undefined;
}
