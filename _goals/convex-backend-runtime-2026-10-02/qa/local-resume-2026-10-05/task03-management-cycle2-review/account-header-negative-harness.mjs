// Additional cycle2 confidentiality negatives: native Node Headers inside substituted fetch; no actual network.

import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {parseEnv} from 'node:util';
import * as path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
const root=process.cwd(),goal=path.resolve(root,'_goals/convex-backend-runtime-2026-10-02/qa');
const helperPath=path.resolve(goal,'local-resume-2026-10-05/task03-target-management.mjs');
const preparation=path.resolve(goal,'task03-local-current-delta-2026-10-05'),qa=path.dirname(helperPath),guardPath=path.resolve(preparation,'scripts/guard.mjs');
const helperSource=readFileSync(helperPath,'utf8'),guardSource=readFileSync(guardPath,'utf8'),request=JSON.parse(readFileSync(path.resolve(preparation,'project-request.json'),'utf8'));
const hash=x=>createHash('sha256').update(x).digest('hex'),digest=hash(helperSource),requestDigest=hash(JSON.stringify(request));
const scratch='/Users/SaintNick/.codex/tmp/cortex-runtime-task03-private-20261005',uid=501,now=Date.parse('2026-10-06T01:00:00Z'),deployment='new-disposable-123',projectId=991;
const results=[],assert=(x,m)=>{if(!x)throw Error('ASSERTION FAILED: '+m);};
const project=()=>({id:projectId,name:request.projectName,slug:request.projectSlug,teamId:325340});
const deployed=()=>({name:deployment,projectId,deploymentType:'dev',kind:'cloud',deploymentUrl:'https://'+deployment+'.convex.cloud'});
const ownership=()=>({operation:request.operation,requestSha256:requestDigest,id:projectId,slug:request.projectSlug,requestedName:request.projectName,deploymentName:deployment,createdAt:new Date(now).toISOString()});
const target=()=>({operation:request.operation,requestSha256:requestDigest,purpose:request.purpose,projectName:request.projectName,projectSlug:request.projectSlug,teamId:325340,projectId,deploymentName:deployment,deploymentUrl:'https://'+deployment+'.convex.cloud',kind:'cloud',deploymentType:'dev',createdAt:new Date(now).toISOString(),active:true,retired:false,deleted:false,isolationVerified:true,productionDeployment:false,sharedCiTarget:false,privateEnvironmentFile:request.privateEnvironmentFile,freshManagedProject:true});
function disk(){
 const files=new Map(),dirs=new Map(),aliases=new Set(),hardlinks=new Map(),fds=new Map(),events=[];let fdId=4;
 const dir=(p,mode=0o755)=>{for(let q=p;;q=path.dirname(q)){if(!dirs.has(q))dirs.set(q,{mode:0o040000|mode,uid});if(q==='/')break;}};
 const put=(p,value,mode=0o600)=>{dir(path.dirname(p));files.set(p,{text:typeof value==='string'?value:JSON.stringify(value),mode,uid});};
 [root,preparation,qa,scratch].forEach(p=>dir(p));dirs.get(scratch).mode=0o040700;
 const stat=p=>files.has(p)?{uid:files.get(p).uid,mode:0o100000|files.get(p).mode,nlink:hardlinks.get(p)??1,isFile:()=>true,isDirectory:()=>false,isSymbolicLink:()=>aliases.has(p)}:dirs.has(p)?{...dirs.get(p),nlink:1,isFile:()=>false,isDirectory:()=>true,isSymbolicLink:()=>aliases.has(p)}:undefined;
 const fs={
 lstatSync(p,o){const s=stat(String(p));if(!s&&o?.throwIfNoEntry!==false)throw Error('ENOENT fake');return s;},realpathSync:p=>String(p),
 readFileSync(p,e){p=String(p);events.push({event:'read',path:p});if(!files.has(p))throw Error('ENOENT fake');return e?files.get(p).text:Buffer.from(files.get(p).text);},
 openSync(p,flags,mode){p=String(p);if(flags==='wx'){if(files.has(p)||dirs.has(p))throw Error('EEXIST fake');if(!dirs.has(path.dirname(p)))throw Error('ENOENT parent fake');files.set(p,{text:'',mode,uid});}else if(flags==='r'&&!files.has(p)&&!dirs.has(p))throw Error('ENOENT fake');events.push({event:'open',path:p,flags,mode});const fd=fdId++;fds.set(fd,p);return fd;},
 writeFileSync(fd,b){const p=fds.get(fd);if(!p)throw Error('bad fd');files.get(p).text=String(b);events.push({event:'write',path:p});},fsyncSync(fd){if(!fds.has(fd))throw Error('bad fd');events.push({event:'fsync',path:fds.get(fd)});},closeSync:fd=>fds.delete(fd),
 renameSync(a,b){if(!files.has(a))throw Error('ENOENT fake');files.set(b,files.get(a));files.delete(a);events.push({event:'rename',path:b});},readdirSync(){throw Error('unapproved mocked read');}
 };return {files,dirs,aliases,hardlinks,fds,events,fs,put};
}
async function run(name,o={},check){
 const d=disk(),net=[],timeouts=[],logs=[];let clock=now,preflight=0,deleted=false;
 d.put(helperPath,helperSource,0o644);d.put(path.resolve(preparation,'project-request.json'),o.request??request,0o644);
 d.put(path.resolve(qa,'task03-management-review.json'),{verdict:'PASS',independent:true,scope:'TASK03_DISPOSABLE_TARGET_MANAGEMENT_ONLY',managementSourceSha256:digest,requestSha256:hash(JSON.stringify(o.request??request)),...o.review},0o644);
 d.put(path.resolve(preparation,'fresh-identity-public.json'),{generatedAt:'2026-10-05T00:00:00Z'},0o644);
 d.put('/Users/SaintNick/.convex/config.json',{accessToken:'FAKE_ACCESS_TOKEN_ONLY'});
 if(o.owned)d.put(path.resolve(scratch,'created-project.json'),{...ownership(),...o.owned});
 if(o.target)d.put(request.privateTargetReceipt,{...target(),...o.target});
 o.setup?.(d);
 class FakeDate extends Date{constructor(...a){super(...(a.length?a:[clock]));}static now(){return clock;}}
 const context=vm.createContext({Buffer,Date:FakeDate,process:{argv:['node',helperPath,o.operation??'provision'],env:o.env??{},getuid:()=>uid,version:'v24.15.0',platform:'darwin'},console:{log:(...a)=>logs.push(a.join(' ')),error:(...a)=>logs.push(a.join(' '))},AbortSignal:{timeout(ms){timeouts.push(ms);return {timeout:ms};}},fetch:async(url,opt)=>{
 if(o.nativeHeaderValidation)new Headers(opt.headers);
 const e={url,method:opt.method,body:opt.body};net.push(e);d.events.push({event:'fetch',url});clock+=o.advanceMs??0;
 const injected=await o.reply?.(e,net.length,d);if(injected!==undefined)return injected;
 let data,status=200;
 if(url.endsWith('/api/teams'))data=[{id:325340,slug:'nicholasgeil',name:'Cortex Memory'}];
 else if(url.endsWith('/create_project'))data={id:projectId,slug:request.projectSlug,deploymentName:deployment,deploymentUrl:'https://'+deployment+'.convex.cloud'};
 else if(url.endsWith('/create_deploy_key'))data={deployKey:'dev:'+deployment+'|FAKE_DEV_KEY_ONLY'};
 else if(url.endsWith('/list_deployments'))data=[deployed()];
 else if(url.endsWith('/delete')){deleted=true;data={};}
 else if(url.includes('/deployments/'))data=deployed();
 else if(url.includes('/projects/')){status=deleted?404:200;data=deleted?undefined:project();}
 else throw Error('unapproved mocked API');
 return {status,text:async()=>JSON.stringify(data)};
 }});
 const mods=new Map();
 async function synth(id,exports){if(mods.has(id))return mods.get(id);const m=new vm.SyntheticModule(Object.keys(exports),function(){for(const [k,v]of Object.entries(exports))this.setExport(k,v);},{context,identifier:id});mods.set(id,m);await m.link(()=>{throw Error('unapproved import');});await m.evaluate();return m;}
 async function link(spec){if(spec==='node:fs')return synth(spec,d.fs);if(spec==='node:crypto')return synth(spec,{createHash});if(spec==='node:path')return synth(spec,path);if(spec==='node:url')return synth(spec,{fileURLToPath});if(spec==='node:util')return synth(spec,{parseEnv});throw Error('unapproved import '+spec);}
 const guard=new vm.SourceTextModule(guardSource,{context,identifier:pathToFileURL(guardPath).href,initializeImportMeta(m){m.url=pathToFileURL(guardPath).href;}});await guard.link(link);await guard.evaluate();
 const adapter=await synth('review:guard',{preparation,scratch,validateTarget:guard.namespace.validateTarget,preparationReviewed(){preflight++;if(o.preflightFail)throw Error('FAKE_SOURCE_PREFLIGHT_REJECTION');}});
 const m=new vm.SourceTextModule(helperSource+'\nexport {api as __api};',{context,identifier:pathToFileURL(helperPath).href,initializeImportMeta(meta){meta.url=pathToFileURL(helperPath).href;}});await m.link(s=>s.endsWith('/scripts/guard.mjs')?adapter:link(s));
 let error;try{await m.evaluate();}catch(e){error=e;}
 const s={d,net,timeouts,logs,error,preflight,deleted,api:!error?m.namespace.__api:undefined};
 await check?.(s);assert(d.fds.size===0,'descriptors closed');
 results.push({name,status:'PASS',calls:net.length,timeouts,error:error?.message,...o.summary?.(s)});
 return s;
}
const noEffects=s=>assert(!s.net.length&&!s.d.events.some(e=>['open','write','rename'].includes(e.event)),'rejected before effects');
const reply=x=>({status:200,text:async()=>JSON.stringify(x)});

for(const [name,char]of [['CR','\r'],['LF','\n'],['NUL','\u0000']])await run('native account header '+name+' diagnostic reflection',{nativeHeaderValidation:true,setup(d){d.put('/Users/SaintNick/.convex/config.json',{accessToken:'SECRET_SENTINEL_123'+char+'SECOND_LINE'});},summary(s){return {diagnosticReflectsPrivateAccountValue:s.error?.message.includes('SECRET_SENTINEL_123'),noPlatformRequests:s.net.length===0};}},s=>{assert(s.error?.message.includes('SECRET_SENTINEL_123'),'native Headers error leaks account token');assert(s.net.length===0&&!s.d.events.some(e=>['open','write','rename'].includes(e.event)),'native validation before platform effect');});
console.log(JSON.stringify({runtime:process.version,scope:'TASK03_DISPOSABLE_TARGET_MANAGEMENT_ONLY',managementSourceSha256:digest,guardSourceSha256:hash(guardSource),requestSha256:requestDigest,caseCount:results.length,results,limitations:['All helper config/fs/fetch substituted in-memory; no actual credential read, network or helper disk mutation. Evidence files are written only outside VM by authorized reviewer persistence.','Exact helper source; inherited ephemeral api export is unused in these three probes. Real source never changed.','Exact guard validateTarget and native Node parseEnv execute; preparationReviewed injectable pass/fail represents reviewed prerequisite, not sourcePreflight certification.','This does not certify live API shape/availability, native foundation, or fullTask03.']},null,2));
