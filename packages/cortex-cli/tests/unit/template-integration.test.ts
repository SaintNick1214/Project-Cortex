import { afterEach, describe, expect, it, jest } from "@jest/globals";
import * as fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Command } from "commander";
import { prepareTemplateInit, prepareTemplateIntegration, applyPreparedTemplateInit,
  readTemplateBaseline, recoverCatalogTemplate, verifyTemplateManager, type TemplateExecutionOutcome } from "../../src/utils/templates/index.js";
import { registerTemplatesCommands, runCatalogBasicInit } from "../../src/commands/templates.js";
import { validateSdkPackage } from "../../src/utils/schema-sync.js";
import { planRuntimeBackend } from "../../src/utils/runtime-backend.js";
import { readTemplateBackendCandidate } from "../../src/utils/templates/resolver.js";
const roots: string[] = [];
const catalog = process.env.CORTEX_TASK12_CATALOG_PACKAGE ?? fileURLToPath(new URL("../../../cortex-templates/", import.meta.url));
const sdk = process.env.CORTEX_TASK12_SDK_PACKAGE ?? fileURLToPath(new URL("../../../../", import.meta.url));
function inputs(): { templatesPackage: string; sdkPackage: string } {
  if (!catalog || !sdk || !process.env.CORTEX_TEST_HOME_ROOT || process.env.HOME !== process.env.CORTEX_TEST_HOME_ROOT)
    throw new Error("Explicit Task12 owned inputs required");
  return { templatesPackage: catalog, sdkPackage: sdk };
}
async function root(): Promise<string> {
  inputs(); const r = await fs.mkdtemp(path.join(process.env.HOME!, "template-integration-")); roots.push(r); return r;
}
afterEach(async () => { for (const r of roots.splice(0)) await fs.rm(r,{recursive:true,force:true}); });
async function tree(dir:string):Promise<Record<string,string>> {
  const result:Record<string,string>={};
  async function walk(p:string,rel:string) { for(const name of (await fs.readdir(p)).sort()) {
    const next=path.join(p,name), key=rel ? rel+"/"+name:name; const stat=await fs.lstat(next);
    if(stat.isDirectory())await walk(next,key);else result[key]=(await fs.readFile(next)).toString("base64");
  }} await walk(dir,"");return result;
}
describe("current canonical catalog prospective integration",()=>{
  it("validates the selected actual SDK source without extraction or module execution",async()=>{
    const view=await readTemplateBackendCandidate(inputs().sdkPackage);
    expect(validateSdkPackage(inputs().sdkPackage,view).version).toBe("0.39.0");
    expect(Object.keys(view.files)).toContain("schema.ts");
    if (view.artifact) expect(view.artifact.path).toBe(inputs().sdkPackage);
    else expect(view.files["schema.ts"]).toEqual(await fs.readFile(path.join(inputs().sdkPackage,"convex-dev/schema.ts")));
    expect(view.files["admin.ts"].toString()).toContain("internalMutation");
  });
  it.each(["basic","vercel-ai-quickstart","chat-sdk"] as const)("%s full schema/app preflight is write-free at an absent destination",async id=>{
    const parent=await root(),target=path.join(parent,"prospective"),before=await tree(parent);
    const prepared=await prepareTemplateInit(target,id,inputs());
    expect(prepared.template.version).toBe("1.4.0");
    const integration=await prepareTemplateIntegration(prepared,{dryRun:true,graph:"none"});
    expect(integration?.summary).toMatchObject({sdkVersion:"0.39.0",packageManager:id==="chat-sdk"?"pnpm":"npm"});
    expect(integration?.summary?.conflicts).toEqual([]);
    expect((await applyPreparedTemplateInit(prepared,{dryRun:true})).status).toBe("dry-run");
    expect(await tree(parent)).toEqual(before);
  });
  it("Basic init and explicit templates init return the same catalog identity and owned bytes",async()=>{
    const parent=await root(), first=path.join(parent,"same-name"),second=path.join(await root(),"same-name");
    const outputs:TemplateExecutionOutcome[]=[];
    const services={install:jest.fn(async()=>({exitCode:0})),output:(v:unknown)=>{outputs.push(v as TemplateExecutionOutcome);}};
    await runCatalogBasicInit(first,{...inputs(),install:false,deploy:false,graph:"none"},services);
    const program=new Command().exitOverride();registerTemplatesCommands(program,services);
    await program.parseAsync(["node","test","templates","init",second,"--template","basic","--templates-package",inputs().templatesPackage,"--sdk-package",inputs().sdkPackage,"--no-install","--graph","none"]);
    expect(outputs.map(o=>o.identity)).toEqual([outputs[0].identity,outputs[0].identity]);
    expect(await tree(first)).toEqual(await tree(second));
    expect(services.install).not.toHaveBeenCalled();
    expect((await readTemplateBaseline(first,"basic"))?.identity.version).toBe("1.4.0");
  });
  it.each(["basic","vercel-ai-quickstart","chat-sdk"] as const)("%s immutable 1.2 payload remains explicitly selectable without implicit runtime integration",async id=>{
    const target=path.join(await root(),"retained-legacy"),prepared=await prepareTemplateInit(target,id,{...inputs(),templateVersion:"1.2.0"});
    expect(prepared.template.version).toBe("1.2.0");
    expect((await applyPreparedTemplateInit(prepared,{dryRun:true})).status).toBe("dry-run");
    if(id!=="basic") await expect(prepareTemplateIntegration(prepared,{dryRun:true,graph:"none"})).rejects.toThrow(/Unreviewed SDK|Canonical app contract changed/);
    await expect(fs.stat(target)).rejects.toMatchObject({code:"ENOENT"});
  });
  it("failed integration remains partial on rerun; file recovery never repeats integration or dependencies",async()=>{
    const target=path.join(await root(),"failed");
    const prepared=await prepareTemplateInit(target,"basic",inputs());
    const apply=jest.fn(async()=>{throw new Error("actual controlled integration failure");});
    const install=jest.fn(async()=>({exitCode:0}));
    await expect(applyPreparedTemplateInit(prepared,{install,integration:{preflight:async()=>({apply})}})).rejects.toMatchObject({outcome:{status:"partial",dependency:"succeeded",integration:"failed-or-unknown"}});
    const before=await tree(target),repeat=await prepareTemplateInit(target,"basic",inputs());
    await expect(applyPreparedTemplateInit(repeat)).rejects.toThrow("TEMPLATE_OPERATION_RECONCILIATION_REQUIRED");
    const recovery=await recoverCatalogTemplate(target,"basic");
    expect(recovery.externalEffects).toBe("reconciliation-required");expect(await tree(target)).toEqual(before);
    expect((await recoverCatalogTemplate(target,"basic",{acknowledgeExternalEffects:true})).externalEffects).toBe("acknowledged");
    expect((await applyPreparedTemplateInit(repeat)).status).toBe("no-op");
    expect(apply).toHaveBeenCalledTimes(1);expect(install).toHaveBeenCalledTimes(1);
  });
  it("registered recovery reports incomplete external work and explicit acknowledgement without repeating effects",async()=>{
    const target=path.join(await root(),"human-recovery"),prepared=await prepareTemplateInit(target,"basic",inputs());
    const apply=jest.fn(async()=>{throw new Error("controlled graph failure");});
    await expect(applyPreparedTemplateInit(prepared,{integration:{preflight:async()=>({apply})}})).rejects.toThrow("TEMPLATE_INTEGRATION_FAILED_OR_UNKNOWN");
    const outputs:unknown[]=[],install=jest.fn(async()=>({exitCode:0}));
    const program=()=>{const p=new Command().exitOverride();registerTemplatesCommands(p,{install,output:v=>{outputs.push(v);}});return p;};
    await expect(program().parseAsync(["node","test","templates","update",target,"--recover"])).rejects.toThrow("TEMPLATE_EXTERNAL_RECONCILIATION_REQUIRED");
    expect(outputs[0]).toMatchObject({status:"no-op",externalEffects:"reconciliation-required",dependency:"not-requested"});
    await program().parseAsync(["node","test","templates","update",target,"--recover","--yes"]);
    expect(outputs[1]).toMatchObject({status:"no-op",externalEffects:"acknowledged",dependency:"not-requested"});
    await expect(fs.stat(path.join(target,".cortex/templates/basic/operation.json"))).rejects.toMatchObject({code:"ENOENT"});
    expect(apply).toHaveBeenCalledTimes(1);expect(install).not.toHaveBeenCalled();
  });
  it("Basic npm minimum uses version-only checks, refuses old/default npm without writes and never switches tools",async()=>{
    const parent=await root(),before=await tree(parent),run=jest.fn(async()=>({exitCode:0,stdout:"10.9.2\n"}));
    await expect(verifyTemplateManager("npm","11.0.0",run)).rejects.toThrow("TEMPLATE_MANAGER_UPGRADE_REQUIRED");
    expect(run).toHaveBeenCalledWith("npm",["--version"],process.cwd());
    expect(await tree(parent)).toEqual(before);
    const current=jest.fn(async()=>({exitCode:0,stdout:"11.19.1\n"}));
    expect(await verifyTemplateManager("npm","11.0.0",current)).toBe("11.19.1");
    expect(await verifyTemplateManager("npm",undefined,current)).toBeUndefined();expect(current).toHaveBeenCalledTimes(1);
  });
  it("Basic projected schema rejects unsafe user output before publishing any file",async()=>{
    const parent=await root(),target=path.join(parent,"conflict");await fs.mkdir(target);await fs.writeFile(path.join(target,"convex.json"),JSON.stringify({functions:"convex"}));await fs.mkdir(path.join(target,"convex"));await fs.writeFile(path.join(target,"convex/schema.ts"),"user schema sentinel");
    const before=await tree(target),view=await readTemplateBackendCandidate(inputs().sdkPackage);
    const plan=await planRuntimeBackend(target,inputs().sdkPackage,{sdkView:view});
    expect(plan.conflicts).toEqual(expect.arrayContaining([expect.stringContaining("convex/schema.ts")]));expect(await tree(target)).toEqual(before);
  });
});
