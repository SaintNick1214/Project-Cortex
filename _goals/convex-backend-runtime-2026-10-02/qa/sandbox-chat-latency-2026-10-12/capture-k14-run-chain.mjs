/** One exact disposable target; query/log reads only; no raw prompts/output/errors retained. */
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {loadSession, createContext, PROOFS_ROOT} from '/Users/SaintNick/Documents/Cortex/Project-Cortex-Proofs/sandbox-env/runner.mjs';
import {verifyCloud, getDeployKey} from '/Users/SaintNick/Documents/Cortex/Project-Cortex-Proofs/sandbox-env/cloud.mjs';
const sessionId=process.argv[2];assert.match(sessionId,/^[a-f0-9-]{36}$/);
const runId=process.argv[3];assert.match(runId,/^run:[a-f0-9]{64}$/);
assert.ok(['run:319a64e2e3d6801803993028a70b57b784060c56c6a3b194bfba81786bc4f292','run:ef6c7741bd3f1155311b155bc860fd5ca850bf10c7402afb6e982f9d5703ab06','run:f600e0263131135d6c0f752963aa1e572c3415405b097747406c4dee2356e43d','run:68ee2464ec0a49342521a1cddc862ac6f36ae21a78aeb8b01e1fb458cd1904fe'].includes(runId),'Exact authorized K14 run required');
const session=await loadSession(PROOFS_ROOT,sessionId);assert.equal(session.phase,'READY');
assert.equal(session.target.name,process.argv[4]);assert.equal(session.target.id,Number(process.argv[5]));
assert.equal(session.target.teamId,325340);assert.equal(session.target.projectId,3200658);
assert.equal(session.target.reference,'dev/cortex-sandbox-'+sessionId);

const exactTarget = async value => {
 assert.equal(value.id,'e07fd8cd-4f0b-4ceb-833c-15b167bda97f');assert.equal(value.phase,'READY');assert.equal(value.ownerUid,process.getuid());
 assert.equal(value.target.name,'mild-eagle-107');assert.equal(value.target.id,6150945);assert.equal(value.target.teamId,325340);assert.equal(value.target.projectId,3200658);
 assert.equal(value.target.reference,'dev/cortex-sandbox-e07fd8cd-4f0b-4ceb-833c-15b167bda97f');assert.equal(value.target.isDefault,false);
 assert.equal(value.target.expiresAt,1792536059586);assert.ok(value.target.expiresAt>Date.now());
 assert.equal(value.container.imageId,'sha256:f1b4bb13bf023ed2851f0bca5c9da2a18eca1e7010daee7eeaef730978d56406');
 const host=JSON.parse(await fs.readFile(path.join(value.receiptDir,'host-prepared.json'),'utf8'));
 assert.equal(host.sourceCommit,'8917f3250fc50aa7f30f5cd727aaf279709a2ef2');
};
await exactTarget(session);

const ctx=await createContext(session,{logger:()=>{}});let freshVerifications=0;
// The read-only diagnostic must not alter even the existing private journal/receipts.
ctx.persist=async()=>{};ctx.receipt=async(name)=>{if(name.startsWith('cloud-verified-'))freshVerifications++;};
const managementFetch=ctx.fetch;ctx.fetch=(url,options={})=>{assert.equal((options.method??'GET').toUpperCase(),'GET');return managementFetch(url,options);};
await verifyCloud(session,ctx);const key=await getDeployKey(session,ctx);
const requireHost=createRequire(path.join(session.backendDir,'package.json'));
const {BaseConvexClient}=requireHost('convex/browser');
const waiting=new Map();
const client=new BaseConvexClient(session.target.deploymentUrl, tokens=>{for(const token of tokens){const waiter=waiting.get(token);if(!waiter)continue;try{waiter.resolve(client.localQueryResultByToken(token));}catch(error){waiter.reject(error);}}},{logger:false,unsavedChangesWarning:false,webSocketConstructor:WebSocket});client.setAdminAuth(key);
const opaque=value=>typeof value==='string'&&/^[a-zA-Z0-9+/_:.=-]{1,512}$/.test(value)?value:undefined;
const hash=value=>createHash('sha256').update(String(value)).digest('hex');
const code=value=>typeof value==='string'&&/^[A-Z][A-Z0-9_]{1,100}$/.test(value)?value:undefined;
function errorSummary(value){
 if(!value)return undefined;const text=typeof value==='string'?value:JSON.stringify(value);
 const checks={dateNow:/Date\.now|date now/i,random:/Math\.random|randomness/i,processGlobal:/process is not defined|process\.env/i,
  deterministic:/deterministic|non.?deterministic/i,argumentValidation:/ArgumentValidationError|argument validation|extra field|missing required field/i,
  missingRunQuery:/runQuery is not a function|runQuery.*undefined/i,missingRunMutation:/runMutation is not a function|runMutation.*undefined/i,
  missingReference:/Invalid function reference|unknown function|could not find.*function/i,invalidState:/INVALID_STATE/i,
  staleTranscript:/STALE_TRANSCRIPT/i,staleContext:/STALE_CONTEXT/i,forbidden:/FORBIDDEN/i,policyDenied:/POLICY_DENIED/i,
  timeout:/timeout|timed out|deadline/i,transactionLimit:/too many|read limit|database.*limit/i,
  workflow:/workflow/i,jsonParse:/JSON|Unexpected token/i,serialization:/serializ|unsupported type/i,
  browserGlobal:/window is not defined|document is not defined/i,traceHelper:/traceRuntimePhase|runtimeLatencyTrace/i,
  undefinedEnv:/Cannot read properties of undefined[^\n]*reading ['"]env['"]/,typeError:/TypeError/,referenceError:/ReferenceError/,convexError:/ConvexError/,assertionError:/AssertionError/};
 return {sha256:hash(text),bytes:Buffer.byteLength(text),classifications:Object.fromEntries(Object.entries(checks).map(([name,pattern])=>[name,pattern.test(text)])),
  knownCodes:['POLICY_DENIED','FORBIDDEN','INVALID_STATE','STALE_TRANSCRIPT','STALE_CONTEXT','LEASE_EXPIRED','CAPABILITY_UNAVAILABLE','MODEL_INTERRUPTED','CONTEXT_LIMIT_EXCEEDED','STALE_SOURCE'].filter(item=>text.includes(item)),
  stackSourceLocations:[...text.matchAll(/(?:at\s+[^\n]*?\()?([a-zA-Z0-9_./-]+\.tsx?):(\d+):(\d+)/g)].map(match=>({file:match[1],line:Number(match[2]),column:Number(match[3])})).slice(0,12)};
}
async function table(table,componentPath=''){
 const page=await new Promise((resolve,reject)=>{const subscription=client.subscribe('_system/cli/tableData',{table,order:'desc',paginationOpts:{cursor:null,numItems:256}},{componentPath});
  const timer=setTimeout(()=>{waiting.delete(subscription.queryToken);subscription.unsubscribe();reject(Error('Bounded system query timeout'));},30000);
  waiting.set(subscription.queryToken,{resolve:value=>{clearTimeout(timer);waiting.delete(subscription.queryToken);subscription.unsubscribe();resolve(value);},reject:error=>{clearTimeout(timer);waiting.delete(subscription.queryToken);subscription.unsubscribe();reject(error);}});
 });
 assert.ok(Array.isArray(page.page),'System table query shape changed');assert.equal(page.isDone,true,'Bounded table scan overflow');return page.page;
}
try {
const runs=(await table('runtimeRuns')).filter(row=>row.runId===runId);assert.equal(runs.length,1,'Exact failed run must exist once');
const run=runs[0];const executions=(await table('runtimeAgentExecutions')).filter(row=>row.runId===runId);assert.equal(executions.length,1);
const execution=executions[0];const workflowRows=(await table('workflows','workflow')).filter(row=>row._id===execution.workflowId);
const steps=(await table('steps','workflow')).filter(row=>row.workflowId===execution.workflowId);
const agentOps=(await table('runtimeAgentOperations')).filter(row=>row.runId===runId);
const modelOps=(await table('runtimeModelOperations')).filter(row=>row.runAccountId===run.runAccountId);
const modelAttempts=(await table('runtimeModelAttempts')).filter(row=>row.runAccountId===run.runAccountId);
const outputRows=(await table('runtimeAgentOutput')).filter(row=>row.runId===runId);
const ingestionEvents=(await table('runtimeIngestionEvents')).filter(row=>row.runId===runId);
const eventIds=new Set(ingestionEvents.map(row=>row.eventId));
const ingestionStages=(await table('runtimeIngestionStages')).filter(row=>eventIds.has(row.eventId));
const ingestionJobs=(await table('runtimeIngestionJobs')).filter(row=>eventIds.has(row.eventId));
const titleJobs=(await table('runtimeContentJobs')).filter(row=>row.parentRunId===runId);
const scalarRows=(rows,names)=>rows.map(row=>Object.fromEntries(names.filter(name=>typeof row[name]==='string'&&/^[a-zA-Z0-9_/:. -]{1,256}$/.test(row[name])||typeof row[name]==='number'&&Number.isFinite(row[name])||typeof row[name]==='boolean').map(name=>[name,row[name]])));
const durable=outputRows.map(row=>{const part=JSON.parse(row.partCanonical),textPart=['text','text-delta'].includes(part.type)&&typeof part.text==='string';return {sequence:row.sequence,final:row.final,createdAt:row.createdAt,type:opaque(part.type),nonemptyText:textPart&&!!part.text.trim(),textBytes:textPart?Buffer.byteLength(part.text):0};}).sort((left,right)=>left.sequence-right.sequence);
const stages={durable,agentOperations:scalarRows(agentOps,['kind','ordinal','state','createdAt','startedAt','endedAt']),modelOperations:scalarRows(modelOps,['_id','operationKey','createdAt','reservedUnits','settledUnits','uncertainUnits']),modelAttempts:scalarRows(modelAttempts,['operationDocumentId','state','createdAt','checkpointAt','reservationUnits','slotReleased','resultWithheld','outputVisible','resultAttachmentState','costProvenance','settledCostUnits']),ingestionEvents:scalarRows(ingestionEvents,['eventId','sequence','eligibility','factsState','vectorsState','graphState','createdAt','updatedAt']),ingestionStages:scalarRows(ingestionStages,['eventId','stage','state','failureCode','attempt','leaseVersion','updatedAt']),ingestionJobs:scalarRows(ingestionJobs,['eventId','runBudgetId','runAccountId','createdAt']),titleJobs:scalarRows(titleJobs,['jobId','intent','state','failureCode','createdAt','updatedAt'])};
const phases=[],errors=[],shapes=new Map();
await exactTarget(await loadSession(PROOFS_ROOT,session.id));await verifyCloud(session,ctx);
const output={observedAt:new Date().toISOString(),target:{sessionId,name:session.target.name,id:session.target.id,reference:session.target.reference},freshVerifications,
 run:{runId,responseStatus:code(run.responseStatus?.toUpperCase()),failureCode:code(run.failureCode),attemptNumber:run.attemptNumber,createdAt:run.createdAt,updatedAt:run.updatedAt,outputMessageCount:run.outputMessageIds?.length},
 execution:{state:code(execution.state?.toUpperCase()),contextState:code(execution.contextState?.toUpperCase()),failureCode:code(execution.failureCode),workflowId:opaque(execution.workflowId)},
 workflows:workflowRows.map(row=>({id:opaque(row._id),generationNumber:row.generationNumber,resultKind:opaque(row.runResult?.kind),error:errorSummary(row.runResult?.error)})),
 stages,runBudgetId:opaque(run.runBudgetId),steps:steps.map(row=>({stepNumber:row.stepNumber,name:typeof row.step.name==='string'&&/^[a-zA-Z0-9_/:. -]{1,128}$/.test(row.step.name)?row.step.name:undefined,functionType:opaque(row.step.functionType),inProgress:row.step.inProgress,resultKind:opaque(row.step.runResult?.kind),startedAt:row.step.startedAt,completedAt:row.step.completedAt,error:errorSummary(row.step.runResult?.error)})),
 counts:{agentOperations:agentOps.length,modelOperations:modelOps.length,modelAttempts:modelAttempts.length},errors,phases,logLineStructures:[...shapes].map(([shape,count])=>({...JSON.parse(shape),count})),rawPayloadRetained:false};
const destination=path.join(path.dirname(new URL(import.meta.url).pathname),'run-chain-'+runId.slice(4,16)+'-'+Date.now()+'.json');await fs.writeFile(destination,JSON.stringify(output,null,2)+'\n');
console.log(JSON.stringify({receipt:destination,run:output.run,execution:output.execution,counts:output.counts,firstDurableText:durable.find(row=>!row.final&&row.nonemptyText)?.createdAt,finalCanonicalText:durable.find(row=>row.final&&row.nonemptyText)?.createdAt,titleJobs:stages.titleJobs,ingestion:stages.ingestionEvents}));
} finally { await client.close(); }
