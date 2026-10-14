import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';import {execFileSync} from 'node:child_process';import ts from 'typescript';
const R=process.cwd(),Q=path.join(R,'_goals/convex-backend-runtime-2026-10-02/qa/sandbox-chat-latency-2026-10-12');
const rows=[];const sha=text=>crypto.createHash('sha256').update(text).digest('hex');
function tokens(source){const scanner=ts.createScanner(ts.ScriptTarget.Latest,true,ts.LanguageVariant.Standard,source);const out=[];for(let token=scanner.scan();token!==ts.SyntaxKind.EndOfFileToken;token=scanner.scan())out.push([token,scanner.getTokenText()]);return JSON.stringify(out);}
function member(source,name,body=false){const tree=ts.createSourceFile('input.ts',source,ts.ScriptTarget.Latest,true);let result;function visit(n){if(ts.isFunctionDeclaration(n)&&n.name?.text===name)result=(body?n.body:n)?.getText(tree);if(ts.isVariableDeclaration(n)&&ts.isIdentifier(n.name)&&n.name.text===name)result=n.getText(tree);ts.forEachChild(n,visit);}visit(tree);if(!result)throw Error('Missing original member '+name);return tokens(result);}
for(const [file,names,body] of [
 ['convex-dev/runtimeAgent.ts',['executeTurn','executeTurnV2','executeTurnV3','executeTurnV4','executeTurnV5','executeToolsV6','executeToolsV7','executeDirectV6','retireDirectV6'],false],
 ['convex-dev/runtimeAgent.ts',['prepareContextHandler','prepareEmptyContextHandler','prepareRoutedContextHandler','saveContextHandler','saveAndPrepareContextHandler','prepareResolvedModelCandidateHandler','prepareDirectTurnHandler','attachDirectContinuationHandler','interruptDirectHandler','finishTurnV6','beginOperationHandler','startOperationHandler','toolStepHandler'],true],
 ['convex-dev/runtimeTranscript.ts',['createManagedConversation','manualAppend','registerMessages','captureCutoff','hydrateCutoff','hydratePrivateCutoff'],true],
 ['convex-dev/runs.ts',['claimNext'],false],
 ['convex-dev/agentDefinitions.ts',['EXECUTABLE_REGISTRY','EXECUTABLE_REGISTRY_V2'],false],
]){const before=execFileSync('git',['show',`03256989da22bde35dff78023c1c3962391a68c6:${file}`],{cwd:R,encoding:'utf8'}),after=fs.readFileSync(path.join(R,file),'utf8');for(const name of names){const old=member(before,name,body),current=member(after,name,body);rows.push({file,name,bodyOnly:body,equal:old===current,beforeHash:sha(old),afterHash:sha(current)});}}
const baselineAgent=execFileSync('git',['show','03256989da22bde35dff78023c1c3962391a68c6:convex-dev/runtimeAgent.ts'],{encoding:'utf8'});
const currentAgent=fs.readFileSync(path.join(R,'convex-dev/runtimeAgent.ts'),'utf8');
const addedBranch=`if (proposal?.requestPreflight) {
        if (fresh.snapshot.version === 8) await preflightModelCandidateV8(fresh, args, op, proposal.initialResolution, proposal.governedResolution);
        else preflightModelCandidate(fresh, args, op, proposal.initialResolution, proposal.governedResolution);
      }`;
if(!currentAgent.includes(addedBranch))throw Error('Exact V8-only branch mask missing');
const restoredAgent=currentAgent.replace(addedBranch,'if (proposal?.requestPreflight) preflightModelCandidate(fresh, args, op, proposal.initialResolution, proposal.governedResolution);');
for(const name of ['executionContext','preflightModelCandidate','executePreparedModelStep']){const before=member(baselineAgent,name,true),after=member(restoredAgent,name,true);rows.push({file:'convex-dev/runtimeAgent.ts',name,bodyOnly:true,equal:before===after,beforeHash:sha(before),afterHash:sha(after),mask:name==='executePreparedModelStep'?'Restore exact added V8 snapshot branch only':undefined});}
const domain='src/domain/model-input-selection.ts',beforeDomain=execFileSync('git',['show',`03256989da22bde35dff78023c1c3962391a68c6:${domain}`],{encoding:'utf8'}),afterDomain=fs.readFileSync(path.join(R,domain),'utf8');
const yielded='const result = yield { messages: selected, context };';if(!afterDomain.includes(yielded))throw Error('Exact callback-yield mask missing');
const restoredDomain=afterDomain.replace(yielded,'const result = input.check(selected, context);');
const beforeSelector=member(beforeDomain,'fitModelInput',true),afterSelector=member(restoredDomain,'modelInputFitSteps',true);rows.push({file:domain,name:'original-selection-predicates-order',equal:beforeSelector===afterSelector,beforeHash:sha(beforeSelector),afterHash:sha(afterSelector),mask:'Only yield restored to original callback invocation'});
const result={kind:'source-token-equivalence',nativeRuntimeProof:false,baseline:'03256989da22bde35dff78023c1c3962391a68c6',checks:rows,passed:rows.every(r=>r.equal)};fs.writeFileSync(path.join(Q,'v8-assembled-input-equivalence.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({passed:result.passed,count:rows.length,changed:rows.filter(r=>!r.equal).map(r=>r.name)}));if(!result.passed)process.exitCode=1;
