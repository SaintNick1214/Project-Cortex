/** Finish only the pending Memgraph projection after its500ms readiness failure; no repeated timeout topology. */
import assert from'node:assert/strict';import{readFile}from'node:fs/promises';import{join}from'node:path';import{pathToFileURL}from'node:url';
import{openOwnedContext,q}from'./common.mjs';const c=await openOwnedContext();let connector,worker,r;
try{
 await c.verifyTarget('native-timeout2-closure1-target-verified');
 const prior=JSON.parse(await readFile(join(q,'native-timeout2-outcomes.json')));assert.equal(prior.outcomes.length,1);
 assert.equal(prior.outcomes[0].name,'silent-actual-first-run-neo4j');assert.equal(prior.error.message,'GRAPH_CONNECTION_UNAVAILABLE');
 const s={tenantId:c.tenantId,memorySpaceId:c.memorySpaceId},before=await c.admin.query('graphNative:inspect',s);
 const fact=before.facts.find(x=>x.fact==='Task11 bounded silent RUN successor after independently owned rejection race repair.');assert.ok(fact);
 const pending=before.outbox.find(x=>x.connectorId==='task11-memgraph'&&x.sourceId===fact.lineage.sourceId);assert.equal(pending.state,'pending');assert.equal(pending.attempt,0);
 const {CypherProjectionConnector,ConvexGraphWorkerTransport,CortexGraphWorker}=await import(pathToFileURL(join(c.host,'task11-graph-runtime-entry.mjs')));
 connector=new CypherProjectionConnector({...c.graphCredentials.memgraph,engine:'memgraph',...s,connectorId:'task11-memgraph',timeoutMs:10000});
 const transport=new ConvexGraphWorkerTransport({deploymentUrl:c.state.url,fetchToken:async signal=>{signal.throwIfAborted();return c.token(c.fixture.workerSubject);}});
 worker=new CortexGraphWorker({...s,connectorId:'task11-memgraph',workerId:'task11-timeout-pending-completion',transport,connector});
 const result=await worker.step();assert.equal(result.state,'complete');assert.equal(result.jobId,pending.jobId);
 const after=await c.admin.query('graphNative:inspect',s);assert.equal(after.graphSources.find(x=>x.sourceId===fact.lineage.sourceId).state,'complete');
 r={version:1,status:'SCOPED_NATIVE_TIMEOUT_AND_PENDING_COMPLETION_CLOSED',prior:'native-timeout2-outcomes.json',
  neo4jHeldActual500Ms:prior.outcomes[0],memgraph500MsReadinessBoundFailure:prior.error,
  memgraphNo500MsApplyClaim:true,memgraphOrdinaryPendingCompletion:result,ordinaryConnectorTimeoutMs:10000,
  originalNoHangRepairActualOnNeo4j:true,modelCalls:0};
}catch(e){r={version:1,status:'FAIL_OR_UNKNOWN',error:c.publicError(e),modelCalls:0};process.exitCode=1;
}finally{const errors=[];for(const owned of [worker,connector])if(owned)try{await owned.close();}catch(e){errors.push(c.publicError(e));}
 await c.close();r.cleanupErrors=errors;r.ownedClosed=!errors.length;await c.publish('native-timeout2-closure1',r);console.log(JSON.stringify({status:r.status,modelCalls:0}));}
