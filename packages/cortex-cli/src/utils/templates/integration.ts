/** Catalog preflight uses the existing trusted backend composer against an explicit byte view. */
import { createRequire } from "node:module";
import * as fs from "node:fs/promises";
import path from "node:path";
import {
  planBackendSync, validateSdkPackage,
  type BackendPlan, type ProspectiveBackendFiles,
} from "../schema-sync.js";
import { planRuntimeBackend, applySelectedBackendPlan } from "../runtime-backend.js";
import { planTemplateBackend, isCanonicalTemplate } from "../template-backend.js";
import { normalizeGraphOptions, type GraphOptions } from "../graph/contract.js";
import type { GraphServiceOptions } from "../graph/service.js";
import { TemplateError } from "./contract.js";
import { readTemplateBackendCandidate } from "./resolver.js";
import { runTemplateProcess } from "./runtime.js";
import type { PreparedTemplate, PreparedTemplateUpdate, TemplateIntegration } from "./service.js";

export interface TemplateIntegrationOptions extends GraphServiceOptions {
  local?:boolean; cloud?:boolean; deploy?:boolean; install?:boolean; start?:boolean;
}
export function validateTemplateIntegrationOptions(options:TemplateIntegrationOptions):void {
  if(options.start)throw new TemplateError("TEMPLATE_START_RETIRED: run cortex dev separately");
  if(options.local && options.cloud)throw new TemplateError("TEMPLATE_DEPLOYMENT_CONFLICT");
  if(options.install===false && options.deploy===true)throw new TemplateError("TEMPLATE_NO_INSTALL_REQUIRES_NO_DEPLOY");
  if(options.cloud && options.deploy===true)throw new TemplateError("TEMPLATE_CLOUD_TARGET_REQUIRED: stage with --no-deploy, then select a native cloud target explicitly");
}
function graphOptions(options:GraphServiceOptions):GraphOptions {
  return {graph:options.graph,skipGraph:options.skipGraph,graphMode:options.graphMode,graphUri:options.graphUri,boltPort:options.boltPort,httpPort:options.httpPort};
}
export function templateProspectiveFiles(prepared:PreparedTemplate):ProspectiveBackendFiles {
  if("plan" in prepared) return new Map((prepared as PreparedTemplateUpdate).plan.changes.map(change=>[change.path,change.after ? Buffer.from(change.after.bytes):null]));
  return new Map(Object.entries(prepared.baseline.files).map(([name,file])=>[name,Buffer.from(file.content,"base64")]));
}
function cliSdkDirectory():string {
  const selected=createRequire(import.meta.url).resolve("@cortexmemory/sdk");
  return path.dirname(path.dirname(selected));
}
/** All source/schema/ownership decisions are made without cache or destination writes. */
export async function prepareTemplateIntegration(prepared:PreparedTemplate,options:TemplateIntegrationOptions={}):Promise<TemplateIntegration|undefined> {
  validateTemplateIntegrationOptions(options);
  const selectedGraph=graphOptions(options),normalized=normalizeGraphOptions(selectedGraph);
  let backend:BackendPlan|undefined;
  if(prepared.template.backend){
    const sdk=prepared.candidates.sdk?.source ?? cliSdkDirectory(),view=await readTemplateBackendCandidate(sdk);
    validateSdkPackage(sdk,view);
    const prospective=templateProspectiveFiles(prepared);
    backend = /^1\.(?:[3-9]|[1-9][0-9]+)\./.test(prepared.template.version)
      ? await planRuntimeBackend(prepared.directory, sdk, { prospectiveFiles: prospective, sdkView: view })
      : isCanonicalTemplate(prepared.template.id) ? planTemplateBackend(prepared.directory,sdk,prepared.template.id,prospective,view) : planBackendSync(prepared.directory,sdk,{prospectiveFiles:prospective,sdkView:view});
    if(backend.conflicts.length)throw new TemplateError("TEMPLATE_BACKEND_CONFLICT: "+backend.conflicts.join(", "));
  }
  if(normalized.provider!=="none") {
    const {setupGraph}=await import("../graph/service.js");
    await setupGraph(prepared.directory,{...options,...selectedGraph,dryRun:true});
  }
  if(!backend && normalized.provider==="none")return undefined;
  const summary={projectPath:prepared.directory,dryRun:options.dryRun===true,sdkVersion:backend?.ownership.sdk.version,convexVersion:"1.46.0",packageManager:prepared.baseline.identity.manager,deployment:options.deploy===true ? "anonymous-local":"staged",functions:backend?.functions,additions:backend?.additions,updates:backend?.updates,conflicts:backend?.conflicts,writes:Object.keys(prepared.baseline.files)};
  return {summary,preflight:async()=>({apply:async()=>{
    // The payload apply publishes the same prospective bytes, then the existing second-pass
    // checks protect app dependencies/SDK source/config before any backend mutation.
    if(backend)await applySelectedBackendPlan(backend);
    let deployment="staged";
    if(options.deploy===true){
      if(!options.local)throw new TemplateError("TEMPLATE_LOCAL_SELECTION_REQUIRED");
      const native=path.join(prepared.directory,"node_modules/convex/bin/main.js");
      const manifest=JSON.parse(await fs.readFile(path.join(prepared.directory,"node_modules/convex/package.json"),"utf8"));
      if(manifest.version!=="1.46.0")throw new TemplateError("TEMPLATE_CONVEX_VERSION_MISMATCH");
      const env=Object.fromEntries(Object.entries(process.env).filter(([key])=>!key.startsWith("CONVEX_") && !key.startsWith("CORTEX_")));env.CONVEX_AGENT_MODE="anonymous";
      const result=await runTemplateProcess(process.execPath,[native,"dev","--once","--typecheck","enable"],prepared.directory,env);
      if(result.exitCode!==0)throw new TemplateError("TEMPLATE_NATIVE_SETUP_FAILED_OR_UNKNOWN");deployment="anonymous-local";
    }
    const {setupGraph}=await import("../graph/service.js");
    const graph=await setupGraph(prepared.directory,{...options,...selectedGraph,dryRun:false});
    return {...summary,deployment,backend:backend ? {functions:backend.functions,additions:backend.additions,updates:backend.updates}:undefined,graph};
  }})};
}
