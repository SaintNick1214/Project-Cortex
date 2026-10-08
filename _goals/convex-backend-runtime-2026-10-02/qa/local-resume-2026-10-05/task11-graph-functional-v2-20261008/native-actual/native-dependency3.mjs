/** Unpaid native exact-witness fixture + real recursive retirement; no synthetic model/tool acceptance. */
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createRequire} from 'node:module';
import {openOwnedContext,denied,authorityReference,q,root} from './common.mjs';
const abort=new AbortController(), c=await openOwnedContext({signal:abort.signal});
const started=performance.now(), outcomes=[], workers=[], connectors=[];
const timer=setTimeout(()=>abort.abort(Error('TASK11_DEPENDENCY_BOUND')),90000);
const s={tenantId:c.tenantId,memorySpaceId:c.memorySpaceId};
const inspect=()=>c.admin.query(c.reference('graphNative:inspect'),s);
const code=e=>e?.data?.code??e?.code??e?.message;
let receipt;
try{
 await c.verifyTarget('native-dependency3-target-verified');
 assert.equal(JSON.parse(await readFile(join(q,'deploy-current3.json'))).code,0);
 const setup=JSON.parse(await readFile(join(q,'setup-scopes1.json')));
 const beforeModel=await c.admin.query('baselineQualification:counts',{});
 const {CypherProjectionConnector,ConvexGraphWorkerTransport,CortexGraphWorker}=await import(pathToFileURL(join(c.host,'task11-graph-runtime-entry.mjs')));
 const original=JSON.parse(await readFile(join(q,'native-dependency1-outcomes.json')));
 assert.equal(original.status,'FAIL_OR_UNKNOWN');
 assert.match(original.error.message,/multiple paginated queries/);
 const sources=original.outcomes[0].sources;
 assert.equal(sources.length,3);
 const preserved=await inspect();
 for(const row of sources){assert.ok(preserved.facts.some(x=>x.factId===row.factId&&!x.tombstonedAt));assert.equal(preserved.graphSources.find(x=>x.sourceId===row.sourceId).operation,'tombstone');}
 // Reuse the genuinely projected sources after the prior atomic rollback. No duplicate fixture source/model.
 const edges=await c.admin.query(c.reference('graphSuccessorNative:dependencies'),s);
 assert.ok(edges.some(e=>e.sourceId===sources[0].sourceId&&e.dependentSourceId===sources[1].sourceId));
 assert.ok(edges.some(e=>e.sourceId===sources[1].sourceId&&e.dependentSourceId===sources[2].sourceId));
 for(const engine of ['neo4j','memgraph']){
  const connectorId='task11-'+engine;
  const connector=new CypherProjectionConnector({...c.graphCredentials[engine],engine,...s,connectorId,timeoutMs:10000});
  const transport=new ConvexGraphWorkerTransport({deploymentUrl:c.state.url,fetchToken:async signal=>{signal.throwIfAborted();abort.signal.throwIfAborted();return c.token(c.fixture.workerSubject);}});
  connectors.push({engine,connector});workers.push({engine,worker:new CortexGraphWorker({...s,connectorId,workerId:'task11-dependency-'+engine,transport,connector})});
 }
 async function drain(){
  for(const {engine,worker}of workers){
   let done=false;
   for(let n=0;n<16;n++){
    abort.signal.throwIfAborted();const step=await worker.step();
    if(step.kind==='idle'){done=true;break;}
    assert.equal(step.state,'complete');assert.equal(step.backendAcknowledged,true);
   }
   assert.equal(done,true,'bounded native dependency drain '+engine);
  }
 }
 const remoteBefore=[];
 for(const {engine,connector}of connectors){await connector.connect();for(const row of sources)remoteBefore.push({engine,sourceId:row.sourceId,fence:await connector.inspectSource(row.sourceId)});}
 // dependency2 already committed this parent tombstone before its literal denial-oracle failed.
 // Do not issue that parent again; prove its current committed intents and drain them.
 const retired=await inspect();
 for(const row of sources){
  const next=retired.graphSources.find(x=>x.sourceId===row.sourceId);
  assert.equal(next.operation,'tombstone');assert.ok(['pending','complete'].includes(next.state));for(const old of remoteBefore.filter(x=>x.sourceId===row.sourceId))assert.ok(next.revision>old.fence.revision);
  const error=await denied(()=>c.owner.mutation(c.reference('runtimeGraph:requestExpansion'),{...s,sourceId:row.sourceId,
   connectorId:'task11-neo4j',requestId:'dependency-retired-'+row.factId,limit:5}));assert.ok(['FORBIDDEN','STALE_SOURCE'].includes(code(error)));if(row.sourceId===sources[0].sourceId)assert.equal(code(error),'FORBIDDEN');
 }
 outcomes.push({name:'committed-upstream-tombstone-transitive-intents-and-current-denial',status:'PASS',sources,
  intents:retired.graphSources.filter(x=>sources.some(s=>s.sourceId===x.sourceId)),pendingRetirements:retired.scope.pendingRetirements??0});
 await drain();const after=await inspect();
 const neo4j=createRequire(join(root,'package.json'))('neo4j-driver');
 for(const{engine,connector}of connectors){
  const remote=[];
  for(const row of sources){const fence=await connector.inspectSource(row.sourceId);assert.equal(fence.tombstoned,true);
   assert.equal(fence.revision,after.graphSources.find(x=>x.sourceId===row.sourceId).revision);remote.push({sourceId:row.sourceId,fence});}
  const config=c.graphCredentials[engine],driver=neo4j.driver(config.uri,neo4j.auth.basic(config.username,config.password),{maxConnectionPoolSize:1,maxTransactionRetryTime:0});
  const session=driver.session();try{
   const result=await session.run('MATCH (n) WHERE n.scopeKey=$scopeKey AND n.sourceId IN $sources AND (n:CortexRuntimeGraphFact OR n:CortexRuntimeGraphEntity) RETURN count(n) AS count',{
    scopeKey:JSON.stringify([s.tenantId,s.memorySpaceId]),sources:sources.map(x=>x.sourceId)},{timeout:5000});
   assert.equal(result.records[0].get('count').toNumber(),0);
  }finally{await session.close();await driver.close();}
  outcomes.push({name:'native-transitive-remote-deletion-'+engine,status:'PASS',remote,contentCount:0});
 }
 const noRestore=await denied(()=>c.admin.mutation(c.reference('runtimeGraph:enqueue'),{reference:setup.data.reference,sourceIds:[sources[2].sourceId]}));
 assert.ok(['FORBIDDEN','STALE_SOURCE'].includes(code(noRestore)));
 const afterModel=await c.admin.query('baselineQualification:counts',{});
 assert.equal(afterModel.runtimeModelAttempts,beforeModel.runtimeModelAttempts);
 assert.equal(afterModel.runtimeModelOperations,beforeModel.runtimeModelOperations);
 await c.publish('native-dependency3-after',after);
 receipt={version:1,status:'ACTUAL_DEPENDENCY_RETIREMENT_PASS',outcomes,noRestoreCode:code(noRestore),modelCalls:0,
  modelAttemptsBefore:beforeModel.runtimeModelAttempts,modelAttemptsAfter:afterModel.runtimeModelAttempts,
  candidate:'installed-current3-source-manifest.json',priorParent:'native-dependency2-outcomes.json',parentRepeated:false,deadlineMs:90000};
}catch(error){receipt={version:1,status:'FAIL_OR_UNKNOWN',outcomes,error:c.publicError(error),noBlindRepeat:true,modelCalls:0};process.exitCode=1;
}finally{
 clearTimeout(timer);const cleanupErrors=[];
 for(const{worker}of workers)try{await worker.close();}catch(e){cleanupErrors.push(c.publicError(e));}
 for(const{connector}of connectors)try{await connector.close();}catch(e){cleanupErrors.push(c.publicError(e));}
 try{await c.close();}catch(e){cleanupErrors.push(c.publicError(e));}
 receipt.cleanupErrors=cleanupErrors;receipt.ownedWorkersClientsClosed=!cleanupErrors.length;receipt.elapsedMs=performance.now()-started;
 if(cleanupErrors.length){receipt.status='FAIL_OR_UNKNOWN';process.exitCode=1;}
 await c.publish('native-dependency3-outcomes',receipt);console.log(JSON.stringify({status:receipt.status,groups:outcomes.length,elapsedMs:receipt.elapsedMs,modelCalls:0}));
}
