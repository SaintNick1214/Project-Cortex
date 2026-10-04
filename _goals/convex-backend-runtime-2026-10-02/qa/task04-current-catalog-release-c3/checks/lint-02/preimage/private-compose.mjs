import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {inspectAncestors,recheckAncestors,readExact,verifyOutput,exclusiveFile,ownedDirectories,verifyTree,rollbackOutput,removePrivate,hash} from './containment.mjs';
export const STAGES=Object.freeze(['allocated','copy','tree','native','baseline','inventory','publish','published']);
export function execute({base,root,pinned,destination,buildResult,projection,policy,sourceRoot=root,instrument,failAt,childFault}){
 assert.ok(childFault===undefined||['native-import','baseline-output','inventory-output'].includes(childFault),'UNKNOWN_CHILD_FAULT');
 assert.ok(failAt===undefined||STAGES.includes(failAt),'UNKNOWN_CONTROL_STAGE');
 if(sourceRoot!==root)assert.ok(path.resolve(sourceRoot).startsWith(base+path.sep)||path.resolve(sourceRoot).startsWith(root+'/work/resume/task04-current-catalog-release-c3/'),'CONTROL_SOURCE_SCOPE');
 const buffers=new Map();const preimageExpected=new Map(pinned.map(r=>[r.path,r.sha256]));
 // No allocation or other filesystem mutation occurs before every source/tree fence.
 verifyTree(path.join(base,'preimages'),preimageExpected);
 for(const row of pinned){const live=readExact(path.join(sourceRoot,row.path),row.sha256);const retained=readExact(path.join(base,'preimages',row.path),row.sha256);assert.ok(live.equals(retained),'SOURCE_PREIMAGE_MISMATCH');buffers.set(row.path,live)}
 const dynamicExtensions=/\.(?:[cm]?[jt]sx?|json)$/;
 const liveConvex=new Map(pinned.filter(r=>r.path.startsWith('convex-dev/')).map(r=>[r.path.slice('convex-dev/'.length),r.sha256]));
 const observed=[];function walk(dir){for(const name of fs.readdirSync(dir)){const p=path.join(dir,name),s=fs.lstatSync(p);assert.ok(!s.isSymbolicLink(),'UNEXPECTED_LIVE_SOURCE_SYMLINK');if(s.isDirectory())walk(p);else if(dynamicExtensions.test(name)){assert.ok(s.isFile(),'UNEXPECTED_LIVE_SOURCE_TYPE');observed.push(path.relative(path.join(sourceRoot,'convex-dev'),p))}}}walk(path.join(sourceRoot,'convex-dev'));assert.deepEqual(observed.sort(),[...liveConvex.keys()].sort(),'UNEXPECTED_DYNAMIC_SOURCE_TREE');
 const output=verifyOutput(destination,[base,root+'/work/resume/task04-current-catalog-release-c3']);
 const workRoot=path.join(root,'work/resume/task04-current-catalog-release-c3');const workParents=inspectAncestors(workRoot);assert.ok(fs.lstatSync(workRoot).isDirectory());
 const selected=new Map([...buffers].filter(([name])=>name.startsWith('convex-dev/')||name.startsWith('src/')||name.startsWith('_goals/')||['package.json','convex.json'].includes(name)));
 const expected=new Map([...selected].map(([name,bytes])=>[name,hash(bytes)]));
 let workspace,identity,replica,stage='source',committed=false;const outputRecords=[],logs=[];
 const invoke=(name)=>{stage=name;instrument?.(name,{workspace,replica,destination:output.dest});if(failAt===name)throw new Error('CONTROLLED_STAGE_FAILURE:'+name)};
 const run=(args,cwd=replica)=>{recheckAncestors(workParents);const started=new Date().toISOString();try{const stdout=execFileSync(process.execPath,args,{cwd,env:{PATH:'/usr/bin:/bin',TSX_DISABLE_CACHE:'1',NODE_OPTIONS:`--import ${path.join(base,'offline-guard.mjs')}`},encoding:'utf8',maxBuffer:16*1024*1024});logs.push({args,cwd,startUTC:started,endUTC:new Date().toISOString(),exit:0,stdout,stderr:''});return stdout}catch(error){logs.push({args,cwd,startUTC:started,endUTC:new Date().toISOString(),exit:error.status??1,stdout:String(error.stdout??''),stderr:String(error.stderr??'')});throw error}};
 const currentFence=()=>{for(const row of pinned)readExact(path.join(sourceRoot,row.path),row.sha256);verifyTree(replica,expected,{dependencyTarget:path.join(root,'node_modules')})};
 try{
  recheckAncestors(output.ancestors);recheckAncestors(workParents);
  workspace=fs.mkdtempSync(path.join(workRoot,'private-'));identity=fs.lstatSync(workspace);assert.equal(identity.mode&0o777,0o700,'PRIVATE_MODE_REQUIRED');replica=path.join(workspace,'replica');fs.mkdirSync(replica,{mode:0o700});invoke('allocated');
  for(const [name,bytes] of selected){ownedDirectories(replica,path.dirname(name));exclusiveFile(path.join(replica,name),bytes)}
  fs.symlinkSync(path.join(root,'node_modules'),path.join(replica,'node_modules'),'dir');invoke('copy');currentFence();invoke('tree');currentFence();
  const nativeFile=path.join(workspace,'current-native.json');assert.deepEqual(fs.readdirSync(workspace),['replica'],'UNEXPECTED_PRIVATE_ROOT');invoke('native');assert.ok(!fs.existsSync(nativeFile),'NATIVE_OUTPUT_PREEXISTS');currentFence();run(['--import','tsx',path.join(base,'native-probe.mts'),childFault==='native-import'?path.join(replica,'absent-owned-module-root'):replica,nativeFile]);
  const native=JSON.parse(readExact(nativeFile,hash(fs.readFileSync(nativeFile))).toString());
  const schema=path.join(replica,'convex-dev/schema.ts');readExact(schema,expected.get('convex-dev/schema.ts'));const fd=fs.openSync(schema,fs.constants.O_WRONLY|fs.constants.O_TRUNC|fs.constants.O_NOFOLLOW);try{assert.equal(fs.fstatSync(fd).nlink,1);fs.writeFileSync(fd,projection)}finally{fs.closeSync(fd)}expected.set('convex-dev/schema.ts',hash(projection));
  const baselineDir=path.join(workspace,'baseline');invoke('baseline');assert.ok(!fs.existsSync(baselineDir),'BASELINE_OUTPUT_PREEXISTS');currentFence();
  if(childFault==='baseline-output')exclusiveFile(baselineDir,Buffer.from('CONTROLLED_EXISTING_FILE'));
 const baseline=JSON.parse(run(['_goals/convex-backend-runtime-2026-10-02/qa/task03-artifact-schema-index-repair/strict-compose.mjs',baselineDir]));
  const baselineFile=baseline.exactCurrentRepair.nativeWitness;assert.ok(baselineFile.startsWith(baselineDir+path.sep));inspectAncestors(baselineFile);const nativeBaseline=JSON.parse(fs.readFileSync(baselineFile,'utf8'));
  const policyFile=path.join(replica,'convex-dev/runtimeModelPolicy.ts');readExact(policyFile,expected.get('convex-dev/runtimeModelPolicy.ts'));fs.unlinkSync(policyFile);expected.delete('convex-dev/runtimeModelPolicy.ts');
  const inventoryDir=path.join(workspace,'baseline-inventory');invoke('inventory');assert.ok(!fs.existsSync(inventoryDir),'INVENTORY_OUTPUT_PREEXISTS');currentFence();if(childFault==='inventory-output')exclusiveFile(inventoryDir,Buffer.from('CONTROLLED_EXISTING_FILE'));run(['_goals/convex-backend-runtime-2026-10-02/qa/task03b2d/inventory.mjs',inventoryDir]);
  const historical=JSON.parse(fs.readFileSync(path.join(inventoryDir,'public-path-inventory.json'),'utf8'));
  const result=buildResult({native,nativeBaseline,baseline,historical,policy,dest:output.dest});
  const files=new Map([['current-native.json',fs.readFileSync(nativeFile)],['exact-current-repair-native.json',fs.readFileSync(baselineFile)],['historical-artifact/output/public-path-inventory.json',fs.readFileSync(path.join(baselineDir,'historical-artifact/output/public-path-inventory.json'))],['baseline-inventory/public-path-inventory.json',fs.readFileSync(path.join(inventoryDir,'public-path-inventory.json'))],['baseline-inventory/public-path-inventory.md',fs.readFileSync(path.join(inventoryDir,'public-path-inventory.md'))],['public-path-inventory.json',Buffer.from(JSON.stringify(result.inventory,null,2)+'\n')],['composition.json',Buffer.from(JSON.stringify(result.composition,null,2)+'\n')],['execution.json',Buffer.from(JSON.stringify({scope:'TRUSTED_OFFLINE_CHILD_SOURCE_ONLY',logs},null,2)+'\n')]]);
  invoke('publish');currentFence();recheckAncestors(output.ancestors);
  if(!output.exists){fs.mkdirSync(output.dest,{mode:0o700});const s=fs.lstatSync(output.dest);outputRecords.push({path:output.dest,dev:s.dev,ino:s.ino,kind:'directory'})}else assert.deepEqual(fs.readdirSync(output.dest),[],'OUTPUT_CHANGED_BEFORE_COMMIT');
  for(const [relative,bytes] of files){const directory=path.dirname(relative);if(directory!=='.')ownedDirectories(output.dest,directory,outputRecords);exclusiveFile(path.join(output.dest,relative),bytes,outputRecords)}invoke('published');committed=true;return result.composition;
 }catch(cause){
  const error=new Error('COMPOSITION_FAILED:'+stage,{cause});error.compositionStage=stage;
  // Safe diagnostics are separate BEFORE cleanup; failure to retain them cannot
  // bypass finally or mutate an opaque thrown value/accessor.
  if(workspace)try{const diagnosticDirectory=path.join(workRoot,'diagnostics');inspectAncestors(diagnosticDirectory);assert.ok(fs.lstatSync(diagnosticDirectory).isDirectory());const file=path.join(diagnosticDirectory,crypto.randomUUID()+'.json');exclusiveFile(file,Buffer.from(JSON.stringify({utc:new Date().toISOString(),scope:'OFFLINE_CONTROL_FAILURE_ONLY',stage,code:'COMPOSITION_FAILED',logs},null,2)+'\n'));error.diagnosticPath=file}catch{error.diagnosticRetention='FAILED_WITHOUT_SKIPPING_CLEANUP'}
  throw error;
 }finally{
  try{if(!committed)rollbackOutput(outputRecords)}finally{if(workspace)removePrivate(workspace,identity)}
 }
}
