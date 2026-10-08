import {spawn} from 'node:child_process';
import {openSync,closeSync,writeFileSync,readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
const [label,...argv]=process.argv.slice(2);
if(!/^task04-model-drift-c3-(extension|regression|extra)-[a-z0-9-]+$/.test(label)||argv.length<2)throw Error('Invalid bounded command label');
const sourcePaths=[argv[1],resolve('work/resume/task04-model-drift-c3-record-command.mjs')];
const hashInputs=()=>sourcePaths.map(path=>({path,sha256:createHash('sha256').update(readFileSync(path)).digest('hex')}));
const pre=hashInputs(),base=resolve('work/resume',label),start=new Date().toISOString();
const out=openSync(base+'.stdout.log','wx',0o600),err=openSync(base+'.stderr.log','wx',0o600);
const child=spawn(argv[0],argv.slice(1),{cwd:process.cwd(),env:process.env,stdio:['ignore',out,err]});
let terminal=false;
function finish(code,signal,spawnError){if(terminal)return;terminal=true;closeSync(out);closeSync(err);const post=hashInputs();writeFileSync(base+'.receipt.json',JSON.stringify({argv,cwd:process.cwd(),startedAt:start,endedAt:new Date().toISOString(),exitCode:code,signal,spawnError,sourcePre:pre,sourcePost:post,sourceUnchanged:JSON.stringify(pre)===JSON.stringify(post),environmentKeysOnly:['PATH','NODE_USE_ENV_PROXY','CORTEX_QA_TASK04_EXISTING_KEY','CORTEX_QA_TASK04_KEY_CHECK_RECEIPT','CONVEX_TEAM_ID','CONVEX_TEAM_API_KEY','CORTEX_QA_TASK04_REVIEW_SHA256'].filter(k=>process.env[k])},null,2)+'\n',{flag:'wx',mode:0o600});process.stdout.write(JSON.stringify({label,exitCode:code,signal,spawnError})+'\n');process.exitCode=code??1;}
child.on('error',error=>finish(null,null,error.code));
child.on('exit',(code,signal)=>finish(code,signal));
