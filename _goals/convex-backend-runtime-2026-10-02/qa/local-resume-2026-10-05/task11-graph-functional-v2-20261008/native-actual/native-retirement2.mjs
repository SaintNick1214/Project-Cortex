/** Scoped Task11 retirement and honest retained service/target handoff; no cost refund. */
import assert from 'node:assert/strict';
import {readFile,stat} from 'node:fs/promises';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createRequire} from 'node:module';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {openOwnedContext,denied,q,root,sha,authorityReference} from './common.mjs';
const c=await openOwnedContext(), started=performance.now(),owned=[];
const execute=promisify(execFile),s={tenantId:c.tenantId,memorySpaceId:c.memorySpaceId};
const inspect=()=>c.admin.query(c.reference('graphNative:inspect'),s);
let receipt;
try{
 await c.verifyTarget('native-retirement2-target-verified');
 assert.equal(JSON.parse(await readFile(join(q,'native-revocation2-outcomes.json'))).status,'ACTUAL_REVOCATION_PASS');
 const setup=JSON.parse(await readFile(join(q,'setup-scopes1.json')));
 const before=await inspect();await c.publish('native-retirement2-before',before);
 // Explicit source retirement is separate from current grant retirement; no historical row is relabeled.
 const tombstones=[];
 for(const source of before.sources){
  await c.admin.mutation(c.reference('runtimeAuth:tombstoneResource'),{...s,resourceType:'source',resourceId:source.lineage.sourceId});
  tombstones.push(source.lineage.sourceId);
 }
 // Advancing the data scope epoch enqueues final epoch-pinned tombstones while
 // the separately authorized cleanup service is still current.
 await c.admin.mutation(c.reference('runtimeAuth:deleteScope'),s);
 const {CypherProjectionConnector,ConvexGraphWorkerTransport,CortexGraphWorker}=await import(pathToFileURL(join(c.host,'task11-graph-runtime-entry.mjs')));
 for(const engine of ['neo4j','memgraph']){
  const connectorId='task11-'+engine, connector=new CypherProjectionConnector({...c.graphCredentials[engine],engine,...s,connectorId,timeoutMs:10000});
  const transport=new ConvexGraphWorkerTransport({deploymentUrl:c.state.url,fetchToken:async signal=>{signal.throwIfAborted();return c.token(c.fixture.workerSubject);}});
  const worker=new CortexGraphWorker({...s,connectorId,workerId:'task11-retirement-'+engine,transport,connector});owned.push(worker);
  let idle=false;for(let n=0;n<48;n++){const result=await worker.step();if(result.kind==='idle'){idle=true;break;}assert.equal(result.state,'complete');}
  assert.equal(idle,true);await worker.close();
 }
 const after=await inspect();await c.publish('native-retirement2-after',after);
 assert.ok(after.graphSources.every(x=>x.operation==='tombstone'&&x.state==='complete'));
 assert.equal(after.scope.pendingRetirements??0,0);
 assert.equal(after.outbox.filter(x=>['pending','running'].includes(x.state)).length,0);
 const neo4j=createRequire(join(root,'package.json'))('neo4j-driver'),services=[];
 const serviceStart=JSON.parse(await readFile(join(q,'..','owned-service-start1.json')));
 for(const engine of ['neo4j','memgraph']){
  const config=c.graphCredentials[engine], original=serviceStart.services.find(x=>x.service===engine);
  assert.equal(config.containerId,original.containerId);assert.equal(config.uri,original.uri);
  const {stdout}=await execute('/usr/local/bin/docker',['inspect','--format','{{json .Id}} {{json .State.Running}} {{json .Config.Labels}} {{json .HostConfig.PortBindings}}',config.containerId],{timeout:5000,maxBuffer:16384});
  assert.ok(stdout.startsWith(JSON.stringify(config.containerId)+' true '));assert.ok(stdout.includes('"cortex.task":"11"'));
  assert.ok(stdout.includes('"cortex.owner":"backend-runtime-completion"'));assert.ok(stdout.includes('"HostIp":"127.0.0.1"'));
  const driver=neo4j.driver(config.uri,neo4j.auth.basic(config.username,config.password),{maxConnectionPoolSize:1,maxTransactionRetryTime:0}),session=driver.session();
  try{
   const result=await session.run('MATCH(n) WHERE n.scopeKey=$scopeKey AND (n:CortexRuntimeGraphFact OR n:CortexRuntimeGraphEntity) RETURN count(n) AS count',{
    scopeKey:JSON.stringify([s.tenantId,s.memorySpaceId])},{timeout:5000});assert.equal(result.records[0].get('count').toNumber(),0);
   const fence=await session.run('MATCH(n:CortexRuntimeGraphSource {scopeKey:$scopeKey}) RETURN n.sourceId AS sourceId,n.tombstoned AS tombstoned,n.payloadCanonical AS payloadCanonical',{
    scopeKey:JSON.stringify([s.tenantId,s.memorySpaceId])},{timeout:5000});
   assert.equal(fence.records.length,after.graphSources.length);
   for(const row of fence.records){assert.equal(row.get('tombstoned'),true);assert.deepEqual(JSON.parse(row.get('payloadCanonical')).facts,[]);}
   services.push({engine,containerId:config.containerId,uri:config.uri,status:'RETAINED_FOR_TASK16_AND_FINAL_ADVERSARIAL',
    ownedDataContentCount:0,tombstoneFenceCount:fence.records.length,selectedMetadataOwnershipVerified:true});
  }finally{await session.close();await driver.close();}
 }
 // Last service work is finished before revoking its separate control account.
 const revoked=[];
 for(const actor of [setup.data,setup.ownReader,setup.policyAdmin,setup.foreign,setup.operator,setup.worker]){
  await c.admin.mutation(c.reference('runtimeAuth:revokeGrant'),{grantId:actor.reference.grantId});revoked.push({actor:actor.name,grantId:actor.reference.grantId});
 }
 const workerDenied=await denied(()=>c.http(c.fixture.workerSubject).mutation(c.reference('runtimeGraph:claim'),{
  ...s,connectorId:'task11-neo4j',workerId:'retired-service-must-deny'}));assert.equal(workerDenied.data?.code,'FORBIDDEN');
 for(const scope of [setup.foreign.scope,setup.operator.scope])await c.admin.mutation(c.reference('runtimeAuth:deleteScope'),scope);
 const oldBase=JSON.parse(await readFile(join(q,'prior-task10-accounting-baseline1.json')));
 const origin=c.pointer.originQaDirectory;
 const first=JSON.parse(await readFile(join(origin,'baseline-functional-auth-outcomes.json')));
 const managed=JSON.parse(await readFile(join(origin,'managed-setup1.json')));
 const money=[];
 for(const [name,reference]of [['commission',authorityReference(first.owner)],['managed',managed.reference]]){
  const ledger=await c.admin.query('profileNative:inspectLedger',{reference}),previous=oldBase.scopes.find(x=>x.name===name);
  assert.deepEqual(ledger.accounts,previous.accounts);
  assert.equal(ledger.operations.length,previous.operationCount);assert.equal(ledger.attempts.length,previous.attemptCount);
  money.push({name,tenantLiability:ledger.accounts.find(x=>x.kind==='tenant').uncertainUnits,slots:ledger.accounts.reduce((n,x)=>n+x.activeConcurrency,0),
   accountIds:ledger.accounts.map(x=>x._id),rootWindowAndAllMoneyUnchanged:true});
 }
 assert.equal(money.reduce((n,x)=>n+x.tenantLiability,0),500000);assert.ok(money.every(x=>x.slots===0));
 const counts=await c.admin.query('baselineQualification:counts',{});assert.equal(counts.runtimeModelAttempts,5);assert.equal(counts.runtimeModelOperations,5);
 const current=JSON.parse(await readFile(join(q,'installed-current2-source-manifest.json')));
 for(const row of current.preserved)assert.equal(sha(await readFile(join(c.host,row.path))),row.sha256);
 const host=await c.hostOwner.query('host:authenticated',{});assert.equal(host.length,1);assert.equal(host[0].text,'unrelated Task10 host sentinel');
 const node=await c.hostOwner.action('hostNode:health',{});assert.equal(node.runtime,'node');assert.equal(node.subject,'host-owner');
 const response=await fetch(c.state.url.replace('.convex.cloud','.convex.site')+'/host-health',{signal:AbortSignal.timeout(10000)});
 assert.equal(response.status,200);assert.equal(await response.text(),'host-route-preserved');
 const privateMetadata=[];
 for(const [directory,names]of [[c.pointer.privateDirectory,['credentials.json','auth.json','jwt-private.pem','state.json']],
  [c.pointer.privateDataDirectory,['state.json']],[new URL('file://'+c.pointer.graphCredentials).pathname.replace(/\/[^/]+$/,''),['credentials.json']]]){
  assert.equal((await stat(directory)).mode&0o777,0o700);
  for(const name of names){assert.equal((await stat(join(directory,name))).mode&0o777,0o600);privateMetadata.push({directory,file:name,mode:'0600',bodyPublished:false,retained:true});}
 }
 receipt={version:1,status:'ACTUAL_SCOPED_RETIREMENT_RETAINED_RESOURCES_PASS',sourcesTombstoned:tombstones,revoked,
  pendingJobs:0,workerDeniedCode:workerDenied.data.code,hostFunctionsNodeAuthHttpPreserved:true,oldTask10Money:money,
  unknownTenantLiability:500000,liabilityResetOrRefund:false,modelCalls:0,modelAttemptCount:5,services,
  target:{projectId:c.state.projectId,deploymentName:c.state.deploymentName,status:'RETAINED_EXPLICITLY_FOR_TASK12_TASK13',production:false},
  privateMetadata,issuer:{runningProcess:false,mode:'static-owned-JWKS'},finalGoalRetirementRequired:true,
  noTask12ScopeOrInferenceStarted:true};
}catch(error){receipt={version:1,status:'FAIL_OR_UNKNOWN',error:c.publicError(error),modelCalls:0,noBlindRepeat:true};process.exitCode=1;
}finally{
 const cleanupErrors=[];for(const worker of owned)try{await worker.close();}catch(e){cleanupErrors.push(c.publicError(e));}
 try{await c.close();}catch(e){cleanupErrors.push(c.publicError(e));}
 receipt.ownedWorkersAndClientsClosed=!cleanupErrors.length;receipt.cleanupErrors=cleanupErrors;receipt.elapsedMs=performance.now()-started;
 if(cleanupErrors.length){receipt.status='FAIL_OR_UNKNOWN';process.exitCode=1;}
 await c.publish('native-retirement2-outcomes',receipt);console.log(JSON.stringify({status:receipt.status,elapsedMs:receipt.elapsedMs,modelCalls:0}));
}
