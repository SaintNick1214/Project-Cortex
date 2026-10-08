'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');const configPath=path.join(__dirname,'synthetic-bootstrap.json'),bytes=fs.readFileSync(configPath),config=JSON.parse(bytes);
if(config.kind!=='OWN_SYNTHETIC_FIXED'||config.original122!=='HELD'||Object.keys(config).some(k=>!['kind','original122','roots','readFiles','readDirectories','closure'].includes(k)))throw Error('QA_BRIDGE_BOOTSTRAP');
function sourceFence(){for(const row of config.closure){const s=fs.lstatSync(row.path);if(!s.isFile()||s.isSymbolicLink()||s.nlink!==1||fs.realpathSync(row.path)!==row.path)throw Error('QA_BRIDGE_SOURCE_BINDING');const b=fs.readFileSync(row.path);if(b.length!==row.bytes||crypto.createHash('sha256').update(b).digest('hex')!==row.sha256)throw Error('QA_BRIDGE_SOURCE_DRIFT');}}
sourceFence();const{install}=require('./bridge-preload.cjs');
// Fence closure uses immutable native reads captured BEFORE syncBuiltinESMExports; no recursion.
const raw={...fs};const fence=()=>{for(const row of config.closure){const s=raw.lstatSync(row.path);if(!s.isFile()||s.nlink!==1||raw.realpathSync(row.path)!==row.path)throw Error('QA_BRIDGE_SOURCE_BINDING');const b=raw.readFileSync(row.path);if(b.length!==row.bytes||crypto.createHash('sha256').update(b).digest('hex')!==row.sha256)throw Error('QA_BRIDGE_SOURCE_DRIFT');}};
const port=install({...config,effectFence:fence});globalThis.fetch=()=>{throw Error('QA_BRIDGE_NETWORK_HELD');};process.once('exit',()=>{try{port.closeOwned();}catch(e){process.exitCode=1;process.stderr.write('QA_BRIDGE_UNRESOLVED_CLOSE\n');}});
