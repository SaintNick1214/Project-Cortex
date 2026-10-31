import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import child from 'node:child_process';
import {createRequire} from 'node:module';
const R=process.cwd(),Q=path.join(R,'_goals/convex-backend-runtime-2026-10-02/qa/sandbox-chat-latency-2026-10-12');
const ts=createRequire(path.join(R,'package.json'))('typescript'),hash=v=>crypto.createHash('sha256').update(v).digest('hex');
const baseline='3e55e7b9b45093f547699619c572fdbe09c1efde';
const changes={'src/domain/belief-plan.ts':['planBeliefs'],'convex-dev/runtimeMemoryGateway.ts':['buildSourceExtractionFramingV4'],'convex-dev/runtimeIngestion.ts':['failStage','processStageHandler']};
function declarations(text,file){const source=ts.createSourceFile(file,text,ts.ScriptTarget.Latest,true);const out={};
 for(const node of source.statements){if(ts.isFunctionDeclaration(node)&&node.name)out[node.name.text]=node.getText(source);
  if(ts.isVariableStatement(node))for(const d of node.declarationList.declarations)if(ts.isIdentifier(d.name))out[d.name.text]=d.getText(source);}
 return out;}
const result={baselineCommit:baseline,sourceOnly:true,financialAndSourceGuardChanges:false,files:{},unchangedDeclarationCount:0};
for(const [file,intended]of Object.entries(changes)){
 const old=child.execFileSync('git',['show',baseline+':'+file],{cwd:R,encoding:'utf8'}),now=fs.readFileSync(path.join(R,file),'utf8');
 const before=declarations(old,file),after=declarations(now,file),changed=Object.keys(before).filter(n=>before[n]!==after[n]),added=Object.keys(after).filter(n=>!Object.hasOwn(before,n));
 if(changed.sort().join('|')!==intended.sort().join('|'))throw Error('Unexpected original declaration delta: '+file+':'+changed.join(','));
 const unchanged=Object.keys(before).filter(n=>before[n]===after[n]);result.unchangedDeclarationCount+=unchanged.length;
 result.files[file]={baselineSha256:hash(old),currentSha256:hash(now),changedOriginalDeclarations:changed,addedDeclarations:added,unchangedOriginalDeclarations:unchanged};
}
for(const file of ['src/domain/sources.ts','src/domain/extraction.ts','convex-dev/runtimeIngestionSchema.ts','convex-dev/runtimeModelPolicy.ts']){
 const old=child.execFileSync('git',['show',baseline+':'+file],{cwd:R}),now=fs.readFileSync(path.join(R,file));if(!old.equals(now))throw Error('Protected source changed: '+file);
 result.files[file]={baselineSha256:hash(old),currentSha256:hash(now),byteIdentical:true};
}
result.verdict='PASS';fs.writeFileSync(path.join(Q,'k22-domain-output-equivalence.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({verdict:result.verdict,unchangedDeclarationCount:result.unchangedDeclarationCount}));
