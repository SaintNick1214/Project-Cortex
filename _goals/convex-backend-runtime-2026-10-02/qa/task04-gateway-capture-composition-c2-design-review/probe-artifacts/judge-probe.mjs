import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import ts from '/workspace/Project-Cortex/node_modules/typescript/lib/typescript.js';
const root='/workspace/Project-Cortex';
const scratch=path.dirname(new URL(import.meta.url).pathname);
const freeze=root+'/_goals/convex-backend-runtime-2026-10-02/qa/task04-gateway-capture-composition-preparation-c2/preimages';
const mirror=path.join(scratch,'mirror');fs.mkdirSync(mirror,{recursive:true});
fs.writeFileSync(path.join(mirror,'package.json'),'{"type":"module"}\n');
for(const name of ['profile','model-policy'])fs.writeFileSync(path.join(mirror,name+'.js'),ts.transpileModule(fs.readFileSync(freeze+'/src/domain/'+name+'.ts','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText);
const pure=await import(path.join(mirror,'model-policy.js'));
const source=()=>({sourceId:'source',sourceEventId:'event',sourceRevision:1,contentHash:'a'.repeat(64)});
const scope={tenantId:'tenant',tenantEpoch:1,memorySpaceId:'space',memorySpaceEpoch:1,principalId:'principal',principalVersion:1,membershipId:'member',membershipVersion:1,grantId:'grant',grantVersion:1};
const limits={inputTokens:100,contextTokens:200,outputTokens:20,toolSteps:0,timeoutMs:100,operationBudgetUnits:100,runBudgetUnits:100,tenantBudgetUnits:100,concurrency:1};
const pins={promptVersion:'p',schemaVersion:'s',extractionVersion:'e',toolRegistryVersion:'t',priceRevision:'price',boundRevision:'bound'};
const modelId='openai/gpt-4o-mini';
function resolution(input){
 const descriptors=Object.getOwnPropertyDescriptors(input);delete descriptors.contentHash;
 return pure.resolveModelPolicy({context:{scope,operationKey:'agent.respond',runBudgetId:'budget',authorizedOverrides:[],source:Object.create(Object.getPrototypeOf(input),descriptors)},policies:[{policyId:'deployment',version:1,scope:'deployment',rules:{modelId,nativeInterface:'chat',allowedModels:[modelId],interfaces:['chat'],capabilities:['text'],allowedOptions:[],allowedTools:[],fallbackModels:[],limits,pins}}],qualifications:[{receiptId:'qualification',modelId,nativeInterface:'chat',capabilities:['text'],allowedOptions:[],limits,costBound:{kind:'qualified-call-ceiling',maximumCostUnits:100,provenance:'JUDGE-OFFLINE-ONLY',coversAllProviderCharges:true},priceRevision:'price',boundRevision:'bound'}]});
}
// Independent design prototype: assertions against actual frozen PURE follow separately.
function proposedAdapter(input,minimum=1){
 if(input===undefined)return undefined;
 assert.ok(input && typeof input==='object' && !Array.isArray(input));
 assert.ok([Object.prototype,null].includes(Object.getPrototypeOf(input)));
 const keys=Reflect.ownKeys(input);assert.equal(keys.length,4);
 const copy=Object.create(null);
 for(const key of keys){assert.ok(['sourceId','sourceEventId','sourceRevision','contentHash'].includes(key));const d=Object.getOwnPropertyDescriptor(input,key);assert.ok(d.enumerable && Object.hasOwn(d,'value'));copy[key]=d.value;}
 for(const key of ['sourceId','sourceEventId']){const s=copy[key];assert.equal(typeof s,'string');assert.ok(s.length>0 && s.length<=256 && s.trim()===s && s.trim().length>0);for(const point of s){const n=point.codePointAt(0);assert.ok(n<0xd800 || n>0xdfff);}}
 assert.ok(Number.isSafeInteger(copy.sourceRevision) && copy.sourceRevision>=minimum);
 assert.equal(typeof copy.contentHash,'string');assert.match(copy.contentHash,/^[0-9a-f]{64}$/);
 return JSON.parse(pure.canonicalModelJson(copy));
}
if(process.argv.includes('--old-criterion')){assert.throws(()=>proposedAdapter({...source(),sourceRevision:0},0),'Original C1 nonnegative rule must deny zero');process.exit(0);}
const results=[];function check(name,fn){fn();results.push(name);}
for(const revision of [0,-1,1.5,Number.MAX_SAFE_INTEGER+1,NaN])check('deny revision '+revision,()=>{let effects=0;const input={...source(),sourceRevision:revision};assert.throws(()=>{proposedAdapter(input);effects++;});assert.equal(effects,0);assert.throws(()=>resolution(input));});
for(const revision of [1,Number.MAX_SAFE_INTEGER])check('accept revision '+revision,()=>{const input={...source(),sourceRevision:revision};assert.equal(proposedAdapter(input).sourceRevision,revision);assert.equal(resolution(input).source.sourceRevision,revision);});
for(const key of ['sourceId','sourceEventId']){
 for(const value of ['', ' ', ' leading','trailing ', 'x'.repeat(257)])check(key+' denial '+JSON.stringify(value),()=>{let effects=0;const input={...source(),[key]:value};assert.throws(()=>{proposedAdapter(input);effects++;});assert.equal(effects,0);assert.throws(()=>resolution(input));});
 check(key+' max256 Unicode',()=>{const input={...source(),[key]:'\ud83d\ude00'.repeat(128)};assert.equal(proposedAdapter(input)[key].length,256);assert.equal(resolution(input).source[key],input[key]);});
 check(key+' lone surrogate attribution',()=>{const input={...source(),[key]:'\ud800'};assert.equal(resolution(input).source[key],'\ud800');assert.throws(()=>proposedAdapter(input));});
 check(key+' accessor never executed',()=>{let count=0,effects=0;const input=source();Object.defineProperty(input,key,{enumerable:true,get(){count++;throw Error('Getter executed');}});assert.throws(()=>{proposedAdapter(input);effects++;});assert.throws(()=>resolution(input));assert.equal(count,0);assert.equal(effects,0);});
}
check('detach canonical identity and omit absent source',()=>{const input=source(),frozen=proposedAdapter(input);Object.assign(input,{sourceId:'changed',sourceEventId:'changed',sourceRevision:2,contentHash:'b'.repeat(64)});assert.deepEqual(frozen,source());assert.equal(Object.hasOwn({...proposedAdapter(undefined)?{source:proposedAdapter(undefined)}:{}},'source'),false);});
for(const hash of ['A'.repeat(64),'a'.repeat(63),'a'.repeat(65),'not-hash'])check('hash denial '+hash.length,()=>assert.throws(()=>proposedAdapter({...source(),contentHash:hash})));
for(const kind of ['extra','symbol','nonenumerable','prototype'])check('descriptor denial '+kind,()=>{const input=source();if(kind==='extra')input.extra=1;if(kind==='symbol')input[Symbol('x')]=1;if(kind==='nonenumerable')Object.defineProperty(input,'sourceId',{enumerable:false});if(kind==='prototype')Object.setPrototypeOf(input,{polluted:true});assert.throws(()=>proposedAdapter(input));});
const nativeFile=freeze+'/_goals/convex-backend-runtime-2026-10-02/qa/task04-gateway-capture-composition-c1-design-review/preimages/convex-dev/runtimeModelPolicy.ts';
const parsed=ts.createSourceFile('historical.ts',fs.readFileSync(nativeFile,'utf8'),ts.ScriptTarget.Latest,true);
const extracted=parsed.statements.filter(n=>ts.isFunctionDeclaration(n)&&['integer','purpose','checkSource'].includes(n.name?.text)).map(n=>n.getText(parsed));assert.equal(extracted.length,3);
fs.writeFileSync(path.join(scratch,'extracted-native.ts'),extracted.join('\n'));
let reads=0;const context={Number,Date,fail:code=>{throw Error(code);},semanticHash:async()=>'a'.repeat(64),ConvexMemoryRepository:class{async getSource(){reads++;return {lineage:{sourceEventId:'event',sourceRevision:1},contentHash:'a'.repeat(64),content:'stub'};}}};vm.createContext(context);vm.runInContext(ts.transpileModule(extracted.join('\n')+'\nglobalThis.probe=checkSource;', {compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText,context);
await assert.rejects(context.probe({},scope,'agent.respond',{...source(),sourceRevision:0}));assert.equal(reads,0);results.push('historical extracted revision0 fails before repository read');
await context.probe({},scope,'agent.respond',source());assert.equal(reads,1);results.push('historical extracted matching revision1 reads once');
console.log(JSON.stringify({status:'PASS_BOUNDARY_DESIGN_PROTOTYPE_ONLY',count:results.length,results,skipped:0,pending:0,nativeTransactions:'NOT_RUN',gatewayProduct:'NOT_RUN'}));
