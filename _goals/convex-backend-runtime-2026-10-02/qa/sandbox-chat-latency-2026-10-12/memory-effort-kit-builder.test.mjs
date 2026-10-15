import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {buildPlan,runtimeCandidate,fixtureCandidate,validateSyntax,Q,R,KIT,REGISTRY_HASH} from './memory-effort-kit-builder.mjs';
const P='/Users/SaintNick/Documents/Cortex/Project-Cortex-Proofs';
const preimage=path.join(Q,'memory-effort-kit-runtime.mjs-before-pin');
const old=fs.readFileSync(fs.existsSync(preimage)?preimage:path.join(P,'sandbox-env/runtime.mjs'),'utf8');
const existed=fs.existsSync(KIT),plan=()=>buildPlan(undefined,old);
const ts=createRequire(path.join(R,'package.json'))('typescript');
function functions(text){const ast=ts.createSourceFile('runtime.mjs',text,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);return Object.fromEntries(ast.statements.filter(ts.isFunctionDeclaration).map(row=>[row.name.text,row.getText(ast)]));}
test('runtime bootstrap changes only effort definition/host fixture seams; qualification and effects remain unchanged',()=>{
 const adapted=runtimeCandidate(old),before=functions(old),after=functions(adapted);
 for(const name of ['deploy','serviceClient','admin','publicClient','jwt','nativePins','prepare','observeImage','paidBatch','promote'])assert.equal(after[name],before[name],name);
 assert.match(adapted,/handlerId: 'cortex.transcript.relevant', handlerVersion: 2/);assert.match(adapted,/inputSelection: \{ version: 2 \}/);
 assert.match(adapted,/assert.equal\(current.inputSelectionVersion, 2\)/);assert.match(adapted,/assert.equal\(current.memoryEffortPolicyVersion, 1\)/);
 assert.match(adapted,/fixtures\/memoryEffortQualification.ts/);
 const canonical=value=>value!==null&&typeof value==='object'?Array.isArray(value)?'['+value.map(canonical).join(',')+']':'{'+Object.keys(value).sort().map(key=>JSON.stringify(key)+':'+canonical(value[key])).join(',')+'}':JSON.stringify(value);
 const registry={version:4,tools:{'memory.remember':1,'memory.recall':1,'media.image.generate':1,'media.video.generate':1,'artifact.read':1},contexts:{'cortex.transcript':1,'cortex.transcript.relevant':2}};
 assert.equal(createHash('sha256').update(canonical(registry)).digest('hex'),REGISTRY_HASH);
});
test('eight fixed startup calls, prices/models/limits and approval settings are inherited unchanged',()=>{
 const qualification=fs.readFileSync(path.join(P,'sandbox-env/qualification.mjs'),'utf8');
 assert.match(qualification,/\['jsonExtract', 'plain', 'title', 'small', 'large', 'toolsGenerate', 'toolsStream', 'image'\]/);
 const approval=JSON.parse(fs.readFileSync(path.join(P,'sandbox-env/procedure-approval.json')));
 assert.equal(approval.maximumPaidRequests,8);assert.equal(approval.maximumUnknownLiabilityUnits,2700000);assert.equal(approval.perRunHumanReview,false);
 const planned=plan();assert(!planned.planned.some(row=>row.name.includes('qualification-envelopes')||row.name.includes('native-package-lock')||row.name.includes('cloud-config')));
});
test('temporary fixture keeps four internal registrations and actual installed shared import paths',()=>{
 const text=fixtureCandidate(fs.readFileSync(path.join(Q,'memory-effort-hosted-fixture.ts'),'utf8'));
 assert.match(text,/\.\/_cortex\/shared\/domain\/memory_effort/);assert(!text.includes('../src/'));
 const ast=ts.createSourceFile('fixture.ts',text,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS);
 const registrations=ast.statements.filter(ts.isVariableStatement).flatMap(row=>[...row.declarationList.declarations]).filter(row=>row.initializer&&ts.isCallExpression(row.initializer)&&ts.isIdentifier(row.initializer.expression)&&['seed','traverse','changeBridge','delivery'].includes(row.name.getText(ast)));
 assert.equal(registrations.length,4);assert(registrations.every(row=>['internalMutation','internalQuery'].includes(row.initializer.expression.text)));
 const manifest=JSON.parse(fs.readFileSync(path.join(R,'dist/backend/v1/manifest.json')));for(const target of ['_cortex/shared/domain/memory_effort.ts','_cortex/shared/domain/sources.ts','runtimeMemoryTraversal.ts'])assert(manifest.files.some(row=>row.path===target));
});
test('selective preparation has no old archives, evidence, cache or dependency bytes and validates generated control syntax',()=>{
 assert.equal(fs.existsSync(KIT),existed);const planned=plan();assert.equal(planned.planned.length,12);validateSyntax(planned);
 assert.equal(planned.acceptedSourceCommit,'SOURCE_COMMIT_PENDING');assert.deepEqual(planned.backend,{files:173,tables:79});
 assert(planned.planned.every(row=>!row.name.endsWith('.tgz')&&!row.name.includes('node_modules')&&!row.name.startsWith('artifacts/')&&!row.name.startsWith('cache/')));
 assert.equal(fs.existsSync(KIT),existed);
});
test('new catalog verifier retains historical descriptors and checks all three current payloads',()=>{
 const text=plan().planned.find(row=>row.name==='verify-packed-template-catalog.mjs').text;
 assert.match(text,/catalog.templates.length,18/);assert(text.includes('f87695783e8b21ffecf6298057a87cd8e69a3016:packages/cortex-templates/catalog.json'));
 for(const id of ['payloads/basic/1.5.0','payloads/chat-sdk/1.5.0','payloads/vercel-ai-quickstart/1.5.0'])assert(text.includes(id));
 assert(text.includes('retainedUiFinalObserverCalls'));assert(text.includes('removedUiWatchRunCalls'));
});
test('changed anchors, public fixture registration and noncanonical accepted commits refuse before writes',()=>{
 assert.throws(()=>runtimeCandidate(old.replace('handlerVersion: 1','handlerVersion: 99')),/Changed adaptation anchor/);
 const fixture=fs.readFileSync(path.join(Q,'memory-effort-hosted-fixture.ts'),'utf8');assert.throws(()=>fixtureCandidate(fixture.replace('export const seed = internalMutation','export const seed = mutation')),/Fixture must remain internal/);
 assert.throws(()=>buildPlan('latest'));assert.equal(fs.existsSync(KIT),existed);
});
