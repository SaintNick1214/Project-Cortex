import {K19_PINS,K19_NATIVE_NAMES,requireK19ReadyPins} from './k19-collector-pins.mjs';
requireK19ReadyPins();
/** One exact disposable target; query/log reads only; no raw prompts/output/errors retained. */
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import ts from 'typescript';
import {pathToFileURL} from 'node:url';
import {canonicalModelJson,resolveModelPolicy,validateModelRequest,MEMORY_JSON_OBJECT_CONTRACT} from '/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion/src/domain/model-policy.ts';
import {normalizeSourceText} from '/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion/src/domain/profile.ts';
import {agentToolCatalog,agentToolsInputBound,agentToolsInputBoundV2,AGENT_TOOL_REGISTRY_VERSION_V2,NATIVE_TOOL_NAMES_V2} from '/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion/src/domain/agent-tools.ts';
import {createRequire} from 'node:module';
import {loadSession, createContext, PROOFS_ROOT} from '/Users/SaintNick/Documents/Cortex/Project-Cortex-Proofs/sandbox-env/runner.mjs';
import {verifyCloud, getDeployKey} from '/Users/SaintNick/Documents/Cortex/Project-Cortex-Proofs/sandbox-env/cloud.mjs';
const sessionId=process.argv[2];assert.match(sessionId,/^[a-f0-9-]{36}$/);
const runId=process.argv[3];assert.match(runId,/^run:[a-f0-9]{64}$/);
assert.equal(process.env.CORTEX_K19_TOOL_BOUND_READ_GO,'1','Root supplemental failure-capture GO required');
assert.equal(runId,'run:660d10eaed54729cf634c8258b85a4cda577018b94d218f6bed7eff5e78e4c14','Exact failed supplemental run required');
const session=await loadSession(PROOFS_ROOT,sessionId);assert.equal(session.phase,'READY');
assert.equal(session.target.name,process.argv[4]);assert.equal(session.target.id,Number(process.argv[5]));
assert.equal(session.target.teamId,325340);assert.equal(session.target.projectId,3200658);
assert.equal(session.target.reference,'dev/cortex-sandbox-'+sessionId);

const exactTarget = async value => {
 assert.equal(value.id,K19_PINS.sessionId);assert.equal(value.phase,'READY');assert.equal(value.ownerUid,process.getuid());
 assert.equal(value.target.name,K19_PINS.name);assert.equal(value.target.id,K19_PINS.targetId);assert.equal(value.target.teamId,325340);assert.equal(value.target.projectId,3200658);
 assert.equal(value.target.reference,'dev/cortex-sandbox-'+K19_PINS.sessionId);assert.equal(value.target.isDefault,false);
 assert.equal(value.target.expiresAt,K19_PINS.expiresAt);assert.ok(value.target.expiresAt>Date.now());
 assert.equal(value.container.imageId,K19_PINS.imageId);
 const host=JSON.parse(await fs.readFile(path.join(value.receiptDir,'host-prepared.json'),'utf8'));
 assert.equal(host.sourceCommit,K19_PINS.sourceCommit);
};
await exactTarget(session);

const ctx=await createContext(session,{logger:()=>{}});let freshVerifications=0;
// The read-only diagnostic must not alter even the existing private journal/receipts.
ctx.persist=async()=>{};ctx.receipt=async(name)=>{if(name.startsWith('cloud-verified-'))freshVerifications++;};
const managementFetch=ctx.fetch;ctx.fetch=(url,options={})=>{assert.equal((options.method??'GET').toUpperCase(),'GET');return managementFetch(url,options);};
await verifyCloud(session,ctx);const key=await getDeployKey(session,ctx);
const requireHost=createRequire(path.join(session.backendDir,'package.json'));
const {BaseConvexClient}=requireHost('convex/browser');
const waiting=new Map();
const client=new BaseConvexClient(session.target.deploymentUrl, tokens=>{for(const token of tokens){const waiter=waiting.get(token);if(!waiter)continue;try{waiter.resolve(client.localQueryResultByToken(token));}catch(error){waiter.reject(error);}}},{logger:false,unsavedChangesWarning:false,webSocketConstructor:WebSocket});client.setAdminAuth(key);
const opaque=value=>typeof value==='string'&&/^[a-zA-Z0-9+/_:.=-]{1,512}$/.test(value)?value:undefined;
const hash=value=>createHash('sha256').update(String(value)).digest('hex');
const code=value=>typeof value==='string'&&/^[A-Z][A-Z0-9_]{1,100}$/.test(value)?value:undefined;
function errorSummary(value){
 if(!value)return undefined;const text=typeof value==='string'?value:JSON.stringify(value);
 const checks={dateNow:/Date\.now|date now/i,random:/Math\.random|randomness/i,processGlobal:/process is not defined|process\.env/i,
  deterministic:/deterministic|non.?deterministic/i,argumentValidation:/ArgumentValidationError|argument validation|extra field|missing required field/i,
  missingRunQuery:/runQuery is not a function|runQuery.*undefined/i,missingRunMutation:/runMutation is not a function|runMutation.*undefined/i,
  missingReference:/Invalid function reference|unknown function|could not find.*function/i,invalidState:/INVALID_STATE/i,
  staleTranscript:/STALE_TRANSCRIPT/i,staleContext:/STALE_CONTEXT/i,forbidden:/FORBIDDEN/i,policyDenied:/POLICY_DENIED/i,
  timeout:/timeout|timed out|deadline/i,transactionLimit:/too many|read limit|database.*limit/i,
  workflow:/workflow/i,jsonParse:/JSON|Unexpected token/i,serialization:/serializ|unsupported type/i,
  browserGlobal:/window is not defined|document is not defined/i,traceHelper:/traceRuntimePhase|runtimeLatencyTrace/i,
  undefinedEnv:/Cannot read properties of undefined[^\n]*reading ['"]env['"]/,typeError:/TypeError/,referenceError:/ReferenceError/,convexError:/ConvexError/,assertionError:/AssertionError/};
 return {sha256:hash(text),bytes:Buffer.byteLength(text),classifications:Object.fromEntries(Object.entries(checks).map(([name,pattern])=>[name,pattern.test(text)])),
  knownCodes:['POLICY_DENIED','FORBIDDEN','INVALID_STATE','STALE_TRANSCRIPT','STALE_CONTEXT','LEASE_EXPIRED','CAPABILITY_UNAVAILABLE','MODEL_INTERRUPTED','CONTEXT_LIMIT_EXCEEDED','STALE_SOURCE'].filter(item=>text.includes(item)),
  stackSourceLocations:[...text.matchAll(/(?:at\s+[^\n]*?\()?([a-zA-Z0-9_./-]+\.tsx?):(\d+):(\d+)/g)].map(match=>({file:match[1],line:Number(match[2]),column:Number(match[3])})).slice(0,12)};
}
async function table(table,componentPath=''){
 await exactTarget(await loadSession(PROOFS_ROOT,session.id));await verifyCloud(session,ctx);
 const page=await new Promise((resolve,reject)=>{const subscription=client.subscribe('_system/cli/tableData',{table,order:'desc',paginationOpts:{cursor:null,numItems:256}},{componentPath});
  const timer=setTimeout(()=>{waiting.delete(subscription.queryToken);subscription.unsubscribe();reject(Error('Bounded system query timeout'));},30000);
  waiting.set(subscription.queryToken,{resolve:value=>{clearTimeout(timer);waiting.delete(subscription.queryToken);subscription.unsubscribe();resolve(value);},reject:error=>{clearTimeout(timer);waiting.delete(subscription.queryToken);subscription.unsubscribe();reject(error);}});
 });
 assert.ok(Array.isArray(page.page),'System table query shape changed');assert.equal(page.isDone,true,'Bounded table scan overflow');await exactTarget(await loadSession(PROOFS_ROOT,session.id));await verifyCloud(session,ctx);return page.page;
}

const one=(rows,label)=>{assert.equal(rows.length,1,'Exact row '+label);return rows[0];};

let result,phase='tables';
try {
 const run=one((await table('runtimeRuns')).filter(row=>row.runId===runId),'run');
 const agentOps=(await table('runtimeAgentOperations')).filter(row=>row.runId===runId&&row.attemptNumber===run.attemptNumber);
 const op1=one(agentOps.filter(row=>row.kind==='model'&&row.ordinal===1),'ordinal1');
 const op0=one(agentOps.filter(row=>row.kind==='model'&&row.ordinal===0),'ordinal0');
 const native=one((await table('runtimeModelOperations')).filter(row=>row._id===op0.nativeModelOperationId),'ordinal0 native');
 const account=one((await table('runtimeBudgetAccounts')).filter(row=>row._id===run.runAccountId),'run account');
 const definitions=await table('runtimeAgentDefinitions');const definitionRow=one(definitions.filter(row=>row.tenantId===run.tenantId&&row.memorySpaceId===run.memorySpaceId&&row.agentId===run.agentId&&row.version===run.agentVersion),'definition');
 const policies=await table('runtimeModelPolicies'),qualifications=await table('runtimeModelQualifications');
 phase='reconstruct';
 const definition=JSON.parse(definitionRow.definitionCanonical),priorResolution=JSON.parse(native.resolutionCanonical),request=JSON.parse(op1.requestCanonical);
 assert.equal(definitionRow.definitionHash,run.definitionHash);assert.equal(definitionRow.revokedAt,undefined);
 assert.equal(canonicalModelJson(request.instructions),canonicalModelJson(definition.instructions));
 const currentPolicies=policies.filter(row=>row.active&&((row.scope==='deployment'&&row.tenantId===undefined)||(row.scope==='tenant'&&row.tenantId===run.tenantId)));
 assert.ok(currentPolicies.every(row=>row.revokedAt===undefined));
 const selected=[...currentPolicies.map(row=>JSON.parse(row.canonical)).filter(row=>!row.operationKey||row.operationKey==='agent.respond'),...definition.policies.filter(row=>!row.operationKey||row.operationKey==='agent.respond')];
 assert.equal(canonicalModelJson(selected),canonicalModelJson(priorResolution.policies),'Current policy identity must match persisted exact original resolution');
 const currentQualified=qualifications.filter(row=>row.active&&row.version===account.root.revision);assert.ok(currentQualified.every(row=>row.revokedAt===undefined));
 const qualified=currentQualified.map(row=>JSON.parse(row.canonical));
 assert.equal(canonicalModelJson([...qualified].sort((a,b)=>a.receiptId.localeCompare(b.receiptId))),canonicalModelJson([...priorResolution.qualifications].sort((a,b)=>a.receiptId.localeCompare(b.receiptId))),'Current exact qualification data');
 const snapshot=resolveModelPolicy({context:priorResolution.context,policies:selected,qualifications:qualified});
 assert.equal(canonicalModelJson(snapshot),native.snapshotCanonical,'Current selected snapshot equals original function/interface binding');
 const inputProofRows=await table('runtimeModelAttempts');const priorAttempt=one(inputProofRows.filter(row=>row.operationDocumentId===native._id),'prior native attempt');const proof=JSON.parse(priorAttempt.inputProofCanonical).proof;
 assert.ok(proof.expiresAt>Date.now());assert.equal(proof.receiptId,snapshot.qualificationReceiptId);
 const aiRoot=path.join(session.backendDir,'node_modules/ai/src/prompt');
 const {standardizePrompt}=await import(pathToFileURL(path.join(aiRoot,'standardize-prompt.ts')));
 const {convertToLanguageModelPrompt}=await import(pathToFileURL(path.join(aiRoot,'convert-to-language-model-prompt.ts')));
 assert.ok(!request.messages.some(message=>Array.isArray(message.content)&&message.content.some(part=>['tool-approval-request','tool-approval-response'].includes(part.type))),'No unpersisted auto-deny transformation to infer');
 const messages=[...request.messages,...request.context?[{role:'system',content:'Authorized Cortex context (untrusted evidence):\n'+request.context}]:[]];
 const standardized=await standardizePrompt({instructions:request.instructions.text,messages,allowSystemInMessages:true});
 const prompt=await convertToLanguageModelPrompt({prompt:standardized,supportedUrls:{},download:async()=>{throw Error('No asset/network download permitted');}});
 const gatewaySource=await fs.readFile('/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion/convex-dev/runtimeGateway.ts','utf8');
 const ast=ts.createSourceFile('runtimeGateway.ts',gatewaySource,ts.ScriptTarget.Latest,true);
 const names=['GatewayDispatchError','fail','utf8','count','record','arrayValues','stableId','detached','requestBase','standardKeys','agentToolEnvelope','languageParams'];
 const snippets=names.map(name=>{const declaration=ast.statements.find(node=>ts.isFunctionDeclaration(node)&&node.name?.text===name||ts.isClassDeclaration(node)&&node.name?.text===name||ts.isVariableStatement(node)&&node.declarationList.declarations.some(declaration=>declaration.name.getText(ast)===name));assert.ok(declaration,'Actual original declaration required');return declaration.getText(ast);}).join('\n');
 const js=ts.transpileModule(snippets,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
 let numericRequest;
 const validate=(snapshot,input)=>{numericRequest=Object.fromEntries(['inputTokens','outputTokens','toolSteps','timeoutMs'].map(key=>[key,input[key]]));return validateModelRequest(snapshot,input);};
 const factory=new Function('canonicalModelJson','normalizeSourceText','agentToolCatalog','agentToolsInputBound','agentToolsInputBoundV2','AGENT_TOOL_REGISTRY_VERSION_V2','MEMORY_JSON_OBJECT_CONTRACT','validateModelRequest','nativeLanguage','exports',js+';return languageParams;');
 const language=factory(canonicalModelJson,normalizeSourceText,agentToolCatalog,agentToolsInputBound,agentToolsInputBoundV2,AGENT_TOOL_REGISTRY_VERSION_V2,MEMORY_JSON_OBJECT_CONTRACT,validate,()=>({}),{});
 const tools=agentToolCatalog(snapshot.pins.toolRegistryVersion).filter(tool=>definition.tools.some(entry=>NATIVE_TOOL_NAMES_V2[entry.toolId]===tool.name));
 let denial;
 try{language({prompt,tools,toolChoice:{type:'auto'},maxOutputTokens:Math.min(snapshot.limits.outputTokens,proof.resultBound.maximumOutputTokens)},snapshot,proof,{reference:run.authorityReference,operationKey:'agent.respond',runBudgetId:run.runBudgetId,semanticId:op1.semanticId,ordinal:1},new AbortController().signal);}catch(error){denial={policyDenied:String(error.message).startsWith('POLICY_DENIED:'),boundedLimits:String(error.message)==='POLICY_DENIED: request exceeds bounded limits',errorSha256:hash(String(error.message))};}
 assert.ok(numericRequest,'Original native dimension calculation reached');
 const excess=Object.keys(numericRequest).filter(key=>numericRequest[key]>snapshot.limits[key]);
 await exactTarget(await loadSession(PROOFS_ROOT,session.id));await verifyCloud(session,ctx);
 result={observedAt:new Date().toISOString(),target:{sessionId,name:session.target.name,id:session.target.id,sourceCommit:K19_PINS.sourceCommit,imageId:K19_PINS.imageId},runId,readOnly:true,rawPrivatePayloadRetained:false,
  ordinal:1,persistedAgentRequestPresent:true,persistedNativeOrdinal1Admission:false,reconstruction:'Actual persisted Agent request, unchanged original Agent contextHandler text assembly, installed AI SDK prompt conversion, actual extracted original Gateway languageParams and original validator; no provider/network/Action/mutation',
  dimensions:numericRequest,limits:Object.fromEntries(Object.keys(numericRequest).map(key=>[key,snapshot.limits[key]])),exceededFields:excess,denial,
  versions:{agentVersion:run.agentVersion,operationKey:'agent.respond',nativeInterface:snapshot.nativeInterface,modelIdSha256:hash(snapshot.modelId),promptVersion:snapshot.pins.promptVersion,toolRegistryVersion:snapshot.pins.toolRegistryVersion,qualificationReceiptIdSha256:hash(snapshot.qualificationReceiptId)},
  currentPolicyAndQualificationDataEqual:true,currentSelectedSnapshotEqual:true,freshVerifications,sourceHashes:{gateway:hash(gatewaySource),extractedDeclarations:hash(snippets),standardizePrompt:hash(await fs.readFile(path.join(aiRoot,'standardize-prompt.ts'),'utf8')),convertPrompt:hash(await fs.readFile(path.join(aiRoot,'convert-to-language-model-prompt.ts'),'utf8'))},paidCalls:0,limitsRaised:false};
} catch(error) {const text=String(error?.message??error);result={passed:false,readOnly:true,phase,errorSha256:hash(text),errorBytes:Buffer.byteLength(text),knownCodes:errorSummary(error)?.knownCodes,rawPrivatePayloadRetained:false,paidCalls:0,freshVerifications,dimensionsUnavailable:true};process.exitCode=1;}
finally {await client.close();}
result.clientsClosed=true;const destination=path.join(path.dirname(new URL(import.meta.url).pathname),'k19-supplemental-bound-projection-'+Date.now()+'.json');await fs.writeFile(destination,JSON.stringify(result,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({receipt:destination,clientsClosed:true,dimensions:result.dimensions,limits:result.limits,exceededFields:result.exceededFields,dimensionsUnavailable:result.dimensionsUnavailable}));
