import ts from 'typescript';
import fs from 'node:fs/promises';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const R=process.cwd(),Q=path.dirname(new URL(import.meta.url).pathname),baseline='2dd1c8474392322b71606a8dd8ee2df64b9fe0c5';
const before=execFileSync('git',['show',baseline+':convex-dev/runtimeIngestion.ts'],{cwd:R,encoding:'utf8'}),after=await fs.readFile(path.join(R,'convex-dev/runtimeIngestion.ts'),'utf8');
const hash=s=>createHash('sha256').update(s).digest('hex');
function declarations(text){const source=ts.createSourceFile('runtimeIngestion.ts',text,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS),out=new Map();
 for(const statement of source.statements){
  if(ts.isVariableStatement(statement)){for(const item of statement.declarationList.declarations)if(ts.isIdentifier(item.name))out.set(item.name.text,item.getText(source));}
  else if('name'in statement&&statement.name&&ts.isIdentifier(statement.name))out.set(statement.name.text,statement.getText(source));
 }
 return out;}
const old=declarations(before),current=declarations(after),changed=[...old].filter(([name,text])=>current.get(name)!==text).map(([name])=>name);
assert.deepEqual(changed,['readiness','writeStage','claim','registerCompletedDerivedSource']);
assert.deepEqual([...old.keys()],[...current.keys()]);
const guards=['readEventCurrent','requireStageLease','requireStageCommit','guardIngestionRunBudget','assertIngestionPolicyPin','extractionParent','persistStage','failStage','expireStage','failUnclaimed','retry','reconcile','status','stageInput','persistDraft','commitVectors','processStageHandler','finishBeliefStage','retireScopedSourceEvents','enqueueSourceEvent','registerCompletedToolSource'];
for(const name of guards)assert.equal(old.get(name),current.get(name),name);
const related={};for(const file of ['convex-dev/runtimeAgent.ts','convex-dev/runtimeTranscript.ts','convex-dev/runtimeAuth.ts','convex-dev/runtimeMemoryContext.ts','convex-dev/runtimeIngestionSchema.ts']){
 const original=execFileSync('git',['show',baseline+':'+file],{cwd:R}),actual=await fs.readFile(path.join(R,file));assert.deepEqual(actual,original,file);related[file]=hash(actual);}
const output={baselineProductCommit:baseline,qaOnlyHead:execFileSync('git',['rev-parse','HEAD'],{cwd:R,encoding:'utf8'}).trim(),beforeSha256:hash(before),afterSha256:hash(after),changedOriginalDeclarations:changed,unchangedOriginalDeclarations:old.size-changed.length,noNewRegistrationOrDeclaration:true,byteExactOriginalGuardsAndRegistrations:guards,relatedByteExact:related,publicProjection:'ingestion.status still reads stages with original exact running/attempt/failure/receipt fields; event running readiness is normalized pending only internally.',semanticNormalization:'Event summary no longer mirrors running lease activity; supported historical running summary remains incomplete. Only real summary changes publish updatedAt.',newFence:'Foreground profile assignment also requires actual vectors stage pending; running-stage repinning cannot follow normalized event pending.',freshSummaryRead:'Original same event argument can be stale after earlier stage writes; compare freshly read transaction event with same id.',pass:true};
await fs.writeFile(path.join(Q,'ingestion-progress-publication-equivalence.json'),JSON.stringify(output,null,2)+'\n');console.log(JSON.stringify({pass:true,changed,unchanged:output.unchangedOriginalDeclarations,relatedByteExact:Object.keys(related).length}));
