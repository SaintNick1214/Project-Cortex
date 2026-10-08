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
 await c.verifyTarget('native-dependency1-target-verified');
 assert.equal(JSON.parse(await readFile(join(q,'deploy-current2.json'))).code,0);
 const setup=JSON.parse(await readFile(join(q,'setup-scopes1.json')));
 const beforeModel=await c.admin.query('baselineQualification:counts',{});
 const {CypherProjectionConnector,ConvexGraphWorkerTransport,CortexGraphWorker}=await import(pathToFileURL(join(c.host,'task11-graph-runtime-entry.mjs')));
 const sources=[];
 for(let i=0;i<3;i++){
  const text='Task11 unpaid native dependency level '+i;
  await c.owner.mutation(c.reference('facts:store'),{...s,fact:text,factType:'knowledge',confidence:100,
   sourceType:'manual',tags:['task11-native-dependency'],entities:[],relations:[]});
  const fact=(await inspect()).facts.find(x=>x.fact===text);assert.ok(fact);
  sources.push({factId:fact.factId,sourceId:fact.lineage.sourceId});
  if(i>0)await c.admin.mutation(c.reference('graphSuccessorNative:attachDependency'),{
   reference:authorityReference(setup.data.reference),upstreamSourceId:sources[i-1].sourceId,dependentSourceId:sources[i].sourceId});
 }
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
 await drain(); const projected=await inspect();
 for(const row of sources)assert.equal(projected.graphSources.find(x=>x.sourceId===row.sourceId).state,'complete');
 outcomes.push({name:'actual-three-level-current-projection-before-retirement',status:'PASS',sources,edges,
  witnessSetup:'unpaid fixture injection; no provider-derived memory_remember claim'});
 await c.admin.mutation(c.reference('runtimeAuth:tombstoneResource'),{...s,resourceType:'source',resourceId:sources[0].sourceId});
 const retired=await inspect();
 for(const row of sources){
  const old=projected.graphSources.find(x=>x.sourceId===row.sourceId),next=retired.graphSources.find(x=>x.sourceId===row.sourceId);
  assert.equal(next.operation,'tombstone');assert.equal(next.state,'pending');assert.ok(next.revision>old.revision);
  const error=await denied(()=>c.owner.mutation(c.reference('runtimeGraph:requestExpansion'),{...s,sourceId:row.sourceId,
   connectorId:'task11-neo4j',requestId:'dependency-retired-'+row.factId,limit:5}));assert.equal(code(error),'FORBIDDEN');
 }
 outcomes.push({name:'native-upstream-tombstone-atomic-transitive-intents-and-current-denial',status:'PASS',sources,
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
 assert.equal(code(noRestore),'FORBIDDEN');
 const afterModel=await c.admin.query('baselineQualification:counts',{});
 assert.equal(afterModel.runtimeModelAttempts,beforeModel.runtimeModelAttempts);
 assert.equal(afterModel.runtimeModelOperations,beforeModel.runtimeModelOperations);
 await c.publish('native-dependency1-after',after);
 receipt={version:1,status:'ACTUAL_DEPENDENCY_RETIREMENT_PASS',outcomes,noRestoreCode:code(noRestore),modelCalls:0,
  modelAttemptsBefore:beforeModel.runtimeModelAttempts,modelAttemptsAfter:afterModel.runtimeModelAttempts,
  candidate:'installed-current2-source-manifest.json',deadlineMs:90000};
}catch(error){receipt={version:1,status:'FAIL_OR_UNKNOWN',outcomes,error:c.publicError(error),noBlindRepeat:true,modelCalls:0};process.exitCode=1;
}finally{
 clearTimeout(timer);const cleanupErrors=[];
 for(const{worker}of workers)try{await worker.close();}catch(e){cleanupErrors.push(c.publicError(e));}
 for(const{connector}of connectors)try{await connector.close();}catch(e){cleanupErrors.push(c.publicError(e));}
 try{await c.close();}catch(e){cleanupErrors.push(c.publicError(e));}
 receipt.cleanupErrors=cleanupErrors;receipt.ownedWorkersClientsClosed=!cleanupErrors.length;receipt.elapsedMs=performance.now()-started;
 if(cleanupErrors.length){receipt.status='FAIL_OR_UNKNOWN';process.exitCode=1;}
 await c.publish('native-dependency1-outcomes',receipt);console.log(JSON.stringify({status:receipt.status,groups:outcomes.length,elapsedMs:receipt.elapsedMs,modelCalls:0}));
}
