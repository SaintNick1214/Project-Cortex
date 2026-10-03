import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { ConvexClient } from "convex/browser";
import WebSocket from "ws";
import { HttpsProxyAgent } from "https-proxy-agent";
import { client, jwt, target } from "./client.mjs";
import { evidenceFile, fixtureDirectory } from "./paths.mjs";
import { resolve } from "node:path";

const selected=new Set(process.argv.slice(2));
const receiptFile=evidenceFile("live-receipts.json");
const c=client(),other=client(jwt("task01-other-owner"));
const evidence=selected.size&&existsSync(receiptFile) ? JSON.parse(readFileSync(receiptFile,"utf8")) : {version:1,startedAt:new Date().toISOString(),deployment:target.deploymentName,targetType:target.deploymentType,checks:[]};
if(evidence.deployment!==target.deploymentName)throw new Error("Evidence deployment differs from selected qualification target; use a fresh evidence directory.");
const knownChecks=new Set(["signed-JWT-identity-and-boundary","live-gateway-structured","live-gateway-responses","cross-component-atomic-final-and-ingestion","durable-cursor-reconciliation-after-forced-gap","live-agent-gateway-backend-tool-and-dedup","live-Gateway-tool-disconnect-multiple-observers-no-replay","persisted-Agent-stream-multiple-observers-reconnect","persisted-Agent-stream-cancellation","interrupted-external-HTTP-effect-uncertain-no-replay"]);
for(const name of selected)if(!knownChecks.has(name))throw new Error(`Unknown qualification check: ${name}`);
evidence.selectedChecks=[...selected];
evidence.wsVersion=JSON.parse(readFileSync(resolve(fixtureDirectory,"node_modules/ws/package.json"),"utf8")).version;
evidence.fixtureLockSha256=createHash("sha256").update(readFileSync(resolve(fixtureDirectory,"package-lock.json"))).digest("hex");
if(selected.size)evidence.rerunStartedAt=new Date().toISOString();
const prefix=`task01-${randomUUID()}`;
async function check(name,fn){
  if(selected.size&&!selected.has(name))return;
  evidence.checks=evidence.checks.filter(check=>check.name!==name);
  try{const result=await fn();evidence.checks.push({name,status:"PASS",result:result??null});console.log(name+": PASS");}
  catch(error){evidence.checks.push({name,status:"FAIL",error:String(error).slice(0,900)});console.log(name+": FAIL "+String(error).slice(0,300));}
  writeFileSync(receiptFile,JSON.stringify(evidence,null,2));
}
async function poll(fn,accept,timeout=60000){
  const deadline=Date.now()+timeout;let result;
  do{result=await fn();if(accept(result))return result;await new Promise(r=>setTimeout(r,100));}while(Date.now()<deadline);
  throw new Error("Timed out waiting for durable outcome: "+JSON.stringify(result).slice(0,300));
}
const observe=runId=>c.query("runtime:observe",{runId});
const start=(scenario,label=scenario)=>c.mutation("runtime:start",{requestId:`${prefix}:${label}`,scenario});

await check("signed-JWT-identity-and-boundary",async()=>{
  assert.deepEqual(await c.query("runtime:identity",{}),{version:1,principal:"task01-owner",grant:"fixture-text-only"});
  const tests=[{name:"no-token",c:client(null),pattern:/UNAUTHENTICATED/},{name:"valid-but-no-grant",c:client(jwt("task01-denied")),pattern:/FORBIDDEN/},{name:"wrong-audience",c:client(jwt("task01-owner",{aud:"wrong-audience"})),pattern:/authenticate|audience|provider/i},{name:"expired",c:client(jwt("task01-owner",{exp:1})),pattern:/authenticate|expired/i},{name:"bad-signature",c:client(jwt("task01-owner",{},true)),pattern:/InvalidAuthHeader|decode token|signature/i}];
  const negatives=[];
  for(const test of tests){await assert.rejects(()=>test.c.query("runtime:identity",{}),test.pattern);negatives.push(test.name);}
  const denied=await fetch(target.deploymentUrl.replace(".cloud",".site")+"/fixture-effect",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({operationId:"unowned"})});
  assert.equal(denied.status,403);
  return {verifiedSignedIdentity:true,negativeCases:negatives,privateHttpEffectWithoutSecret:denied.status,adminImpersonation:false};
});

for(const interfaceName of ["structured","responses"]){
  await check("live-gateway-"+interfaceName,async()=>{
    const result=await c.action("inference:capability",{interface:interfaceName});
    assert.equal(result.ok,true,JSON.stringify(result));
    if(interfaceName==="structured") assert.deepEqual(result.output,{ready:true});
    else assert.match(result.text,/READY/);
    return result;
  });
}

await check("cross-component-atomic-final-and-ingestion",async()=>{
  const runId=await start("atomic");
  await assert.rejects(()=>c.mutation("runtime:atomicFinalize",{runId,forceFailure:true}),/FORCED_TRANSACTION_FAILURE/);
  const failed=await observe(runId);
  assert.equal(failed.messages.filter(m=>m.message?.role==="assistant").length,0);
  assert.equal(failed.receipts.length,0);
  await c.mutation("runtime:atomicFinalize",{runId,forceFailure:false});
  const success=await observe(runId);
  assert.equal(success.messages.filter(m=>m.message?.role==="assistant").length,1);
  assert.equal(success.receipts.length,1);
  assert.equal(success.run.status,"completed");
  return {runId,forcedFailure:{assistantMessages:0,ingestionReceipts:0},success:{assistantMessages:1,ingestionReceipts:1}};
});

await check("durable-cursor-reconciliation-after-forced-gap",async()=>{
  const runId=await start("cursor");
  await assert.rejects(()=>c.action("inference:cursorGap",{runId}),/FORCED_AFTER_FINAL_BEFORE_RECEIPT/);
  const gap=await observe(runId);
  assert.equal(gap.messages.filter(m=>m.message?.role==="assistant").length,1);assert.equal(gap.receipts.length,0);
  assert.equal(await c.mutation("runtime:reconcile",{runId}),1);
  assert.equal(await c.mutation("runtime:reconcile",{runId}),0);
  const recovered=await observe(runId);assert.equal(recovered.receipts.length,1);
  await assert.rejects(()=>other.query("runtime:observe",{runId}),/FORBIDDEN/);
  await assert.rejects(()=>other.mutation("runtime:reconcile",{runId}),/FORBIDDEN/);
  return {runId,committedGap:{assistantMessages:1,receipts:0},idempotentRecovery:{firstAdded:1,secondAdded:0,receipts:1},crossOwnerReadAndWriteDenied:true};
});

await check("live-agent-gateway-backend-tool-and-dedup",async()=>{
  const runId=await start("gateway-tool");
  const result=await poll(()=>observe(runId),r=>["completed","failed"].includes(r.run.status));
  assert.equal(result.run.status,"completed",JSON.stringify(result.run));
  assert.equal(result.tools.length,1);assert.equal(result.tools[0].result,5);assert.equal(result.run.attempt,1);
  assert.equal(await start("gateway-tool"),runId);
  await assert.rejects(()=>c.mutation("runtime:start",{requestId:`${prefix}:gateway-tool`,scenario:"gateway-text"}),/IDEMPOTENCY_CONFLICT/);
  const again=await observe(runId);assert.equal(again.tools.length,1);assert.equal(again.run.attempt,1);
  return {runId,status:result.run.status,attempts:result.run.attempt,toolExecutions:result.tools.length,toolResult:5,receipts:result.receipts.length,canonicalMessages:result.messages.map(m=>({id:m._id,status:m.status,role:m.message?.role,content:m.message?.content})),persistedStreams:result.streams};
});

const proxyUrl=process.env.HTTPS_PROXY??process.env.HTTP_PROXY;
class ProxyWebSocket extends WebSocket{constructor(url,protocols){super(url,protocols,proxyUrl?{agent:new HttpsProxyAgent(proxyUrl)}:{});}}
function observer(){const cl=new ConvexClient(target.deploymentUrl,{webSocketConstructor:ProxyWebSocket});cl.setAuth(async()=>jwt());return cl;}

await check("live-Gateway-tool-disconnect-multiple-observers-no-replay",async()=>{
  const runId=await start("gateway-tool","gateway-tool-observers");
  const a=observer(),b=observer();let aSnapshots=0,bSnapshots=0;
  const ua=a.onUpdate("runtime:observe",{runId},()=>{aSnapshots++;});
  const ub=b.onUpdate("runtime:observe",{runId},()=>{bSnapshots++;});
  try{
    const executing=await poll(()=>observe(runId),s=>s.run.status==="running"&&s.tools.length===1);
    await poll(async()=>({aSnapshots,bSnapshots}),s=>s.aSnapshots>0&&s.bSnapshots>0);
    ua();await a.close();
    const final=await poll(()=>observe(runId),s=>["completed","failed"].includes(s.run.status));
    assert.equal(final.run.status,"completed");assert.equal(final.run.attempt,1);assert.equal(final.tools.length,1);assert.equal(final.receipts.length,1);
    const finalIds=final.messages.filter(m=>m.message?.role==="assistant").map(m=>m._id).sort();
    const reconnect=observer();let restored;
    const ur=reconnect.onUpdate("runtime:observe",{runId},s=>{restored=s;});
    await poll(async()=>restored,s=>s?.run.status==="completed");ur();await reconnect.close();
    assert.deepEqual(restored.messages.filter(m=>m.message?.role==="assistant").map(m=>m._id).sort(),finalIds);
    assert.equal(await start("gateway-tool","gateway-tool-observers"),runId);
    const after=await observe(runId);assert.equal(after.tools.length,1);assert.equal(after.run.attempt,1);assert.equal(after.receipts.length,1);
    return {evidenceKind:"actual-Gateway-Agent-backend-tool-and-managed-Convex-WebSocket",runId,disconnectStatus:executing.run.status,toolEffectsAtDisconnect:executing.tools.length,aSnapshots,bSnapshots,finalStatus:final.run.status,modelActionAttempts:final.run.attempt,toolEffects:final.tools.length,finalIngestionReceipts:final.receipts.length,sameCanonicalFinalIds:finalIds,persistedStreams:final.streams};
  }finally{ua();ub();await a.close();await b.close();}
});

await check("persisted-Agent-stream-multiple-observers-reconnect",async()=>{
  const runId=await start("synthetic-stream");
  const a=observer(),b=observer();let aSnapshots=0,bSnapshots=0;
  const snapshots=[];
  const ua=a.onUpdate("runtime:observe",{runId},s=>{aSnapshots++;snapshots.push({observer:"A",status:s.run.status,streams:s.streams.length});});
  const ub=b.onUpdate("runtime:observe",{runId},s=>{bSnapshots++;snapshots.push({observer:"B",status:s.run.status,streams:s.streams.length});});
  try{
    const live=await poll(()=>observe(runId),s=>s.streams.some(stream=>stream.status==="streaming"));
    const streamId=live.streams[0].streamId;
    const initial=await poll(()=>c.query("runtime:observe",{runId,streamArgs:{kind:"deltas",cursors:[{streamId,cursor:0}]}}),s=>s.deltas?.kind==="deltas"&&s.deltas.deltas.length>0);
    const savedCursor=Math.max(...initial.deltas.deltas.map(d=>d.end));
    ua();await a.close();
    const end=await poll(()=>observe(runId),s=>s.run.status==="completed");
    const resumed=await c.query("runtime:observe",{runId,streamArgs:{kind:"deltas",cursors:[{streamId,cursor:savedCursor}]}});
    assert.equal(resumed.deltas.kind,"deltas");assert.ok(resumed.deltas.deltas.length>0);
    assert.ok(resumed.deltas.deltas.every(d=>d.start>=savedCursor));
    assert.ok(aSnapshots>0&&bSnapshots>0);assert.equal(end.run.attempt,1);
    assert.ok(end.hiddenReasoningParts>0);assert.ok(!JSON.stringify(end).includes("private fixture reasoning"));assert.ok(!JSON.stringify(resumed).includes("private fixture reasoning"));
    const reconnect=observer();let reconnectSnapshot;
    const ur=reconnect.onUpdate("runtime:observe",{runId},s=>{reconnectSnapshot=s;});
    await poll(async()=>reconnectSnapshot,s=>s?.run.status==="completed");ur();await reconnect.close();
    return {evidenceKind:"synthetic-model-on-real-Agent-Workflow-and-managed-Convex",runId,aSnapshots,bSnapshots,disconnectDidNotCancel:true,savedCursor,resumedDeltas:resumed.deltas,finalStatus:end.run.status,attempts:end.run.attempt,hiddenReasoningParts:end.hiddenReasoningParts,rawReasoningSuppressed:true,reconnectedCanonicalMessages:reconnectSnapshot.messages.map(m=>({id:m._id,status:m.status,role:m.message?.role,content:m.message?.content})),snapshots};
  }finally{ua();ub();await a.close();await b.close();}
});

await check("persisted-Agent-stream-cancellation",async()=>{
  const runId=await start("synthetic-stream","cancel-stream");
  await poll(()=>observe(runId),s=>s.streams.some(stream=>stream.status==="streaming"));
  const ack=await c.mutation("runtime:cancel",{runId});assert.equal(ack.status,"cancelled");assert.ok(ack.abortedStreams>0);
  const cancelled=await poll(()=>observe(runId),s=>s.run.status==="cancelled"&&s.streams.every(stream=>stream.status==="aborted"));
  assert.equal(cancelled.receipts.length,0);assert.equal(cancelled.run.attempt,1);
  assert.equal(await start("synthetic-stream","cancel-stream"),runId);
  return {evidenceKind:"synthetic-model-on-real-Agent-Workflow-and-managed-Convex",runId,ack,attempts:cancelled.run.attempt,receipts:cancelled.receipts.length,streams:cancelled.streams};
});

await check("interrupted-external-HTTP-effect-uncertain-no-replay",async()=>{
  const operationId=`${prefix}:interrupt`;
  const id=await c.mutation("interrupted:start",{operationId});
  const operation=await poll(()=>c.query("interrupted:observe",{operationId}),o=>o?.state==="uncertain");
  assert.equal(operation.attempts,1);assert.equal(operation.effects,1);assert.equal(operation.owner,"task01-owner");
  assert.equal(await other.query("interrupted:observe",{operationId}),null);
  assert.equal(await c.mutation("interrupted:start",{operationId}),id);
  const recovery=await c.mutation("interrupted:recover",{operationId});assert.equal(recovery.code,"UNCERTAIN_OUTCOME");assert.equal(recovery.replayAllowed,false);
  const after=await c.query("interrupted:observe",{operationId});assert.equal(after.effects,1);assert.equal(after.attempts,1);
  return {operationId:after.operationId,state:after.state,effects:after.effects,attempts:after.attempts,recovery,otherOwnerLookup:null,effectProtocol:"real HTTPS to private peer fixture; loss forced after response and before local outcome receipt",paidProviderInterruption:"not force-killed; deterministic private peer tests replay decision"};
});
evidence.finishedAt=new Date().toISOString();evidence.status=evidence.checks.every(c=>c.status==="PASS")?"PASS":"FAIL";
writeFileSync(receiptFile,JSON.stringify(evidence,null,2));
console.log("Qualification "+evidence.status);process.exitCode=evidence.status==="PASS"?0:1;
