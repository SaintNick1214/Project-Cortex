import assert from 'node:assert/strict';
// Public deterministic DUMMY bytes, never target/operator K or an actual signer installation.
// Real Node WebCrypto Promise APIs demonstrate API sequencing only, not Convex support.
const key=await crypto.subtle.importKey('raw',new Uint8Array(32).fill(0x44),{name:'HMAC',hash:'SHA-256'},false,['sign','verify']);
const C=x=>Array.isArray(x)?'['+x.map(C).join(',')+']':x&&typeof x==='object'?'{'+Object.keys(x).sort().map(k=>JSON.stringify(k)+':'+C(x[k])).join(',')+'}':JSON.stringify(x);
const bytes=x=>new TextEncoder().encode(C(x));const hex=x=>Array.from(new Uint8Array(x),v=>v.toString(16).padStart(2,'0')).join('');
const outcomes=[];
async function model({name,preparationAt=999,synchronousCost=0,asyncCompletionAt,closedDuringPreparation=false,nativeExpiry=15000,accountExpiry=20000,expected,late='success'}){
 let clock=preparationAt,closed=false,submitted=false,rpcs=0,newP=0,newS=0,resigns=0,pending=0,lateFailures=0;
 const P={domain:'DUMMY_NOMINATION',phaseStartedAt:0,phaseExpiresAt:1000,text:'DUMMY_FIRST'};newP++;
 const pCanonical=C(P),digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(pCanonical));const m1=await crypto.subtle.sign('HMAC',key,new TextEncoder().encode('DUMMY_NOMINATION\n'+pCanonical));
 const S={nominationHash:hex(digest),nominationMac:hex(m1),submittedAt:clock,phaseExpiresAt:1000};newS++;
 const signPromise=crypto.subtle.sign('HMAC',key,new TextEncoder().encode('DUMMY_SUBMISSION\n'+C(S)));assert.equal(typeof signPromise.then,'function');const m2=await signPromise;
 // Symbolic synchronous final encoding/validation cost can advance trusted clock WITHOUT yielding.
 clock+=synchronousCost;if(asyncCompletionAt!==undefined)clock=asyncCompletionAt;if(closedDuringPreparation)closed=true;
 const prepared={P,S,m1:hex(m1),m2:hex(m2)};C(prepared);assert.equal(await crypto.subtle.verify('HMAC',key,m2,new TextEncoder().encode('DUMMY_SUBMISSION\n'+C(S))),true);
 // In this DUMMY model only, a fixed source port records immediate invocation. A production
 // caller/test-injectable port is forbidden; accepted source must use actual fixed ctx directly.
 let resolveRpc,rejectRpc;const rpc=new Promise((resolve,reject)=>{resolveRpc=resolve;rejectRpc=reject});
 const finalAdmissionAt=clock;
 if(finalAdmissionAt>=0&&finalAdmissionAt<1000&&finalAdmissionAt<nativeExpiry&&finalAdmissionAt<accountExpiry&&S.submittedAt>=0&&S.submittedAt<=finalAdmissionAt&&!submitted&&!closed){submitted=true;rpcs++;pending++;}
 else {closed=true;}
 assert.equal(rpcs,expected);assert.equal(newP,1);assert.equal(newS,1);assert.equal(resigns,0);
 if(expected){const owned=rpc.then(()=>{pending--},()=>{pending--;lateFailures++});clock=1500;closed=true;assert.equal(pending,1);if(late==='failure')rejectRpc(Error('DUMMY_LATE_FAILURE'));else resolveRpc('DUMMY_ATOMIC_EFFECT');await owned;assert.equal(pending,0);assert.equal(lateFailures,late==='failure'?1:0);assert.equal(rpcs,1);}else {assert.equal(pending,0);assert.equal(submitted,false);resolveRpc();}
 outcomes.push({name,status:'PASS',rpcs,finalAdmissionAt,preparedAt:S.submittedAt,lateFailures,noRenewal:true});
}
await model({name:'symbolic synchronous sealing/encoding cost crosses expiry no RPC',synchronousCost:2,expected:0});
await model({name:'awaited WebCrypto completion crosses original expiry no RPC',asyncCompletionAt:1001,expected:0});
await model({name:'cancellation/authority closes during preparation no RPC',preparationAt:500,closedDuringPreparation:true,expected:0});
await model({name:'exact expiry equality denies no RPC',preparationAt:1000,expected:0});
await model({name:'original native window equality denies no RPC',preparationAt:500,nativeExpiry:500,expected:0});
await model({name:'original account window equality denies no RPC',preparationAt:500,accountExpiry:500,expected:0});
await model({name:'in-window final admission owns late success',preparationAt:998,expected:1});
await model({name:'in-window final admission consumes late failure',preparationAt:998,expected:1,late:'failure'});
const child=C({text:'"'.repeat(89000)});assert.ok(new TextEncoder().encode(child).length<=180000);assert.ok(bytes({observerTranscriptCanonical:child}).length>190000);outcomes.push({name:'child byte bound cannot bypass escaped parent envelope',status:'PASS'});
const count=x=>x&&typeof x==='object'?1+Object.values(x).reduce((n,v)=>n+count(v),0):1;const subtree={events:Array.from({length:4094},()=>0)};assert.equal(count(subtree),4096);assert.ok(count({version:1,decodedNomination:{decodedTranscript:subtree},decodedSubmission:{submittedAt:0}})>4096);outcomes.push({name:'combined expanded decoded graph includes outer metadata',status:'PASS'});
assert.equal([].length,0);outcomes.push({name:'present category domain remains EMPTY/UNKNOWN/fullK/STOP',status:'PASS'});
console.log(JSON.stringify({scope:'DUMMY_DESIGN_R1_ORDER_MODEL_ONLY_NOT_REGISTERED_OR_CONVEX_CRYPTO',outcomes,skipped:0,actualKeys:0,native:0,paid:0}));
