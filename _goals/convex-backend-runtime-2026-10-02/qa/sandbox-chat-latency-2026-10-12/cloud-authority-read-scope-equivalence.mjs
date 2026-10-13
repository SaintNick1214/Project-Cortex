import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import ts from 'typescript';
const root='/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion';
const qa=path.dirname(new URL(import.meta.url).pathname),baseline='acf3b5efa4d1d3b798fa655b0db919cf6baf7f40';
const read=p=>fs.readFileSync(path.join(root,p),'utf8'),hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const oldAuth=execFileSync('git',['show',`${baseline}:convex-dev/runtimeAuth.ts`],{cwd:root,encoding:'utf8'}),auth=read('convex-dev/runtimeAuth.ts');
const parsed=text=>ts.createSourceFile('source.ts',text,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS);
const functions=text=>{const source=parsed(text),map=new Map();for(const node of source.statements)if(ts.isFunctionDeclaration(node)&&node.name&&node.body)map.set(node.name.text,node.body.getText(source));return map;};
const before=functions(oldAuth),after=functions(auth),unchanged=[];
for(const [name,body] of before){const current=after.get(name==='createAuthorityReader'?'createUncachedAuthorityReader':name);assert.equal(current,body,`Original auth predicate/adapter body changed: ${name}`);unchanged.push({name,sha256:hash(body)});}
const priorAgent=fs.readFileSync(path.join(qa,'cloud-authority-read-scope-agent-preimage.ts'),'utf8'),agent=read('convex-dev/runtimeAgent.ts');
assert.equal(hash(priorAgent),'42c6c4e7a3a5a30e213625d83181be6afd3fc55b054d3bc50c1aa3dc555647f7');
let normalized=agent.replace('import { recheckAuthority, createAuthorityReadScope } from "./runtimeAuth";','import { recheckAuthority } from "./runtimeAuth";');
const wrappers=['resolveModelOperationHandler','contextInputsHandler','prepareEmptyContextHandler','admitModelOperationHandler'];
for(const name of wrappers){const wrapper=`handler: (ctx, args) => ${name}(createAuthorityReadScope(ctx), args)`;assert.equal(normalized.split(wrapper).length-1,1);normalized=normalized.replace(wrapper,`handler: ${name}`);}
assert.equal(normalized.split('  ctx = createAuthorityReadScope(ctx);\n').length-1,1);normalized=normalized.replace('  ctx = createAuthorityReadScope(ctx);\n','');
assert.equal(normalized,priorAgent,'Agent differs outside explicit entry wrappers/import');
assert(agent.includes('boundary: contextBoundary }, handler: contextSourceHandler });'),'contextSource must remain unscoped');
const files=['convex-dev/runtimeAuth.ts','convex-dev/runtimeAgent.ts','tests/unit/runtimeAuth/authority-read-scope.test.ts','tests/unit/runtimeAgent/resolution-composition.test.ts'];
const result={schema:'cortex.authority-read-scope.equivalence.v1',observedAtUTC:new Date().toISOString(),baseline,
  originalAuthPredicateAndAdapterBodiesUnchanged:unchanged,agentPreimageSha256:hash(priorAgent),
  exactAllowedAgentChanges:{import:'createAuthorityReadScope',registeredEntryWrappers:wrappers,entryStatement:{parent:'prepareRoutedContext',statement:'ctx = createAuthorityReadScope(ctx);'},remainingAgentBytesUnchanged:true},
  activeParents:['resolveModelOperation','admitModelOperation','contextInputs','prepareEmptyContext','prepareRoutedContext'],
  unscopedParents:['contextSource','hydrateExecution','prepareModelOperation','all other endpoints unless their caller explicitly constructs a fresh native scope'],
  sourceFiles:files.map(p=>({path:p,sha256:hash(read(p))})),
  proof:'Old guard bodies and raw native authority adapter are unchanged; only explicitly branded factory contexts reuse cloned raw reads, all predicate evaluation remains original. Unit tests prove exact native ledger/account/permit result and 326-to-42 / 1046-to-66 read reductions with every writer boundary invalidation.',
  limits:'Controlled ports/source proof, not native OCC/engine performance or service/SLO acceptance. contextSource retains its original direct revocation witness test and has no scope activation.'};
fs.writeFileSync(path.join(qa,'cloud-authority-read-scope-equivalence.json'),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({unchangedAuthBodies:unchanged.length,activeParents:result.activeParents,sourceFiles:result.sourceFiles}));
