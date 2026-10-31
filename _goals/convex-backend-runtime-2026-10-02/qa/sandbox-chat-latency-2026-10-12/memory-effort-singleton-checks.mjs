import {spawn} from 'node:child_process';
import {createWriteStream} from 'node:fs';
import {writeFile,readFile} from 'node:fs/promises';
import path from 'node:path';
const root='/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion';
const qa=path.dirname(new URL(import.meta.url).pathname);
const node='/Users/SaintNick/.codex/tmp/cortex-runtime-toolchain-20261005/node_modules/.bin/node';
const files=['src/domain/memory-direct-recall.ts','tests/unit/runtimeMemory/direct-fact-rule.test.ts','tests/unit/runtimeMemory/query-composition.test.ts','tests/unit/runtimeAgent/whole-recall-composition.test.ts'];
const tests=[...files.slice(1),'tests/unit/runtimeAgent/v8-preparation-read-retention.test.ts','tests/unit/runtimeMemory/memory-effort.test.ts','tests/unit/runtime/latency-trace.test.ts'];
const environment={CORTEX_TEST_ENV_MODE:'explicit',CONVEX_URL:'http://127.0.0.1:9',CONVEX_TEST_MODE:'local',GRAPH_TESTING_ENABLED:'false'};
const definitions={
 tests:[node,['--experimental-vm-modules','node_modules/jest/bin/jest.js','--watchman=false','--runInBand','--forceExit=false','--runTestsByPath',...tests,'--json',`--outputFile=${qa}/memory-effort-singleton-tests.jest.json`]],
 types:[node,['node_modules/typescript/bin/tsc','--noEmit']],
 lint:[node,['node_modules/eslint/bin/eslint.js',...files,'--report-unused-disable-directives']],
 diff:['git',['diff','--check','--',...files]],
};
const suffix=process.env.CORTEX_SINGLETON_CHECK_SUFFIX??'';
if(!/^(?:|[2-9][0-9]*)$/u.test(suffix))throw Error('Invalid receipt suffix');
definitions.tests[1][definitions.tests[1].length-1]=`--outputFile=${qa}/memory-effort-singleton-tests${suffix}.jest.json`;
const selected=process.argv.slice(2);if(selected.some(name=>!definitions[name]))throw Error('Unknown check');
const results=await Promise.all((selected.length?selected:Object.keys(definitions)).map(async name=>{
 const [command,args]=definitions[name],startedAt=new Date().toISOString(),origin=performance.now(),log=createWriteStream(`${qa}/memory-effort-singleton-${name}${suffix}.log`,{flags:'wx'});
 const child=spawn(command,args,{cwd:root,env:{...process.env,...environment,PATH:`${path.dirname(node)}:${process.env.PATH}`},stdio:['ignore','pipe','pipe']});
 child.stdout.pipe(log,{end:false});child.stderr.pipe(log,{end:false});
 const result=await new Promise((resolve,reject)=>{child.once('error',reject);child.once('close',(exitCode,signal)=>resolve({name,command:[command,...args],cwd:root,environment,startedAt,durationMs:Math.round(performance.now()-origin),node:process.version,declaredNpm:'12.2.0',exitCode,signal}));});
 await new Promise(resolve=>log.end(resolve));await writeFile(`${qa}/memory-effort-singleton-${name}${suffix}.json`,JSON.stringify(result,null,2)+'\n',{flag:'wx'});return result;
}));
if(results.some(result=>result.exitCode!==0))process.exitCode=1;
for(const result of results)console.log(JSON.stringify(result));
if(results.some(result=>result.name==='tests')){const data=JSON.parse(await readFile(`${qa}/memory-effort-singleton-tests${suffix}.jest.json`,'utf8'));console.log(JSON.stringify({suites:data.numTotalTestSuites,passedSuites:data.numPassedTestSuites,tests:data.numTotalTests,passed:data.numPassedTests,failed:data.numFailedTests,pending:data.numPendingTests,todo:data.numTodoTests,success:data.success}));}
