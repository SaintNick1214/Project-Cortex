import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import ts from 'typescript';
const root=process.cwd(),baseline='a773bd545c22e3c6eeb228b800d4c3a679375c5b';
const changed={
 'convex-dev/runtimeAgent.ts':['prepareEmptyContextV8Handler','prepareRoutedContextV8Handler','prepareDirectTurnV8Handler'],
 'convex-dev/runtimeAgentRecall.ts':['prepareReadsHandler','readMatchesHandler'],
 'convex-dev/runtimeMemoryQuery.ts':['readRecallMatchesHandler'],
 'convex-dev/agentDefinitions.ts':['narrowPolicies','rowFor'],
 'convex-dev/runtimeModelPolicy.ts':['policies'],
 'convex-dev/runtimeTranscript.ts':['bridgeFor'],
};
const sha=value=>crypto.createHash('sha256').update(value).digest('hex');
function declarations(file,source){
 const sf=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS),out=new Map();
 for(const statement of sf.statements){
  if(ts.isImportDeclaration(statement))continue;
  const name=ts.isFunctionDeclaration(statement)?statement.name?.text:ts.isVariableStatement(statement)?statement.declarationList.declarations.map(item=>item.name.getText(sf)).join(','):ts.isInterfaceDeclaration(statement)||ts.isTypeAliasDeclaration(statement)||ts.isClassDeclaration(statement)?statement.name?.text:`${ts.SyntaxKind[statement.kind]}:${out.size}`;
  out.set(name,statement.getText(sf));
 }
 return out;
}
const files=[];
for(const[file,allowed]of Object.entries(changed)){
 const original=execFileSync('git',['show',`${baseline}:${file}`],{encoding:'utf8',cwd:root}),current=fs.readFileSync(path.join(root,file),'utf8');
 const old=declarations(file,original),now=declarations(file,current),actualChanged=[],unchanged=[];
 if(JSON.stringify([...old.keys()])!==JSON.stringify([...now.keys()]))throw Error(`Unexpected declaration inventory ${file}`);
 for(const[name,value]of old){if(now.get(name)===value)unchanged.push({name,sha256:sha(value)});else actualChanged.push(name);}
 if(JSON.stringify([...actualChanged].sort())!==JSON.stringify([...allowed].sort()))throw Error(`Unexpected changed declarations ${file}: ${actualChanged}`);
 files.push({file,baselineSHA256:sha(original),currentSHA256:sha(current),originalDeclarations:old.size,unchangedDeclarations:unchanged,explicitChangedDeclarations:actualChanged});
}
const result={schemaVersion:1,kind:'source-only original declaration comparison',baseline,files,unchangedDeclarations:files.reduce((n,file)=>n+file.unchangedDeclarations.length,0),
 conclusion:'Only the ten named orchestration/raw-query expressions changed; all other original top-level declarations are byte-identical. This does not claim native latency or replace dynamic equivalence tests.',native:'NOT_RUN'};
fs.writeFileSync(path.join(path.dirname(new URL(import.meta.url).pathname),'k29-chain-original-bodies.json'),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({files:files.length,unchangedDeclarations:result.unchangedDeclarations,changed:files.flatMap(file=>file.explicitChangedDeclarations),exit:0}));
