import assert from 'node:assert/strict';
import {readFile,writeFile,access,mkdir} from 'node:fs/promises';
import {join,dirname} from 'node:path';
import {spawn} from 'node:child_process';
import {openOwnedContext,qa as q,sha} from './common.mjs';
const c=await openOwnedContext();
try{
 await c.verifyTarget('install-current3-target-verified');
 const baseline=JSON.parse(await readFile(join(q,'installed-task09-source-manifest4.json'))),packed=JSON.parse(await readFile(join(q,'packed-sdk-current3.json')));
 assert.equal(sha(await readFile(packed.file)),packed.sha256);
 const oldRaw=await readFile(join(c.host,'node_modules/@cortexmemory/sdk/dist/backend/v1/manifest.json'));assert.equal(sha(oldRaw),baseline.manifestSha256);
 const old=JSON.parse(oldRaw),incomingRaw=await readFile(join(packed.unpackedBackend,'manifest.json'));assert.equal(sha(incomingRaw),packed.manifestSha256);const incoming=JSON.parse(incomingRaw);assert.equal(incoming.files.length,80);assert.equal(old.files.length,80);const delta=incoming.files.filter(row=>!old.files.some(prior=>prior.path===row.path&&prior.sha256===row.sha256));assert.equal(delta.length,1);assert.ok(delta[0].path==='runtimeAgent.ts'); 
 const functions=join(c.host,c.functionsDirectory),preserved=[],preimages=[];
 for(const file of old.files){assert.equal(sha(await readFile(join(functions,file.path))),file.sha256,'Unexpected existing owned product bytes '+file.path);assert.ok(incoming.files.some(row=>row.path===file.path),'Removed current product file needs explicit handling '+file.path);}
 for(const path of ['convex.json','custom/backend/host.ts','custom/backend/hostNode.ts','custom/backend/http.ts','custom/backend/auth.config.ts','custom/backend/convex.config.ts']){
  const bytes=await readFile(join(c.host,path));preserved.push({path,sha256:sha(bytes),bytes:bytes.length});
 }
 for(const file of incoming.files){const prior=old.files.find(row=>row.path===file.path);if(!prior){let present=true;try{await access(join(functions,file.path));}catch(e){if(e.code==='ENOENT')present=false;else throw e;}assert.equal(present,false,'Unowned new-path collision '+file.path);}
  else if(prior.sha256!==file.sha256){const bytes=await readFile(join(functions,file.path));preimages.push({path:file.path,sha256:sha(bytes),bytes:bytes.length,source:bytes.toString()});}}
 const schema=await readFile(join(functions,'schema.ts'),'utf8');await c.publish('install-current3-preimage',{oldManifestSha256:sha(oldRaw),incomingManifestSha256:sha(incomingRaw),preserved,preimages,schema,fixtureOnlyOwnedUpdate:true});
 const env=Object.fromEntries(Object.entries(process.env).filter(([key])=>['HOME','PATH','TMPDIR','SHELL','LANG','LC_ALL','TERM','NO_COLOR','CI'].includes(key)));env.PATH=dirname(process.execPath)+':'+env.PATH;
 const args=['/Users/SaintNick/.codex/tmp/cortex-runtime-toolchain-20261005/node_modules/npm/bin/npm-cli.js','install',packed.file,'--ignore-scripts','--no-audit','--no-fund'];
 const start=Date.now(),child=spawn(process.execPath,args,{cwd:c.host,env,detached:true,stdio:['ignore','pipe','pipe']});let stdout='',stderr='',closed=false,timedOut=false;
 child.stdout.on('data',b=>stdout+=b);child.stderr.on('data',b=>stderr+=b);
 const timer=setTimeout(()=>{timedOut=true;if(!closed)try{process.kill(-child.pid,'SIGTERM');}catch{}},120000),hard=setTimeout(()=>{if(timedOut&&!closed)try{process.kill(-child.pid,'SIGKILL');}catch{}},125000);
 let exit;try{exit=await new Promise((res,rej)=>{child.once('error',rej);child.once('close',(code,signal)=>{closed=true;res({code,signal});});});}finally{clearTimeout(timer);clearTimeout(hard);}
 await writeFile(join(q,'install-current3.stdout.log'),c.redact(stdout));await writeFile(join(q,'install-current3.stderr.log'),c.redact(stderr));
 await c.publish('install-current3',{...exit,pid:child.pid,timedOut,childClosed:closed,deadlineMs:120000,elapsedMs:Date.now()-start,args,cwd:c.host});assert.equal(timedOut,false);assert.equal(exit.code,0,c.redact(stderr));
 const installed=await readFile(join(c.host,'node_modules/@cortexmemory/sdk/dist/backend/v1/manifest.json'));assert.equal(sha(installed),packed.manifestSha256);
 const files=[];
 for(const file of incoming.files){const bytes=await readFile(join(packed.unpackedBackend,file.path));assert.equal(sha(bytes),file.sha256);const prior=old.files.find(row=>row.path===file.path);if(!prior||prior.sha256!==file.sha256){await mkdir(dirname(join(functions,file.path)),{recursive:true});await writeFile(join(functions,file.path),bytes);}files.push({path:file.path,bytes:bytes.length,sha256:sha(bytes)});}
 const updated=schema;
 for(const pin of preserved)assert.equal(sha(await readFile(join(c.host,pin.path))),pin.sha256,'Unrelated host file changed '+pin.path);
 await c.publish('installed-task09-source-manifest5',{projectId:c.state.projectId,manifestSha256:packed.manifestSha256,packed,files,preserved,
  schema:{path:'schema.ts',bytes:Buffer.byteLength(updated),sha256:sha(updated)},compiledDefaultUnchanged:true,qualificationTrustException:false,qualificationApplicability:{modelEnvelopeCodecAliasInputResultAccounting:'unchanged',runtimeAdapterPersistenceTiming:'unchanged from installed manifest4',observerTerminalProjection:'changed; existing unpaid overflow/cancel readback required',oldUnknownTurn:'never retried'},task07BaselinePreserved:'baseline-packages.json',
  changedPaths:incoming.files.filter(row=>!old.files.some(prior=>prior.path===row.path&&prior.sha256===row.sha256)).map(row=>row.path),fixtureOnlyUpdate:true});
}finally{await c.close();}
