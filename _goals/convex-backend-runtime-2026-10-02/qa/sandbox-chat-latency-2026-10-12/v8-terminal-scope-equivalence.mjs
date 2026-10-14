import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import ts from '/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion/node_modules/typescript/lib/typescript.js';
const R='/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion';
const Q=path.join(R,'_goals/convex-backend-runtime-2026-10-02/qa/sandbox-chat-latency-2026-10-12');
const commit='efcc91d2317dadcb143c5cf1929504bd0cbee3a6';
const kit='/Users/SaintNick/Documents/Cortex/Project-Cortex-Proofs/manual-sandbox-read-retention-2026-10-14';
const stage=path.join(kit,'staging',commit);
const inputs=JSON.parse(fs.readFileSync(path.join(kit,'artifacts',commit,'build-inputs.json'),'utf8'));
const hash=x=>crypto.createHash('sha256').update(x).digest('hex');
const files=['runtimeModelPolicy','runtimeGatewayBackend','runtimeAgentQueryEmbedding','runtimeAgent'].map(x=>`convex-dev/${x}.ts`);
const checks=[], baselines=[];
function bodies(text,file){
 const source=ts.createSourceFile(file,text,ts.ScriptTarget.Latest,true);const found=new Map();
 function visit(node){
  if(ts.isFunctionDeclaration(node)&&node.name&&node.body) found.set(node.name.text,node.body.getText(source));
  if(ts.isVariableDeclaration(node)&&ts.isIdentifier(node.name)&&node.initializer&&ts.isCallExpression(node.initializer)) {
   const arg=node.initializer.arguments[0];
   if(arg&&ts.isObjectLiteralExpression(arg))for(const p of arg.properties){
    if(ts.isPropertyAssignment(p)&&p.name.getText(source)==='handler'&&(ts.isArrowFunction(p.initializer)||ts.isFunctionExpression(p.initializer))&&ts.isBlock(p.initializer.body))found.set(`${node.name.text}.handler`,p.initializer.body.getText(source));
   }
  }
  ts.forEachChild(node,visit);
 }
 visit(source);return found;
}
for(const file of files){
 const baseline=fs.readFileSync(path.join(stage,file),'utf8'), current=fs.readFileSync(path.join(R,file),'utf8');
 const pin=inputs.find(x=>x.path===file); if(!pin||hash(baseline)!==pin.sha256)throw Error(`Unmatched immutable preimage ${file}`);
 baselines.push({file,path:path.join(stage,file),sha256:pin.sha256});const old=bodies(baseline,file),now=bodies(current,file);
 for(const [name,body]of old){
  const target=name==='captureTerminalEvidence.handler'?'captureTerminalEvidenceHandler':name==='attachTerminalResult.handler'?'attachTerminalResultHandler':name;
  let actual=now.get(target), mask='none';
  if(name==='createBackendGatewayComposition'){
   actual=actual?.replace('  const terminalReferences = (ctx as BackendGatewayContext & { [v8TerminalPorts]?: true })[v8TerminalPorts] ? v8TerminalReferences : references;\n','').replace('ctx.runMutation(terminalReferences.attachTerminalResult, args)','ctx.runMutation(references.attachTerminalResult, args)').replace('ctx.runMutation(terminalReferences.captureTerminalEvidence, evidence)','ctx.runMutation(references.captureTerminalEvidence, evidence)');mask='two compiled terminal references only';
  }
  if(name==='executePreparedModelStep'){actual=actual?.replace('createBackendGatewayComposition(current.snapshot.version === 8 ? withV8GatewayTerminalPorts(ctx) : ctx, async request => {','createBackendGatewayComposition(ctx, async request => {');mask='server-derived snapshot.version===8 context selection only';}
  if(name==='recallAgentMemoryV8'){actual=actual?.replace('createGatewayMemoryModel(withV8GatewayTerminalPorts(ctx), repository,','createGatewayMemoryModel(ctx, repository,');mask='private V8 terminal context selection after native V8 preflight only';}
  const equal=body===actual;checks.push({file,name,target,mask,equal,oldBodySha256:hash(body),newComparisonBodySha256:actual===undefined?null:hash(actual)});if(!equal)throw Error(`Changed original body ${file}:${name}`);
 }
}
const output={baselineCommit:commit,baselineOrigin:'Four narrowly read immutable K23 staging sources matched to their committed-input hashes; no Git operation or archive copy',baselines,checks,total:checks.length,failed:checks.filter(x=>!x.equal).length,qualification:'Source equivalence only; independent review and live qualification remain separate'};
fs.writeFileSync(path.join(Q,'v8-terminal-scope-equivalence.json'),JSON.stringify(output,null,2)+'\n');
console.log(JSON.stringify({checks:checks.length,failed:output.failed}));
