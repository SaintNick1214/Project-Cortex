import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import ts from '/workspace/Project-Cortex/node_modules/typescript/lib/typescript.js';
const root='/workspace/Project-Cortex';
const base=path.join(root,'work/resume/task04-gateway-capture-composition-preparation-c2');
const qa=path.join(root,'_goals/convex-backend-runtime-2026-10-02/qa/task04-gateway-capture-composition-preparation-c2');
const mirror=path.join(base,'mirror'); fs.mkdirSync(mirror,{recursive:true});
fs.writeFileSync(path.join(mirror,'package.json'),'{"type":"module"}\n');
for(const name of ['model-policy','sources','profile','extraction']) {
 const source=fs.readFileSync(path.join(qa,'preimages/src/domain',name+'.ts'),'utf8');
 fs.writeFileSync(path.join(mirror,name+'.js'),ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText);
}
const pure=await import(path.join(mirror,'model-policy.js'));
const sources=await import(path.join(mirror,'sources.js'));
const hash='a'.repeat(64);
const source=()=>({sourceId:'source',sourceEventId:'event',sourceRevision:1,contentHash:hash});
const id=(v)=>typeof v==='string'&&v.length>=1&&v.length<=256&&v.trim()===v&&v.trim().length>0;
function serialize(input,old=false) {
 if(input===undefined)return undefined;
 if(!input||typeof input!=='object'||Array.isArray(input)||![Object.prototype,null].includes(Object.getPrototypeOf(input)))throw Error('INVALID_SOURCE');
 const keys=['sourceId','sourceEventId','sourceRevision','contentHash'];
 const result=Object.create(null);
 assert.equal(Reflect.ownKeys(input).length,4);
 for(const key of Reflect.ownKeys(input)) {
  assert.ok(typeof key==='string'&&keys.includes(key));
  const d=Object.getOwnPropertyDescriptor(input,key);
  assert.ok(d.enumerable&&'value'in d); result[key]=d.value;
 }
 assert.ok(id(result.sourceId)&&id(result.sourceEventId));
 assert.ok(Number.isSafeInteger(result.sourceRevision)&&result.sourceRevision>=(old?0:1));
 assert.match(result.contentHash,/^[a-f0-9]{64}$/);
 return JSON.parse(pure.canonicalModelJson(result));
}
if(process.argv.includes('--c1-red')) {
 const old={...source(),sourceRevision:0};
 // The unapplied C1 nonnegative criterion wrongly accepts the positive-boundary denial.
 assert.throws(()=>serialize(old,true),'C1 criterion must reject revision0');
 process.exit(0);
}
const scope={tenantId:'t',tenantEpoch:1,memorySpaceId:'s',memorySpaceEpoch:1,principalId:'p',principalVersion:1,membershipId:'m',membershipVersion:1,grantId:'g',grantVersion:1};
const limits={inputTokens:100,contextTokens:200,outputTokens:20,toolSteps:1,timeoutMs:100,operationBudgetUnits:100,runBudgetUnits:1000,tenantBudgetUnits:1000,concurrency:1};
const pins={promptVersion:'p',schemaVersion:'s',extractionVersion:'e',toolRegistryVersion:'t',priceRevision:'r',boundRevision:'b'};
function resolve(src) {
 const modelId='openai/gpt-4o-mini';
 return pure.resolveModelPolicy({context:{scope,operationKey:'agent.respond',runBudgetId:'budget',authorizedOverrides:[],...(src?{source:{sourceId:src.sourceId,sourceEventId:src.sourceEventId,sourceRevision:src.sourceRevision}}:{})},
 policies:[{policyId:'d',version:1,scope:'deployment',rules:{modelId,nativeInterface:'chat',allowedModels:[modelId],interfaces:['chat'],capabilities:['text'],allowedOptions:[],allowedTools:[],fallbackModels:[],limits,pins}}],
 qualifications:[{receiptId:'q',modelId,nativeInterface:'chat',capabilities:['text'],allowedOptions:[],limits,costBound:{kind:'qualified-call-ceiling',maximumCostUnits:100,provenance:'OFFLINE-SYNTHETIC-ONLY',coversAllProviderCharges:true},priceRevision:'r',boundRevision:'b'}]});
}
const nativeText=fs.readFileSync(path.join(qa,'preimages/_goals/convex-backend-runtime-2026-10-02/qa/task04-gateway-capture-composition-c1-design-review/preimages/convex-dev/runtimeModelPolicy.ts'),'utf8');
const parsed=ts.createSourceFile('frozen.ts',nativeText,ts.ScriptTarget.Latest,true);
const selected=parsed.statements.filter(x=>ts.isFunctionDeclaration(x)&&['integer','purpose','checkSource'].includes(x.name?.text)).map(x=>x.getText(parsed));
assert.equal(selected.length,3);
fs.writeFileSync(path.join(base,'exact-native-functions.ts'),selected.join('\n'));
const observed={reads:0};
const context={Number,Date,observed,fail:(code)=>{throw Error(code);},semanticHash:async()=>hash,
 ConvexMemoryRepository:class { async getSource(){observed.reads++;return {lineage:{sourceEventId:'event',sourceRevision:1},contentHash:hash,content:'owned-fixture'};} }};
vm.createContext(context);
vm.runInContext(ts.transpileModule(selected.join('\n')+'\nglobalThis.checkSourceProbe=checkSource;',{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText,context);
const results=[];
async function check(name,fn){await fn();results.push({name,status:'PASS'});}
for(const revision of [0,Number.MAX_SAFE_INTEGER+1,-1,1.5,NaN])await check('revision denied '+String(revision),async()=>{
 const s={...source(),sourceRevision:revision};let effects=0;
 assert.throws(()=>{const detached=serialize(s);effects++;resolve(detached);});assert.equal(effects,0);
 assert.throws(()=>resolve(s));assert.throws(()=>sources.assertSourceLineage({...s,role:'user',trust:'user_assertion'}));
 const before=observed.reads;await assert.rejects(context.checkSourceProbe({},scope,'agent.respond',s));assert.equal(observed.reads,before);
});
for(const revision of [1,Number.MAX_SAFE_INTEGER])await check('revision accepted '+revision,()=>{
 const s={...source(),sourceRevision:revision};assert.equal(serialize(s).sourceRevision,revision);assert.equal(resolve(s).version,1);sources.assertSourceLineage({...s,role:'user',trust:'user_assertion'});
});
await check('native revision1 reads matching current source',async()=>{const before=observed.reads;await context.checkSourceProbe({},scope,'agent.respond',source());assert.equal(observed.reads,before+1);});
for(const key of ['sourceId','sourceEventId']) {
 for(const value of ['', ' ', ' source','source ', 'x'.repeat(257),'\ud800'])await check(key+' rejects '+JSON.stringify(value),()=>{
  const s={...source(),[key]:value};let effects=0;assert.throws(()=>{const d=serialize(s);effects++;resolve(d);});assert.equal(effects,0);assert.throws(()=>resolve(s));
 });
 await check(key+' accepts256 codeunits',()=>{const s={...source(),[key]:'x'.repeat(256)};assert.equal(serialize(s)[key].length,256);assert.equal(resolve(s).version,1);});
}
await check('getter denied without execution or effects',()=>{let getters=0,effects=0;const s=source();Object.defineProperty(s,'sourceId',{enumerable:true,get(){getters++;return 'source';}});assert.throws(()=>{serialize(s);effects++;});assert.throws(()=>resolve(s));assert.equal(getters,0);assert.equal(effects,0);});
for(const kind of ['symbol','nonenumerable','extra','prototype','null','array'])await check('descriptor rejects '+kind,()=>{
 let s=source();if(kind==='symbol')s[Symbol('x')]=1;if(kind==='nonenumerable')Object.defineProperty(s,'sourceId',{value:'source',enumerable:false});if(kind==='extra')s.extra=1;if(kind==='prototype')Object.setPrototypeOf(s,{hidden:1});if(kind==='null')s=null;if(kind==='array')s=[];let effects=0;assert.throws(()=>{serialize(s);effects++;});assert.equal(effects,0);
});
await check('detachment preserves all identity after caller mutation',()=>{const s=source();const d=serialize(s);s.sourceId='mutated';s.sourceEventId='changed';s.sourceRevision=2;s.contentHash='b'.repeat(64);assert.deepEqual(d,source());});
await check('source absence omitted',()=>{const d=serialize(undefined);const args={reference:scope,...(d?{source:d}:{})};assert.equal(Object.hasOwn(args,'source'),false);});
for(const value of ['A'.repeat(64),'a'.repeat(63),'a'.repeat(65),'not-hash'])await check('hash denied '+value.length,()=>{let effects=0;assert.throws(()=>{serialize({...source(),contentHash:value});effects++;});assert.equal(effects,0);});
const output={status:'BOUNDARY_PROTOTYPE_ONLY_PASS',count:results.length,results,nativeSource:'exact frozen review preimage; extracted functions with deterministic repository stub',gatewayImplementation:'NOT_RUN',nativeHandlers:'NOT_RUN'};
fs.writeFileSync(path.join(qa,'boundary-results.json'),JSON.stringify(output,null,2)+'\n');
console.log(JSON.stringify(output));
