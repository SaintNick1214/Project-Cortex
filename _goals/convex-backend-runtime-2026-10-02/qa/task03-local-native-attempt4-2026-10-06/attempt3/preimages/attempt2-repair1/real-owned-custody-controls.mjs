/** Actual filesystem behavior using dummy files confined to QA/tmp; no private input. */
import assert from 'node:assert/strict';
import vm from 'node:vm';
import * as fs from 'node:fs';
import { resolve,dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash,randomUUID } from 'node:crypto';
import { canonical } from '../scripts/guard.mjs';
const q=resolve(dirname(fileURLToPath(import.meta.url)),'..'),source=fs.readFileSync(resolve(q,'scripts/incidental-custody.mjs'),'utf8'),sha=bytes=>createHash('sha256').update(bytes).digest('hex'),results=[];
for(const name of ['healthy-owned-source','same-owner-replacement-after-receipt','same-inode-content-change-after-receipt']){
 const root=fs.mkdtempSync(resolve(q,'tmp/actual-custody-')),fixture=resolve(root,'managed-fixture'),scratch=resolve(root,'private'),path=resolve(fixture,'fixture/.env.local'),held=new Set();let seamReached=false,unlinkCalls=0,replacedInode;
 try{
  fs.mkdirSync(resolve(fixture,'fixture'),{recursive:true});fs.mkdirSync(scratch,{mode:0o700});fs.mkdirSync(resolve(root,'attempt2'));fs.writeFileSync(path,'DUMMY_QA_INPUT_NO_CREDENTIALS\n',{flag:'wx',mode:0o600});
  const initial=fs.lstatSync(path,{bigint:true});
  fs.writeFileSync(resolve(root,'attempt2/incidental-file-policy.json'),JSON.stringify({path:'managed-fixture/fixture/.env.local',baselineAbsent:true,removalRequiresPrivateExactCustody:true}));fs.writeFileSync(resolve(root,'candidate-freeze-attempt2-repair1.json'),JSON.stringify({files:[]}));
  const boundary={...fs,openSync:(p,flags)=>{const fd=fs.openSync(p,flags);if(p===path)held.add(fd);return fd;},closeSync:fd=>{fs.closeSync(fd);held.delete(fd);},
   fsyncSync:fd=>{fs.fsyncSync(fd);
    // Exact trigger uses the tracked durable receipt descriptor, without pathname guesses.
    if(receiptDescriptors.has(fd)){seamReached=true;if(name==='same-owner-replacement-after-receipt'){const replacement=resolve(root,'replacement.env');fs.writeFileSync(replacement,'DUMMY_REPLACEMENT_NO_CREDENTIALS\n',{flag:'wx',mode:0o600});fs.renameSync(replacement,path);replacedInode=fs.lstatSync(path,{bigint:true}).ino.toString();}else if(name==='same-inode-content-change-after-receipt')fs.writeFileSync(path,'DUMMY_CHANGED_CONTENT_NO_CREDENTIALS\n');}},
   unlinkSync:p=>{unlinkCalls++;fs.unlinkSync(p);}};
  const receiptDescriptors=new Set(),open=boundary.openSync;boundary.openSync=(p,flags)=>{const fd=open(p,flags);if(typeof p==='string'&&p.includes('incidental-custody-'))receiptDescriptors.add(fd);return fd;};
  const imports={'node:fs':boundary,'node:path':{resolve},'node:crypto':{randomUUID},'./guard.mjs':{fixture,preparation:root,scratch,canonical,sha256:sha}};
  const context=vm.createContext({process:{getuid:()=>process.getuid()},Buffer}),module=new vm.SourceTextModule(source,{context});await module.link(name=>{assert.ok(Object.hasOwn(imports,name),name);const values=imports[name];return new vm.SyntheticModule(Object.keys(values),function(){for(const [key,value] of Object.entries(values))this.setExport(key,value);},{context});});await module.evaluate({timeout:3000});
  let observed,error;try{observed=module.namespace.captureIncidental();}catch(caught){error=caught.message;}
  assert.equal(seamReached,true);assert.equal(held.size,0,'Actual held source FD is closed');
  if(name==='healthy-owned-source'){assert.equal(observed.removed,true);assert.equal(error,undefined);assert.equal(unlinkCalls,1);assert.equal(fs.existsSync(path),false);}else {assert.equal(error,'ATTEMPT2_INCIDENTAL_CUSTODY_NOT_VERIFIED');assert.equal(unlinkCalls,0);assert.equal(fs.existsSync(path),true);if(replacedInode)assert.equal(fs.lstatSync(path,{bigint:true}).ino.toString(),replacedInode);}
  const receiptName=fs.readdirSync(scratch).find(file=>file.startsWith('incidental-custody-')),receipt=JSON.parse(fs.readFileSync(resolve(scratch,receiptName),'utf8'));assert.equal(receipt.sourceIdentityDecimal.ino,initial.ino.toString());assert.equal(receipt.sourceIdentityDecimal.mtimeNs,initial.mtimeNs.toString());assert.equal(receipt.pathRemovalAuthorization,'PENDING_FINAL_POST_RECEIPT_OWNERSHIP_IDENTITY_CONTENT_CHECK');
  results.push({name,status:'PASS',postReceiptSeamReached:true,heldSourceFdClosed:true,unlinkCalls,removed:observed?.removed??false,unknownReplacementRetained:name==='same-owner-replacement-after-receipt',identityPrecision:'ACTUAL_BIGINT_DECIMAL_STAT_FIELDS',privateInputRead:false});
 }finally{fs.rmSync(root,{recursive:true,force:true});}
}
console.log(JSON.stringify({scope:'ACTUAL_OWNED_QA_TMP_CUSTODY_CONTROLS_ONLY',status:'PASS',cases:results.length,actualSourceSha256:sha(source),externalRequests:0,privateScratchTouched:false,credentialsRead:false,results}));
