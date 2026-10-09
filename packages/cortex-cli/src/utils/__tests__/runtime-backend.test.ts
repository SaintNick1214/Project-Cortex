import { afterEach, expect, it } from "@jest/globals";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { planRuntimeBackend, applySelectedBackendPlan } from "../runtime-backend.js";
import { readTemplateBackendCandidate } from "../templates/resolver.js";
import { installSdk } from "../install.js";
const repository = fileURLToPath(new URL("../../../../../", import.meta.url));
const roots: string[] = [];
afterEach(async()=>{for(const root of roots.splice(0))await fs.rm(root,{recursive:true,force:true});});
async function root(){const directory=await fs.mkdtemp(path.join(os.tmpdir(),"cortex-runtime-compose-"));roots.push(directory);return directory;}
it("the actual built distribution composes private app tables and guarded public runtime without raw SDK rewrite",async()=>{
  const directory=await root(),host=path.join(directory,"host");
  const view=await readTemplateBackendCandidate(repository);
  const app=await fs.readFile(path.join(repository,"packages/cortex-cli/templates/chat-sdk-quickstart/convex/app.schema.ts"));
  const registration=Buffer.from('export { internalQuery as query, internalMutation as mutation } from "./_generated/server";\n');
  const schema=Buffer.from('import { defineSchema } from "convex/server"; import appSchema from "./app.schema"; export default defineSchema({ ...appSchema.tables }, { schemaValidation: true });\n');
  const prospective=new Map([["convex/schema.ts",schema],["convex/app.schema.ts",app],["convex/sdk.registration.ts",registration]]);
  const plan=await planRuntimeBackend(host,repository,{prospectiveFiles:prospective,sdkView:view});
  expect(plan.conflicts).toEqual([]);expect(await fs.stat(host).then(()=>true,()=>false)).toBe(false);
  expect(plan.files["schema.ts"].toString()).toContain("...appSchema.tables");expect(plan.files["schema.ts"].toString()).toContain("...cortexTablesV1");
  expect(plan.files["runtimeClient.ts"].toString()).toContain("./_generated/server");expect(plan.files["runtimeClient.ts"].toString()).not.toContain("./sdk.registration");
  expect(Object.keys(plan.files)).toContain("cliOperator/immutable.ts");expect(plan.files["cliOperator/immutable.ts"].toString()).toContain("../lib/operatorBoundary");
  await applySelectedBackendPlan(plan,{dryRun:true});expect(await fs.stat(host).then(()=>true,()=>false)).toBe(false);
  for(const [name,bytes] of prospective){await fs.mkdir(path.dirname(path.join(host,name)),{recursive:true});await fs.writeFile(path.join(host,name),bytes);}
  await fs.writeFile(path.join(host,"sentinel.txt"),"unrelated");
  await applySelectedBackendPlan(plan);
  expect(await fs.readFile(path.join(host,"convex/sdk.registration.ts"))).toEqual(registration);
  expect(await fs.readFile(path.join(host,"convex/app.schema.ts"))).toEqual(app);
  expect(await fs.readFile(path.join(host,"sentinel.txt"),"utf8")).toBe("unrelated");
  expect((await planRuntimeBackend(host,repository)).runtime.changes).toEqual([]);
});
it("changed current distribution bytes fail validation before destination writes",async()=>{
  const directory=await root(),host=path.join(directory,"host"),view=await readTemplateBackendCandidate(repository);
  view.distribution!["runtimeClient.ts"]=Buffer.from("unguarded substituted source");
  await expect(planRuntimeBackend(host,repository,{sdkView:view})).rejects.toThrow("digest mismatch");
  expect(await fs.stat(host).then(()=>true,()=>false)).toBe(false);
});

it("a private app-schema edit after planning cannot conceal a runtime collision or write any backend source", async () => {
  const directory=await root(),host=path.join(directory,"host");await fs.mkdir(path.join(host,"convex"),{recursive:true});
  await fs.writeFile(path.join(host,"convex/schema.ts"),'import { defineSchema } from "convex/server"; import appSchema from "./app.schema"; export default defineSchema({ ...appSchema.tables });');
  const file=path.join(host,"convex/app.schema.ts");await fs.writeFile(file,'export default defineSchema({ appOnly: defineTable({}) });');
  const plan=await planRuntimeBackend(host,repository);
  await fs.writeFile(file,'export default defineSchema({ runtimeRuns: defineTable({}) });');
  await expect(applySelectedBackendPlan(plan)).rejects.toThrow("Host file changed");
  expect(await fs.stat(path.join(host,"convex/runtimeClient.ts")).then(()=>true,()=>false)).toBe(false);
});

it("an existing host cannot shadow qualified runtime dependencies with dev or optional versions", async () => {
  const host=await root();
  const before={name:"host",dependencies:{unrelated:"^1.0.0"},devDependencies:{ai:"^6.0.0",convex:"0.1.0",typescript:"~6.0.3"},optionalDependencies:{ai:"^5.0.0","fast-sha256":"0.9.0",otherOptional:"^2.0.0"}};
  await fs.writeFile(path.join(host,"package.json"),JSON.stringify(before));
  await installSdk(host,{sdkPackage:repository,install:false,deploy:false});
  const manifest=JSON.parse(await fs.readFile(path.join(host,"package.json"),"utf8"));
  expect(manifest.dependencies.ai).toBe("7.0.127");
  expect(manifest.dependencies["fast-sha256"]).toBe("1.3.0");
  expect(manifest.devDependencies).toEqual({typescript:"~6.0.3"});
  expect(manifest.optionalDependencies).toEqual({otherOptional:"^2.0.0"});
  expect(manifest.dependencies.unrelated).toBe(before.dependencies.unrelated);
});

it.each([
  {overrides:{ai:"6.0.0"}},
  {overrides:{"ai@^7.0.0":{".":"6.0.0"}}},
  {overrides:{unrelated:{ai:"6.0.0"}}},
  {pnpm:{overrides:{"parent>ai":"6.0.0"}}},
])("a selected runtime override refuses the actual installer before any host write: %j",async (override)=>{
  const host=await root(),manifest={name:"host",dependencies:{unrelated:"^1.0.0"},...override};
  const bytes=JSON.stringify(manifest);await fs.writeFile(path.join(host,"package.json"),bytes);
  await fs.writeFile(path.join(host,"sentinel.txt"),"preserve");
  await expect(installSdk(host,{sdkPackage:repository,install:false,deploy:false})).rejects.toThrow("RUNTIME_DEPENDENCY_OVERRIDE");
  expect(await fs.readFile(path.join(host,"package.json"),"utf8")).toBe(bytes);
  expect((await fs.readdir(host)).sort()).toEqual(["package.json","sentinel.txt"]);
});

it("qualified exact and direct-reference overrides preserve unrelated host override configuration",async()=>{
  const host=await root(),overrides={ai:"$ai","fast-sha256":{".":"1.3.0"},unrelated:"^2.0.0"},pnpm={overrides:{"parent>ai":"7.0.127",other:"^3.0.0"}};
  await fs.writeFile(path.join(host,"package.json"),JSON.stringify({name:"host",overrides,pnpm}));
  await installSdk(host,{sdkPackage:repository,install:false,deploy:false});
  const manifest=JSON.parse(await fs.readFile(path.join(host,"package.json"),"utf8"));
  expect(manifest.dependencies.ai).toBe("7.0.127");expect(manifest.overrides).toEqual(overrides);expect(manifest.pnpm).toEqual(pnpm);
});
