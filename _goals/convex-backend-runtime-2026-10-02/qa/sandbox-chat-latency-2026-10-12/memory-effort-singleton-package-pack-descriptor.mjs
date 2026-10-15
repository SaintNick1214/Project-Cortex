/** Pure descriptor/read-only archive validation; no pack/build side effects. */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
const digest=(bytes,algorithm='sha256',encoding='hex')=>createHash(algorithm).update(bytes).digest(encoding);
export function packDescriptor(raw,name,version){
 const value=JSON.parse(raw);let row;
 if(Array.isArray(value)){assert.equal(value.length,1);row=value[0];}
 else{assert(value&&typeof value==='object');assert.deepEqual(Object.keys(value),[name]);row=value[name];}
 assert.equal(row.name,name);assert.equal(row.version,version);assert.equal(row.id,name+'@'+version);assert(Array.isArray(row.files)&&row.files.length>0);assert.equal(row.entryCount,row.files.length);assert(Array.isArray(row.bundled)&&row.bundled.length===0);assert.match(row.filename,/^[a-zA-Z0-9._-]+\.tgz$/);
 const names=new Set();for(const file of row.files){assert(!file.path.startsWith('/')&&!file.path.split('/').some(p=>['..','node_modules','.git','_goals'].includes(p))&&(!/(^|\/)\.env(?:\.[^/]+)?$/.test(file.path)||file.path.endsWith('.example')));assert(!names.has(file.path));names.add(file.path);assert(Number.isSafeInteger(file.size)&&file.size>=0);}
 return row;
}
export function validateArchive(row,archive,root){
 const bytes=fs.readFileSync(archive);assert.equal(bytes.length,row.size);assert.equal(digest(bytes,'sha1'),row.shasum);assert.equal('sha512-'+digest(bytes,'sha512','base64'),row.integrity);
 const proof=JSON.parse(execFileSync('python3',['-c',`import sys,tarfile,pathlib,json,hashlib\na,root=sys.argv[1:];rows=[];names=set()\nwith tarfile.open(a,'r:gz') as tar:\n for m in tar.getmembers():\n  if m.isdir(): continue\n  assert m.isfile() and m.name.startswith('package/')\n  name=m.name[8:];parts=pathlib.PurePosixPath(name).parts\n  assert name not in names and '..' not in parts and not pathlib.PurePosixPath(name).is_absolute();names.add(name)\n  data=tar.extractfile(m).read();p=pathlib.Path(root)/name\n  assert p.is_file() and not p.is_symlink() and data==p.read_bytes(),name\n  rows.append({'path':name,'size':len(data),'sha256':hashlib.sha256(data).hexdigest()})\nprint(json.dumps(rows))`,archive,root],{encoding:'utf8',maxBuffer:20*1024*1024}));
 assert.deepEqual(proof.map(r=>({path:r.path,size:r.size})).sort((a,b)=>a.path.localeCompare(b.path)),row.files.map(r=>({path:r.path,size:r.size})).sort((a,b)=>a.path.localeCompare(b.path)));
 return {archiveSha256:digest(bytes),memberCount:proof.length,membershipSha256:digest(JSON.stringify(proof)),nativeSha1AndSha512Match:true,allMembersMatchAcceptedStaging:true};
}
