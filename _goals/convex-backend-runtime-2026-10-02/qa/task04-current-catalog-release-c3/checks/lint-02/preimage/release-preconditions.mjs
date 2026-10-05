import assert from 'node:assert/strict';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {readExact} from './containment.mjs';
const base=path.dirname(fileURLToPath(import.meta.url));
const root='/workspace/Project-Cortex';
const transition=JSON.parse(readExact(path.join(base,'source-transition.json'),'9b3e09f74a4ba500f2c61cf5e471929dec978faacfe6327cd17f939685dfae88').toString());
export function verifyReleaseState(phase){
 assert.ok(phase==='PRE'||phase==='POST','EXACT_PHASE_REQUIRED');
 const file=phase==='PRE'?'source-before.json':'source-runtime.json';
 const digest=phase==='PRE'?transition.sourceBeforeSHA256:transition.runtimeManifestSHA256;
 const rows=JSON.parse(readExact(path.join(base,file),digest).toString()).sources;
 assert.equal(rows.length,136);for(const row of rows)readExact(path.join(root,row.path),row.sha256);
 readExact(path.join(base,'proposed-four-file-exact.patch'),transition.exactPatchSHA256);
 for(const row of transition.changedOnly)readExact(path.join(base,'postimages',row.path),row.afterSHA256);
 return {phase,exactRootRows:136,changedOnly:transition.changedOnly.map(r=>r.path),patchSHA256:transition.exactPatchSHA256,writes:0,sourceRelease:'ROOT_ONLY_FRESH_REVIEW_REQUIRED'};
}
if(process.argv[1]===fileURLToPath(import.meta.url)){assert.equal(process.argv.length,3);console.log(JSON.stringify(verifyReleaseState(process.argv[2])))}
