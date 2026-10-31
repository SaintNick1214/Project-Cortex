// A new native public launcher. All original C7 control bodies remain byte-exact.
import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {registerHooks} from 'node:module';
import {fullHeld} from './node_contract.mjs';
const root='/var/tmp/cortex-task04-native-public',T='/dev/shm/cortex-native-c7-exact-identity-repair';
const F=['dev','ino','mode','uid','gid','nlink','size','mtime_ns','ctime_ns'];
const ident=s=>({schema:'FS_IDENTITY_DECIMAL_V1',fields:Object.fromEntries(F.map(k=>[k,s[k==='mtime_ns'?'mtimeNs':k==='ctime_ns'?'ctimeNs':k].toString()]))});
const held=[],loads=[],closes=[];let primary=null,hook,rawBytes=0;
const write=(p,b)=>{const fd=fs.openSync(p,fs.constants.O_WRONLY|fs.constants.O_CREAT|fs.constants.O_EXCL|fs.constants.O_NOFOLLOW,0o600);try{let at=0;while(at<b.length){const n=fs.writeSync(fd,b,at,Math.min(65536,b.length-at));if(n<=0)throw Error('NATIVE_RAW_WRITE_RETURN');at+=n;}fs.fsyncSync(fd);}finally{fs.closeSync(fd);}};
function capture(p,cap=268435456){
 const a=fs.lstatSync(p,{bigint:true});if(!a.isFile()||a.nlink!==1n||fs.realpathSync.native(p)!==p)throw Error('NATIVE_LITERAL_REGULAR');
 const fd=fs.openSync(p,fs.constants.O_RDONLY|fs.constants.O_NOFOLLOW),pin=ident(a),digest=crypto.createHash('sha256');let n=0;
 try{if(JSON.stringify(ident(fs.fstatSync(fd,{bigint:true})))!==JSON.stringify(pin))throw Error('NATIVE_OPEN_DRIFT');
 const block=Buffer.alloc(65536);for(;;){const count=fs.readSync(fd,block,0,block.length,null);if(!count)break;n+=count;if(n>cap)throw Error('NATIVE_EOF_CAP');digest.update(block.subarray(0,count));}
 const sha=digest.digest('hex'),beforeByteBacking=path.join(root,'node-raw',sha);
 if(!fs.existsSync(beforeByteBacking)){
  rawBytes+=n;if(rawBytes>268435456)throw Error('NODE_RAW_HALF_COMBINED_BOUND');
  const out=fs.openSync(beforeByteBacking,fs.constants.O_WRONLY|fs.constants.O_CREAT|fs.constants.O_EXCL|fs.constants.O_NOFOLLOW,0o600);let at=0;
  try{for(;;){const count=fs.readSync(fd,block,0,block.length,at);if(!count)break;let written=0;while(written<count){const returned=fs.writeSync(out,block,written,count-written);if(returned<=0)throw Error('NATIVE_RAW_RETURN');written+=returned;}at+=count;if(at>n)throw Error('NATIVE_SECOND_READ_DRIFT');}if(at!==n)throw Error('NATIVE_SECOND_READ_SHORT');fs.fsyncSync(out);}finally{fs.closeSync(out);}
 }
 const rawfd=fs.openSync(beforeByteBacking,fs.constants.O_RDONLY|fs.constants.O_NOFOLLOW);let rawPin,rawHash=crypto.createHash('sha256'),rawCount=0;
 try{rawPin=ident(fs.fstatSync(rawfd,{bigint:true}));for(;;){const count=fs.readSync(rawfd,block,0,block.length,null);if(!count)break;rawCount+=count;if(rawCount>n)throw Error('RAW_EOF_BOUND');rawHash.update(block.subarray(0,count));}if(rawCount!==n||rawHash.digest('hex')!==sha||JSON.stringify(rawPin)!==JSON.stringify(ident(fs.fstatSync(rawfd,{bigint:true})))||JSON.stringify(rawPin)!==JSON.stringify(ident(fs.lstatSync(beforeByteBacking,{bigint:true}))))throw Error('RAW_FULL_EOF_NINE');}finally{fs.closeSync(rawfd);}
 const row={path:p,bytes:n,sha256:sha,PRE:pin,OPEN:pin,EOF:true,beforeByteBacking:{path:beforeByteBacking,bytes:n,sha256:sha,identity:rawPin,encoding:'RAW_EXACT_PREIMAGE'}};held.push({fd,row});fence({fd,row});return row;
 }catch(e){fs.closeSync(fd);throw e;}
}
function fence(h){const a=ident(fs.fstatSync(h.fd,{bigint:true})),b=ident(fs.lstatSync(h.row.path,{bigint:true}));if(JSON.stringify(a)!==JSON.stringify(h.row.PRE)||JSON.stringify(b)!==JSON.stringify(h.row.PRE))throw Error('NATIVE_CURRENT_ALL_NINE_DRIFT');h.row.POST=a;h.row.pathFINAL=b;}
function maps(){const raw=fs.readFileSync('/proc/self/maps');if(raw.length>1048576)throw Error('NATIVE_MAP_BOUND');const paths=[];for(const line of raw.toString().trim().split('\n')){const match=/^\S+\s+\S+\s+\S+\s+\S+\s+\S+\s+(.+)$/.exec(line);if(match?.[1].startsWith('/')){if(match[1].endsWith(' (deleted)'))throw Error('DELETED_NATIVE_MAP');paths.push(match[1]);}}return {rawHex:raw.toString('hex'),paths:[...new Set(paths)].sort()};}
try{
 if(process.platform!=='linux'||process.arch!=='x64'||process.version!=='v24.15.0'||process.getuid()!==0)throw Error('NATIVE_NODE_PLATFORM_VERSION_UID');
 if(process.env.NODE_PATH!==undefined)throw Error('NODE_PATH_ABSENT');
 const directory='/native-source/c7/candidate',names=fs.readdirSync(directory).sort();
 if(names.length!==81||names.some(n=>!n.endsWith('.mjs')&&!n.endsWith('.cjs')))throw Error('EXACT81_SOURCE_MEMBERSHIP');
 const allowed=new Set(names.map(n=>path.join(directory,n)));allowed.add('/native-source/c7/controls.mjs');
 for(const p of allowed)capture(p,1048576);capture('/native-source/native-node.mjs',1048576);capture('/native-source/node_contract.mjs',1048576);
 const before=maps();for(const p of before.paths)capture(p);
 const initial=fs.readFileSync('/proc/self/cmdline');
 if(!initial.equals(Buffer.from('/usr/local/bin/node\0--experimental-vm-modules\0/native-source/native-node.mjs\0')))throw Error('EXACT_NATIVE_NODE_KERNEL_ARGV');
 const literal=JSON.parse(fs.readFileSync('/native-source/c7-membership.json','utf8'));
 if(JSON.stringify(names)!==JSON.stringify(literal.names))throw Error('EXACT_DECLARED_C7_MEMBERSHIP');
 for(const h of held.filter(h=>allowed.has(h.row.path))){const declared=literal.files.find(r=>r.path===h.row.path);if(!declared||h.row.bytes!==declared.bytes||h.row.sha256!==declared.sha256)throw Error('ORIGINAL_SOURCE_BYTE_CONSERVATION');}
 // Every file load is resolved by the native loader and checked against the held
 // exact source set before defaultLoad returns executable code to the consumer.
 hook=registerHooks({load(url,context,nextLoad){let h;if(url.startsWith('file:')){const p=fileURLToPath(url);if(!allowed.has(p))throw Error('NATIVE_NONMEMBER_IMPORT');h=held.find(h=>h.row.path===p);fence(h);fullHeld(h.fd,h.row);loads.push({url,path:p,utcBeforeLoad:new Date().toISOString()});}else if(!url.startsWith('node:'))throw Error('NATIVE_NONFILE_NONBUILTIN_IMPORT');const value=nextLoad(url,context);if(h)fence(h);return value;}});
 await import('file:///native-source/c7/controls.mjs');
 const after=maps();if(JSON.stringify(after.paths)!==JSON.stringify(before.paths))throw Error('NATIVE_MAPPED_PATH_SET_DRIFT');
 for(const h of held)fence(h);
 if(!fs.readFileSync('/proc/self/cmdline').equals(initial))throw Error('NATIVE_KERNEL_ARGV_DRIFT');
 write(path.join(root,'native-node.json'),Buffer.from(JSON.stringify({scope:'NATIVE_PUBLIC_C7_OWN20_ONLY',
  platform:process.platform,arch:process.arch,version:process.version,uid:process.getuid(),pid:process.pid,
  rawArgvHex:initial.toString('hex'),mapsPRE:before,mapsPOST:after,sourceRows:held.map(h=>h.row),actualImports:loads,preHookImportedFiles:['/native-source/native-node.mjs','/native-source/node_contract.mjs'],
  original122:'HELD',whole120:'HELD',native8recipes:'HELD',ROOT:'ABSENT',functionalTask04:false})+'\n'));
}catch(e){primary=String(e);throw e;}finally{
 if(hook)hook.deregister();for(const h of held){try{fence(h);}catch(e){primary??=String(e);}try{const returned=fs.closeSync(h.fd);closes.push({fd:h.fd,closeReturn:returned,closed:true});}catch(e){closes.push({fd:h.fd,error:String(e)});primary??=String(e);}}
 write(path.join(root,'native-node-close.json'),Buffer.from(JSON.stringify({scope:'NATIVE_PUBLIC_C7_OWN20_FD_CLOSE',closes,primary,original122:'HELD',ROOT:'ABSENT'})+'\n'));
 if(primary)process.exitCode=1;
}
