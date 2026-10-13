/** Read-only product investigation: unmodified real handlers, controlled native DB/component ports. */
import fs from 'node:fs';
import { performance } from 'node:perf_hooks';
import { beforeEach, afterEach, expect, it, jest } from '@jest/globals';
import { getFunctionName } from 'convex/server';
const root = '/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion';
const qa = `${root}/_goals/convex-backend-runtime-2026-10-02/qa/sandbox-chat-latency-2026-10-12`;
jest.unstable_mockModule('@convex-dev/workflow', () => ({ WorkflowManager: class {
  define(value) { return { _handler: value.handler }; } async start() { return 'workflow:read-investigation'; }
} }));
const { transcriptFixture, installMockRoot, ledger, runs, invoke, clock } = await import(`${root}/tests/unit/runtimeTranscript/fixture.ts`);
const runtime = await import(`${root}/convex-dev/runtimeAgent.ts`);
const { canonicalModelJson } = await import(`${root}/src/domain/model-policy.ts`);
beforeEach(() => { installMockRoot(); }); afterEach(() => { jest.restoreAllMocks(); });
const scenarios = [];
const controlTables = new Set(['runtimeAuthPrincipals','runtimeAuthMemberships','runtimeAuthGrants','runtimeAuthScopes','runtimeAuthTombstones']);
// Instrumentation keys distinguish omitted/undefined from null and empty strings; never normalize product inputs.
const exactKey=value=>JSON.stringify(value===undefined?['undefined']:value===null?['null']:Array.isArray(value)?['array',...value.map(item=>JSON.parse(exactKey(item)))]:typeof value==='object'?['record',...Object.keys(value).sort().map(key=>[key,JSON.parse(exactKey(value[key]))])]:[typeof value,value]);
it.each([0,4])('counts exact native API reads in one original model-admission transaction with %i source witnesses', async sourceCount => {
  const f = await transcriptFixture({maxContextTokens:16384}), mutation = f.ctx.runMutation.bind(f.ctx);
  f.ctx.runMutation = async (reference, args) => {
    let name=''; try { name=getFunctionName(reference); } catch { /* Native component. */ }
    const reg=name==='runs:claimNext'?runs.claimNext:name.startsWith('runtimeAgent:')?runtime[name.split(':')[1]]:undefined;
    return reg?await invoke(reg,f.ctx,args):await mutation(reference,args);
  };
  const run=await f.run(); await f.call(runtime.start,{runId:run.runId});
  const execution=f.db.table('runtimeAgentExecutions')[0];
  const attempt={reference:f.reference,runId:run.runId,attemptNumber:1,leaseVersion:execution.leaseVersion};
  const witnesses=[];
  for(let index=0;index<sourceCount;index++) {
    const content=`Controlled private context ${index}`,hash=await f.hash(content),sourceId=`probe-source-${index}`,sourceEventId=`probe-event-${index}`;
    f.db.seed('runtimeMemorySources',{tenantId:f.reference.tenantId,memorySpaceId:f.reference.memorySpaceId,ownerPrincipalId:f.reference.principalId,
      lineage:{sourceId,sourceEventId,sourceRevision:1,role:'user',trust:'user_assertion'},content,contentHash:hash,createdAt:clock});
    witnesses.push({sourceId,sourceEventId,sourceRevision:1,contentHash:hash});
  }
  await f.call(runtime.saveContext,{...attempt,context:'Controlled authorized evidence',witnesses,completeness:'complete'});
  const prepared=await f.call(runtime.prepareModelOperation,{...attempt,ordinal:0});
  const resolution=await f.call(ledger.resolve,{reference:f.reference,operationKey:'agent.respond',runBudgetId:prepared.current.run.runBudgetId});
  const pins=resolution.snapshot.pins;
  const request={semanticId:prepared.op.semanticId,childCallId:'controlled-child',texts:['Hello world!'],messages:[{role:'user',parts:[{type:'text',text:'Hello world!'}]}],
    inputTokens:1,outputTokens:20,toolSteps:0,timeoutMs:1000,reservationUnits:resolution.snapshot.costBound.maximumCostUnits,
    promptVersion:pins.promptVersion,schemaVersion:pins.schemaVersion,extractionVersion:pins.extractionVersion,toolRegistryVersion:pins.toolRegistryVersion,tools:[],options:{maxRetries:0}};
  request.inputTokens=ledger.deriveQualifiedInputBound(resolution.dispatchEvidence,request);
  const args={...attempt,operationId:prepared.op.operationId,ordinal:0,requestCanonical:canonicalModelJson(request),snapshotCanonical:canonicalModelJson(resolution.snapshot)};
  const records=[], writes=[]; let epoch=0;
  const get=f.db.get.bind(f.db),query=f.db.query.bind(f.db);
  f.db.get=async (table,id) => {const value=await get(table,id);records.push({kind:'get',table,id,epoch,documents:value?1:0});return value;};
  f.db.query=table => {
    const builder=query(table);let indexName,conditions=[],filter=false,order;
    const withIndex=builder.withIndex.bind(builder);
    builder.withIndex=(name,callback)=>{indexName=name;return withIndex(name,q=>{
      let proxy; proxy=new Proxy(q,{get(target,key){const value=Reflect.get(target,key);if(typeof value!=='function')return value;
        return (...args)=>{conditions.push([key,...args]);value.apply(target,args);return proxy;};}});return callback(proxy);
    });};
    const originalFilter=builder.filter.bind(builder);builder.filter=callback=>{filter=true;return originalFilter(callback);};
    const originalOrder=builder.order.bind(builder);builder.order=value=>{order=value;return originalOrder(value);};
    for(const method of ['take','collect','unique','first','paginate']) {
      const terminal=builder[method].bind(builder);
      builder[method]=async (...args)=>{const value=await terminal(...args);records.push({kind:'query',table,index:indexName,conditions,filter,order,method,args,epoch,
        documents:Array.isArray(value)?value.length:value?.page?value.page.length:value?1:0});return value;};
    }
    return builder;
  };
  for(const method of ['insert','patch','replace','delete']) {
    const write=f.db[method].bind(f.db);
    f.db[method]=async (...args)=>{const result=await write(...args);writes.push({method,table:args[0],id:typeof args[1]==='string'?args[1]:undefined,fields:Object.keys(typeof args[1]==='string'?args[2]??{}:args[1]??{}),epoch});epoch++;return result;};
  }
  const beforeWrites=f.db.writes, started=performance.now();
  const outcome=await f.call(runtime.admitModelOperation,args);const isolatedHandlerMs=performance.now()-started;
  expect(outcome).toMatchObject({admission:{status:'reserved'},permit:{dispatchPermit:true}});
  expect(f.db.table('runtimeModelAttempts')).toHaveLength(1);expect(f.db.table('runtimeModelAttempts')[0].state).toBe('dispatch_pending');
  expect(writes).toHaveLength(f.db.writes-beforeWrites);
  const aggregate=new Map(), uniqueControls=new Set(), uniqueControlsPerWriteEpoch=new Set();
  for(const row of records) {
    const {epoch:_epoch,documents:_documents,...lookup}=row;const identity=exactKey(lookup);
    const value=aggregate.get(identity)??{identity:JSON.parse(identity),calls:0,documents:0,epochs:[]};value.calls++;value.documents+=row.documents;
    if(!value.epochs.includes(row.epoch))value.epochs.push(row.epoch);aggregate.set(identity,value);
    if(controlTables.has(row.table)){uniqueControls.add(identity);uniqueControlsPerWriteEpoch.add(exactKey([row.epoch,identity]));}
  }
  const controls=records.filter(row=>controlTables.has(row.table));
  scenarios.push({sourceCount,isolatedHandlerMs,registeredHandler:'runtimeAgent.admitModelOperation',returnedPermit:true,
    totalReadCalls:records.length,totalReturnedDocuments:records.reduce((total,row)=>total+row.documents,0),authorityReadCalls:controls.length,
    authorityReturnedDocuments:controls.reduce((total,row)=>total+row.documents,0),distinctExactAuthorityReadIdentities:uniqueControls.size,
    distinctExactAuthorityReadIdentitiesPerWriteEpoch:uniqueControlsPerWriteEpoch.size,
    potentialEliminableAuthorityCallsIfEntireInvocationReadStable:controls.length-uniqueControls.size,
    potentialEliminableAuthorityCallsWithEveryWriteInvalidation:controls.length-uniqueControlsPerWriteEpoch.size,
    writes,readIdentities:[...aggregate.values()].sort((a,b)=>b.calls-a.calls),orderedReads:records});
});
afterEach(()=>{if(scenarios.length===2)fs.writeFileSync(`${qa}/cloud-k11-admission-read-investigation-counts.json`,JSON.stringify({sourceCommit:'acf3b5efa4d1d3b798fa655b0db919cf6baf7f40',
  scope:'Actual unmodified registered handlers; controlled DB/component ports, no native engine/OCC/service/latency claim; no reuse implemented.',paidCalls:0,services:0,scenarios},null,2)+'\n');});
