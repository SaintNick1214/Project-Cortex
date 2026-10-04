/** Outcome oracles only; importing never invokes tools/services/env. NOT_FROZEN/NOT_RUN. */
import assert from 'node:assert/strict';
export function canonical(value) {
 if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';
 if(value&&typeof value==='object')return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+canonical(value[k])).join(',')+'}';
 return JSON.stringify(value);
}
export function unchanged(before,after){assert.equal(canonical(after),canonical(before),'QA_ZERO_EFFECT');}
export function immutableInitial(before,after){for(const key of ['terminalEvidenceCanonical','terminalEvidenceHash','resultAttachmentState'])assert.equal(after[key],before[key],key);}
export function moneyDelta(before,after,cost){
 for(const key of ['_id','kind','tenantId','runBudgetId','windowStart','windowEnd'])assert.equal(after[key],before[key],key);
 assert.equal(after.reservedUnits,before.reservedUnits);
 assert.equal(after.uncertainUnits,before.uncertainUnits-100);
 assert.equal(after.settledUnits,before.settledUnits+cost);
 assert.equal(after.activeConcurrency,before.activeConcurrency);
 assert.equal(after.activeConcurrency,0);
}
export function capturedUnknown(attempt){assert.equal(attempt.state,'uncertain');assert.equal(attempt.slotReleased,true);assert.equal(attempt.resultAttachmentState,'closed');assert.ok(attempt.terminalEvidenceCanonical);assert.ok(attempt.terminalEvidenceHash);assert.equal(attempt.privateResultCanonical,undefined);}
export function refined(before,after,cost){immutableInitial(before,after);assert.equal(after.state,'settled');assert.equal(after.settledCostUnits,cost);assert.equal(after.overrun,true);assert.equal(after.slotReleased,true);assert.equal(after.privateResultCanonical,undefined);assert.ok(after.receiptCanonical);assert.ok(after.receiptHash);}
export function captureArgs(attemptId,dispatchIdentity,receiptCanonical){return{attemptId,dispatchIdentity,receiptCanonical};}
export function attachArgs(reference,attemptId,evidenceId,privateResultCanonical){return{reference,attemptId,evidenceId,privateResultCanonical};}
export async function denied(snapshot,action,code){const before=await snapshot();await assert.rejects(action,e=>{assert.ok(e?.data?.code,'QA_STRUCTURED_HANDLER_FAILURE');if(code)assert.equal(e.data.code,code);return true;});unchanged(before,await snapshot());}
export async function duplicate(snapshot,action,evidenceId,cost){const before=await snapshot(),result=await action();assert.equal(result.evidenceId,evidenceId);assert.equal(result.state,cost===undefined?'uncertain':'settled');if(cost!==undefined)assert.equal(result.settledCostUnits,cost);unchanged(before,await snapshot());return result;}
export async function equalRace(capture,snapshot,args,assertTransition){const before=await snapshot();const results=await Promise.all([capture(args),capture(args)]);assert.equal(results[0].evidenceId,results[1].evidenceId);assert.equal(results[0].settledCostUnits,150);assert.equal(results[1].settledCostUnits,150);assertTransition(before,await snapshot(),150);return results[0];}
export async function conflictRace(capture,snapshot,args150,args151,assertTransition){const before=await snapshot(),results=await Promise.allSettled([capture(args150),capture(args151)]);const winners=results.filter(x=>x.status==='fulfilled'),losers=results.filter(x=>x.status==='rejected');assert.equal(winners.length,1);assert.equal(losers.length,1);assert.ok(losers[0].reason?.data?.code);const cost=winners[0].value.settledCostUnits;assert.ok([150,151].includes(cost));assertTransition(before,await snapshot(),cost);await denied(snapshot,()=>capture(cost===150?args151:args150));return winners[0].value;}
export function publication(functions){for(const name of ['captureTerminalEvidence','attachTerminalResult']){const matches=functions.filter(f=>f.identifier.replace(/\.js:/,':')==='runtimeModelPolicy:'+name);assert.equal(matches.length,1);assert.equal(matches[0].functionType,'Mutation');assert.equal(typeof matches[0].visibility==='string'?matches[0].visibility:matches[0].visibility.kind,'internal');}}
