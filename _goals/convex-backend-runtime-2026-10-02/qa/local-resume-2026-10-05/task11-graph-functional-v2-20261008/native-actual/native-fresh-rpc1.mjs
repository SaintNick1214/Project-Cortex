/** Fresh mutation ABI and genuine service expiry within a still-valid lease; no inference. */
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {openOwnedContext,authorityReference,denied,q} from './common.mjs';
const controller=new AbortController(), c=await openOwnedContext({signal:controller.signal});
const started=performance.now(), owned=[], outcomes=[], s={tenantId:c.tenantId,memorySpaceId:c.memorySpaceId};
const timer=setTimeout(()=>controller.abort(Error('TASK11_FRESH_RPC_60000')),60000);
const inspect=()=>c.admin.query(c.reference('graphNative:inspect'),s);
const lease=w=>Object.fromEntries(['tenantId','memorySpaceId','connectorId','jobId','workerId','leaseVersion'].map(k=>[k,w[k]]));
let receipt,temporary,switched=false;
try{
 await c.verifyTarget('native-fresh-rpc1-target-verified');
 assert.equal(JSON.parse(await readFile(join(q,'deploy-current3.json'))).code,0);
 const setup=JSON.parse(await readFile(join(q,'setup-scopes1.json')));
 const text='Task11 fresh-mutation service expiry source, not a model response.';
 await c.owner.mutation(c.reference('facts:store'),{...s,fact:text,factType:'knowledge',confidence:100,sourceType:'manual',tags:['task11-fresh-rpc'],entities:[],relations:[]});
 const created=await inspect(),fact=created.facts.find(x=>x.fact===text);assert.ok(fact);
 const subject='task11-expiring-worker-'+c.pointer.operation, expiresAt=Date.now()+8000;
 temporary=authorityReference(await c.admin.mutation(c.reference('runtimeAuth:provision'),{
  issuer:c.auth.issuer,subject,actorKind:'service',...setup.worker.scope,capabilities:['admin'],resourceAccess:'space',expiresAt}));
 await c.publish('native-fresh-rpc1-temporary-authority',{subject,reference:temporary,expiresAt,deadlineMs:60000,leaseMs:30000,modelCalls:0});
 const configure=workerPrincipalId=>c.admin.mutation(c.reference('runtimeGraph:configureConnector'),{
  ...s,connectorId:'task11-neo4j',workerPrincipalId,workerTenantId:setup.worker.scope.tenantId,workerMemorySpaceId:setup.worker.scope.memorySpaceId,enabled:true});
 await configure(temporary.principalId);switched=true;
 const service=c.http(subject), work=await service.mutation(c.reference('runtimeGraph:claim'),{...s,connectorId:'task11-neo4j',workerId:'task11-real-expiring-service',leaseMs:30000});assert.ok(work);assert.equal(work.payload.source.sourceId,fact.lineage.sourceId,'Only the freshly created pending fact is eligible for this expiry fixture');
 const beforeCurrent=await service.mutation(c.reference('runtimeGraph:current'),lease(work));assert.equal(beforeCurrent.jobId,work.jobId);
 const badExpansion=await denied(()=>service.mutation(c.reference('runtimeGraph:currentExpansion'),{...lease(work),jobId:'no-expansion-request'}));assert.equal(badExpansion.data?.code,'GRAPH_LEASE_EXPIRED');
 const publicMissing=await denied(()=>c.owner.mutation(c.reference('runtimeGraph:expansion'),{...s,requestId:'no-expansion-request'}));assert.equal(publicMissing.data?.code,'FORBIDDEN');
 const before=await inspect();await c.publish('native-fresh-rpc1-before-expiry',{work,current:beforeCurrent,rows:before,expansionDenial:badExpansion,publicExpansionDenial:publicMissing});
 outcomes.push({name:'three-registered-fresh-mutation-ABI',status:'PASS',currentPositive:true,currentExpansionCode:badExpansion.data.code,publicExpansionCode:publicMissing.data.code});
 await new Promise(resolve=>setTimeout(resolve,Math.max(0,expiresAt-Date.now()+400)));
 const expiredValid=await denied(()=>service.mutation(c.reference('runtimeGraph:current'),lease(work)));
 const expiredInvalid=await denied(()=>service.mutation(c.reference('runtimeGraph:current'),{...lease(work),jobId:'invalid-lease'}));
 assert.equal(expiredValid.data?.code,'FORBIDDEN');assert.equal(expiredInvalid.data?.code,'FORBIDDEN');
 const after=await inspect();assert.deepEqual(after.outbox,before.outbox);assert.deepEqual(after.receipts,before.receipts);
 assert.ok(Date.now()<before.outbox.find(x=>x.jobId===work.jobId).leaseExpiresAt,'Expired grant probe must still hold valid lease');
 outcomes.push({name:'actual-expired-grant-before-valid-and-invalid-lease',status:'PASS',expiresAt,validLeaseExpiresAt:before.outbox.find(x=>x.jobId===work.jobId).leaseExpiresAt,expiredValid,expiredInvalid,outboxAndReceiptsUnchanged:true,remoteApplyCalls:0});
 await configure(setup.worker.reference.principalId);switched=false;
 await c.admin.mutation(c.reference('runtimeAuth:revokeGrant'),{grantId:temporary.grantId});
 // A deliberate new revision retires the never-issued old lease; no retry of an old packet.
 await c.owner.mutation(c.reference('facts:updateInPlace'),{memorySpaceId:s.memorySpaceId,factId:fact.factId,fact:text+' New explicit content revision.'});
 const {CypherProjectionConnector,ConvexGraphWorkerTransport,CortexGraphWorker}=await import(pathToFileURL(join(c.host,'task11-graph-runtime-entry.mjs')));
 for(const engine of ['neo4j','memgraph']){
  const connectorId='task11-'+engine,connector=new CypherProjectionConnector({...c.graphCredentials[engine],engine,...s,connectorId});
  const transport=new ConvexGraphWorkerTransport({deploymentUrl:c.state.url,fetchToken:async signal=>{signal.throwIfAborted();return c.token(c.fixture.workerSubject);}});
  const worker=new CortexGraphWorker({...s,connectorId,workerId:'task11-fresh-rpc-current-'+engine,connector,transport});owned.push(worker);
  let idle=false;for(let i=0;i<48;i++){const v=await worker.step();if(v.kind==='idle'){idle=true;break;}assert.equal(v.state,'complete');}assert.ok(idle);await worker.close();
 }
 const counts=await c.admin.query('baselineQualification:counts',{});assert.equal(counts.runtimeModelAttempts,5);assert.equal(counts.runtimeModelOperations,5);
 outcomes.push({name:'packed-worker-fresh-current-ABI-both-engines',status:'PASS',modelCalls:0,modelAttempts:5});
 await c.publish('native-fresh-rpc1-after',await inspect());receipt={version:1,status:'ACTUAL_FRESH_RPC_EXPIRY_PASS',outcomes,modelCalls:0,deadlineMs:60000};
}catch(error){receipt={version:1,status:'FAIL_OR_UNKNOWN',outcomes,error:c.publicError(error),noBlindRepeat:true,modelCalls:0};process.exitCode=1;
}finally{
 clearTimeout(timer);const cleanupErrors=[];
 if(switched)try{const setup=JSON.parse(await readFile(join(q,'setup-scopes1.json')));await c.admin.mutation(c.reference('runtimeGraph:configureConnector'),{...s,connectorId:'task11-neo4j',workerPrincipalId:setup.worker.reference.principalId,workerTenantId:setup.worker.scope.tenantId,workerMemorySpaceId:setup.worker.scope.memorySpaceId,enabled:true});}catch(e){cleanupErrors.push(c.publicError(e));}
 if(temporary)try{await c.admin.mutation(c.reference('runtimeAuth:revokeGrant'),{grantId:temporary.grantId});}catch(e){cleanupErrors.push(c.publicError(e));}
 for(const w of owned)try{await w.close();}catch(e){cleanupErrors.push(c.publicError(e));}
 try{await c.close();}catch(e){cleanupErrors.push(c.publicError(e));}
 receipt.cleanupErrors=cleanupErrors;receipt.ownedWorkersAndClientsClosed=!cleanupErrors.length;receipt.elapsedMs=performance.now()-started;
 if(cleanupErrors.length){receipt.status='FAIL_OR_UNKNOWN';process.exitCode=1;}
 await c.publish('native-fresh-rpc1-outcomes',receipt);console.log(JSON.stringify({status:receipt.status,groups:outcomes.length,elapsedMs:receipt.elapsedMs,modelCalls:0}));
}
