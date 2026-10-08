/** Existing owned expired lease diagnosis; failure mutation is expected to deny without writes. */
import assert from'node:assert/strict';import{readFile}from'node:fs/promises';import{join}from'node:path';
import{openOwnedContext,q}from'./common.mjs';
const c=await openOwnedContext();let r;
try{
 await c.verifyTarget('native-expiry-query-diagnosis1-target-verified');
 const s={tenantId:c.tenantId,memorySpaceId:c.memorySpaceId},before=await c.admin.query('graphNative:inspect',s),cases=[];
 for(const engine of ['neo4j','memgraph']){
  const prior=JSON.parse(await readFile(join(q,'native-late5-source-tombstone-held-'+engine+'.json'))),args=prior.lease;
  let query,mutation;try{const value=await c.http(c.fixture.workerSubject).query('runtimeGraph:current',args);
   query={returned:true,revision:value.payload.revision,leaseExpiresAt:value.leaseExpiresAt,observedAt:Date.now()};
  }catch(e){query={returned:false,error:c.publicError(e)};}
  try{const value=await c.http(c.fixture.workerSubject).mutation('runtimeGraph:fail',{...args,outcome:'unknown'});
   mutation={unexpectedAllowed:true,value};
  }catch(e){mutation={denied:true,error:c.publicError(e)};}
  cases.push({engine,args,query,mutation});
 }
 const after=await c.admin.query('graphNative:inspect',s);assert.deepEqual(after.outbox,before.outbox);
 for(const row of cases)assert.equal(row.mutation.error?.data?.code,'GRAPH_LEASE_EXPIRED');
 r={version:1,status:'ACTUAL_MUTATION_EXPIRY_DENIAL_DIAGNOSED',cases,graphJobsUnchanged:true,modelCalls:0,
  queryClockCacheHypothesis:cases.some(x=>x.query.returned),noNewGraphPacketIssued:true};
}catch(e){r={version:1,status:'FAIL_OR_UNKNOWN',error:c.publicError(e),modelCalls:0};process.exitCode=1;
}finally{await c.close();r.ownedClientsClosed=true;await c.publish('native-expiry-query-diagnosis1',r);console.log(JSON.stringify({status:r.status,modelCalls:0}));}
