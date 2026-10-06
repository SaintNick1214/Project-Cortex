import fs from 'node:fs';
import crypto from 'node:crypto';
export function fullHeld(fd,expected,read=fs.readSync){
 if(!Number.isSafeInteger(expected.bytes)||expected.bytes<0)throw Error('FINITE_HELD_SOURCE_BYTES');
 const block=Buffer.alloc(65536),hash=crypto.createHash('sha256');let at=0;
 for(;;){const count=read(fd,block,0,block.length,at);if(!count)break;at+=count;if(at>expected.bytes)throw Error('NATIVE_BEFORE_LOAD_BOUND');hash.update(block.subarray(0,count));}
 if(at!==expected.bytes||hash.digest('hex')!==expected.sha256)throw Error('NATIVE_BEFORE_LOAD_FULL_BYTE_PIN');
 return {bytes:at,sha256:expected.sha256,EOF:true};
}
