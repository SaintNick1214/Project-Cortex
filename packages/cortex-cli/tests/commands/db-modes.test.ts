import { afterEach, expect, it, jest } from "@jest/globals";
import { Command } from "commander";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
const operator = jest.fn(async (_options: unknown, _intent: unknown) => ({ retired: true }));
const nativeExport = jest.fn(async (_config: unknown, _options: unknown) => undefined);
const metadata = jest.fn(async (_config: unknown, _options: unknown, callback: (client: unknown) => Promise<unknown>) => callback({auth:{userId:"verified",tenantId:"owned"},memorySpaces:{list:async()=>({spaces:[{id:"owned-space"}]})},users:{list:async()=>({users:[{id:"verified"}]})}}));
jest.unstable_mockModule("../../src/utils/operator.js", () => ({runOperator:operator}));
jest.unstable_mockModule("../../src/utils/client.js", () => ({withClient:metadata, acquireForegroundSignalHandler:jest.fn(), setupClientCleanup:jest.fn(), createClient:jest.fn(),disposeClient:jest.fn()}));
jest.unstable_mockModule("../../src/utils/management.js", () => ({exportSnapshot:nativeExport,importSnapshot:jest.fn(),nativeOperation:jest.fn(),retired:(message:string)=>{throw new Error(message);},resolveNativeTarget:jest.fn(),targetOptions:(command:Command)=>command.option("--local").option("--prod").option("--env-file <file>").option("--project <directory>")}));
const {registerDbCommands} = await import("../../src/commands/db.js");
const config = {deployments:{},default:"",format:"json" as const,confirmDangerous:true};
const directories:string[]=[];
const log=jest.spyOn(console,"log").mockImplementation(()=>undefined);
function program(){const p=new Command().exitOverride();registerDbCommands(p,config);return p;}
afterEach(async()=>{operator.mockClear();nativeExport.mockClear();metadata.mockClear();log.mockClear();for(const directory of directories.splice(0))await fs.rm(directory,{recursive:true,force:true});});
it.each(["retire-scope","clear"])("%s requires the entire guarded retirement intent before dispatch",async name=>{
  for(const flags of [[],["--target","identity.json","--yes"],["--tenant-id","tenant","--memory-space-id","space","--yes"]])await expect(program().parseAsync(["node","test","db",name,...flags])).rejects.toThrow("GLOBAL_CLEAR_RETIRED");
  expect(operator).not.toHaveBeenCalled();
  await program().parseAsync(["node","test","db",name,"--target","identity.json","--tenant-id","tenant","--memory-space-id","space","--yes"]);
  expect(operator).toHaveBeenCalledTimes(1);expect(operator).toHaveBeenCalledWith(expect.objectContaining({target:"identity.json"}),{kind:"retireScope",tenantId:"tenant",memorySpaceId:"space"});
});
it("native export keeps ZIP mode and metadata alias writes exactly one private bounded JSON",async()=>{
  await program().parseAsync(["node","test","db","export","--output","snapshot.zip"]);
  expect(nativeExport).toHaveBeenCalledTimes(1);expect(metadata).not.toHaveBeenCalled();
  const directory=await fs.mkdtemp(path.join(os.tmpdir(),"cortex-db-mode-"));directories.push(directory);const output=path.join(directory,"metadata.json");
  await program().parseAsync(["node","test","db","export","--metadata","--output",output]);
  expect(nativeExport).toHaveBeenCalledTimes(1);expect(metadata).toHaveBeenCalledTimes(1);
  expect(JSON.parse(await fs.readFile(output,"utf8"))).toMatchObject({restorable:false,scope:{userId:"verified",tenantId:"owned"}});
  expect((await fs.stat(output)).mode&0o777).toBe(0o600);
  await expect(program().parseAsync(["node","test","db","export-metadata","--output",output])).rejects.toMatchObject({code:"EEXIST"});
});
it.each(["--local","--prod","--include-file-storage"])("metadata mode refuses native %s without either dispatch",async flag=>{
  await expect(program().parseAsync(["node","test","db","export","--metadata",flag])).rejects.toThrow("METADATA_EXPORT_MODE_CONFLICT");
  expect(nativeExport).not.toHaveBeenCalled();expect(metadata).not.toHaveBeenCalled();
});
