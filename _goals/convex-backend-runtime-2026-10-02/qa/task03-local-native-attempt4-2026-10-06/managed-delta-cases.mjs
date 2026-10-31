import assert from "node:assert/strict";
/** Preparation module only. No transport/key/target creation and no automatic execution.
 * The parent must bind this to a freshly reviewed current native driver. Fake contexts
 * used in offline assertions are never actual managed evidence. C11 remains historical. */
export async function qualifyInternalDelta(ctx, ledger) {
  await ctx.requireCurrentReviewedNativeTarget();
  const additions=ledger.cases.filter(row=>row.group==="model-policy-delta");
  assert.equal(additions.length,16);assert(additions.every(row=>row.visibility==="internal"));
  await ctx.assertExactPublished275PlusFixtureHelpers();
  let completed=0;
  for(const row of additions)for(const identity of ["noJWT","reader"]){
    const args=await ctx.realOwnedArgumentsFor(row);const before=await ctx.completeOwnedSnapshotIncludingPolicyTables();
    let result,error;try{result=await ctx.nativePublicCall(identity,row.path,args);}catch(caught){error=caught;}
    assert.equal(result,undefined);assert.ok(error);
    // Preserve original C11 exact visibility assertion; metadata separately proves existence.
    assert.match(error.message,/Could not find public function|internal function|not a public function/i);
    assert.doesNotMatch(error.message,/ArgumentValidationError|Validator|invalid argument/i);
    assert.deepEqual(await ctx.completeOwnedSnapshotIncludingPolicyTables(),before);
    await ctx.appendFsyncedSafeOutcome({id:"delta-visibility:"+identity+":"+row.path,path:row.path,identity,status:"PASS",observedCode:"INTERNAL_ONLY",noEffect:true});completed++;
  }
  assert.equal(completed,32);return {scope:"CURRENT_NEW_INTERNAL_VISIBILITY_ONLY",completed,actualTransportRequired:true};
}
export async function qualifySafeCurrentControl(ctx, path, args, code) {
  await ctx.requireCurrentReviewedNativeTarget();
  const before=await ctx.completeOwnedSnapshotIncludingPolicyTables();let result,error;
  try{result=await ctx.nativeTrustedOperatorCall(path,args);}catch(caught){error=caught;}
  assert.equal(result,undefined);assert.ok(error);
  assert.deepEqual(error.data,{version:1,code,message:"Model operation control failed.",retryable:false,outcome:"not_dispatched"});
  assert.deepEqual(await ctx.completeOwnedSnapshotIncludingPolicyTables(),before);
  return {scope:"CURRENT_EMPTY_ROOT_OR_MISSING_ATTEMPT_CONTROL_ONLY",path,code,noEffect:true};
}
