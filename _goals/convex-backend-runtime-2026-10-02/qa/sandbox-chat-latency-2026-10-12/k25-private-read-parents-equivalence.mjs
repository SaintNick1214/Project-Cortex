import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
const r='/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion';
const q=path.dirname(new URL(import.meta.url).pathname);
const accepted='be39655e09fdee69907a6ba81b096e5a44067945';
const old=path.join('/Users/SaintNick/Documents/Cortex/Project-Cortex-Proofs/manual-sandbox-foreground-priority-2026-10-14/staging',accepted);
const ts=createRequire(path.join(r,'package.json'))('typescript');
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const files=['convex-dev/runtimeAgent.ts','convex-dev/runtimeAgentQueryEmbedding.ts','convex-dev/runtimeAgentRecall.ts'];
const manifest=JSON.parse(await fs.readFile(path.join(old,'dist/backend/v1/manifest.json'),'utf8'));
const changedBodies=new Set(['runtimeAgent.ts:prepareContextV8Handler','runtimeAgent.ts:finishTurnV8','runtimeAgentRecall.ts:finishAgentRecallV8']);
const proofs=[];
for(const relative of files){
 const a=await fs.readFile(path.join(old,relative),'utf8'),b=await fs.readFile(path.join(r,relative),'utf8');
 const entry=manifest.files.find(value=>value.sourcePath===relative);
 if(!entry||entry.sourceSha256!==sha(a))throw Error('Accepted staging input mismatch: '+relative);
 const parse=text=>ts.createSourceFile(relative,text,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS);
 const as=parse(a),bs=parse(b),functions=sf=>new Map(sf.statements.filter(ts.isFunctionDeclaration).filter(n=>n.name&&n.body).map(n=>[n.name.text,n]));
 const af=functions(as),bf=functions(bs),checks=[];
 for(const[name,node]of af){
  const key=path.basename(relative)+':'+name,next=bf.get(name);if(!next)throw Error('Original function removed: '+key);
  const prior=node.body.getText(as);let actual=next.body.getText(bs),kind='literal-original-body';
  if(changedBodies.has(key)){checks.push({name,kind:'explicit-private-V8-routing-change',oldSha256:sha(prior),newSha256:sha(actual)});continue;}
  if(name==='readMatchesHandler'||name==='finalDeliveryV8Handler'){
   actual=actual.replace(next.body.statements[0].getText(bs),node.body.statements[0].getText(as));kind='only-invocation-reader-injection-mask';
  }
  if(name==='recallAgentMemoryV8'){
   actual=actual.replace('  // Only a private native context/preflight parent supplies this tentative data.\n  // Admission derives and rechecks the request again; refresh keeps its own RPC.\n','').replace('const proposal = preparedProposal ?? await','const proposal = await');kind='only-tentative-private-proposal-selection-mask';
  }
  if(actual!==prior)throw Error('Original body differs outside allowed routing/read masks: '+key);
  checks.push({name,kind,oldSha256:sha(prior),normalizedCurrentSha256:sha(actual)});
 }
 const vars=sf=>new Map(sf.statements.filter(ts.isVariableStatement).flatMap(n=>n.declarationList.declarations.filter(v=>ts.isIdentifier(v.name)).map(v=>[v.name.text,v.getText(sf)])));
 const av=vars(as),bv=vars(bs);let variables=0;
 for(const[name,text]of av){if(bv.get(name)!==text)throw Error('Original registration/constant changed: '+relative+':'+name);variables++;}
 proofs.push({relative,acceptedSourceSha256:sha(a),currentSha256:sha(b),originalFunctions:checks,originalVariablesLiteralEqual:variables});
}
const out={status:'SOURCE_EQUIVALENCE_COMPLETE',acceptedSourceCommit:accepted,baseline:'Existing prospective immutable kit staging bytes verified against its retained backend source manifest; no Git/network/archive copies',files:proofs,literalFunctionBodies:proofs.flatMap(p=>p.originalFunctions).filter(x=>x.kind==='literal-original-body').length,maskedOriginalHelperBodies:proofs.flatMap(p=>p.originalFunctions).filter(x=>x.kind.endsWith('-mask')).length,explicitPrivateRoutingChanges:proofs.flatMap(p=>p.originalFunctions).filter(x=>x.kind==='explicit-private-V8-routing-change').length,originalRegistrationsAndConstants:proofs.reduce((n,p)=>n+p.originalVariablesLiteralEqual,0),nativeSpeed:'UNAVAILABLE'};
await fs.writeFile(path.join(q,'k25-private-read-parents-equivalence.json'),JSON.stringify(out,null,2)+'\n');
console.log(JSON.stringify({status:out.status,literalBodies:out.literalFunctionBodies,masks:out.maskedOriginalHelperBodies,routingChanges:out.explicitPrivateRoutingChanges,oldConstantsAndRegistrations:out.originalRegistrationsAndConstants,receiptSha256:sha(await fs.readFile(path.join(q,'k25-private-read-parents-equivalence.json')))}));
