import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import ts from 'typescript';
const Q='_goals/convex-backend-runtime-2026-10-02/qa/task05-current-seam-refresh-c1-fresh-review/';
const P='_goals/convex-backend-runtime-2026-10-02/qa/task05-runtime-contract-lock-preparation-c3/preimages/';
const read=(dir,path)=>fs.readFileSync(dir+path.replaceAll('/','--'),'utf8');
const current=read(Q+'preimages/','convex-dev/runtimeModelPolicy.ts');
const old=read(P,'convex-dev/runtimeModelPolicy.ts');
let groups=0;const pass=x=>console.log(`PASS ${++groups}: ${x}`);
const ast=s=>ts.createSourceFile('pin.ts',s,ts.ScriptTarget.Latest,true);
const declaration=(s,name)=>{const nodes=ast(s).statements;const n=nodes.find(n=>n.name?.text===name);assert(n,`missing ${name}`);return n.getText();};
for(const name of ['bindTrustedBudget','readTrustedAgentPolicyVersion','policies','resolutionContext','resolveCurrent','currentOperation']){
 assert.equal(declaration(current,name),declaration(old,name));pass(`${name} exact current declaration equals C3, independent of line shifts`);
}
assert.equal(crypto.createHash('sha256').update(current).digest('hex'),'c8279d4496eb9b6eb5763732dbb7e54cefe27e028f285fe3e31a639af1535710');
const gateway=read(Q+'preimages/','convex-dev/runtimeGateway.ts');
assert.equal(crypto.createHash('sha256').update(gateway).digest('hex'),'e796e43aafe70c37d8af7330a969e5b643eb58e86be7621cc7c08991ff1224be');pass('recomputed current ledger and Gateway hashes match assigned frozen current sources');
for(const name of ['captureTerminalEvidence','attachTerminalResult']){const n=ast(current).statements.find(n=>ts.isVariableStatement(n)&&n.declarationList.declarations.some(d=>d.name.getText()===name));assert(n);assert.match(n.getText(),/= internalMutation\(/);}pass('new terminal capture and private attachment registered internal, no public proxy assertion');
assert.match(declaration(gateway,'GatewayLedgerPort'),/attachTerminalResult/);assert.doesNotMatch(declaration(gateway,'GatewayLedgerPort'),/\bsettle\s*\(/);
assert.match(declaration(gateway,'GatewayComposition'),/terminalSink: DurableTerminalEvidenceSink/);pass('current Gateway port requires exact attachment and durable sink; no old settle-only composition');
const bootstrap=read(Q+'preimages/','convex-dev/runtimeModelPolicyBootstrap.ts');assert.match(bootstrap,/const manifests: readonly DeploymentPolicyManifest\[\] = Object.freeze\(\[\]\)/);pass('actual root remains empty; no source-only qualification enabled');
const registry=read(Q+'preimages/','convex-dev/runtimeRegistryAuth.ts');assert.match(registry,/JSON.stringify\(\["agents", row.agentId\]\)/);
assert(!current.includes('runtimeAgentDefinitions'));pass('metadata agents source namespace remains distinct; executable definition table still prospective');
const schema=read(Q+'preimages/','convex-dev/runtimePolicySchema.ts');assert.match(schema,/terminalEvidenceHash: v.optional\(v.string\(\)\)/);assert.match(schema,/resultAttachmentState/);pass('current policy schema carries capture hash plus attachment state; no new Task05 ledger');
assert.equal(read(Q+'preimages/','node_modules/@convex-dev/agent/src/component/messages.ts'),read(P,'node_modules/@convex-dev/agent/src/component/messages.ts'));pass('Agent list/anchor component byte-identical to frozen C3 adverse ordering evidence');
assert.equal(read(Q+'preimages/','src/domain/model-policy.ts'),read(P,'src/domain/model-policy.ts'));pass('strict actual canonical serializer byte-identical; no permissive replacement');
console.log(JSON.stringify({assertedSourceGroups:groups,classification:'SOURCE_STATIC_CONTROLS_ONLY_NOT_NATIVE',skips:[]}));
