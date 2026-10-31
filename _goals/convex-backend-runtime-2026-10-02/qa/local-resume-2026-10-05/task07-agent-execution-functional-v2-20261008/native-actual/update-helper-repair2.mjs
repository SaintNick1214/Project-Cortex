/** Controlled fix of the proven owned generated helper; not a product override. */
import assert from 'node:assert/strict';
import {readFile,writeFile,unlink} from 'node:fs/promises';
import {join,isAbsolute} from 'node:path';
import {openOwnedContext,q,sha} from './common.mjs';
const incoming=process.argv[2];assert.ok(incoming&&isAbsolute(incoming));const c=await openOwnedContext();
try {
 await c.verifyTarget('helper-repair2-target-verified');
 const expected=JSON.parse(await readFile(join(q,'deployment-source-manifest.json'),'utf8'));
 const old=JSON.parse(await readFile(join(c.host,'node_modules/@cortexmemory/sdk/dist/backend/v1/manifest.json'),'utf8'));
 const nextRaw=await readFile(join(incoming,'manifest.json')),next=JSON.parse(nextRaw),functions=join(c.host,c.functionsDirectory);
 assert.equal(old.files.length,69);assert.equal(next.files.length,69);assert.equal(next.tables.length,44);
 const before=old.files.find(row=>row.path==='_cortex/components.ts'),after=next.files.find(row=>row.path==='_cortex/components.config.ts');assert.ok(before&&after);
 assert.equal(next.files.some(row=>row.path===before.path),false);
 for(const file of old.files){const pin=expected.files.find(row=>row.path===file.path);assert.ok(pin);assert.equal(sha(await readFile(join(functions,file.path))),pin.sha256);}
 for(const file of next.files){const bytes=await readFile(join(incoming,file.path));assert.equal(sha(bytes),file.sha256);
  if(file.path!==after.path)assert.equal(file.sha256,old.files.find(row=>row.path===file.path)?.sha256,'Unexpected non-helper product change '+file.path);}
 try{await readFile(join(functions,after.path));throw new Error('NEW_HELPER_COLLISION');}catch(e){if(e.code!=='ENOENT')throw e;}
 for(const pin of expected.preserved)assert.equal(sha(await readFile(join(c.host,pin.path))),pin.sha256);
 const config=await readFile(join(functions,'convex.config.ts'));
 await c.publish('helper-repair2-owned-preimage',{target:c.state.projectId,oldHelper:before,newHelper:after,oldBytes:await readFile(join(functions,before.path),'utf8'),
  configSha256:sha(config),protectedFiles:expected.preserved,all69OwnedHashesMatched:true,changedProductPaths:[before.path,after.path]});
 await writeFile(join(functions,after.path),await readFile(join(incoming,after.path)));
 await unlink(join(functions,before.path));
 assert.equal(sha(await readFile(join(functions,'convex.config.ts'))),sha(config));
 await c.publish('helper-repair2-applied',{target:c.state.projectId,newManifestSha256:sha(nextRaw),removedOnlyExactOwnedPath:before.path,newHelper:after,
  oldDeploy400:'deploy-qualification1.json',hostAndDirectConfigUnchanged:true,fixtureOnlyExplicitRepair:true});
} finally {await c.close();}
