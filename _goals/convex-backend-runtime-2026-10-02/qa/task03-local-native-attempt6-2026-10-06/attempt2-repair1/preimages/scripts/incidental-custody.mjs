/** Capture only the newly created owned CLI environment file, before removing it. */
import { lstatSync,readFileSync,writeFileSync,openSync,fsyncSync,closeSync,unlinkSync } from 'node:fs';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { fixture,preparation,scratch,canonical,sha256 } from './guard.mjs';
const fail=()=>{throw new Error('ATTEMPT2_INCIDENTAL_CUSTODY_NOT_VERIFIED');};
const identity=stat=>({device:stat.dev,inode:stat.ino,uid:stat.uid,gid:stat.gid,mode:stat.mode&0o777,links:stat.nlink,bytes:stat.size,mtimeMs:stat.mtimeMs,ctimeMs:stat.ctimeMs});
function durable(path,bytes){writeFileSync(path,bytes,{flag:'wx',mode:0o600});const fd=openSync(path,'r');try{fsyncSync(fd);}finally{closeSync(fd);}}
export function captureIncidental(){
 const policy=JSON.parse(readFileSync(canonical(resolve(preparation,'attempt2/incidental-file-policy.json'),preparation)));
 const relative='managed-fixture/fixture/.env.local',path=resolve(fixture,'fixture/.env.local');
 const freeze=JSON.parse(readFileSync(canonical(resolve(preparation,'candidate-freeze-attempt2.json'),preparation)));
 if(policy.path!==relative||policy.baselineAbsent!==true||policy.removalRequiresPrivateExactCustody!==true||freeze.files.some(row=>row.path===relative))fail();
 const before=lstatSync(path,{throwIfNoEntry:false});if(!before)return {created:false,captured:false,removed:false};
 canonical(path,preparation);if(!before.isFile()||before.uid!==process.getuid()||before.nlink!==1)fail();
 const content=readFileSync(path),digest=sha256(content),capture=resolve(scratch,'cli-created-env-'+randomUUID()+'.bin');
 durable(capture,content);canonical(capture,scratch,true);if(sha256(readFileSync(capture))!==digest)fail();
 const after=lstatSync(path);if(JSON.stringify(identity(before))!==JSON.stringify(identity(after))||sha256(readFileSync(path))!==digest)fail();
 const receipt=resolve(scratch,'incidental-custody-'+randomUUID()+'.json');
 durable(receipt,JSON.stringify({scope:'OWNED_NEW_CLI_ENVIRONMENT_FILE_ONLY',path:relative,baselineAbsent:true,sourceIdentity:identity(before),capturePath:capture,sha256:digest,bytes:content.length,privateExactCaptureVerified:true,removalAuthorizedAfterDurableReceipt:true,removed:false},null,2)+'\n');
 canonical(receipt,scratch,true);unlinkSync(path);if(lstatSync(path,{throwIfNoEntry:false}))fail();
 durable(resolve(scratch,'incidental-removal-'+randomUUID()+'.json'),JSON.stringify({scope:'OWNED_NEW_CLI_ENVIRONMENT_FILE_ONLY',custodyReceipt:receipt,sha256:digest,removed:true,absenceVerified:true},null,2)+'\n');
 return {created:true,captured:true,removed:true};
}
