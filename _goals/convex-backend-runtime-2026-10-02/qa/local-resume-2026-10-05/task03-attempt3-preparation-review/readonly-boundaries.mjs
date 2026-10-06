import assert from 'node:assert/strict';
import vm from 'node:vm';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as url from 'node:url';
import * as crypto from 'node:crypto';
import * as util from 'node:util';
const repo='/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion';
const q=path.resolve(repo,'_goals/convex-backend-runtime-2026-10-02/qa/task03-local-native-attempt3-2026-10-05');
const review=path.dirname(url.fileURLToPath(import.meta.url));
const mode=process.argv[2];
const privateRoot='/Users/SaintNick/.codex/tmp/cortex-runtime-task03-attempt3-private-20261005';
const overlays=new Map(),virtualWrites=[],dummyWrites=[],privateMetadataMocks=[];
const tmpPrefix=path.resolve(q,'tmp');
const inside=(p,b)=>typeof p==='string'&&(p===b||p.startsWith(b+path.sep));
function mapped(p){if(inside(p,tmpPrefix))return path.resolve(review,'tmp',path.relative(tmpPrefix,p));return p;}
function authorizeDummy(p){assert.ok(inside(p,path.resolve(review,'tmp')),`Unexpected filesystem write: ${p}`);dummyWrites.push(p);}
function safeRead(p){if(inside(p,privateRoot))throw Error('PRIVATE_READ_PROHIBITED');return mapped(p);}
const mockStat=(file=false)=>({uid:process.getuid(),gid:20,mode:(file?0o100600:0o40700),nlink:1,isFile:()=>file,isDirectory:()=>!file,isSymbolicLink:()=>false});
const boundary={...fs,
 readFileSync:(p,...args)=>{safeRead(p);return overlays.has(p)?Buffer.from(overlays.get(p)).toString(args[0]==='utf8'?'utf8':undefined):fs.readFileSync(mapped(p),...args);},
 lstatSync:(p,...args)=>{if(p===privateRoot||p===path.resolve(privateRoot,'jwt-private.pem')){privateMetadataMocks.push(p);return mockStat(p.endsWith('.pem'));}if(overlays.has(p))return mockStat(true);return fs.lstatSync(mapped(p),...args);},
 realpathSync:p=>{if(p===privateRoot||p===path.resolve(privateRoot,'jwt-private.pem')||overlays.has(p))return p;const real=fs.realpathSync(mapped(p));if(inside(p,tmpPrefix))return path.resolve(tmpPrefix,path.relative(path.resolve(review,'tmp'),real));return real;},
 readdirSync:(p,options)=>{const list=fs.readdirSync(mapped(p),options);for(const key of overlays.keys())if(path.dirname(key)===p&&!list.some(row=>(typeof row==='string'?row:row.name)===path.basename(key)))list.push(options?.withFileTypes?{name:path.basename(key),isDirectory:()=>false,isFile:()=>true,isSymbolicLink:()=>false}:path.basename(key));return list;},
 writeFileSync:(p,b,options)=>{if(inside(p,tmpPrefix)){const actual=mapped(p);authorizeDummy(actual);return fs.writeFileSync(actual,b,options);}if(p===path.resolve(q,'managed-fixture/fixture/convex/qualificationUnreviewed.ts')||p===path.resolve(q,'managed-fixture/fixture/convex/runtimeModelPolicyBootstrap.ts')){if(options?.flag==='wx')assert.ok(!fs.existsSync(p)&&!overlays.has(p));overlays.set(p,Buffer.from(b));virtualWrites.push({path:p,bytes:Buffer.byteLength(b)});return;}throw Error('CANDIDATE_WRITE_PROHIBITED');},
 mkdtempSync:(prefix,...args)=>{assert.ok(inside(prefix,tmpPrefix));const actual=fs.mkdtempSync(mapped(prefix),...args);authorizeDummy(actual);return path.resolve(tmpPrefix,path.relative(path.resolve(review,'tmp'),actual));},
 symlinkSync:(target,p,...args)=>{authorizeDummy(mapped(p));return fs.symlinkSync(mapped(target),mapped(p),...args);},
 linkSync:(target,p)=>{authorizeDummy(mapped(p));return fs.linkSync(mapped(target),mapped(p));},
 chmodSync:(p,...args)=>{authorizeDummy(mapped(p));return fs.chmodSync(mapped(p),...args);},
 rmSync:(p,...args)=>{if(overlays.has(p)){overlays.delete(p);return;}authorizeDummy(mapped(p));return fs.rmSync(mapped(p),...args);}
};
async function exactModule(file,imports,context){const source=fs.readFileSync(file,'utf8');const module=new vm.SourceTextModule(source,{context,identifier:file,initializeImportMeta(meta){meta.url=url.pathToFileURL(file).href;}});await module.link(name=>{assert.ok(Object.hasOwn(imports,name),`Unexpected import: ${name}`);const value=imports[name];return new vm.SyntheticModule(Object.keys(value),function(){for(const [key,v]of Object.entries(value))this.setExport(key,v);},{context});});await module.evaluate({timeout:30000});return module;}
const context=vm.createContext({process:{env:{},getuid:()=>process.getuid(),version:process.version,platform:process.platform},Buffer,console});
const guardFile=path.resolve(q,'scripts/guard.mjs');
const guard=await exactModule(guardFile,{'node:fs':boundary,'node:path':path,'node:url':url,'node:crypto':crypto,'node:util':util},context);
if(mode==='source-preflight'){const outcome=guard.namespace.sourcePreflight();assert.equal(outcome.frozen.files.length,965);assert.equal(privateMetadataMocks.length,0);assert.equal(virtualWrites.length,0);assert.equal(dummyWrites.length,0);console.log(JSON.stringify({scope:'ACTUAL_SOURCE_READ_ONLY_PREFLIGHT',status:'PASS',sourcePins:outcome.source.files.length,copyPins:outcome.copies.files.length,frozenPins:outcome.frozen.files.length,guardSha256:crypto.createHash('sha256').update(fs.readFileSync(guardFile)).digest('hex'),privateReads:0,privateMetadataReads:0,candidateWrites:0,serviceCalls:0}));}
else if(mode==='guard-controls'){
 await exactModule(path.resolve(q,'scripts/offline-guard-check.mjs'),{'node:assert/strict':{default:assert},'node:fs':boundary,'node:path':path,'./guard.mjs':guard.namespace},context);
 overlays.clear();guard.namespace.sourcePreflight();
 console.log(JSON.stringify({scope:'EXACT_GUARD_SCRIPT_WITH_EFFECT_BLOCKED_CANDIDATE_FS',status:'PASS',candidateWrites:0,virtualSourceTamperWrites:virtualWrites.length,privateReads:0,actualPrivateMetadataReads:0,mockedPrivateMetadataCalls:privateMetadataMocks.length,dummyWrites:dummyWrites.length,serviceCalls:0,boundary:'Candidate tamper branches are memory overlays; tmp writes map only to reviewer/tmp; private terminal metadata checks are simulated. No bytes or metadata from actual private directory were read.'}));
}
else if(mode==='actual-filesystem-controls'){
 const realFs={...fs,mkdtempSync:(prefix,...args)=>{assert.ok(inside(prefix,tmpPrefix));const root=fs.mkdtempSync(mapped(prefix),...args);authorizeDummy(root);return root;}};
 await exactModule(path.resolve(q,'attempt2-repair1/real-owned-custody-controls.mjs'),{'node:assert/strict':{default:assert},'node:vm':{default:vm},'node:fs':realFs,'node:path':path,'node:url':url,'node:crypto':crypto,'../scripts/guard.mjs':guard.namespace},context);
 assert.equal(privateMetadataMocks.length,0);assert.equal(virtualWrites.length,0);console.log(JSON.stringify({scope:'EXACT_ACTUAL_FILESYSTEM_CONTROL_WITH_OWNED_REVIEWER_TMP',status:'PASS',candidateWrites:0,actualPrivateReads:0,dummyRoots:dummyWrites.length,serviceCalls:0}));
}else throw Error('Unsupported review mode');
