import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import ts from 'typescript';
const R='/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion',Q=R+'/_goals/convex-backend-runtime-2026-10-02/qa/sandbox-chat-latency-2026-10-12',base='9fb9687536af0b7abfcb7280e0aa26ef450051ea';
const product=['runtimeAuth','runtimeDataAuth','runtimeAgentRecall','runtimeMemory','runtimeMemoryQuery','runtimeMemoryRepository'].map(x=>'convex-dev/'+x+'.ts');
const tests=['runtimeAuth/managed-source-read-scope','runtimeAgent/whole-recall-composition','runtimeMemory/authority-scope-entries','runtimeMemory/vector-delivery-batch','runtimeMemory/query-composition'].map(x=>'tests/unit/'+x+'.test.ts');
const hash=s=>createHash('sha256').update(s).digest('hex'),checks=[];
const prior=p=>execFileSync('git',['show',base+':'+p],{cwd:R,encoding:'utf8',maxBuffer:8*1024*1024});
const current=p=>fs.readFileSync(R+'/'+p,'utf8');
function parse(s){return ts.createSourceFile('source.ts',s,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS);}
function tokens(s){const scanner=ts.createScanner(ts.ScriptTarget.Latest,true,ts.LanguageVariant.Standard,s);let result='';for(let kind=scanner.scan();kind!==ts.SyntaxKind.EndOfFileToken;kind=scanner.scan())result+=kind+':'+scanner.getTokenText()+'|';return result;}
function named(s,name){const source=parse(s);let result;function visit(n){if((ts.isFunctionDeclaration(n)||ts.isClassDeclaration(n))&&n.name?.text===name)result=n;ts.forEachChild(n,visit);}visit(source);if(!result)throw Error('Missing '+name);return {node:result,source,text:result.getText(source),body:result.body?.getText(source)};}
function same(p,name,normalize=s=>s){const old=named(prior(p),name),now=named(current(p),name);const a=old.body??old.text,b=now.body??now.text;const pass=tokens(a)===tokens(normalize(b));checks.push({file:p,declaration:name,pass,baselineBodySha256:hash(a),actualBodySha256:hash(b),comparison:normalize.toString()==='s=>s'?'token-identical':'explicit wrapper-only mask'});if(!pass)throw Error('Changed original body '+p+':'+name);}
for(const name of ['withManagedSourceReads','readManagedSourceRows','readManagedConversationRows','readManagedTranscriptBridgeRows','readManagedSourceRunRows','createAuthorityReadScope','createV8AuthorityReadScope','createUncachedAuthorityReader','readNativeTranscriptMessages','freshManagedSourceReads','freshPolicyMetadataReads'])same(product[0],name);
same(product[1],'managedSourceIsCurrent',s=>s.replace('freshManagedSourceValidation(ctx)','ctx'));
const data=parse(prior(product[1]));for(const node of data.statements)if(ts.isFunctionDeclaration(node)&&node.name&&node.name.text!=='managedSourceIsCurrent')same(product[1],node.name.text);
for(const name of ['prepareReadsHandler','readMatchesHandler'])same(product[2],name,s=>s.replaceAll('withManagedSourceValidationReads','withManagedSourceReads'));
for(const name of ['finalDeliveryV8Handler','readMatchesAndDeliveryV8Handler','finishAgentRecall','finishAgentRecallV8'])same(product[2],name);
for(const name of ['binding','preparePublicRecallHandler','admitPublicRecallHandler'])same(product[4],name);
same(product[4],'recallPublicMemory',s=>s.replace("repository:createActionMemoryRepository(ctx,reference,'read',{boundRecallFacts:true})",'repository'));
same(product[5],'ConvexMemoryRepository');
const actionBody=named(current(product[5]),'createActionMemoryRepository');let boundBranch;
function findBranch(n){if(ts.isVariableDeclaration(n)&&ts.isIdentifier(n.name)&&n.name.text==='listFacts'&&n.initializer&&ts.isArrowFunction(n.initializer))boundBranch=n.initializer.body.statements[0].getText(actionBody.source);ts.forEachChild(n,findBranch);}findBranch(actionBody.node);
same(product[5],'createActionMemoryRepository',s=>s.replace(boundBranch,''));

// Exact original raw-reader mapping moved into one named pure constructor.
const oldRaw=named(prior(product[0]),'createRawReadScope');let oldMap;function mapping(n){if(ts.isVariableDeclaration(n)&&ts.isIdentifier(n.name)&&n.name.text==='reader')oldMap=n.initializer?.getText(oldRaw.source);ts.forEachChild(n,mapping);}mapping(oldRaw.node);
const mapped=named(current(product[0]),'mappedAuthorityReader');const returned=mapped.node.body.statements.find(ts.isReturnStatement)?.expression?.getText(mapped.source);
checks.push({file:product[0],declaration:'original reader mapping',pass:tokens(oldMap)===tokens(returned)});
function registered(s){return parse(s).statements.flatMap(n=>ts.isVariableStatement(n)?n.declarationList.declarations.flatMap(d=>ts.isIdentifier(d.name)&&d.initializer&&ts.isCallExpression(d.initializer)&&['action','mutation','query','internalAction','internalMutation','internalQuery'].includes(d.initializer.expression.getText())?[d.name.text+':'+d.initializer.expression.getText()]:[]):[]).sort();}
for(const p of product){const before=registered(prior(p)),after=registered(current(p));checks.push({file:p,declaration:'registered name/kind set',pass:JSON.stringify(before)===JSON.stringify(after),before,after});}
// No original outcome/race/failure test callback was edited; only the old
// factory-toggle fixture gained the new explicitly replaced entry factory.
const originalTestControls=[];
for(const p of tests){const before=prior(p),afterText=current(p),source=parse(before);let count=0;function visit(n){if(ts.isCallExpression(n)&&n.arguments.some(a=>ts.isArrowFunction(a)||ts.isFunctionExpression(a))&&/^(it|test|describe)(?:$|\.|\()/.test(n.expression.getText(source))){count++;if(!afterText.includes(n.getText(source)))throw Error('Original test control changed '+p);}ts.forEachChild(n,visit);}visit(source);originalTestControls.push({file:p,originalTestCallbacksUnchanged:count});}
if(checks.some(c=>!c.pass))throw Error('Equivalence check failed');
const out={baselineProductCommit:base,observedHead:execFileSync('git',['rev-parse','HEAD'],{cwd:R,encoding:'utf8'}).trim(),files:[...product,...tests].map(path=>({path,sha256:hash(current(path)),baselineSha256:hash(prior(path))})),checks,originalTestControls,
intentionalDeltas:['fresh traversal-local raw reader only on exact-owner graph-only source views; full readers unchanged','public native read entries opt into graph-only raw family','internal readFacts optional includeBindings branch; old array response unchanged','public post-embedding repository opts into source/fact binding in same readFacts snapshot; same finalDelivery RPC'],nativePerformance:'UNAVAILABLE',registeredSetUnchanged:true};
fs.writeFileSync(Q+'/k27-equivalence.json',JSON.stringify(out,null,2)+'\n');console.log(JSON.stringify({checks:checks.length,files:out.files.length,originalTestControls,sha256:hash(fs.readFileSync(Q+'/k27-equivalence.json'))}));
