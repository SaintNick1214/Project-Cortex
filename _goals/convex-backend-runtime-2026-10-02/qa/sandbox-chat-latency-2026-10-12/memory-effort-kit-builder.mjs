/** Prepare source controls only; Root runs accepted-commit packaging/native qualification later. */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
export const Q=path.dirname(fileURLToPath(import.meta.url));
export const R=path.resolve(Q,'../../../..');
const P='/Users/SaintNick/Documents/Cortex/Project-Cortex-Proofs';
const priorCommit='f87695783e8b21ffecf6298057a87cd8e69a3016';
const oldName='manual-sandbox-native-snapshot-2026-10-14',newName='manual-sandbox-memory-effort-2026-10-14';
export const KIT=path.join(P,newName),CHECKS=path.join(Q,'memory-effort-kit-checks');
const oldKit=path.join(P,oldName),oldChecks=path.join(Q,'kit-checks-native-snapshot');
export const REGISTRY_HASH='5152bd0c3f8e35907c2d57c0a3467e2450e8db0dfb5174c552024c954554a515';
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
const read=file=>{assert(fs.lstatSync(file).isFile(),file);return fs.readFileSync(file,'utf8');};
function once(text,before,after){assert.equal(text.split(before).length,2,'Changed adaptation anchor: '+before.slice(0,100));return text.replace(before,after);}
function common(text,commit){return text.replaceAll(oldName,newName).replaceAll('kit-checks-native-snapshot','memory-effort-kit-checks').replaceAll(priorCommit,commit).replaceAll('cortex-sandbox-native-snapshot:20261014','cortex-sandbox-memory-effort:20261014');}
export function runtimeCandidate(text){
 const oldCatalog="const catalog = { version: 3, tools: { 'memory.remember': 1, 'memory.recall': 1, 'media.image.generate': 1, 'media.video.generate': 1, 'artifact.read': 1 }, contexts: { 'cortex.transcript': 1, 'cortex.transcript.relevant': 1 } };";
 text=once(text,oldCatalog,oldCatalog.replace('version: 3','version: 4').replace("'cortex.transcript.relevant': 1","'cortex.transcript.relevant': 2"));
 text=once(text,'const registryHash = sha(canonical(catalog));',`const registryHash = sha(canonical(catalog));\n  assert.equal(registryHash, '${REGISTRY_HASH}');`);
 text=once(text,"handlerId: 'cortex.transcript.relevant', handlerVersion: 1","handlerId: 'cortex.transcript.relevant', handlerVersion: 2");
 text=once(text,'inputSelection: { version: 1, recentMessages: 4, relevantMemories: 4, relevantFacts: 4, pendingEntries: 4, maxMessages: 16 }','inputSelection: { version: 2 }');
 text=once(text,'assert.equal(current.definitionHash, published.definitionHash);','assert.equal(current.definitionHash, published.definitionHash);\n  assert.equal(current.inputSelectionVersion, 2); assert.equal(current.memoryEffortPolicyVersion, 1);');
 text=once(text,'approvalConversationId: conversation.conversationId, conversationInputApprovalRequired: true, toolApproval:', 'inputSelectionVersion: 2, memoryEffortPolicyVersion: 1,\n    approvalConversationId: conversation.conversationId, conversationInputApprovalRequired: true, toolApproval:');
 // The fixture is internal, temporary-host-only and contains no inference calls. It is absent from all package archives.
 text=once(text,"  await deploy(session, ctx, 'initial-host-deploy', key);", "  const effortFixture = await readFile(join(ctx.kit, 'fixtures/memoryEffortQualification.ts'), 'utf8');\n  await writeFile(join(functions, 'memoryEffortQualification.ts'), effortFixture);\n  await ctx.receipt('memory-effort-fixture-installed', { sha256: sha(effortFixture), internalOnly: true, paidCalls: 0 });\n  await deploy(session, ctx, 'initial-host-deploy', key);");
 return text;
}
export function fixtureCandidate(text){
 text=text.replaceAll('../src/domain/memory-effort','./_cortex/shared/domain/memory_effort').replaceAll('../src/domain/sources','./_cortex/shared/domain/sources');
 assert(!text.includes('../src/'));
 assert(!/export const \w+\s*=\s*(?:action|query|mutation)\s*\(/.test(text),'Fixture must remain internal');
 for(const name of ['seed','traverse','changeBridge','delivery'])assert(new RegExp('export const '+name+' = internal(?:Mutation|Query)').test(text));
 return text;
}
export function buildPlan(commit='SOURCE_COMMIT_PENDING',runtimeSource=read(path.join(P,'sandbox-env/runtime.mjs'))){
 assert(commit==='SOURCE_COMMIT_PENDING'||/^[a-f0-9]{40}$/.test(commit));
 const at=relative=>commit==='SOURCE_COMMIT_PENDING'?read(path.join(R,relative)):execFileSync('git',['show',commit+':'+relative],{cwd:R,encoding:'utf8',maxBuffer:12*1024*1024});
 for(const [file,version]of [['package.json','0.39.0'],['packages/cortex-cli/package.json','0.39.0'],['packages/vercel-ai-provider/package.json','0.39.0'],['packages/cortex-templates/package.json','1.4.0'],['packages/cortex-cli/templates/basic/package.json','1.5.0'],['packages/cortex-cli/templates/chat-sdk-quickstart/package.json','1.5.0'],['packages/vercel-ai-provider/quickstart/package.json','1.5.0']])assert.equal(JSON.parse(at(file)).version,version,file);
 const catalog=JSON.parse(at('packages/cortex-templates/catalog.json'));
 assert.equal(catalog.version,'1.4.0');assert.equal(catalog.templates.length,18);
 const selected=Object.fromEntries(['basic','chat-sdk','vercel-ai-quickstart'].map(id=>[id,catalog.templates.find(row=>row.id===id&&row.version==='1.5.0')]));
 assert(Object.values(selected).every(Boolean));
 const planned=[];
 const add=(root,name,text,origin)=>planned.push({root,name,text,origin,sha256:digest(text)});
 for(const name of ['prepare.mjs','image/Dockerfile','image/install-candidates.mjs','image/entrypoint.mjs']){
  const origin=path.join(oldKit,name);let text=common(read(origin),commit).replaceAll('1.3.3','1.4.0');
  if(name==='prepare.mjs')text=once(text,'manifest.files.length !== 170','manifest.files.length !== 173');
  add('kit',name,text,origin);
 }
 for(const name of ['run-consumers.mjs','build-image.mjs','verify-actual-packed-public-contracts.mjs','verify-packed-dependent-contracts.mjs','verify-packed-backend-export-closure.mjs','verify-packed-template-catalog.mjs']){
  const origin=path.join(oldChecks,name);let text=common(read(origin),commit);
  if(name==='build-image.mjs')text=once(text,'receipt.backend.files, 170','receipt.backend.files, 173');
  if(name==='verify-actual-packed-public-contracts.mjs'){
   text=text.replaceAll('receipt.backend.files, 170','receipt.backend.files, 173').replaceAll('manifest.files.length, 170','manifest.files.length, 173').replaceAll('manifest.tables.length, 78','manifest.tables.length, 79');
   text=once(text,"assert.equal(typeof runtime.CortexRuntimeClient, 'function');","assert.equal(typeof runtime.CortexRuntimeClient, 'function');\n    assert.deepEqual(runtime.normalizeMemoryEffortRequest({}), {effort:'normal'});\n    assert.equal(runtime.resolveMemoryEffortPolicy({effort:'max'}).maxDepth, null);\n    assert.equal(typeof runtime.runtimeMemoryEffortTrace, 'function');");
   text=once(text,'type RuntimeRememberResult} from','type RuntimeRememberResult, type MemoryEffortRequest, type RuntimeRecallRequest} from');
   text=once(text,'      const combined: RuntimeAdmissionResult =',"      const requestedMemory: MemoryEffortRequest = {effort:'max'};\n      const effortRecall: RuntimeRecallRequest = {text:'facts',requestId:'effort',memory:requestedMemory};\n      const recalled = await client.recall(effortRecall); recalled.memoryEffort?.stopReasons; recalled.items[0]?.retrieval?.path;\n      const combined: RuntimeAdmissionResult =");
  }
  if(name==='verify-packed-dependent-contracts.mjs'){
   text=once(text,"{client, agentId:'agent', agentVersion:1, onObservation:","{client, agentId:'agent', agentVersion:1, memory:{effort:'normal'}, onObservation:");
   text=once(text,'value.run.responseStatus; value.approvals;','value.run.responseStatus; value.run.memoryEffort?.effectiveEffort; value.approvals;');
  }
  if(name==='verify-packed-backend-export-closure.mjs'){
   for(const anchor of ['const paths=[','const newFiles=['])text=once(text,anchor,anchor+"'src/domain/memory-effort.ts','src/domain/memory-traversal.ts','convex-dev/runtimeMemoryTraversal.ts',");
   text=once(text,"'EXECUTABLE_REGISTRY_V3','executableRegistryHashV3'","'EXECUTABLE_REGISTRY_V3','executableRegistryHashV3','EXECUTABLE_REGISTRY_V4','executableRegistryHashV4'");
  }
  if(name==='verify-packed-template-catalog.mjs'){
   text=text.replaceAll("'1.3.3'","'1.4.0'").replaceAll("'1.4.2'","'1.5.0'").replaceAll('/1.4.2','/1.5.0');
   text=once(text,'target.files.length,74','target.files.length,'+selected['vercel-ai-quickstart'].files.length);
   text=once(text,'basic.files.length,38','basic.files.length,'+selected.basic.files.length);
   text=text.replaceAll('b8a0e0ba1e266ec68abe45c0c0ae2dee16f963a35bd3805dd1c564cd98db99c1',selected.basic.payloadHash).replaceAll('ec60588d69878eb8f8ea45f53e0844e7b619ca183416fc62e4182942df3e0025',selected['vercel-ai-quickstart'].payloadHash);
   text=once(text,'assert.equal(catalog.templates.length,15);','assert.equal(catalog.templates.length,18);\n const k29=JSON.parse(execFileSync(\'git\',[\'show\',\''+priorCommit+':packages/cortex-templates/catalog.json\'],{cwd:r,maxBuffer:3*1024*1024}));\n for(const prior of k29.templates)assert.deepEqual(catalog.templates.find(t=>t.id===prior.id&&t.version===prior.version),prior);');
   text=once(text,'totalDescriptors:15','totalDescriptors:18');
   text=once(text,' const ast=ts.createSourceFile',` const chat=catalog.templates.find(row=>row.id==='chat-sdk'&&row.version==='1.5.0');assert(chat);const chatBytes=new Map();
 for(const file of chat.files){const physical=file.storagePath??file.path;assert(!physical.startsWith('/')&&!physical.split('/').includes('..'));const b=fs.readFileSync(path.join(base,'payloads/chat-sdk/1.5.0',physical));assert.equal(digest(b),file.hash);const original=execFileSync('git',['show',commit+':packages/cortex-cli/templates/chat-sdk-quickstart/'+file.path],{cwd:r,maxBuffer:3*1024*1024});if(file.path==='package.json'){const app=JSON.parse(original);app.dependencies['@cortexmemory/sdk']='^0.39.0';app.dependencies['@cortexmemory/vercel-ai-provider']='^0.39.0';assert.deepEqual(b,Buffer.from(stableJson(app)+'\\n'));}else assert.deepEqual(b,original);chatBytes.set(file.path,b);}assert.equal(payloadHash(chatBytes),chat.payloadHash);
 for(const [map,file]of [[bytes,'components/MemoryEffortControl.tsx'],[chatBytes,'components/memory-effort-control.tsx']])assert(map.get(file).toString().includes('Memory effort'));
 const ast=ts.createSourceFile`);
  }
  add('checks',name,text,origin);
 }
 add('kit','fixtures/memoryEffortQualification.ts',fixtureCandidate(read(path.join(Q,'memory-effort-hosted-fixture.ts'))),path.join(Q,'memory-effort-hosted-fixture.ts'));
 add('proposal','memory-effort-kit-runtime.candidate.mjs',runtimeCandidate(runtimeSource),path.join(P,'sandbox-env/runtime.mjs'));
 return {acceptedSourceCommit:commit,kit:KIT,checks:CHECKS,versions:{sdk:'0.39.0',cli:'0.39.0',provider:'0.39.0',catalog:'1.4.0',apps:'1.5.0'},backend:{files:173,tables:79},registryHash:REGISTRY_HASH,planned};
}
export function validateSyntax(plan){for(const item of plan.planned.filter(row=>row.name.endsWith('.mjs')))execFileSync(process.execPath,['--check','--input-type=module'],{input:item.text,stdio:['pipe','pipe','pipe']});}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 assert.equal(process.version,'v24.15.0');
 const mode=process.argv[2];assert(['--plan','--write-controls'].includes(mode),'Use --plan, or --write-controls <accepted40hexCommit> after Root source approval.');
 const commit=mode==='--plan'?undefined:process.argv[3];if(mode==='--write-controls')assert.match(commit??'',/^[a-f0-9]{40}$/);
 const plan=buildPlan(commit);validateSyntax(plan);
 const output=mode==='--plan'?path.join(Q,'memory-effort-kit-preparation'):CHECKS;
 if(mode==='--write-controls'){
  assert.equal(execFileSync('git',['rev-parse','HEAD'],{cwd:R,encoding:'utf8'}).trim(),commit);
  assert(!fs.existsSync(KIT));assert(!fs.existsSync(CHECKS));fs.mkdirSync(KIT);fs.mkdirSync(CHECKS);
  for(const name of ['staging','artifacts','cache','image/archives','fixtures'])fs.mkdirSync(path.join(KIT,name),{recursive:true});
  fs.writeFileSync(path.join(KIT,'identity.json'),JSON.stringify({version:1,id:randomUUID(),ownerUid:process.getuid(),ownerGid:process.getgid()},null,2)+'\n',{flag:'wx',mode:0o600});
 }else{assert(!fs.existsSync(output));fs.mkdirSync(output);}
 for(const item of plan.planned){const root=mode==='--plan'?path.join(output,item.root):item.root==='kit'?KIT:item.root==='checks'?CHECKS:Q;const destination=path.join(root,item.name);fs.mkdirSync(path.dirname(destination),{recursive:true});fs.writeFileSync(destination,item.text,{flag:'wx'});}
 const summary={status:mode==='--plan'?'PREPARED_SOURCE_ONLY':'FRESH_CONTROLS_ONLY',acceptedSourceCommit:plan.acceptedSourceCommit,kit:KIT,checks:CHECKS,versions:plan.versions,backend:plan.backend,registryHash:REGISTRY_HASH,files:plan.planned.map(({root,name,origin,sha256})=>({root,name,origin,sha256})),builds:0,packs:0,images:0,serviceCalls:0,inferenceCalls:0,launcherChanged:false};
 fs.writeFileSync(path.join(output,'preparation.json'),JSON.stringify(summary,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify(summary));
}
