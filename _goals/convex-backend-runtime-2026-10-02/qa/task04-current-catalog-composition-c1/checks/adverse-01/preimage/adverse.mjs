import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {verifySources,verifyNative,policyAst,baselineProjection} from './current-compose.mjs';
import {canonicalModelJson,resolveModelPolicy,validateModelRequest} from '../../../../src/domain/model-policy.ts';
const base=path.dirname(fileURLToPath(import.meta.url));
const read=name=>fs.readFileSync(path.join(base,'preimages',name),'utf8');
const sources=Object.fromEntries(['convex-dev/schema.ts','convex-dev/runtimePolicySchema.ts','convex-dev/runtimeModelPolicy.ts','convex-dev/runtimeGateway.ts'].map(name=>[name,read(name)]));
const clone=v=>JSON.parse(JSON.stringify(v));const outcomes=[];
const test=(name,fn)=>{fn();outcomes.push({name,status:'PASS'})};
const native=JSON.parse(fs.readFileSync(path.join(base,'witness-03/current-native.json'),'utf8'));
const baseline=JSON.parse(fs.readFileSync(path.join(base,'witness-03/baseline-strict/exact-current-repair-native.json'),'utf8'));
test('current exact four-source binding and full26+5/184/16 native contracts accepted',()=>{assert.equal(verifySources(sources),baselineProjection(sources['convex-dev/schema.ts']));assert.equal(policyAst(sources['convex-dev/runtimeModelPolicy.ts']).length,16);assert.deepEqual(verifyNative(native,baseline),{baselineTables:26,additiveTables:5,currentTables:31,indexes:184,policyInternal:16})});
for(const [name,target,needle,replacement] of [
 ['wrong baseline table','convex-dev/schema.ts','  artifacts:','  unrelatedArtifacts:'],
 ['unapproved additive table spread','convex-dev/schema.ts','  ...runtimePolicyTables,','  ...runtimePolicyTables,\n  unapproved: defineTable({}) ,'],
 ['extra normal index','convex-dev/schema.ts','.index("by_runtime_key",','.index("unapproved",["tenantId"]).index("by_runtime_key",'],
 ['changed policy validator','convex-dev/runtimeModelPolicy.ts','manifestId: v.string()','manifestId: v.number()'],
 ['policy registration made public','convex-dev/runtimeModelPolicy.ts','ensureBudget = internalMutation','ensureBudget = mutation'],
 ['fragment canonical extra validator','convex-dev/runtimePolicySchema.ts','canonical: v.string()','canonical: v.any()'],
 ['Gateway source drift','convex-dev/runtimeGateway.ts','/**','/* altered approved source */\n/**'],
])test('source reject before acceptance/output: '+name,()=>{assert.ok(sources[target].includes(needle));assert.throws(()=>verifySources({...sources,[target]:sources[target].replace(needle,replacement)}))});
test('duplicate or differently encoded additive splice fails exactbaseline byte theorem',()=>{assert.throws(()=>baselineProjection(sources['convex-dev/schema.ts']+'\n'));assert.throws(()=>baselineProjection(sources['convex-dev/schema.ts'].replace('  ...runtimePolicyTables,','  ...runtimePolicyTables,\n  ...runtimePolicyTables,')))});
test('AST changed samecount public builder and unresolved extra registration denied',()=>{assert.throws(()=>policyAst(sources['convex-dev/runtimeModelPolicy.ts'].replace('internalMutation, internalQuery','mutation, internalQuery').replaceAll('internalMutation({','mutation({')));assert.throws(()=>policyAst(sources['convex-dev/runtimeModelPolicy.ts']+'\ninternalMutation({args:{},handler:()=>null});'))});
for(const [name,mutate] of [
 ['missing approved table',n=>n.definitions.pop()],
 ['wrong samecount baseline table',n=>n.definitions.find(r=>r.table==='artifacts').table='wrong'],
 ['changed baseline field validator',n=>n.definitions.find(r=>r.table==='artifacts').exported.documentType+=' '],
 ['changed additive validator',n=>{n.additions[0].exported.documentType+=' ';n.definitions.find(r=>r.table===n.additions[0].table).exported.documentType+=' '}],
 ['changed additive index sequence',n=>{n.additions[0].indexes[0].fields=['version','policyId'];n.definitions.find(r=>r.table===n.additions[0].table).indexes[0].fields=['version','policyId']}],
 ['extra additive index',n=>n.additions[0].indexes.push({indexDescriptor:'extra',fields:['policyId']})],
 ['changed selected27 artifact args',n=>n.artifactRegistrations.count.args='{}'],
 ['changed additive policy args',n=>n.policyRegistrations.ensureBudget.args='{"type":"object","value":{}}'],
 ['changed additive return validator',n=>n.policyRegistrations.ensureBudget.returns='{}'],
 ['public additive alias/visibility',n=>n.policyRegistrations.ensureBudget.isPublic=true],
 ['unapproved samecount registration',n=>{n.policyRegistrations.unapproved=n.policyRegistrations.ensureBudget;delete n.policyRegistrations.ensureBudget}],
 ['fake installed root',n=>n.forgedRootTrusted=true],
])test('native contract reject before current output: '+name,()=>{const n=clone(native);mutate(n);assert.throws(()=>verifyNative(n,baseline))});
const limits={inputTokens:1000,contextTokens:2000,outputTokens:500,toolSteps:3,timeoutMs:10000,operationBudgetUnits:1000,runBudgetUnits:5000,tenantBudgetUnits:10000,concurrency:4};
const pins={promptVersion:'prompt-1',schemaVersion:'schema-1',extractionVersion:'extract-1',toolRegistryVersion:'tools-1',priceRevision:'price-1',boundRevision:'bound-1'};
const input={context:{scope:{tenantId:'tenant',tenantEpoch:1,memorySpaceId:'space',memorySpaceEpoch:1,principalId:'owner',principalVersion:1,membershipId:'member',membershipVersion:1,grantId:'grant',grantVersion:1},operationKey:'agent.respond',runBudgetId:'synthetic-run',authorizedOverrides:[]},policies:[{policyId:'synthetic-deployment',version:1,scope:'deployment',rules:{allowedModels:['openai/gpt-4o-mini'],interfaces:['chat'],capabilities:['text'],allowedOptions:[],allowedTools:[],fallbackModels:[],limits,pins}}],qualifications:[{receiptId:'synthetic-only',modelId:'openai/gpt-4o-mini',nativeInterface:'chat',capabilities:['text'],allowedOptions:[],limits,costBound:{kind:'qualified-call-ceiling',maximumCostUnits:500,provenance:'synthetic-only',coversAllProviderCharges:true},priceRevision:'price-1',boundRevision:'bound-1'}]};
const snapshot=resolveModelPolicy(input);
for(const [name,mutate] of [['top',n=>n.extra='caller'],['scope',n=>n.context.scope.role='admin'],['context',n=>n.context.root={trusted:true}],['policy',n=>n.policies[0].trusted=true],['rule',n=>n.policies[0].rules.unrecognizedModel='other'],['qualification',n=>n.qualifications[0].actual=true]])test('actual pure strict canonical-extra denial: '+name,()=>{const n=clone(input);mutate(n);assert.throws(()=>resolveModelPolicy(n))});
test('descriptor and noncanonical bytes never acquire authority',()=>{let reads=0;const n=Object.defineProperty({},'trusted',{enumerable:true,get(){reads++;return true}});assert.throws(()=>canonicalModelJson(n));assert.equal(reads,0);assert.throws(()=>canonicalModelJson({value:NaN}));assert.throws(()=>validateModelRequest(snapshot,{callerRoot:true}))});
console.log(JSON.stringify({scope:'PURE_OFFLINE_ADVERSE_COMPOSITION_AND_CANONICAL_CONTRACTS_ONLY',groups:outcomes.length,outcomes,native:'NOT_RUN',paid:'NOT_RUN'}));
