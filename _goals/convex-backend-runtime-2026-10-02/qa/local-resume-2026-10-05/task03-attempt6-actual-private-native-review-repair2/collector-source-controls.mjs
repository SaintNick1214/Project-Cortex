/** SOURCE/MOCK filesystem controls: no real /owned, /prep, or private file access. */
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { gzipSync, gunzipSync } from 'node:zlib';
import vm from 'node:vm';
const A=new URL('.',import.meta.url).pathname,source=readFileSync(A+'native-evidence-collector.mjs','utf8').replace(/^import .*;$/gm,''),PRIVATE='/owned/private',GENERATED='/prep/managed-fixture/fixture/convex/_generated';
const names={deploy:'deploy-',driver:'driver-',qualify:'qualify-',codegen:'codegen-',caseJournal:'case-journal-',caseOutcomes:'case-outcomes-',owned:'owned-foundation-',ownedJournal:'owned-journal-foundation-'};
const controls=[];
function run(change){
 const files=new Map(),directories=new Set(['/','/owned',PRIVATE,'/prep','/prep/managed-fixture','/prep/managed-fixture/fixture','/prep/managed-fixture/fixture/convex',GENERATED]);
 for(const [kind,prefix]of Object.entries(names)){const name=prefix+(kind.startsWith('owned')?'0'.repeat(32):'00000000-0000-4000-8000-000000000000')+(kind.endsWith('Journal')?'.jsonl':'.json');files.set(PRIVATE+'/'+name,Buffer.from('{"scope":"SOURCE/MOCK"}\n'));}
 for(const name of ['api.d.ts','api.js','dataModel.d.ts','server.d.ts','server.js'])files.set(GENERATED+'/'+name,Buffer.from('SOURCE/MOCK'));
 files.set('/prep/path-ledger.json',Buffer.from('{}'));files.set('/prep/lifecycle-coverage.json',Buffer.from('{}'));
 // Forbidden credential/CLI diagnostic names appear in the inventory but must never be opened.
 for(const name of ['jwt-private.pem','target.json','deploy.env','private-cli-diagnostics-00000000-0000-4000-8000-000000000000.json'])files.set(PRIVATE+'/'+name,Buffer.from('FORBIDDEN_SOURCE_MOCK_CONTENT'));
 const forbidden=new Set([...files].filter(([p])=>files.get(p).toString()==='FORBIDDEN_SOURCE_MOCK_CONTENT').map(([p])=>p));
 const fdrows=new Map(),opens=[],reads=[],closed=[];let next=10,stdout='',exitCode=0,current,mutations={};
 if(change)change({files,directories,mutations});
 const stat=(p)=>{
  assert.ok(files.has(p)||directories.has(p),'mock_unknown_path');const dir=directories.has(p),ino=BigInt([...directories,...files.keys()].indexOf(p)+100);
  const s={dev:1n,ino,mode:BigInt(dir?0o40700:0o100600),uid:501n,gid:20n,nlink:dir?2n:1n,size:BigInt(dir?0:files.get(p).length),mtimeNs:1n,ctimeNs:1n,isSymbolicLink:()=>false,isDirectory:()=>dir,isFile:()=>!dir};
  return Object.assign(s,mutations[p]??{});
 };
 const lstatSync=p=>stat(p),openSync=p=>{assert.equal(forbidden.has(p),false,'secret_open');opens.push(p);const fd=next++;fdrows.set(fd,{p,pin:stat(p)});return fd;};
 const fstatSync=fd=>{const r=fdrows.get(fd);assert.ok(r);return mutations.fdPinChanged&&r.p===mutations.fdPinChanged?{...r.pin,ctimeNs:2n}:r.pin;};
 const readSync=(fd,b,offset,length,position)=>{const p=fdrows.get(fd).p;assert.equal(forbidden.has(p),false);reads.push(p);const data=files.get(p);assert.ok(data);const n=Math.max(0,Math.min(length,data.length-position));if(n)data.copy(b,offset,position,position+n);if(!n&&mutations.lateIdentity===p)mutations[p]={ctimeNs:3n};return n;};
 const readdirSync=p=>[...files,...[...directories].map(d=>[d])].map(([f])=>f).filter(f=>f.startsWith(p+'/')&&!f.slice(p.length+1).includes('/')).map(f=>f.slice(p.length+1));
 const process={version:'v24.15.0',platform:'linux',arch:'x64',getuid:()=>501,getgid:()=>20,env:{HOME:'/tmp'},stdout:{write:b=>{stdout+=b.toString();}},get exitCode(){return exitCode;},set exitCode(x){exitCode=x;}};
 const sandbox=vm.createContext({assert:{...assert,deepEqual:(a,b)=>assert.deepEqual(JSON.parse(JSON.stringify(a)),JSON.parse(JSON.stringify(b)))},constants:{O_RDONLY:0,O_NOFOLLOW:1,O_DIRECTORY:2},closeSync:fd=>{closed.push(fd);fdrows.delete(fd);},lstatSync,fstatSync,openSync,readSync,readdirSync,realpathSync:p=>p,createHash,gzipSync,Buffer,process});
 new vm.Script(source).runInContext(sandbox,{timeout:2000});assert.equal(fdrows.size,0);assert.equal(opens.filter(p=>forbidden.has(p)).length,0);
 const envelope=JSON.parse(stdout);const pass=exitCode===0;
 if(pass){const raw=gunzipSync(Buffer.from(envelope.body,'base64'));assert.equal(raw.length,envelope.decodedBytes);assert.equal(createHash('sha256').update(raw).digest('hex'),envelope.decodedSha256);current=JSON.parse(raw);assert.equal(current.files,15);assert.equal(current.rows.length,15);assert.equal(current.secretFilesRead,0);assert.equal(current.currentDescriptorsHeldThroughFinal,true);}
 return {pass,opens:opens.length,reads:reads.length,closed:closed.length,stage:pass?'complete':envelope.failureStage};
}
const positive=run();assert.equal(positive.pass,true);controls.push({name:'all_fifteen_selected_full_EOF_held_then_final',result:'PASS',...positive});
for(const [name,fn]of [
 ['missing_required_codegen',s=>s.files.delete([...s.files.keys()].find(p=>p.startsWith(PRIVATE+'/codegen-')))],
 ['duplicate_native_run',s=>s.files.set(PRIVATE+'/driver-11111111-1111-4111-8111-111111111111.json',Buffer.from('{}'))],
 ['missing_generated_api',s=>s.files.delete(GENERATED+'/api.d.ts')],
 ['extra_generated_file',s=>s.files.set(GENERATED+'/unsafe.js',Buffer.from('{}'))],
 ['private_file_wrong_mode',s=>s.mutations[PRIVATE+'/deploy-00000000-0000-4000-8000-000000000000.json']={mode:0o100644n}],
 ['private_file_wrong_owner',s=>s.mutations[PRIVATE+'/deploy-00000000-0000-4000-8000-000000000000.json']={uid:0n}],
 ['private_file_hardlink',s=>s.mutations[PRIVATE+'/deploy-00000000-0000-4000-8000-000000000000.json']={nlink:2n}],
 ['fd_identity_changed',s=>s.mutations.fdPinChanged=PRIVATE+'/deploy-00000000-0000-4000-8000-000000000000.json'],
 ['identity_after_EOF_changed',s=>s.mutations.lateIdentity=PRIVATE+'/deploy-00000000-0000-4000-8000-000000000000.json'],
 ['journal_original_four_million_ceiling',s=>s.files.set(PRIVATE+'/case-journal-00000000-0000-4000-8000-000000000000.jsonl',Buffer.alloc(4000001))],
 ]){const value=run(fn);assert.equal(value.pass,false,name);controls.push({name,result:'DENIED',...value});}
writeFileSync(A+'collector-source-control-results.json',JSON.stringify({scope:'FINITE_COLLECTOR_SOURCE_MOCK_FS_ONLY_NOT_ACTUAL_EVIDENCE',status:'PASS',controls,count:controls.length,privateReads:0,DockerCalls:0,serviceCalls:0,secretFileOpens:0,actualNativeOutcomes:0},null,2)+'\n',{flag:'wx',mode:0o600});
console.log(JSON.stringify({scope:'SOURCE/MOCK',status:'PASS',count:controls.length,privateReads:0}));
