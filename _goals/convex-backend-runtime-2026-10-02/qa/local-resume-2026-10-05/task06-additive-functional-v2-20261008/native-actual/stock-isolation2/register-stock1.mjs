import {readFile,writeFile,mkdtemp,chmod,rm} from 'node:fs/promises';
import {join,dirname} from 'node:path';
import {homedir,tmpdir} from 'node:os';
import {pathToFileURL} from 'node:url';
import {spawn,execFile} from 'node:child_process';
import {promisify} from 'node:util';
import assert from 'node:assert/strict';
const q=dirname(new URL(import.meta.url).pathname),out=q,p=JSON.parse(await readFile(join(out,'fixture-pointer.json')));
const s=JSON.parse(await readFile(join(p.privateDirectory,'state.json'))),creds=JSON.parse(await readFile(join(p.privateDirectory,'credentials.json'))),host=join(p.privateDirectory,'project');
assert.equal(s.projectId,3172356);assert.equal(s.deploymentName,'groovy-hound-304');assert.equal(s.retired,undefined);
const token=JSON.parse(await readFile(join(homedir(),'.convex/config.json'))).accessToken;
const target=await import(pathToFileURL('/Users/SaintNick/.codex/tmp/cortex-task06-custom-native-43a8bddd5e2a/project/node_modules/@cortexmemory/cli/dist/utils/init/development-target.js'));
const verified=await target.verifyDisposableDevelopmentTarget({teamId:s.teamId,projectId:s.projectId,deploymentName:s.deploymentName,deploymentUrl:s.url,disposable:true},token);
const listResponse=await fetch('https://api.convex.dev/v1/projects/'+s.projectId+'/list_deployments',{headers:{Authorization:'Bearer '+token},signal:AbortSignal.timeout(15000)});assert.equal(listResponse.status,200);const ds=await listResponse.json();assert.equal(ds.length,1);assert.equal(ds[0].name,s.deploymentName);assert.equal(ds[0].deploymentType,'dev');
const temporary=await mkdtemp(join(tmpdir(),'cortex-task06-stock-diagnostic-'));await chmod(temporary,0o700);const envFile=join(temporary,'target.env');await writeFile(envFile,'CONVEX_DEPLOY_KEY='+creds.deployKey+'\nCONVEX_DEPLOYMENT=dev:'+s.deploymentName+'\n',{mode:0o600});
const args=['dev','--once','--typecheck','enable','--verbose','--env-file',envFile];const start=Date.now();let stdout='',stderr='',timedOut=false,exit,child,progress=[];
const redact=x=>x.replaceAll(creds.adminKey,'[REDACTED]').replaceAll(creds.deployKey,'[REDACTED]');
try{
 const env={...process.env,CONVEX_DEPLOY_KEY:creds.deployKey,CONVEX_DEPLOYMENT:'dev:'+s.deploymentName};for(const k of ['CONVEX_SELF_HOSTED_URL','CONVEX_SELF_HOSTED_ADMIN_KEY','CONVEX_PROVISION_HOST'])delete env[k];env.PATH=dirname(process.execPath)+':'+env.PATH;
 child=spawn(process.execPath,[join(host,'node_modules/convex/bin/main.js'),...args],{cwd:host,env,stdio:['ignore','pipe','pipe']});child.stdout.on('data',b=>stdout+=b);child.stderr.on('data',b=>stderr+=b);
 const timer=setTimeout(()=>{timedOut=true;child.kill('SIGTERM');},120000),force=setTimeout(()=>child.kill('SIGKILL'),125000);
 const interval=setInterval(()=>{const item={elapsedMs:Date.now()-start,pid:child.pid,lastPhase:redact(stderr).split('\n').slice(-3).join('\n').slice(-1000)};progress.push(item);console.log(JSON.stringify(item));},20000);
 try{exit=await new Promise((ok,no)=>{child.once('error',no);child.once('close',(code,signal)=>ok({code,signal}));});}finally{clearTimeout(timer);clearTimeout(force);clearInterval(interval);}
}finally{
 await writeFile(join(out,'stock-registration1.stdout'),redact(stdout));await writeFile(join(out,'stock-registration1.stderr'),redact(stderr));
 await rm(temporary,{recursive:true,force:true});
 const {stdout:ps}=await promisify(execFile)('/bin/ps',['-axo','pid,ppid,etime,command'],{maxBuffer:2097152});const remaining=ps.split('\n').filter(x=>x.includes(p.privateDirectory));
 await writeFile(join(out,'stock-registration1.json'),JSON.stringify({operation:s.operation,projectId:s.projectId,deploymentName:s.deploymentName,verifiedAt:verified.verifiedAt,args:args.map(x=>x===envFile?'[private temporary env file]':x),cwd:host,pid:child?.pid,...exit,timedOut,elapsedMs:Date.now()-start,progress,temporaryEnvRemoved:true,ownedFixtureProcessesRemaining:remaining,credentialsPrinted:false,priorTimeoutPreserved:true},null,2)+'\n');
}
assert.equal(exit?.code,0,'See redacted stock-registration1.stderr');assert.equal(timedOut,false);console.log(JSON.stringify({status:'PASS',pid:child.pid,elapsedMs:Date.now()-start}));
