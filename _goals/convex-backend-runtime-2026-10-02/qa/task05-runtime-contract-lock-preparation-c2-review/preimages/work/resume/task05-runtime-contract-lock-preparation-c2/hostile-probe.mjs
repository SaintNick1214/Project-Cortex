import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import ts from 'typescript';
import {saveMessages} from '@convex-dev/agent';
let count=0;
function pass(s){count++;console.log(`PASS ${count}: ${s}`)}
function segment(path,start,end){const s=fs.readFileSync(path,'utf8');const a=s.indexOf(start),b=s.indexOf(end,a);assert(a>=0&&b>a);return s.slice(a,b)}
const ledger=segment('convex-dev/runtimeModelPolicy.ts','export async function bindTrustedBudget(','export const ensureBudget');
let writes=0;
const reference={tenantId:'t',memorySpaceId:'s',principalId:'p'};
const args={reference,operationKey:'agent.respond',requestId:'submit-v1:identity',requestCanonical:'{"identity":"fixed","input":"a"}',agentId:'agent',agentVersion:1};
const row={_id:'ledger-account',reference,scopeKey:JSON.stringify(['run','t','s','p','agent.respond',args.requestId]),requestCanonical:args.requestCanonical,agentId:'agent',agentVersion:1};
const scope=vm.createContext({currentAuthority:async()=>{},text:()=>{},decode:JSON.parse,canonical:JSON.stringify,semanticHash:async()=> 'derived-ledger-budget',single:x=>x[0],sameAuthority:(a,b)=>JSON.stringify(a)===JSON.stringify(b),fail:s=>{throw Error(s)}});
vm.runInContext(ts.transpileModule(ledger.replace('export async','async'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText+'\nglobalThis.bind=bindTrustedBudget',scope);
const ctx={db:{query:()=>({withIndex:(_n,fn)=>{const q={eq:()=>q};fn(q);return {take:async()=>[row]}}}),insert:async()=>{writes++;throw Error('unexpected-write')},patch:async()=>{writes++;throw Error('unexpected-write')}}};
const replay=await scope.bind(ctx,args);assert.equal(replay.runBudgetId,'derived-ledger-budget');assert.equal(replay.runAccountId,'ledger-account');assert.equal(writes,0);pass('actual transpiled ledger replay returns separate derived budget/account IDs with zero writes');
await assert.rejects(scope.bind(ctx,{...args,requestCanonical:'{"identity":"fixed","input":"changed"}'}),/IDEMPOTENCY_CONFLICT/);assert.equal(writes,0);pass('actual ledger changed payload under same key conflicts before writes');
await assert.rejects(scope.bind(ctx,{...args,agentVersion:2}),/IDEMPOTENCY_CONFLICT/);pass('actual ledger changed agent version conflicts');
await assert.rejects(scope.bind(ctx,{...args,reference:{...reference,grantVersion:2}}),/IDEMPOTENCY_CONFLICT/);pass('actual ledger changed authority cannot replay');
const auth=segment('convex-dev/runtimeAuth.ts','export function assertResourceScope(','async function assertCurrentScope(');
const ac=vm.createContext({deny:()=>{throw Error('FORBIDDEN')}});
vm.runInContext(ts.transpileModule(auth.replace('export function','function'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText+'\nglobalThis.check=assertResourceScope',ac);
const authority={...reference,capabilities:['admin'],resourceAccess:'own'};
const resource={resourceType:'source',resourceId:'["executable-agent","a",1]',tenantId:'t',memorySpaceId:'s',ownerPrincipalId:'p'};
ac.check(authority,resource);pass('actual resource scope admits exact owned executable source resource');
for(const drift of [{ownerPrincipalId:'foreign'},{tenantId:'foreign'},{memorySpaceId:'foreign'}]){assert.throws(()=>ac.check(authority,{...resource,...drift}),/FORBIDDEN/);pass('actual admin scope denies '+Object.keys(drift)[0]+' drift');}
let observed;
const saved=[{_id:'one'},{_id:'two'}];
const result=await saveMessages({runMutation:async(ref,a)=>{assert.equal(ref,'add');observed=a;return {messages:saved}}},{messages:{addMessages:'add'}},{threadId:'thread',userId:'p',order:'next',messages:[{role:'user',content:'one'},{role:'user',content:'two'}]});
assert.deepEqual(result.messages,saved);assert.equal(observed.order,'next');assert.equal(observed.failPendingSteps,false);assert.equal(observed.embeddings,undefined);assert.equal(observed.messages.length,2);pass('actual imported installed save helper forwards next order/no embeddings and returns all IDs');
const list=segment('node_modules/@convex-dev/agent/dist/component/messages.js','async function listMessagesByThreadIdHandler(','\nexport const getMessagesByIds');
const rows=[{_id:'before',threadId:'t',order:2,stepOrder:0,status:'success',tool:false},{_id:'anchor',threadId:'t',order:3,stepOrder:1,status:'success',tool:false},{_id:'later',threadId:'t',order:3,stepOrder:2,status:'success',tool:false},{_id:'future',threadId:'t',order:4,stepOrder:0,status:'success',tool:false}];
function stream(){const tests=[];return {query(){return this},withIndex(_n,fn){const q={eq:(k,v)=>{tests.push(r=>r[k]===v);return q},lte:(k,v)=>{tests.push(r=>r[k]<=v);return q}};fn(q);return this},order(){return this},filterWith(){return this},values(){return rows.filter(r=>tests.every(t=>t(r)))}}}
const lc=vm.createContext({assert:(a,b)=>assert(a,b),schema:{},stream,vMessageStatus:{members:[{value:'success'}]},DEFAULT_RECENT_MESSAGES:100,mergedStream:ss=>({paginate:async()=>({page:ss.flatMap(s=>s.values()),isDone:true,continueCursor:''})})});
vm.runInContext(list+'\nglobalThis.list=listMessagesByThreadIdHandler',lc);
const lctx={db:{get:async(_t,id)=>rows.find(r=>r._id===id)??null}};
const largs={threadId:'t',order:'asc',statuses:['success'],upToAndIncludingMessageId:'anchor'};
assert.deepEqual(Array.from((await lc.list(lctx,largs)).page,r=>r._id),['before','anchor','later']);pass('actual installed body includes same-order later step without exact adapter filtering');
assert.deepEqual(Array.from((await lc.list(lctx,{...largs,upToAndIncludingMessageId:'missing'})).page,r=>r._id),['before','anchor','later','future']);pass('actual installed body missing anchor broadens history');
rows.splice(1,1);assert.deepEqual(Array.from((await lc.list(lctx,largs)).page,r=>r._id),['before','later','future']);pass('actual installed body deleted anchor broadens history');
rows.push({_id:'foreign',threadId:'foreign',order:0,stepOrder:0,status:'success',tool:false});await assert.rejects(lc.list(lctx,{...largs,upToAndIncludingMessageId:'foreign'}),/message in the thread/);pass('actual installed body foreign anchor denies');
console.log(JSON.stringify({assertedOutcomeGroups:count,classification:'offline actual source/body and imported installed helper; explicit fake DB/streams; no native transactions, OCC, current grants, policy root, UI or public DTO implementation qualified',testsSkipped:[],native:'NOT_RUN'}));
