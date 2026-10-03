import assert from 'node:assert/strict';
import {harness,factStoreArgs} from '/workspace/Project-Cortex/work/resume/mf/candidate/tests/unit/runtimeEndpointAuth/sharedfixtures.ts';
import * as facts from '/workspace/Project-Cortex/work/resume/mf/candidate/convex-dev/facts.ts';
const results:any[]=[];
for(const mode of ['none','tombstone','event'] as const){const h=harness();await h.provisionScope();const row:any=await h.invoke(facts.store,factStoreArgs);let injected=false;const digest=crypto.subtle.digest.bind(crypto.subtle);
crypto.subtle.digest=async(a:any,b:any)=>{if(!injected && mode!=='none'){injected=true;const source=h.db.rows.get('runtimeMemorySources')![0];await h.db.patch(source._id,mode==='tombstone'?{tombstonedAt:Date.now()}:{lineage:{...(source.lineage as any),sourceEventId:'changed-event'}});}return await digest(a,b);};
try{const result:any=await h.invoke(facts.getHistory,{memorySpaceId:'space-a',factId:row.factId});if(mode==='none'){assert.equal(result.length,1);assert.equal(result[0].fact,row.fact);results.push({name:'history-positive',status:'PASS'});}else{assert(injected);results.push({name:`history-${mode}`,status:'FAIL',injected,result});}}catch(e:any){results.push({name:`history-${mode}`,status:e.data?.code==='STALE_SOURCE'?'PASS':'FAIL',injected,error:e.data??e.stack});}finally{crypto.subtle.digest=digest;}}
console.log(JSON.stringify({node:process.version,observedAt:new Date().toISOString(),results},null,2));process.exitCode=results.some(r=>r.status==='FAIL')?1:0;
