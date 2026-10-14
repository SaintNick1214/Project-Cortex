import {K21_PINS,K21_NATIVE_NAMES,requireK21ReadyPins} from './k21-collector-pins.mjs';
requireK21ReadyPins();
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
assert.equal(runId,'run:666cc944a716d927af6103f027e850e16271ce7d25acba16c5f2dfe275b21def','Exact authorized failed tool continuation required');
const session=await loadSession(PROOFS_ROOT,sessionId);assert.equal(session.phase,'READY');
assert.equal(session.target.name,process.argv[4]);assert.equal(session.target.id,Number(process.argv[5]));
assert.equal(session.target.teamId,325340);assert.equal(session.target.projectId,3200658);
assert.equal(session.target.reference,'dev/cortex-sandbox-'+sessionId);

const exactTarget = async value => {
 assert.equal(value.id,K21_PINS.sessionId);assert.equal(value.phase,'READY');assert.equal(value.ownerUid,process.getuid());
 assert.equal(value.target.name,K21_PINS.name);assert.equal(value.target.id,K21_PINS.targetId);assert.equal(value.target.teamId,325340);assert.equal(value.target.projectId,3200658);
 assert.equal(value.target.reference,'dev/cortex-sandbox-'+K21_PINS.sessionId);assert.equal(value.target.isDefault,false);
 assert.equal(value.target.expiresAt,K21_PINS.expiresAt);assert.ok(value.target.expiresAt>Date.now());
 assert.equal(value.container.imageId,K21_PINS.imageId);
 const host=JSON.parse(await fs.readFile(path.join(value.receiptDir,'host-prepared.json'),'utf8'));
 assert.equal(host.sourceCommit,K21_PINS.sourceCommit);
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
const hash=value=>createHash('sha256').update(String(value)).digest('hex');
const knownNames=['AI_MissingToolResultsError','MissingToolResultsError','AI_InvalidPromptError','InvalidPromptError','AI_TypeValidationError','TypeValidationError','AI_InvalidToolInputError','InvalidToolInputError','AI_NoSuchToolError','NoSuchToolError','AI_UnsupportedFunctionalityError','UnsupportedFunctionalityError','AbortError','ConvexError','TypeError','ReferenceError'];
function leaf(value){
 if(typeof value!=='string'||!value)return undefined;
 return {sha256:hash(value),bytes:Buffer.byteLength(value),knownErrorNames:knownNames.filter(name=>value.includes(name)),classifications:{
  missingToolResults:/MissingToolResults|tool (?:call|result)s? .*missing|missing.*tool (?:call|result)/i.test(value),
  duplicateTool:/duplicate.*tool|tool.*duplicate/i.test(value),
  toolOrder:/tool.*(?:order|preced|follow|matching)|(?:order|preced|follow|matching).*tool/i.test(value),
  invalidPrompt:/InvalidPrompt|invalid prompt|InvalidMessage|invalid message/i.test(value),
  streamState:/stream.*(?:not found|aborted|conflict|state)|(?:not found|conflict).*stream/i.test(value),
  serialization:/serializ|could not convert|schema|validation/i.test(value),
  genericAbort:/abort/i.test(value),policyDenied:/POLICY_DENIED/.test(value),budgetExceeded:/BUDGET_EXCEEDED/.test(value),
  timeout:/timeout|timed out|deadline/i.test(value),contextLimit:/CONTEXT_LIMIT|context.*limit|input.*limit/i.test(value)},
  sourceLocations:[...value.matchAll(/(?:at\s+[^\n]*?\()?([a-zA-Z0-9_./-]+\.tsx?):(\d+):(\d+)/g)].map(m=>({file:m[1],line:Number(m[2]),column:Number(m[3])})).slice(0,8)};
}
let queries=0,clientsClosed=false,output;
async function query(name,args,componentPath=''){
 await exactTarget(await loadSession(PROOFS_ROOT,session.id));await verifyCloud(session,ctx);queries++;
 const result=await new Promise((resolve,reject)=>{const sub=client.subscribe(name,args,{componentPath});
  const timer=setTimeout(()=>{waiting.delete(sub.queryToken);sub.unsubscribe();reject(Error('Bounded tool leaf read timeout'));},30000);
  waiting.set(sub.queryToken,{resolve:value=>{clearTimeout(timer);waiting.delete(sub.queryToken);sub.unsubscribe();resolve(value);},reject:error=>{clearTimeout(timer);waiting.delete(sub.queryToken);sub.unsubscribe();reject(error);}});
 });
 assert.ok(Buffer.byteLength(JSON.stringify(result))<=16777216,'Original byte bound exceeded');
 await exactTarget(await loadSession(PROOFS_ROOT,session.id));await verifyCloud(session,ctx);return result;
}
async function table(name){const value=await query('_system/cli/tableData',{table:name,order:'desc',paginationOpts:{cursor:null,numItems:256}});assert.ok(Array.isArray(value.page));assert.equal(value.isDone,true,'Original bounded system page overflow');return value.page;}
try {
 const runs=(await table('runtimeRuns')).filter(row=>row.runId===runId);assert.equal(runs.length,1);const run=runs[0];
 const conversations=(await table('runtimeConversations')).filter(row=>row.conversationId===run.conversationId&&row.tenantId===run.tenantId&&row.memorySpaceId===run.memorySpaceId);assert.equal(conversations.length,1);const convo=conversations[0];
 assert.equal(convo.ownerPrincipalId,run.ownerPrincipalId);assert.equal(convo.epoch,run.conversationEpoch);assert.equal(convo.tombstonedAt,undefined);
 const snapshot=JSON.parse(run.snapshotCanonical);assert.equal(snapshot.threadId,convo.threadId);assert.equal(snapshot.conversationId,convo.conversationId);
 const page=await query('messages:listMessagesByThreadId',{threadId:convo.threadId,excludeToolMessages:false,order:'desc',paginationOpts:{cursor:null,numItems:256}},'agent');assert.ok(Array.isArray(page.page));assert.equal(page.isDone,true,'Original bounded message page overflow');assert.ok(page.page.length<=256);
 output={observedAt:new Date().toISOString(),sourceCommit:K21_PINS.sourceCommit,target:{sessionId,name:session.target.name,id:session.target.id},runId,readOnly:true,conversationIdSha256:hash(convo.conversationId),threadIdSha256:hash(convo.threadId),queryCount:queries,freshVerifications,
  messages:page.page.map(row=>({idSha256:hash(row._id),creationTime:row._creationTime,order:row.order,stepOrder:row.stepOrder,status:row.status,role:row.message?.role,tool:row.tool,partTypes:Array.isArray(row.message?.content)?row.message.content.map(p=>typeof p.type==='string'&&/^[a-z-]{1,64}$/.test(p.type)?p.type:'UNCLASSIFIED'):[],
   toolCallIdsSha256:Array.isArray(row.message?.content)?row.message.content.filter(p=>typeof p.toolCallId==='string').map(p=>hash(p.toolCallId)):[],error:leaf(row.error)})),
  rawPrivatePayloadRetained:false,rawErrorTextRetained:false,byteCap:16777216,pageCap:256,deadlineMs:30000,
  streamsRead:false,streamLimitation:'Official aborted stream cleanup is five minutes; no extra stream query issued',mutationCalls:0,paidCalls:0};
} catch(error){output={observedAt:new Date().toISOString(),sourceCommit:K21_PINS.sourceCommit,target:{sessionId,name:session.target.name,id:session.target.id},runId,readOnly:true,queryCount:queries,freshVerifications,failed:true,error:{name:/^[a-zA-Z_]{1,64}$/.test(error.name)?error.name:'UNCLASSIFIED',messageSha256:hash(error.message??''),messageBytes:Buffer.byteLength(error.message??'')},rawPrivatePayloadRetained:false,mutationCalls:0,paidCalls:0};process.exitCode=1;
} finally {await client.close();clientsClosed=true;}
output.clientsClosed=clientsClosed;
const destination=path.join(path.dirname(new URL(import.meta.url).pathname),'k21-tool-leaf-native-'+Date.now()+'.json');await fs.writeFile(destination,JSON.stringify(output,null,2)+'\n');console.log(JSON.stringify({receipt:destination,failed:output.failed??false,clientsClosed,queryCount:queries,failedMessageLeaves:output.messages?.filter(m=>m.error).map(m=>({creationTime:m.creationTime,status:m.status,error:m.error}))}));
