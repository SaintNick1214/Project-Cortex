/** Exact owned fixture update to shipped registry9; no trust exception or financial changes. */
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {join,dirname} from 'node:path';
import {spawn} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {q,root,sha,openOwnedContext} from './common.mjs';
const c=await openOwnedContext();
try{
 await c.verifyTarget('install-shipped9-target-verified');
 const packed=JSON.parse(await readFile(join(q,'packed-sdk-shipped9.json'))),prior=JSON.parse(await readFile(join(q,'observed-fixture-source-manifest2.json'))),old=JSON.parse(await readFile(join(q,'packed-sdk-current1.json'))),fn=join(c.host,c.functionsDirectory);
 assert.equal(sha(await readFile(packed.file)),packed.sha256);
 for(const row of prior.files)assert.equal(sha(await readFile(join(fn,row.path))),row.sha256,'Owned fixture preimage changed '+row.path);
 const oldManifest=JSON.parse(await readFile(join(old.unpackedBackend,'manifest.json'))),incoming=JSON.parse(await readFile(join(packed.unpackedBackend,'manifest.json')));
 assert.equal(incoming.files.length,80);assert.equal(incoming.tables.length,52);assert.deepEqual(incoming.components,['agent','workflow']);
 const changed=incoming.files.filter(row=>oldManifest.files.find(prior=>prior.path===row.path)?.sha256!==row.sha256).map(row=>row.path).sort();assert.deepEqual(changed,['runtimeGatewayQualifications.ts','runtimeModelPolicyBootstrap.ts']);
 const protectedPaths=['convex.json','custom/backend/host.ts','custom/backend/hostNode.ts','custom/backend/http.ts','custom/backend/auth.config.ts','custom/backend/convex.config.ts','custom/backend/schema.ts'],preserved=[];
 for(const path of protectedPaths)preserved.push({path,sha256:sha(await readFile(join(c.host,path)))});
 const preimages=[];for(const path of changed){const bytes=await readFile(join(fn,path));preimages.push({path,bytes:bytes.length,sha256:sha(bytes),source:bytes.toString()});}
 await c.publish('install-shipped9-preimages',{preimages,preserved,incomingManifestSha256:packed.manifestSha256,onlyOwnedTwoProductFilesChanged:true});
 const npm='/Users/SaintNick/.codex/tmp/cortex-runtime-toolchain-20261005/node_modules/npm/bin/npm-cli.js',args=[npm,'install',packed.file,'--ignore-scripts','--no-audit','--no-fund'];
 const env=Object.fromEntries(Object.entries(process.env).filter(([key])=>['HOME','PATH','TMPDIR','SHELL','LANG','LC_ALL','TERM','NO_COLOR','CI'].includes(key)));env.PATH=dirname(process.execPath)+':'+env.PATH;
 const started=Date.now(),child=spawn(process.execPath,args,{cwd:c.host,env,detached:true,stdio:['ignore','pipe','pipe']});let stdout='',stderr='',closed=false,timedOut=false;
 child.stdout.on('data',b=>stdout+=b);child.stderr.on('data',b=>stderr+=b);const timer=setTimeout(()=>{timedOut=true;if(!closed)try{process.kill(-child.pid,'SIGTERM');}catch{}},120000),hard=setTimeout(()=>{if(timedOut&&!closed)try{process.kill(-child.pid,'SIGKILL');}catch{}},125000);
 let exit;try{exit=await new Promise((resolve,reject)=>{child.once('error',reject);child.once('close',(code,signal)=>{closed=true;resolve({code,signal});});});}finally{clearTimeout(timer);clearTimeout(hard);}
 await writeFile(join(q,'install-shipped9.stdout.log'),c.redact(stdout));await writeFile(join(q,'install-shipped9.stderr.log'),c.redact(stderr));await c.publish('install-shipped9',{executable:process.execPath,args,cwd:c.host,pid:child.pid,...exit,timedOut,childClosed:closed,deadlineMs:120000,elapsedMs:Date.now()-started});assert.equal(exit.code,0);assert.equal(timedOut,false);
 assert.equal(sha(await readFile(join(c.host,'node_modules/@cortexmemory/sdk/dist/backend/v1/manifest.json'))),packed.manifestSha256);
 for(const path of changed)await writeFile(join(fn,path),await readFile(join(packed.unpackedBackend,path)));
 for(const row of preserved)assert.equal(sha(await readFile(join(c.host,row.path))),row.sha256);
 const files=[];for(const row of incoming.files){const bytes=await readFile(join(fn,row.path));assert.equal(sha(bytes),row.sha256);files.push({path:row.path,bytes:bytes.length,sha256:sha(bytes)});}
 const bootstrap=await readFile(join(fn,'runtimeModelPolicyBootstrap.ts'),'utf8');assert.ok(!bootstrap.includes('smallProfileManifest'));assert.ok(!bootstrap.includes('fixtureManifest'));assert.ok(!bootstrap.includes('fixture-synthetic operator'));
 const ts=await import(pathToFileURL(join(root,'node_modules/typescript/lib/typescript.js'))),data=ts.transpileModule(await readFile(join(fn,'runtimeGatewayQualifications.ts'),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2021,module:ts.ModuleKind.ES2022}}).outputText;
 const exports=await import('data:text/javascript;base64,'+Buffer.from(data).toString('base64'));
 assert.equal(exports.DEFAULT_GATEWAY_POLICY_MANIFEST.revision,9);assert.equal(exports.AGENT_GATEWAY_POLICY_MANIFEST_V5.revision,5);
 assert.deepEqual(exports.DEFAULT_GATEWAY_POLICY_MANIFEST.qualifications.slice(0,4),exports.AGENT_GATEWAY_POLICY_MANIFEST_V5.qualifications);assert.deepEqual(exports.DEFAULT_GATEWAY_POLICY_MANIFEST.dispatchEvidence.slice(0,4),exports.AGENT_GATEWAY_POLICY_MANIFEST_V5.dispatchEvidence);
 await c.publish('shipped-default-manifest9',exports.DEFAULT_GATEWAY_POLICY_MANIFEST);
 await c.publish('installed-shipped9-source-manifest1',{status:'PASS',projectId:c.state.projectId,packed,files,preserved,changedPaths:changed,productBootstrapExact:true,syntheticTrustAllowance:false,oldV5LookupPreserved:true,oldFourObjectsExact:true,defaultSmall:true});
}finally{await c.close();}
