import assert from 'node:assert/strict';
import {readFile,writeFile,access} from 'node:fs/promises';
import {join,dirname} from 'node:path';
import {spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
const q=dirname(new URL(import.meta.url).pathname),repo='/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion',site='/Users/SaintNick/Documents/Cortex/cortexmemory.dev/docs-site',output='/Users/SaintNick/.codex/tmp/cortex-backend-runtime-docs-build3-20261009',npm='/Users/SaintNick/.codex/tmp/cortex-runtime-toolchain-20261005/node_modules/npm/bin/npm-cli.js',sha=value=>createHash('sha256').update(value).digest('hex');
const source=JSON.parse(await readFile(join(q,'website-context3.json')));assert.equal(sha(await readFile(source.doc)),source.sha256);let exists=true;try{await access(output);}catch(error){if(error.code==='ENOENT')exists=false;else throw error;}assert.equal(exists,false,'preserve prior builds');
const checks=[];
async function run(name,cwd,args) {
 const start=Date.now(),env={...Object.fromEntries(Object.entries(process.env).filter(([key])=>['HOME','PATH','TMPDIR','SHELL','LANG','LC_ALL','NO_COLOR','CI'].includes(key))),NODE_OPTIONS:'--max-old-space-size=6144'};env.PATH=dirname(process.execPath)+':'+env.PATH;
 const child=spawn(process.execPath,args,{cwd,env,detached:true,stdio:['ignore','pipe','pipe']});let bytes='',closed=false,timedOut=false;child.stdout.on('data',value=>bytes+=value);child.stderr.on('data',value=>bytes+=value);const signal=value=>{if(!closed)try{process.kill(-child.pid,value);}catch{}};
 const timer=setTimeout(()=>{timedOut=true;signal('SIGTERM');},120000),hard=setTimeout(()=>{if(timedOut)signal('SIGKILL');},125000);let exit;
 try{exit=await new Promise((resolve,reject)=>{child.once('error',reject);child.once('close',(code,signal)=>{closed=true;resolve({exit:code,signal});});});}finally{clearTimeout(timer);clearTimeout(hard);}
 const log=join(q,name+'.log');await writeFile(log,bytes,{flag:'wx'});checks.push({name,cwd,command:[process.execPath,...args],...exit,timedOut,elapsedMs:Date.now()-start,ownedChildClosed:closed,log,sha256:sha(bytes)});assert.equal(exit.exit,0,bytes.slice(-2000));assert.equal(timedOut,false);
}
try {
 await run('typescript-examples3',repo,['node_modules/typescript/bin/tsc','--noEmit','--project',join(q,'examples-tsconfig2.json')]);
 await run('website-build3',site,[npm,'run','build','--','--out-dir',output]);
 assert.equal(sha(await readFile(source.doc)),source.sha256);
 await writeFile(join(q,'checks3.json'),JSON.stringify({createdAtUtc:new Date().toISOString(),node:process.version,npm:'12.2.0',checks,source3:source,actualServiceCalls:0,actualWebsiteBrowser:false,productionDeploy:false,packagePublish:false,preservedBuild2:true,originalTask17Accepted:false},null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({status:'WEBSITE_SOURCE3_EXAMPLES_AND_BUILD_PASS',checks:2,output,modelCalls:0}));
}catch(error){await writeFile(join(q,'checks3.json'),JSON.stringify({status:'FAIL',checks,error:{name:error.name,message:error.message},modelCalls:0},null,2)+'\n',{flag:'wx'});throw error;}
