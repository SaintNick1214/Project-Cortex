from pathlib import Path
import json,hashlib,difflib
q=Path(__file__).resolve().parent
changes=[]
def edit(name,edits):
 p=q/'scripts'/name;s=p.read_text();old=s
 for a,b in edits:
  if s.count(a)!=1:raise RuntimeError(f'{name}: expected exact unique replacement {a[:70]} count {s.count(a)}')
  s=s.replace(a,b,1)
 p.write_text(s);changes.append({'path':str(p.relative_to(q)),'preimageSha256':hashlib.sha256(old.encode()).hexdigest(),'prospectiveSha256':hashlib.sha256(s.encode()).hexdigest(),'replacementCount':len(edits)})
 (q/'historical-preimages'/f'{name}.prospective.diff').write_text(''.join(difflib.unified_diff(old.splitlines(True),s.splitlines(True),fromfile='historical-c11/'+name,tofile='prospective-current/'+name)))
edit('native-engine.mjs',[
 ("canonical(resolve(repo,'work/backend-runtime/qualification/jwt-private.pem'),repo,true)","canonical(resolve(scratch,'jwt-private.pem'),scratch,true)"),
 ("const allowedInternal=new Set([", "const deltaFixtureKinds={'qualificationDelta:allocateDeletedAttemptId':'mutation','qualificationDelta:policySnapshot':'query'};for(const [path,kind] of Object.entries(deltaFixtureKinds)){const fn=deployed.get(path);assert.ok(fn,'Current delta fixture operator not published');assert.equal(String(fn.functionType).toLowerCase(),kind);assert.equal(fn.visibility?.kind??fn.visibility,'internal');kindByPath[path]=kind;}\n const allowedInternal=new Set([...Object.keys(deltaFixtureKinds),...ledger.cases.filter(row=>row.group==='model-policy-delta').map(row=>row.path),"),
 ("assert.deepEqual([...deployed.keys()].sort(),[...ledger.cases.map(row=>row.path),...Object.keys(fixtureKinds).map(name=>'qualificationOwned:'+name)].sort(),'Unexpected published path');", "// Both helper families are checked explicitly below; all production paths conserve original C11.\n const expectedHelpers=['qualificationDelta:allocateDeletedAttemptId','qualificationDelta:policySnapshot'];assert.deepEqual([...deployed.keys()].sort(),[...ledger.cases.map(row=>row.path),...Object.keys(fixtureKinds).map(name=>'qualificationOwned:'+name),...expectedHelpers].sort(),'Unexpected published path');"),
 ("async function snapshot(selected=refs){await discoverOwnedEffects();const rows=await operator('snapshot',{refs:selected.map(({table,id})=>({table,id}))});const storage=await operator('storageSnapshot',{files});if(selected===refs)return [...rows,{table:'_storage',id:'owned-storage-metadata',row:storage}];return rows;}", "async function snapshot(selected=refs){await discoverOwnedEffects();const rows=await operator('snapshot',{refs:selected.map(({table,id})=>({table,id}))});const storage=await operator('storageSnapshot',{files});if(selected===refs){const policy=await operator('qualificationDelta:policySnapshot',{run});return [...rows,{table:'_storage',id:'owned-storage-metadata',row:storage},{table:'current-policy-tables',id:'empty-native-policy-state',row:policy}];}return rows;}"),
 ("return complete&&!unknownDispatch;", "await operator('qualificationDelta:policySnapshot',{run});return complete&&!unknownDispatch;")
])
edit('argument-candidates.mjs',[("ctx.refs.find(ref=>ref.table===table)?.id;", "ctx.refs.find(ref=>ref.table===table)?.id??ctx.policyWitnesses?.[table];")])
edit('lifecycle.mjs',[("'../../../../../dist/index.js'", "'../sdk-dist/index.js'")])
edit('qualify.mjs',[
 ("import { qualifyPolicyTemplate } from './policy-fixture.mjs';", "import { qualifyPolicyTemplate } from './policy-fixture.mjs';\nimport { preparePolicyDelta, qualifyPolicyDelta } from './policy-delta.mjs';"),
 ("discovered:259,public:200,internal:59", "discovered:275,public:200,internal:75,deltaVisibilityCases:0,deltaNativeControls:0,deltaHealthyAuthorityControls:0,deltaRevokedNoEffectControls:0"),
 ("const suites=[await prepareMf(ctx),await prepareMwd(ctx)];", "await preparePolicyDelta(ctx);const suites=[await prepareMf(ctx),await prepareMwd(ctx)];"),
 ("// Internal visibility denial is distinct from public authorization denial.", "activeCase={id:'current-policy-delta',paths:ledger.cases.filter(row=>row.group==='model-policy-delta').map(row=>row.path),phase:'current-policy-delta'};const deltaCounts=await qualifyPolicyDelta(ctx,ledger,record);counts.deltaNativeControls=deltaCounts.nativeControls;counts.deltaHealthyAuthorityControls=deltaCounts.healthyAuthorityControls;counts.deltaRevokedNoEffectControls=deltaCounts.revokedNoEffectControls;\n // Internal visibility denial is distinct from public authorization denial."),
 ("const args=argumentsFor(row,ctx);let result,error;try{result=await ctx.call(identity,row.path,args);}", "const args=argumentsFor(row,ctx);const deltaBefore=row.group==='model-policy-delta'?await ctx.snapshot():undefined;let result,error;try{result=await ctx.call(identity,row.path,args);}"),
 ("counts.visibilityCases++;internalObserved.add(row.path);", "if(deltaBefore){assert.deepEqual(await ctx.snapshot(),deltaBefore);counts.deltaVisibilityCases++;}counts.visibilityCases++;internalObserved.add(row.path);"),
 ("assert.equal(counts.visibilityCases,118)", "assert.equal(counts.visibilityCases,150);assert.equal(counts.deltaVisibilityCases,32);assert.equal(counts.deltaNativeControls,16);assert.equal(counts.deltaHealthyAuthorityControls,2);assert.equal(counts.deltaRevokedNoEffectControls,1)"),
 ("assert.equal(internalObserved.size,59)", "assert.equal(internalObserved.size,75)")
])
edit('cleanup.mjs',[("if(complete)status='PASS';", "if(complete){const policy=await client.query(makeFunctionReference('qualificationDelta:policySnapshot'),{run});if(policy.length!==5||policy.some(row=>row.count!==0))throw new Error('Policy cleanup not verified');status='PASS';}")])
(q/'prospective-script-deltas.json').write_text(json.dumps({'historicalAssertions':'All original C11 assertions are preserved; only explicit source/identity binding, registration additions, added controls, and count increments change.','files':changes},indent=2)+'\n')
print(json.dumps({'adaptedScripts':len(changes),'externalRequests':0}))
