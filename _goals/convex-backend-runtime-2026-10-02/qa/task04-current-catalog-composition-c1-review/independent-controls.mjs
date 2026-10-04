import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import {fileURLToPath,pathToFileURL} from 'node:url';
const base=path.dirname(fileURLToPath(import.meta.url));
const copy=path.join(base,'subject-copy');
const {compose,verifySources,verifyNative,policyAst}=await import(pathToFileURL(path.join(copy,'current-compose.mjs')));
const read=n=>fs.readFileSync(path.join(copy,'preimages',n),'utf8');
const source=Object.fromEntries(['convex-dev/schema.ts','convex-dev/runtimePolicySchema.ts','convex-dev/runtimeModelPolicy.ts','convex-dev/runtimeGateway.ts'].map(n=>[n,read(n)]));
const native=JSON.parse(fs.readFileSync(path.join(copy,'review-witness/current-native.json')));
const baseline=JSON.parse(fs.readFileSync(path.join(copy,'review-witness/exact-current-repair-native.json')));
const outcomes=[];
const check=(name,fn)=>{fn();outcomes.push({name,status:'PASS'})};
for(const [name,file,a,b] of [
 ['old table','convex-dev/schema.ts','  artifacts:','  altered:'],
 ['old index','convex-dev/schema.ts','by_tenant','bad_index'],
 ['policy validator','convex-dev/runtimeModelPolicy.ts','manifestId: v.string()','manifestId: v.number()'],
 ['module injection','convex-dev/runtimeModelPolicy.ts','import { ConvexError','import "./unapproved";\nimport { ConvexError'],
 ['public visibility','convex-dev/runtimeModelPolicy.ts','ensureBudget = internalMutation','ensureBudget = mutation'],
 ['handler source','convex-dev/runtimeModelPolicy.ts','handler:','handler: /*changed*/'],
 ['source drift','convex-dev/runtimeGateway.ts','/**','/*drift*/\n/**'],
 ['extra table','convex-dev/schema.ts','  ...runtimePolicyTables,','  ...runtimePolicyTables,\n  extra: defineTable({}),']])check('independent exact-source denial '+name,()=>{assert.ok(source[file].includes(a));assert.throws(()=>verifySources({...source,[file]:source[file].replace(a,b)}))});
for(const [name,change] of [
 ['old validator',n=>n.definitions.find(r=>r.table==='artifacts').exported.documentType+=' '],
 ['old index',n=>n.definitions.find(r=>r.table==='artifacts').indexes[0].fields=['invalid']],
 ['extra policy',n=>n.policyRegistrations.unknown=n.policyRegistrations.ensureBudget],
 ['return contract',n=>n.artifactRegistrations.count.returns='{"type":"any"}'],
 ['artifact visibility',n=>n.artifactRegistrations.count.isPublic=!n.artifactRegistrations.count.isPublic],
 ['fake reviewed actual root',n=>n.rootLookup={classification:'reviewed-actual'}]])check('independent native denial '+name,()=>{const n=structuredClone(native);change(n);assert.throws(()=>verifyNative(n,baseline))});
check('AST unresolved re-export denied',()=>assert.throws(()=>policyAst(source['convex-dev/runtimeModelPolicy.ts']+'\nexport {query} from "./other";')));
// Safety probes affect only owned review directories.
const escaped=path.join(base,'escaped-destination');fs.mkdirSync(escaped);
const link=path.join(copy,'scratch-link');fs.symlinkSync(escaped,link,'dir');
const escapedResult=compose(path.join(link,'probe'));
assert.ok(fs.existsSync(path.join(escaped,'probe/composition.json')));
outcomes.push({name:'destination symlink ancestor escape',status:'DEFECT_REPRODUCED',compositionAccepted:escapedResult.currentComposition.currentEndpoints,escapedDirectory:escaped});
const polluted=path.join(copy,'polluted-destination');fs.mkdirSync(path.join(polluted,'replica/convex-dev'),{recursive:true});
const marker=path.join(base,'unapproved-module-executed.txt');
fs.writeFileSync(path.join(polluted,'replica/convex-dev/runtimeModelPolicyBootstrap.js'),`import fs from 'node:fs'; fs.writeFileSync(${JSON.stringify(marker)},'unapproved import graph module executed'); export * from './runtimeModelPolicyBootstrap.ts';\n`);
let pollutedError;try{compose(polluted)}catch(error){pollutedError=String(error)}
outcomes.push({name:'existing unpinned JS import sibling executed',status:fs.existsSync(marker)?'DEFECT_REPRODUCED':'NOT_REPRODUCED',markerExists:fs.existsSync(marker),compositionError:pollutedError??null,scratchRetained:fs.existsSync(path.join(polluted,'replica'))});
const fence=path.join(base,'drift-fence-subject');fs.mkdirSync(fence);
for(const n of ['current-compose.mjs','approved-additions.json'])fs.copyFileSync(path.join(copy,n),path.join(fence,n));
const pins=JSON.parse(fs.readFileSync(path.join(copy,'source-pre.json')));pins.sources.find(r=>r.path==='AGENTS.md').sha256='0'.repeat(64);fs.writeFileSync(path.join(fence,'source-pre.json'),JSON.stringify(pins));
const driftCompose=(await import(pathToFileURL(path.join(fence,'current-compose.mjs')))).compose;
const beforeFence=path.join(fence,'created-before-source-fence');assert.throws(()=>driftCompose(beforeFence));assert.ok(fs.existsSync(beforeFence));
outcomes.push({name:'mkdir effect precedes protected source fence',status:'DEFECT_REPRODUCED',directoryRetained:beforeFence});
// Replace transport first with a stub: this detects missing interception without a socket/network operation.
let calls=0;const original=net.Socket.prototype.connect;
net.Socket.prototype.connect=function(){calls++;return this};
try{await import(pathToFileURL(path.join(copy,'offline-guard.mjs')).href+'?fresh-prototype-probe');new net.Socket().connect({host:'qualification.invalid',port:443});assert.equal(calls,1)}finally{net.Socket.prototype.connect=original}
outcomes.push({name:'Socket.prototype.connect bypasses preloaded guard (stubbed no network)',status:'DEFECT_REPRODUCED',underlyingConnectCalls:calls});
console.log(JSON.stringify({scope:'INDEPENDENT_OFFLINE_CONTROLS_OWNED_REVIEW_ONLY',outcomes},null,2));
