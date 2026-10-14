/** One authorized K28 CLI-first request diagnosis; no raw request/output is persisted. */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {K28_PINS,requireK28ReadyPins} from './k28-collector-pins.mjs';
import {loadSession,createContext,PROOFS_ROOT} from '/Users/SaintNick/Documents/Cortex/Project-Cortex-Proofs/sandbox-env/runner.mjs';
import {verifyCloud,getDeployKey} from '/Users/SaintNick/Documents/Cortex/Project-Cortex-Proofs/sandbox-env/cloud.mjs';
requireK28ReadyPins();
assert.equal(process.env.CORTEX_K28_REQUEST_ORDER_GO,'cli-first');
const runId=K28_PINS.runIds[2];assert.match(runId,/^run:[a-f0-9]{64}$/);
const session=await loadSession(PROOFS_ROOT,K28_PINS.sessionId);
async function exact(value){
 assert.equal(value.id,K28_PINS.sessionId);assert.equal(value.phase,'READY');assert.equal(value.ownerUid,process.getuid());
 assert.equal(value.target.name,K28_PINS.name);assert.equal(value.target.id,K28_PINS.targetId);
 assert.equal(value.target.teamId,325340);assert.equal(value.target.projectId,3200658);assert.equal(value.target.isDefault,false);
 assert.equal(value.target.reference,'dev/cortex-sandbox-'+K28_PINS.sessionId);assert.equal(value.target.expiresAt,K28_PINS.expiresAt);assert.ok(value.target.expiresAt>Date.now());
 assert.equal(value.container.imageId,K28_PINS.imageId);
 assert.equal(JSON.parse(await fs.readFile(path.join(value.receiptDir,'host-prepared.json'),'utf8')).sourceCommit,K28_PINS.sourceCommit);
}
await exact(session);
const ctx=await createContext(session,{logger:()=>{}});ctx.persist=async()=>{};ctx.receipt=async()=>{};
const management=ctx.fetch;ctx.fetch=(url,options={})=>{assert.equal((options.method??'GET').toUpperCase(),'GET');return management(url,options);};
await verifyCloud(session,ctx);const key=await getDeployKey(session,ctx);
const requireHost=createRequire(path.join(session.backendDir,'package.json'));const {BaseConvexClient}=requireHost('convex/browser');
const waiting=new Map();const client=new BaseConvexClient(session.target.deploymentUrl,tokens=>{for(const token of tokens){const waiter=waiting.get(token);if(!waiter)continue;try{waiter.resolve(client.localQueryResultByToken(token));}catch(error){waiter.reject(error);}}},{logger:false,unsavedChangesWarning:false,webSocketConstructor:WebSocket});client.setAdminAuth(key);
let queryCount=0;const tables=[];
async function table(name,componentPath=''){
 await exact(await loadSession(PROOFS_ROOT,session.id));await verifyCloud(session,ctx);queryCount++;
 const page=await new Promise((resolve,reject)=>{const subscription=client.subscribe('_system/cli/tableData',{table:name,order:'desc',paginationOpts:{cursor:null,numItems:256}},{componentPath});
  const timer=setTimeout(()=>{waiting.delete(subscription.queryToken);subscription.unsubscribe();reject(Error('Bounded request-order query timeout'));},30000);
  waiting.set(subscription.queryToken,{resolve:value=>{clearTimeout(timer);waiting.delete(subscription.queryToken);subscription.unsubscribe();resolve(value);},reject:error=>{clearTimeout(timer);waiting.delete(subscription.queryToken);subscription.unsubscribe();reject(error);}});
 });
 assert.ok(Array.isArray(page.page));assert.equal(page.isDone,true,'Bounded request-order table overflow');tables.push({name,componentPath,rows:page.page.length});return page.page;
}
const hash=value=>createHash('sha256').update(typeof value==='string'?value:JSON.stringify(value)).digest('hex');
const markers=['READY48','WARM48','CLI48','CLW48','TOOL48'];
function texts(value){if(typeof value==='string')return[value];if(Array.isArray(value))return value.flatMap(texts);if(value&&typeof value==='object')return Object.values(value).flatMap(texts);return[];}
function project(value){const strings=texts(value),joined=strings.join('\n');return {sha256:hash(value),utf8Bytes:Buffer.byteLength(joined),markerCounts:Object.fromEntries(markers.map(marker=>[marker,[...joined.matchAll(new RegExp('\\b'+marker+'\\b','g'))].length])),exactRequestedDirectiveCLI48:joined.includes('Reply exactly CLI48.'),exactOlderDirectiveREADY48:joined.includes('Reply exactly READY48.'),containsTopazSyntheticPreference:joined.includes('favorite gemstone is topaz')};}
let output;let failure;
try{
 const runs=(await table('runtimeRuns')).filter(row=>row.runId===runId);assert.equal(runs.length,1);const run=runs[0];
 const executions=(await table('runtimeAgentExecutions')).filter(row=>row.runId===runId);assert.equal(executions.length,1);const execution=executions[0];
 const agentOps=(await table('runtimeAgentOperations')).filter(row=>row.runId===runId&&row.kind==='model'&&row.ordinal===0);assert.equal(agentOps.length,1);
 const modelOps=(await table('runtimeModelOperations')).filter(row=>row.runAccountId===run.runAccountId&&row.operationKey==='agent.respond'&&row.semanticId===agentOps[0].semanticId);assert.equal(modelOps.length,1);
 const attempts=(await table('runtimeModelAttempts')).filter(row=>row.operationDocumentId===modelOps[0]._id);assert.equal(attempts.length,1);const attempt=attempts[0];
 const stored=JSON.parse(attempt.canonical);assert.ok(stored.request&&typeof stored.request==='object');const request=stored.request;assert.ok(Array.isArray(request.messages));
 const messages=request.messages.map((message,index)=>({index,role:['system','user','assistant','tool'].includes(message.role)?message.role:'UNRECOGNIZED',...project(message),partTypes:Array.isArray(message.parts)?message.parts.map(part=>typeof part.type==='string'&&/^[a-z-]{1,64}$/.test(part.type)?part.type:'UNRECOGNIZED'):[]}));
 const inputIds=new Set(run.inputMessageIds??[]),outputIds=new Set(run.outputMessageIds??[]);
 const native=(await table('messages','agent')).filter(row=>inputIds.has(row._id)||outputIds.has(row._id));
 const nativeInput=native.filter(row=>inputIds.has(row._id)).map(row=>({idSha256:hash(row._id),status:row.status,order:row.order,stepOrder:row.stepOrder,...project(row.message)}));
 const nativeOutput=native.filter(row=>outputIds.has(row._id)).map(row=>({idSha256:hash(row._id),status:row.status,order:row.order,stepOrder:row.stepOrder,...project(row.message)}));
 assert.equal(nativeInput.length,inputIds.size,'All canonical input IDs must resolve');assert.equal(nativeOutput.length,outputIds.size,'All canonical output IDs must resolve');
 output={status:'READONLY_DIAGNOSIS_COMPLETE',target:{sessionId:session.id,name:session.target.name,id:session.target.id},sourceCommit:K28_PINS.sourceCommit,runId,responseStatus:run.responseStatus,attemptNumber:run.attemptNumber,
 binding:{agentOrdinal:agentOps[0].ordinal,semanticIdSha256:hash(agentOps[0].semanticId),modelOperationIdSha256:hash(modelOps[0]._id),attemptIdSha256:hash(attempt._id),dispatchIdentitySha256:hash(attempt.dispatchIdentity),operationMatchesAgentSemantic:true,attemptCount:attempts.length,state:attempt.state,resultAttachmentState:attempt.resultAttachmentState},
 request:{...project(request),canonicalSha256:hash(attempt.canonical),messages,lastUserIndex:messages.filter(message=>message.role==='user').at(-1)?.index,latestRole:messages.at(-1)?.role},
 candidateEntryPool:(execution.modelInputEntries??[]).map((entry,index)=>({index,kind:entry.kind,keySha256:hash(entry.key),...project(entry.text)})),nativeInput,nativeOutput,
 privateNativeResult:attempt.privateResultCanonical===undefined?null:project(JSON.parse(attempt.privateResultCanonical)),
 queryCount,tables,rawPayloadRetained:false,paidCalls:0,mutations:0,knownOutput:'NOT_OBSERVED_K28: outcome must come from the exact new run',limits:{rowsPerTable:256,queryDeadlineMs:30000},limitations:['Stored native governed request proves what was bound before official Gateway dispatch; unavailable provider-internal prompt transformations remain unproven.','Marker presence/order is evidence, not a causal model-behavior explanation. No full private text/result is retained.']};
 await exact(await loadSession(PROOFS_ROOT,session.id));await verifyCloud(session,ctx);
}catch(error){failure=error;}
finally{await client.close();}
if(failure)throw failure;
output.clientClosed=true;const destination=path.join(path.dirname(new URL(import.meta.url).pathname),'k28-request-order-diagnosis-'+Date.now()+'.json');await fs.writeFile(destination,JSON.stringify(output,null,2)+'\n');console.log(JSON.stringify({receipt:destination,runId,queryCount,clientClosed:true,messages:output.request.messages.length,rawPayloadRetained:false}));
