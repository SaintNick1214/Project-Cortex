import ts from 'typescript';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const cwd='/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion', q=`${cwd}/_goals/convex-backend-runtime-2026-10-02/qa/sandbox-chat-latency-2026-10-12`;
const before=readFileSync(`${q}/cloud-context-routing-runtimeAgent.preimage.ts`,'utf8'),combined=readFileSync(`${cwd}/convex-dev/runtimeAgent.ts`,'utf8'),hash=x=>createHash('sha256').update(x).digest('hex');
// Reconstruct the already observed routing-only intermediate, undoing only
// independent authority-snapshot registration entry wiring for comparison.
let after=combined.replace('recheckAuthority, createAuthorityReadScope','recheckAuthority');
for(const name of ['resolveModelOperation','contextInputs','contextSource','admitModelOperation','prepareEmptyContext']) {
 const handler=name+'Handler';after=after.replace(`handler: (ctx, args) => ${handler}(createAuthorityReadScope(ctx), args)`, `handler: ${handler}`);
}
after=after.replace('  ctx = createAuthorityReadScope(ctx);\n','');
const observedRoutingSha256='42c6c4e7a3a5a30e213625d83181be6afd3fc55b054d3bc50c1aa3dc555647f7';
if(hash(after)!==observedRoutingSha256) throw new Error('Intermediate does not match earlier actually observed routing-only source hash');

function parse(source){const f=ts.createSourceFile('runtimeAgent.ts',source,ts.ScriptTarget.Latest,true);const records=new Map();for(const n of f.statements){if(ts.isFunctionDeclaration(n)&&n.name)records.set(n.name.text,{text:n.getText(f),body:n.body?.getText(f)});if(ts.isVariableStatement(n))for(const d of n.declarationList.declarations)if(ts.isIdentifier(d.name)){const fields={text:d.getText(f)};const call=d.initializer;if(call&&ts.isCallExpression(call)&&call.arguments[0]&&ts.isObjectLiteralExpression(call.arguments[0])){const handler=call.arguments[0].properties.find(p=>ts.isPropertyAssignment(p)&&p.name.getText(f)==='handler');if(handler&&ts.isPropertyAssignment(handler)&&(ts.isArrowFunction(handler.initializer)||ts.isFunctionExpression(handler.initializer)))fields.body=handler.initializer.body.getText(f);}records.set(d.name.text,fields);}}return records;}
const a=parse(before),b=parse(after),changed=[];for(const[name,item]of a)if(item.text!==b.get(name)?.text)changed.push(name);
const oldWorkflows=['executeTurn','executeTurnV2','executeTurnV3'].map(name=>({name,exactDeclaration:a.get(name).text===b.get(name).text,sha256:hash(a.get(name).text)}));
const originalEmptyBody=a.get('prepareEmptyContext').body,factoredBody=b.get('prepareEmptyContextHandler').body;
const v4Expected=a.get('executeTurnV3').body.replaceAll('"runtimeAgent:prepareEmptyContext"','"runtimeAgent:prepareRoutedContext"');
const eq={version:2,baselineSha256:hash(before),observedSha256:hash(after),combinedCurrentSha256:hash(combined),routingIntermediateMatchesEarlierObservedSha:hash(after)===observedRoutingSha256,independentEntryWiringRegistrations:["resolveModelOperation","contextInputs","contextSource","admitModelOperation","prepareEmptyContext","prepareRoutedContext"],historicalWorkflows:oldWorkflows,emptyHandler:{bodyByteIdentical:originalEmptyBody===factoredBody,originalBodySha256:hash(originalEmptyBody),factoredBodySha256:hash(factoredBody)},v4:{exactV3BodyExceptScheduledHandler:v4Expected===b.get('executeTurnV4').body},changedExistingDeclarations:changed,unchangedExistingDeclarations:[...a.keys()].filter(k=>!changed.includes(k)),originalStartDispatcherOnly:a.get('startExecution').text.replace('"runtimeAgent:executeTurnV3"','"runtimeAgent:executeTurnV4"')===b.get('startExecution').text,originalGuardBodies:['executionContext','contextInputsHandler','saveContextHandler','resolveModelOperationHandler','prepareModelOperationHandler','admitModelOperationHandler'].map(name=>({name,byteIdentical:a.get(name).body===b.get(name).body})),productionPassed:false};
eq.productionPassed=oldWorkflows.every(x=>x.exactDeclaration)&&eq.emptyHandler.bodyByteIdentical&&eq.v4.exactV3BodyExceptScheduledHandler&&eq.originalStartDispatcherOnly&&eq.originalGuardBodies.every(x=>x.byteIdentical)&&changed.length===2&&changed.includes('startExecution')&&changed.includes('prepareEmptyContext');
writeFileSync(`${q}/cloud-context-routing-equivalence.json`,JSON.stringify(eq,null,2)+'\n');console.log(JSON.stringify({passed:eq.productionPassed,changed,baselineSha256:eq.baselineSha256,observedSha256:eq.observedSha256}));if(!eq.productionPassed)process.exitCode=1;
