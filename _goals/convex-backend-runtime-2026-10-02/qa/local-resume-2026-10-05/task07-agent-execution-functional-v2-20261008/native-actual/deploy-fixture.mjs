import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {dirname,join} from 'node:path';
import {spawn} from 'node:child_process';
import {openOwnedContext,q} from './common.mjs';
const label=process.argv[2]??'deploy-qualification1';assert.match(label,/^[a-z0-9-]+$/);
const context=await openOwnedContext();
try{
  await context.verifyTarget(label+'-target-verified');
  const args=[join(context.host,'node_modules/convex/bin/main.js'),'dev','--once','--typecheck','enable'];
  const env={...Object.fromEntries(Object.entries(process.env).filter(([key])=>['HOME','PATH','TMPDIR','SHELL','LANG','LC_ALL','TERM','NO_COLOR','CI'].includes(key))),
    CONVEX_DEPLOY_KEY:context.credentials.deployKey,CONVEX_DEPLOYMENT:'dev:'+context.state.deploymentName};
  env.PATH=dirname(process.execPath)+':'+env.PATH;
  const began=Date.now(),child=spawn(process.execPath,args,{cwd:context.host,env,detached:true,stdio:['ignore','pipe','pipe']});
  let stdout='',stderr='',timedOut=false,closed=false;const signals=[];
  child.stdout.on('data',bytes=>stdout+=bytes);child.stderr.on('data',bytes=>stderr+=bytes);
  const signalOwned=signal=>{if(closed)return;try{process.kill(-child.pid,signal);signals.push({signal,ownedGroupFromSpawn:child.pid,at:Date.now()});}
    catch(error){signals.push({signal,error:context.publicError(error)});}};
  const timer=setTimeout(()=>{timedOut=true;signalOwned('SIGTERM');},120000);
  const hard=setTimeout(()=>{if(timedOut)signalOwned('SIGKILL');},125000);
  let exit;
  try{exit=await new Promise((resolve,reject)=>{child.once('error',reject);child.once('close',(code,signal)=>{closed=true;resolve({code,signal});});});}
  finally{clearTimeout(timer);clearTimeout(hard);}
  await writeFile(join(q,label+'.stdout.log'),context.redact(stdout));await writeFile(join(q,label+'.stderr.log'),context.redact(stderr));
  await context.publish(label,{executable:process.execPath,args,cwd:context.host,pid:child.pid,groupOwnedFromSpawn:true,...exit,timedOut,
    deadlineMs:120000,terminationCleanupMs:5000,elapsedMs:Date.now()-began,signals,childClosed:closed,credentialsPrinted:false});
  assert.equal(timedOut,false);assert.equal(exit.code,0,context.redact(stderr).slice(-4000));
  if(label==='deploy-qualification1'){
    const manifest=JSON.parse(await readFile(join(q,'qualification-only-manifest.json'),'utf8'));
    const result=await context.admin.mutation('runtimeModelPolicy:installDeploymentPolicy',{manifestId:manifest.manifestId,expectedRevision:manifest.revision});
    await context.publish('qualification-root-installed',{result,classification:manifest.classification,trust:'exact compiled operator-only provisional fixture',
      productionRegistryChanged:false,actualEvidencePending:true});
  }
}finally{await context.close();}
