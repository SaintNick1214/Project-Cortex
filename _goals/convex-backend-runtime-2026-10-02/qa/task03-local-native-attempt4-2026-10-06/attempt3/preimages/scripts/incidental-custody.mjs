/** Capture only the newly created owned CLI environment file, before removing it. */
import { constants,lstatSync,fstatSync,readSync,readFileSync,writeFileSync,openSync,fsyncSync,closeSync,unlinkSync } from 'node:fs';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { fixture,preparation,scratch,canonical,sha256 } from './guard.mjs';
const fail=()=>{throw new Error('ATTEMPT2_INCIDENTAL_CUSTODY_NOT_VERIFIED');};
// Actual BigInt stat fields are serialized as decimal strings, without rounding.
const fields=['dev','ino','mode','nlink','uid','gid','size','mtimeNs','ctimeNs'];
const identity=stat=>Object.fromEntries(fields.map(name=>{if(typeof stat[name]!=='bigint')fail();return [name,stat[name].toString()];}));
function owned(stat){if(!stat||!stat.isFile()||stat.uid!==BigInt(process.getuid())||stat.nlink!==1n||stat.size<0n||stat.size>65536n)fail();return identity(stat);}
function heldContent(fd,size){
 const bytes=Buffer.alloc(Number(size));let offset=0;
 while(offset<bytes.length){const count=readSync(fd,bytes,offset,bytes.length-offset,offset);if(count===0)fail();offset+=count;}
 if(readSync(fd,Buffer.alloc(1),0,1,bytes.length)!==0)fail();return bytes;
}
function durable(path,bytes){writeFileSync(path,bytes,{flag:'wx',mode:0o600});const fd=openSync(path,'r');try{fsyncSync(fd);}finally{closeSync(fd);}}
export function captureIncidental(){
 const policy=JSON.parse(readFileSync(canonical(resolve(preparation,'attempt2/incidental-file-policy.json'),preparation)));
 const relative='managed-fixture/fixture/.env.local',path=resolve(fixture,'fixture/.env.local');
 const freeze=JSON.parse(readFileSync(canonical(resolve(preparation,'candidate-freeze-attempt2-repair1.json'),preparation)));
 if(policy.path!==relative||policy.baselineAbsent!==true||policy.removalRequiresPrivateExactCustody!==true||freeze.files.some(row=>row.path===relative))fail();
 const before=lstatSync(path,{throwIfNoEntry:false,bigint:true});if(!before)return {created:false,captured:false,removed:false};
 canonical(path,preparation);const original=owned(before);if(typeof constants.O_NOFOLLOW!=='number')fail();
 const fd=openSync(path,constants.O_RDONLY|constants.O_NOFOLLOW);
 try{
  if(JSON.stringify(owned(fstatSync(fd,{bigint:true})))!==JSON.stringify(original))fail();
  const content=heldContent(fd,before.size),digest=sha256(content),capture=resolve(scratch,'cli-created-env-'+randomUUID()+'.bin');
  durable(capture,content);canonical(capture,scratch,true);if(sha256(readFileSync(capture))!==digest)fail();
  const verify=()=>{
   canonical(path,preparation);
   if(JSON.stringify(owned(fstatSync(fd,{bigint:true})))!==JSON.stringify(original)||JSON.stringify(owned(lstatSync(path,{bigint:true})))!==JSON.stringify(original))fail();
   if(sha256(heldContent(fd,before.size))!==digest||sha256(readFileSync(path))!==digest)fail();
   // Repeat identity after both full-content reads; no custody I/O follows this check.
   if(JSON.stringify(owned(fstatSync(fd,{bigint:true})))!==JSON.stringify(original)||JSON.stringify(owned(lstatSync(path,{bigint:true})))!==JSON.stringify(original))fail();
  };
  verify();const receipt=resolve(scratch,'incidental-custody-'+randomUUID()+'.json');
  durable(receipt,JSON.stringify({scope:'OWNED_HELD_NEW_CLI_ENVIRONMENT_SOURCE_ONLY',path:relative,baselineAbsent:true,sourceIdentityDecimal:original,identityFields:fields,sourceFdHeld:true,capturePath:capture,sha256:digest,bytes:content.length,privateExactCaptureVerified:true,pathRemovalAuthorization:'PENDING_FINAL_POST_RECEIPT_OWNERSHIP_IDENTITY_CONTENT_CHECK',removed:false},null,2)+'\n');
  canonical(receipt,scratch,true);
  // A post-receipt replacement retains its pathname and is never claimed as captured.
  verify();unlinkSync(path);if(lstatSync(path,{throwIfNoEntry:false}))fail();
  durable(resolve(scratch,'incidental-removal-'+randomUUID()+'.json'),JSON.stringify({scope:'OWNED_HELD_NEW_CLI_ENVIRONMENT_SOURCE_ONLY',custodyReceipt:receipt,sourceIdentityDecimal:original,sha256:digest,finalPostReceiptChecks:true,removed:true,absenceVerified:true},null,2)+'\n');
  return {created:true,captured:true,removed:true};
 }finally{closeSync(fd);}
}
