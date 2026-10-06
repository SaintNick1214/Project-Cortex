/** Credential-free actual installed CLI/compiler discovery and fixture typing. */
import assert from 'node:assert/strict';
import { readFileSync,existsSync } from 'node:fs';
import { resolve,join } from 'node:path';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import vm from 'node:vm';
import { getHeapStatistics } from 'node:v8';
import { repo,fixture,sha256 } from '../scripts/guard.mjs';
import { childToolchain } from '../scripts/child-toolchain.mjs';
const require=createRequire(import.meta.url),ts=require(resolve(repo,'node_modules/typescript'));
const file=resolve(repo,'node_modules/convex/src/cli/lib/typecheck.ts'),source=readFileSync(file,'utf8');
const ast=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS);
const declaration=ast.statements.find(node=>ts.isFunctionDeclaration(node)&&node.name?.text==='findTypeScriptCompilerPath');assert.ok(declaration);
const actualFunction=declaration.getText(ast),js=ts.transpileModule(actualFunction,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const context=vm.createContext({exports:{},path:{join}});vm.runInContext(js,context,{timeout:1000});
const find=context.exports.findTypeScriptCompilerPath,old=resolve(repo,'_goals/convex-backend-runtime-2026-10-02/qa/task03-local-current-delta-2026-10-05/managed-fixture/fixture'),cwd=resolve(fixture,'fixture');
const rootCompilerPresent=existsSync(resolve(repo,'node_modules/.bin/tsc'));assert.equal(rootCompilerPresent,true);
assert.equal(find({exists:path=>existsSync(resolve(old,path))},'tsc'),undefined,'PATH-only hypothesis is insufficient for actual Convex compiler lookup');
const discovered=find({exists:path=>existsSync(resolve(cwd,path))},'tsc');assert.equal(discovered,join('node_modules','typescript','bin','tsc'));
const toolchain=childToolchain();assert.equal(resolve(cwd,discovered),toolchain.projected);
const env={PATH:toolchain.path,HOME:toolchain.home,LANG:'C.UTF-8',NO_COLOR:'1',CI:'1',NODE_OPTIONS:process.env.NODE_OPTIONS??'',TMPDIR:process.env.TMPDIR??'/tmp'};
const resource=()=>({parentHeapLimitBytes:getHeapStatistics().heap_size_limit,parentHeapUsedBytes:getHeapStatistics().used_heap_size,...(process.platform==='linux'?{cgroupMemoryMax:readFileSync('/sys/fs/cgroup/memory.max','utf8').trim(),cgroupMemoryCurrent:readFileSync('/sys/fs/cgroup/memory.current','utf8').trim(),cgroupMemoryEvents:readFileSync('/sys/fs/cgroup/memory.events','utf8').trim()}:{})});
const resourceBefore=resource(),results=[];
for(const [name,args] of [['official-cli-version',[resolve(repo,'node_modules/convex/bin/main.js'),'--version']],['official-cli-help',[resolve(repo,'node_modules/convex/bin/main.js'),'dev','--help']],['projected-compiler-fixture-types',[toolchain.projected,'--project',resolve(cwd,'convex/tsconfig.json'),'--noEmit']]]){
 const result=spawnSync(process.execPath,args,{cwd,env,encoding:'utf8',timeout:60000,maxBuffer:256000});
 if(result.error||result.signal!==null||result.status!==0)process.stderr.write(JSON.stringify({scope:'READ_ONLY_CLI_READINESS_FAILURE',name,argv:[process.execPath,...args],cwd,exitCode:result.status,signal:result.signal,error:result.error?.code,stdout:result.stdout,stderr:result.stderr,resourceBefore,resourceAfter:resource(),priorSuccessfulReadOnlyResults:results})+'\n');
 assert.equal(result.error,undefined,name);assert.equal(result.signal,null,name);assert.equal(result.status,0,result.stderr);
 if(name==='official-cli-version')assert.equal(result.stdout.trim(),'1.46.0');
 if(name==='official-cli-help'){assert.match(result.stdout,/--typecheck/);assert.match(result.stdout,/enable/);assert.match(result.stdout,/--env-file/);}
 results.push({name,argv:[process.execPath,...args],cwd,exitCode:result.status,stdout:result.stdout,stderr:result.stderr});
}
console.log(JSON.stringify({scope:'CREDENTIAL_FREE_ACTUAL_CLI_COMPILER_READINESS',status:'PASS',nodeVersion:process.version,npmVersion:toolchain.npmVersion,compilerVersion:toolchain.compilerVersion,projectedCompilerVersion:toolchain.projectedCompilerVersion,childPathPrefix:resolve(repo,'node_modules/.bin'),runtimeHome:toolchain.home,resourceBefore,resourceAfter:resource(),actualCliSourceSha256:sha256(source),actualCompilerDiscoveryFunctionSha256:sha256(actualFunction),pathOnlyHypothesis:'SUPERSEDED_BY_ACTUAL_CWD_RELATIVE_LOOKUP',oldFixtureCompilerFound:false,newFixtureCompilerFound:discovered,actualExternalRequests:0,serviceDeployments:0,results}));
