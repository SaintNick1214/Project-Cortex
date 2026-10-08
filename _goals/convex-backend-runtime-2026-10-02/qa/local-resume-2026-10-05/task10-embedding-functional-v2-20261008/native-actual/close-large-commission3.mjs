/** Read-only reachability closure of the original call; no new paid request. */
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {openOwnedContext,q,denied,authorityReference} from './common.mjs';
const c=await openOwnedContext();
try{
 await c.verifyTarget('large-commission3-target-verified');
 const reference=authorityReference(JSON.parse(await readFile(join(q,'baseline-functional-auth-outcomes.json'))).owner);
 const state=()=>c.admin.query('profileQualification:state',{reference}),before=await state(),denials=[];
 for(const [kind,client] of [['anonymous',c.anonymous],['authenticated-owner',c.owner]])denials.push({kind,error:c.publicError(await denied(()=>client.action('profileQualification:exercise',{reference})))});
 const after=await state();assert.deepEqual(after,before);
 await c.publish('large-commission-internal-reachability3',{status:'PASS',denials,attemptsBefore:before.attempts.length,attemptsAfter:after.attempts.length,noNewPaidCall:true,noStateChanges:true});
 const prior=JSON.parse(await readFile(join(q,'large-commission-outcomes1.json')));
 const {internalReachabilityDenialsAlreadyPreserved,...outcomes}=prior;
 await c.publish('large-commission-outcomes2',{...outcomes,internalReachabilityDenials:'large-commission-internal-reachability3.json',priorImpreciseReachabilityPointerPreserved:'large-commission-outcomes1.json',originalCommissionObserverFailurePreserved:'large-commission-failure1.json'});
 console.log(JSON.stringify({status:'SAME_CALL_QUALIFICATION_CLOSED',attempts:after.attempts.length,denials:denials.length,newPaidCalls:0}));
}finally{await c.close();await c.publish('large-commission3-owned-cleanup',{clientsClosed:true});}
