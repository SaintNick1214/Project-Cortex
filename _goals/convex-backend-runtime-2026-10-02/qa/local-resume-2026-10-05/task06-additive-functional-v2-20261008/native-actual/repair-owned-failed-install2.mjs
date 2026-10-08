/** Explicit disposable fixture repair after failed native registration; not an installer override. */
import assert from 'node:assert/strict';
import {readFile,writeFile,unlink,stat} from 'node:fs/promises';
import {dirname,join,resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
const q=dirname(new URL(import.meta.url).pathname),out=join(q,'custom');
const pointer=JSON.parse(await readFile(join(out,'fixture-pointer.json'))),state=JSON.parse(await readFile(join(pointer.privateDirectory,'state.json')));assert.equal(state.operation,pointer.operation);assert.equal(state.retired,undefined);assert.equal(state.projectId,3172114);
const host=join(pointer.privateDirectory,'project'),sdk=join(host,'node_modules/@cortexmemory/sdk');const api=await import(pathToFileURL(join(host,'node_modules/@cortexmemory/cli/dist/utils/init/additive-backend.js')));const auth=JSON.parse(await readFile(join(pointer.privateDirectory,'auth.json')));const opts={trustedJwtProvider:{type:'customJwt',issuer:auth.issuer,jwks:auth.jwks,algorithm:'RS256',applicationID:auth.applicationID}};
const hash=b=>createHash('sha256').update(b).digest('hex');
const original=JSON.parse(await readFile(join(out,'installation-plan2.json')));const owned=original.changes.filter(row=>row.reason==='versioned Cortex backend source');assert.equal(owned.length,61);assert.ok(owned.every(row=>row.beforeSha256===null));
const preserved=['convex.json','custom/backend/schema.ts','custom/backend/convex.config.ts','custom/backend/auth.config.ts','custom/backend/host.ts','custom/backend/http.ts'];const before={};for(const file of preserved)before[file]=hash(await readFile(join(host,file)));
const plan=await api.planAdditiveBackendInstallation(host,sdk,opts);assert.ok(plan.conflicts.length>0,'Repaired bundle must encounter existing changed source and refuse implicit override');let error=null;try{await api.applyAdditiveBackendInstallation(plan);}catch(e){error=e;}assert.ok(error instanceof api.BackendMergeRequiredError);const proposal=await readFile(error.proposalPath);await writeFile(join(out,'repair-merge-proposal2.json'),proposal);
for(const [file,pin]of Object.entries(before))assert.equal(hash(await readFile(join(host,file))),pin);
const rows=[];for(const row of owned){const file=resolve(host,row.path);assert.ok(file.startsWith(host+'/'));const actual=await readFile(file);assert.equal(hash(actual),hash(row.content),'Owned file was changed: '+row.path);assert.equal(actual.toString(),row.content);rows.push({path:row.path,sha256:hash(actual),bytes:actual.length});}
// All old files were checked before the first removal; exact original bodies remain in the old plan/tgz.
for(const row of owned)await unlink(join(host,row.path));
for(const [file,pin]of Object.entries(before))assert.equal(hash(await readFile(join(host,file))),pin);
await writeFile(join(out,'repair-owned-removals2.json'),JSON.stringify({scope:'EXPLICIT_OWN_FAILED_UNREGISTERED_FIXTURE_REPAIR',projectId:state.projectId,operation:state.operation,changedFileConflictRefused:true,conflicts:plan.conflicts.map(r=>({path:r.path,reason:r.reason})),proposalSha256:hash(proposal),verifiedOwnedNewFiles:rows,removed:rows.length,preserved,hostSourceUnchanged:true,sourcePreimages:'installation-plan2.json + packed-sdk-repair1.json original tgz',productionEffects:0},null,2));console.log(JSON.stringify({status:'EXACT_61_OWNED_PREIMAGES_VERIFIED_AND_REMOVED',conflicts:plan.conflicts.length,projectId:state.projectId}));
