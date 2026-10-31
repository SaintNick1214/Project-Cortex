import {spawn} from 'node:child_process';
import {mkdir,writeFile} from 'node:fs/promises';
import {createWriteStream} from 'node:fs';
import {dirname,join} from 'node:path';
const q=dirname(new URL(import.meta.url).pathname),r='/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion';
await mkdir(join(q,'logs'),{recursive:true});
const jobs=[
 {name:'affected1',cwd:join(r,'packages/cortex-cli'),args:['--experimental-vm-modules',join(r,'node_modules/jest/bin/jest.js'),'--selectProjects','unit','--testPathPatterns=additive-backend.test.ts','--runInBand','--json','--outputFile='+join(q,'affected1-results.json')]},
 {name:'types1',cwd:join(r,'packages/cortex-cli'),args:[join(r,'node_modules/typescript/bin/tsc'),'--noEmit']},
 {name:'lint1',cwd:join(r,'packages/cortex-cli'),args:[join(r,'node_modules/eslint/bin/eslint.js'),'src/utils/init/additive-backend.ts','src/utils/__tests__/additive-backend.test.ts','--report-unused-disable-directives']}
];
const results=await Promise.all(jobs.map(async job=>{
 const started=performance.now(),out=createWriteStream(join(q,'logs',job.name+'.stdout.log'),{flags:'wx'}),err=createWriteStream(join(q,'logs',job.name+'.stderr.log'),{flags:'wx'});
 const child=spawn(process.execPath,job.args,{cwd:job.cwd,stdio:['ignore',out,err]});
 let timedOut=false;const timeout=setTimeout(()=>{timedOut=true;child.kill('SIGTERM');},120000),force=setTimeout(()=>child.kill('SIGKILL'),125000);
 const result=await new Promise(resolve=>{child.once('close',(exitCode,signal)=>resolve({exitCode,signal}));child.once('error',error=>resolve({error:error.message}));});
 clearTimeout(timeout);clearTimeout(force);out.end();err.end();
 const record={...job,node:process.execPath,pid:child.pid,deadlineMs:120000,timedOut,...result,elapsedMs:performance.now()-started,childClosed:true};
 await writeFile(join(q,job.name+'.receipt.json'),JSON.stringify(record,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify(record));return record;
}));
await writeFile(join(q,'checks1.json'),JSON.stringify({scope:'CLI_HTTP_AFFECTED',results},null,2)+'\n',{flag:'wx'});
if(results.some(r=>r.exitCode!==0||r.timedOut))process.exitCode=1;
