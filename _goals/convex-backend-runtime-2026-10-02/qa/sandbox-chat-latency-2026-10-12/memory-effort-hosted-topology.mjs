/** Prospective disposable native qualification; no model calls or paid retries. */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createRequire} from 'node:module';
import {createHash,randomUUID} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {fileURLToPath} from 'node:url';
import {performance} from 'node:perf_hooks';
import {loadSession,createContext,PROOFS_ROOT} from '/Users/SaintNick/Documents/Cortex/Project-Cortex-Proofs/sandbox-env/runner.mjs';
import {verifyCloud} from '/Users/SaintNick/Documents/Cortex/Project-Cortex-Proofs/sandbox-env/cloud.mjs';

const Q=path.dirname(fileURLToPath(import.meta.url));
const [sessionId,acceptedCommit]=process.argv.slice(2);
assert.match(sessionId??'',/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/);
assert.match(acceptedCommit??'',/^[a-f0-9]{40}$/);
assert.equal(process.version,'v24.15.0');
const out={version:1,status:'UNRUN',sessionId,acceptedCommit,inferenceCalls:0,retries:0,checks:[],operations:[],clientsClosed:false};
const receipt=path.join(Q,`memory-effort-hosted-topology-${Date.now()}.json`);
const check=(name,value)=>{assert.ok(value,name);out.checks.push(name);};
const digest=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const reference=authority=>Object.fromEntries(['principalId','principalVersion','membershipId','membershipVersion','grantId','grantVersion','tenantId','tenantEpoch','memorySpaceId','memorySpaceEpoch']
  .filter(key=>authority[key]!==undefined).map(key=>[key,authority[key]]));
function errorCode(error){let data=error?.data;if(typeof data==='string'){try{data=JSON.parse(data);}catch{data=undefined;}}
  return typeof data?.code==='string'?data.code:typeof error?.code==='string'?error.code:'OTHER_ERROR';}
let admin;
try {
  const session=await loadSession(PROOFS_ROOT,sessionId),ctx=await createContext(session,{logger:()=>{}});
  check('owned READY session',session.phase==='READY'&&session.id===sessionId&&session.ownerUid===process.getuid());
  check('approved disposable cloud scope',session.target.kind==='cloud'&&session.target.teamId===325340&&session.target.projectId===3200658&&session.target.deploymentType==='dev'&&!session.target.isDefault&&session.target.disposable===true);
  check('unexpired target',session.target.expiresAt>Date.now());
  const ready=JSON.parse(await fs.readFile(path.join(Q,'memory-effort-environment-ready.json'),'utf8'));
  check('exact accepted source and live target',ready.sourceCommit===acceptedCommit&&ready.sessionId===sessionId&&ready.target.id===session.target.id&&ready.target.name===session.target.name&&ready.startupFixedQualification==='8/8ACTUAL_PASS');
  await verifyCloud(session,ctx);
  const inspected=JSON.parse((await promisify(execFile)(ctx.docker,['container','inspect',session.container.id],{encoding:'utf8',timeout:30000,maxBuffer:2*1024*1024})).stdout)[0];
  check('exact owned running Docker',inspected.Id===session.container.id&&inspected.Image===ready.container.imageId&&inspected.State.Running&&inspected.Config.Labels['dev.cortex.disposable-sandbox']===sessionId&&inspected.Config.Labels['dev.cortex.disposable-sandbox.root']===session.runDir);
  const requireHost=createRequire(path.join(session.backendDir,'package.json'));
  const {ConvexHttpClient}=requireHost('convex/browser');
  admin=new ConvexHttpClient(session.target.deploymentUrl,{logger:false,fetch:(url,args)=>fetch(url,{...args,redirect:'error',signal:AbortSignal.timeout(30000)})});
  const keyStat=await fs.lstat(session.deploymentKeyPath);
  check('private deploy key file',keyStat.isFile()&&!keyStat.isSymbolicLink()&&keyStat.uid===process.getuid()&&(keyStat.mode&0o077)===0);
  const key=(await fs.readFile(session.deploymentKeyPath,'utf8')).trim();
  check('key bound to verified development target',key.startsWith(`dev:${session.target.name}|`));admin.setAdminAuth(key);
  const identities=JSON.parse(await fs.readFile(path.join(session.issuerDir,'identities.json'),'utf8'));
  const allowed=new Set(['runtimeAuth:provision','runtimeAuth:revokeGrant','memoryEffortQualification:seed','memoryEffortQualification:traverse','memoryEffortQualification:changeBridge','memoryEffortQualification:delivery']);
  async function call(kind,name,args){assert.ok(allowed.has(name));const started=performance.now();
    try {const value=await admin[kind](name,args);out.operations.push({kind,name,elapsedMs:performance.now()-started,status:'RETURNED'});return value;}
    catch(error){out.operations.push({kind,name,elapsedMs:performance.now()-started,status:'REFUSED',code:errorCode(error)});throw error;}}
  const label=randomUUID(),space=`qa-effort-topology-${label}`,scope={tenantId:session.publicRuntime.tenantId,memorySpaceId:space};
  const owner=await call('mutation','runtimeAuth:provision',{...identities.owner,...scope});
  const ref=reference(owner);out.scopeSha256=digest(scope);
  const seeded=await call('mutation','memoryEffortQualification:seed',{reference:ref,label});
  check('twelve persisted independent sources and linked facts',seeded.seededSources===12&&seeded.seededFacts===12&&seeded.inferenceCalls===0);
  const observed={};
  for(const [effort,depth,entries] of [['fast',2,4],['normal',4,8],['high',8,16],['max',12,null]]){
    const value=await call('query','memoryEffortQualification:traverse',{reference:ref,label,effort});observed[effort]=value;
    const facts=value.items.filter(item=>item.kind==='fact');
    check(`${effort} actually reaches depth ${depth}`,facts.some(item=>item.retrieval.depth===depth));
    check(`${effort} no deeper than effective bound`,facts.every(item=>item.retrieval.depth<=depth));
    check(`${effort} unique evidence`,new Set(value.items.map(item=>`${item.kind}:${item.id}`)).size===value.items.length);
    check(`${effort} every path has shortest reported hop count`,value.items.every(item=>item.retrieval.path.length===item.retrieval.depth));
    check(`${effort} effective shared entry ceiling`,entries===null||value.items.length<=entries);
    check(`${effort} trace accounts for selected evidence`,value.memoryEffort.selected===value.items.length&&value.memoryEffort.requestedEffort===effort);
    check(`${effort} no accidental whole-query deadline claim`,value.durationClock.includes('fixed transaction clock'));
  }
  check('Max expands beyond High with available qualified input',observed.max.items.some(item=>item.kind==='fact'&&item.retrieval.depth>8)&&observed.max.items.length>observed.high.items.length);
  check('real bidirectional evidence cycles terminate with deduplication',observed.max.memoryEffort.deduplicated>0);
  const direct=await call('query','memoryEffortQualification:traverse',{reference:ref,label,effort:'fast',seedOrdinal:12,maxEntries:1});
  check('old connected fact is depth one when directly matched',direct.items.some(item=>item.id.endsWith(':fact:12')&&item.retrieval.depth===1));
  const narrow=await call('query','memoryEffortQualification:traverse',{reference:ref,label,effort:'max',maxEntries:2});
  check('caller may lower Max entry bound',narrow.items.length===2&&narrow.memoryEffort.maxEntries===2&&narrow.memoryEffort.stopReasons.includes('entries'));
  const noEntries=await call('query','memoryEffortQualification:traverse',{reference:ref,label,effort:'max',maxEntries:0});
  check('zero optional entries preserves honest empty result',noEntries.items.length===0&&noEntries.memoryEffort.stopReasons.includes('entries'));
  const small=await call('query','memoryEffortQualification:traverse',{reference:ref,label,effort:'max',maxContextTokens:1});
  check('tiny context stops before oversized optional entries',small.items.length===0&&small.memoryEffort.stopReasons.includes('input'));
  const ownReader=await call('mutation','runtimeAuth:provision',{...identities.reader,...scope,capabilities:['read'],resourceAccess:'own'});
  await assert.rejects(call('query','memoryEffortQualification:traverse',{reference:reference(ownReader),label,effort:'max'}),error=>errorCode(error)==='FORBIDDEN');
  check('different principal cannot expand owned evidence',true);
  const otherSpace=await call('mutation','runtimeAuth:provision',{...identities.owner,tenantId:scope.tenantId,memorySpaceId:`${space}-other`});
  await assert.rejects(call('query','memoryEffortQualification:traverse',{reference:reference(otherSpace),label,effort:'max'}),error=>errorCode(error)==='FORBIDDEN');
  check('same principal different space cannot resolve seed',true);
  const otherTenant=await call('mutation','runtimeAuth:provision',{...identities.owner,tenantId:`qa-effort-other-${label}`,memorySpaceId:space});
  await assert.rejects(call('query','memoryEffortQualification:traverse',{reference:reference(otherTenant),label,effort:'max'}),error=>errorCode(error)==='FORBIDDEN');
  check('same principal different tenant cannot resolve seed',true);
  await call('mutation','memoryEffortQualification:changeBridge',{reference:ref,label,ordinal:4,change:'version'});
  await assert.rejects(call('query','memoryEffortQualification:delivery',{reference:ref,bindingsCanonical:JSON.stringify(observed.max.bindings)}),error=>errorCode(error)==='STALE_SOURCE');
  check('changed intermediate bridge invalidates captured delivery',true);
  const changed=await call('query','memoryEffortQualification:traverse',{reference:ref,label,effort:'max'});
  check('stale projection cannot bridge into later evidence',changed.items.every(item=>item.kind!=='fact'||Number(item.id.split(':').at(-1))<4));
  await call('mutation','memoryEffortQualification:changeBridge',{reference:ref,label,ordinal:2,change:'tombstone'});
  const deleted=await call('query','memoryEffortQualification:traverse',{reference:ref,label,effort:'max'});
  check('tombstoned bridge cannot resurrect deeper evidence',deleted.items.every(item=>item.kind!=='fact'||item.id.endsWith(':fact:1')));
  await call('mutation','runtimeAuth:revokeGrant',{grantId:owner.grantId});
  await assert.rejects(call('query','memoryEffortQualification:delivery',{reference:ref,bindingsCanonical:JSON.stringify(deleted.bindings)}),error=>errorCode(error)==='FORBIDDEN');
  check('grant revocation fences captured delivery',true);
  out.profiles=Object.fromEntries(Object.entries(observed).map(([effort,value])=>[effort,{memoryEffort:value.memoryEffort,items:value.items}]));
  await verifyCloud(session,ctx);out.status='PASS';
} catch(error) {out.status='FAIL';out.failure={code:errorCode(error),assertion:typeof error?.message==='string'&&error.name==='AssertionError'?error.message.split('\n')[0].slice(0,240):'See operation phase; raw errors suppressed'};process.exitCode=1;}
finally {if(admin)admin.clearAuth();out.clientsClosed=true;await fs.writeFile(receipt,JSON.stringify(out,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({status:out.status,checks:out.checks.length,operations:out.operations.length,receipt,inferenceCalls:0}));}
