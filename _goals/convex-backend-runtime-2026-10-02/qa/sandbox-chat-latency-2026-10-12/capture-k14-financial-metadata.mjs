/** K7 projection of original read-only financial collector; original K3 helper retained. */
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {loadSession, createContext, PROOFS_ROOT} from '/Users/SaintNick/Documents/Cortex/Project-Cortex-Proofs/sandbox-env/runner.mjs';
import {verifyCloud, getDeployKey} from '/Users/SaintNick/Documents/Cortex/Project-Cortex-Proofs/sandbox-env/cloud.mjs';
const sessionId=process.argv[2];assert.match(sessionId,/^[a-f0-9-]{36}$/);
const runId=process.argv[3];assert.match(runId,/^run:[a-f0-9]{64}$/);
const session=await loadSession(PROOFS_ROOT,sessionId);assert.equal(session.phase,'READY');
assert.equal(session.target.name,process.argv[4]);assert.equal(session.target.id,Number(process.argv[5]));
assert.equal(session.target.teamId,325340);assert.equal(session.target.projectId,3200658);
assert.equal(session.target.reference,'dev/cortex-sandbox-'+sessionId);
assert.equal(sessionId,'e07fd8cd-4f0b-4ceb-833c-15b167bda97f');assert.equal(session.target.name,'mild-eagle-107');assert.equal(session.target.id,6150945);
assert.equal(session.target.expiresAt,1792536059586);assert.ok(session.target.expiresAt>Date.now());assert.equal(session.target.isDefault,false);
assert.equal(session.container.imageId,'sha256:f1b4bb13bf023ed2851f0bca5c9da2a18eca1e7010daee7eeaef730978d56406');
const ctx=await createContext(session,{logger:()=>{}});let freshVerifications=0;
// The read-only diagnostic must not alter even the existing private journal/receipts.
ctx.persist=async()=>{};ctx.receipt=async(name)=>{if(name.startsWith('cloud-verified-'))freshVerifications++;};
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
const q="/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion/_goals/convex-backend-runtime-2026-10-02/qa/sandbox-chat-latency-2026-10-12/";
try {
 const names={runtimeModelAttempts:['_id','operationDocumentId','runAccountId','tenantAccountId','state','createdAt','checkpointAt','reservationUnits','slotReleased','resultWithheld','outputVisible','resultAttachmentState','settledCostUnits','costProvenance'],
 runtimeModelOperations:['_id','operationKey','runAccountId','createdAt','reservedUnits','settledUnits','uncertainUnits','cancelled','overrun'],
 runtimeBudgetAccounts:['_id','kind','runBudgetId','tenantId','current','cancelled','activeConcurrency','limitUnits','reservedUnits','settledUnits','uncertainUnits','currency','monetaryUnit']};
 const rows={};
 for(const [name,fields] of Object.entries(names)){const values=await table(name);rows[name]=values.map(row=>Object.fromEntries(fields.filter(key=>typeof row[key]==='string'&&/^[a-zA-Z0-9_/:. -]{1,256}$/.test(row[key])||typeof row[key]==='number'&&Number.isFinite(row[key])||typeof row[key]==='boolean').map(key=>[key,row[key]])));}
 await verifyCloud(session,ctx);
 const attempts=rows.runtimeModelAttempts, summary={nativeAttempts:attempts.length,activeSlots:attempts.filter(row=>!row.slotReleased).length,reservationCeilingsUnits:attempts.reduce((total,row)=>total+row.reservationUnits,0),allSlotsReleased:attempts.every(row=>row.slotReleased),chargesUnknown:attempts.some(row=>row.state==='uncertain'),manualCallsNotRetried:true};
 const destination=q+'k14-financial-metadata-'+Date.now()+'.json';await fs.writeFile(destination,JSON.stringify({observedAt:new Date().toISOString(),target:{name:session.target.name,id:session.target.id,reference:session.target.reference},summary,rows,clockNote:'Ceilings/uncertainty are not actual charges; no prompts/results/authority tokens retained'},null,2)+'\n');
 console.log(JSON.stringify({summary,receipt:destination}));
} finally { await client.close(); }
