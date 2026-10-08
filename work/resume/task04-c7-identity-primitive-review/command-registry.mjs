import identity from './fs-identity.cjs';
import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';import {snapshotBuild} from './route-policy.mjs';
const R='/workspace/Project-Cortex',M='/dev/shm/cortex-native-c7-exact-identity-repair/mirror',W=path.dirname(new URL(import.meta.url).pathname),H=b=>crypto.createHash('sha256').update(b).digest('hex');
const compilerIds=new Set(['inventory-extension','inventory-regression','inventory-extra','offline-extension-extension','offline-actual-core-regression','offline-extension-extra','runner-closure','dependency-tiers']);
const mutableMetadata=new Set(['runner-dependency-inventory.json','dependency-tiers.json','runtime-freeze.json','qa-manifest.json','c4-journal-semantic-domain-proof.json']);
const families=Object.freeze(['extension','regression','extra']);
const forbidden=new Set(['initialize.py','prepare.py','compile.mjs','qualify-owned.mjs','driver.mjs','fault.mjs','cleanup.mjs','reconcile.mjs','parent.mjs','current.mjs','publication.mjs','provision.mjs','retire.mjs','deploy.mjs']);
/** Closed prepared source descriptors. Launch authority remains external and absent here. */
export function prepareRegistry(){
 const sourceRefs=identity.parse(fs.readFileSync(path.join(W,'prepared-source-inputs.json')));for(const r of sourceRefs.files){const b=fs.readFileSync(r.path);if(b.length!==r.bytes||H(b)!==r.sha256)throw Error('QA_BRIDGE_PREPARED_INPUT_DRIFT');}
 const auditPath=path.join(R,'work/resume/task04-model-drift-native-preparation-c5/output-route-audit/proposed-closed-command-contract.json'),audit=identity.parse(fs.readFileSync(auditPath)),lineage=identity.parse(fs.readFileSync(path.join(W,'mirror-source-transform-map.json'))),inputs=new Map(lineage.inputs.map(r=>[r.source,r]));
 if(audit.commands.length!==122||new Set(audit.commands.map(c=>c.id)).size!==122)throw Error('QA_BRIDGE_REGISTRY_SIZE');
 const roots=families.map(k=>path.join(R,'_goals/convex-backend-runtime-2026-10-02/qa/task04-model-drift-native-'+k+'-preparation-c5'));
 function mapped(value){if(inputs.has(value))return inputs.get(value).destination;for(const root of roots)if(value===root||value.startsWith(root+'/'))return M+value.slice(R.length);return value;}
 const descriptors=audit.commands.map(command=>{
  const originalEntry=command.proposedArgv.find(v=>inputs.has(v)),entry=inputs.get(originalEntry);
  if(!entry||entry.sha256!==command.entrySha256||forbidden.has(path.basename(originalEntry)))throw Error('QA_BRIDGE_REGISTRY_ENTRY');
  const original=fs.readFileSync(originalEntry),mirror=fs.readFileSync(entry.destination);
  if(H(original)!==entry.sha256||H(mirror)!==entry.destinationSHA256)throw Error('QA_BRIDGE_REGISTRY_PREIMAGE');
  const argv=[process.execPath,...command.proposedArgv.slice(1).map(mapped)];
  const qa=roots.map(r=>M+r.slice(R.length)),work=path.join(M,'work/resume/task04-model-drift-native-preparation-c5'),scratch=path.join(M,'work/backend-runtime'),dummy='/dev/shm/cortex-native-c7-exact-identity-repair/mirror-tmp';
  return snapshotBuild({id:command.id,originalArgv:command.proposedArgv,originalEntry,originalEntrySHA256:entry.sha256,entry:entry.destination,entrySHA256:entry.destinationSHA256,argv,cwd:R,env:{PATH:path.dirname(process.execPath)+':/usr/bin:/bin',TMPDIR:'/dev/shm/cortex-native-c7-exact-identity-repair/child-tmp'},profile:command.profile??'all3',writeFamily:command.writeFamily,writeRoots:[...qa,work,scratch,dummy],compilerRoutes:compilerIds.has(command.id)?['RECORDED_ESBUILD_SERVICE']:[],processRoutes:[],mutableMetadata:qa.flatMap(root=>[...mutableMetadata].map(name=>path.join(root,name))),generatedMetadata:qa.map(root=>path.join(root,'evidence/final-freeze-verification.json')),sourceMap:lineage.inputs.map(r=>({path:r.destination,bytes:r.destinationBytes,sha256:r.destinationSHA256,identity:r.destinationIdentity,original:r.source,originalSHA256:r.sha256,originalIdentity:r.sourceIdentity})),routes:{B01:'FIXED_COMMAND_ID_AND_EXACT_ARGV',B02:'bridge-preload.cjs SYNC_CJS_CALLBACK_NAMED',B03:'bridge-preload.cjs PROMISES_FILEHANDLE_INODE',B04:'module-boundary.cjs PINNED_IMPORTS_AND_PATCHED_VM_PORTS',B05:'generated-parent-port.mjs EXACT_TWO_FIELD_SOURCE_RECIPE',B06:'compiler-session.mjs FINITE_OUTPUT_SERVICE_CAPTURE',B07:'EXACT_ARGUMENT_MAP_ONLY',B08:'ROOT_ONLY_REAL_EFFECTS_DENIED',B09:'HISTORICAL_MUTATORS_DENIED',B10:'capture-originals.py FULL8_PROSPECTIVE'},status:'PREPARED_NOT_REVIEWED_NOT_RELEASED',launchAuthority:'NONE',rootOnlyPrerequisites:'SOURCE_PARENT_ROOT_NATIVE_TIMING_REMAIN_HELD'});
 });
 const byId=new Map(descriptors.map(d=>[d.id,d]));
 return Object.freeze({descriptors:Object.freeze(descriptors),get(id,...extra){if(extra.length||typeof id!=='string'||!byId.has(id))throw Error('QA_BRIDGE_COMMAND_ID');return byId.get(id);},launch(){throw Error('QA_BRIDGE_ORIGINAL122_HELD');},forbidden:Object.freeze([...forbidden])});
}
