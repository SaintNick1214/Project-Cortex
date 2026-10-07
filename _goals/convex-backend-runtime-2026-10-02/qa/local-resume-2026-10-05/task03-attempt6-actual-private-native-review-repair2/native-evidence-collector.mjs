/** Independently owned read-only finite evidence collector. No credentials, RPCs, or writes. */
import assert from 'node:assert/strict';
import { constants, lstatSync, fstatSync, openSync, closeSync, readSync, readdirSync, realpathSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
const OP='c9fbaa34-8ca8-4153-b8bd-1cfe60a8241f',PRIVATE='/owned/private';
const fields=['dev','ino','mode','uid','gid','nlink','size','mtimeNs','ctimeNs'];
const named=['dev','ino','mode','uid','gid','nlink','size','mtime_ns','ctime_ns'];
const id=s=>Object.fromEntries(fields.map((f,i)=>[named[i],String(s[f])]));
const sha=b=>createHash('sha256').update(b).digest('hex');
const held=[];let stage='inventory';
function hold(path,limit,directory=false){
 const before=lstatSync(path,{bigint:true}),fd=openSync(path,constants.O_RDONLY|constants.O_NOFOLLOW|(directory?constants.O_DIRECTORY:0));
 const row={path,fd,originalNine:id(before),limit,directory};held.push(row);return row;
}
function read(row){
 let p='';for(const part of row.path.split('/').filter(Boolean)){p+='/'+part;const s=lstatSync(p,{bigint:true});assert.equal(s.isSymbolicLink(),false);assert.equal(realpathSync(p),p);if(p!==row.path)assert.equal(s.isDirectory(),true);}
 const before=lstatSync(row.path,{bigint:true});assert.deepEqual(id(before),row.originalNine);assert.deepEqual(id(fstatSync(row.fd,{bigint:true})),row.originalNine);
 assert.equal(before.isDirectory(),row.directory);assert.equal(row.directory||before.isFile(),true);assert.equal(before.uid,501n);assert.equal(before.gid,20n);
 if(row.directory)return undefined;
 assert.equal(before.nlink,1n);assert.ok(before.size>=0n&&before.size<=BigInt(row.limit));
 const buffer=Buffer.alloc(65536),chunks=[];let n=0,size=0;while((n=readSync(row.fd,buffer,0,buffer.length,size))!==0){size+=n;assert.ok(size<=row.limit&&BigInt(size)<=before.size);chunks.push(Buffer.from(buffer.subarray(0,n)));}
 assert.equal(BigInt(size),before.size);assert.deepEqual(id(fstatSync(row.fd,{bigint:true})),row.originalNine);assert.deepEqual(id(lstatSync(row.path,{bigint:true})),row.originalNine);return Buffer.concat(chunks);
}
try{
 assert.equal(process.version,'v24.15.0');assert.equal(process.platform,'linux');assert.equal(process.arch,'x64');assert.equal(process.getuid(),501);assert.equal(process.getgid(),20);
 assert.equal(Object.keys(process.env).some(k=>k.startsWith('CONVEX')),false);assert.equal(process.env.HOME,'/tmp');
 const root=hold(PRIVATE,0,true);read(root);assert.equal(BigInt(root.originalNine.mode)&0o777n,0o700n);
 const inventory=readdirSync(PRIVATE).sort();
 const patterns=[
  ['deploy',/^deploy-[a-f0-9-]{36}\.json$/,65536],['driver',/^driver-[a-f0-9-]{36}\.json$/,65536],
  ['qualify',/^qualify-[a-f0-9-]{36}\.json$/,65536],['codegen',/^codegen-[a-f0-9-]{36}\.json$/,65536],
  ['caseJournal',/^case-journal-[a-f0-9-]{36}\.jsonl$/,4000000],['caseOutcomes',/^case-outcomes-[a-f0-9-]{36}\.json$/,8388608],
  ['owned',/^owned-foundation-[a-f0-9]{32}\.json$/,262144],['ownedJournal',/^owned-journal-foundation-[a-f0-9]{32}\.jsonl$/,8388608],
 ];
 const selected=patterns.map(([kind,pattern,limit])=>{const matches=inventory.filter(n=>pattern.test(n));assert.equal(matches.length,1,'exact_single_'+kind);return Object.assign(hold(PRIVATE+'/'+matches[0],limit),{kind});});
 const generated='/prep/managed-fixture/fixture/convex/_generated',groot=hold(generated,0,true),files=['api.d.ts','api.js','dataModel.d.ts','server.d.ts','server.js'];
 assert.deepEqual(readdirSync(generated).filter(n=>!n.startsWith('.')).sort(),[...files].sort());
 const gen=files.map(name=>Object.assign(hold(generated+'/'+name,1048576),{kind:'generated'}));
 const publicRows=[Object.assign(hold('/prep/path-ledger.json',4194304),{kind:'pathLedger'}),Object.assign(hold('/prep/lifecycle-coverage.json',65536),{kind:'lifecycleCoverage'})];
 // Every selected descriptor and original nine are captured before any selected content.
 stage='read';let total=0;const rows=[...selected,...gen,...publicRows].map(row=>{const body=read(row);total+=body.length;assert.ok(total<=16777216);if(row.path.startsWith(PRIVATE+'/'))assert.equal(BigInt(row.originalNine.mode)&0o777n,0o600n);row.sha256=sha(body);row.bytes=body.length;return{kind:row.kind,path:row.path,originalNine:row.originalNine,sha256:row.sha256,bytes:row.bytes,fullEOF:true,bodyBase64:body.toString('base64')};});
 stage='final';assert.deepEqual(readdirSync(PRIVATE).sort(),inventory);for(const row of held){const body=read(row);if(!row.directory){assert.equal(body.length,row.bytes);assert.equal(sha(body),row.sha256);}}
 const decoded=Buffer.from(JSON.stringify({scope:'ACTUAL_CURRENT_NATIVE_READONLY_EVIDENCE_COLLECTION_ONLY',status:'PASS',operation:OP,rows,directoryOriginalNine:root.originalNine,currentDescriptorsHeldThroughFinal:true,files:rows.length,totalRawBytes:total,secretFilesRead:0,serviceCalls:0,volumeWrites:0})+'\n');assert.ok(decoded.length<=25165824);
 const zipped=gzipSync(decoded,{level:9});const envelope=Buffer.from(JSON.stringify({encoding:'gzip+base64',decodedBytes:decoded.length,decodedSha256:sha(decoded),body:zipped.toString('base64')})+'\n');assert.ok(envelope.length<=262144);process.stdout.write(envelope);
}catch{process.stdout.write(JSON.stringify({scope:'ACTUAL_CURRENT_NATIVE_READONLY_EVIDENCE_COLLECTION_ONLY',status:'FAIL_PRESERVED',failureStage:stage,privateBytesPrinted:false,serviceCalls:0,volumeWrites:0})+'\n');process.exitCode=1;}
finally{for(const row of held)closeSync(row.fd);}
