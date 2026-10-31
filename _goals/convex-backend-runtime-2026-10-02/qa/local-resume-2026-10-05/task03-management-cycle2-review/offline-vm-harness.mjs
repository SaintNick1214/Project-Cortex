// Fresh cycle2 exact-source management review. All helper effects are substituted in-memory.

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
await run('happy provision native validateTarget',{},s=>{
 assert(!s.error&&s.net.length===6,'provision success six calls');const t=JSON.parse(s.d.files.get(request.privateTargetReceipt).text);
 assert(t.requestSha256===requestDigest&&t.isolationVerified&&t.freshManagedProject&&t.kind==='cloud'&&t.deploymentType==='dev','verified request binding');
 const envText=s.d.files.get(request.privateEnvironmentFile).text,env=parseEnv(envText);assert(envText.split('\n').filter(Boolean).length===3&&Object.keys(env).length===3&&env.CONVEX_DEPLOY_KEY==='dev:'+deployment+'|FAKE_DEV_KEY_ONLY'&&env.CONVEX_DEPLOYMENT==='dev:'+deployment&&env.CONVEX_URL==='https://'+deployment+'.convex.cloud','exact3 roundtripped entries');
 assert(!s.logs.join('').includes('FAKE_DEV_KEY'),'no console credential');
});
await run('happy retire verified target',{operation:'retire',owned:{},target:{}},s=>{
 assert(!s.error&&s.deleted&&s.net.length===5&&s.preflight===0,'retire success5 no preflight');
 const t=JSON.parse(s.d.files.get(request.privateTargetReceipt).text),r=JSON.parse(s.d.files.get(path.resolve(qa,'task03-target-retirement.json')).text);
 assert(!t.active&&t.retired&&t.deleted&&t.preRetirementReceiptSha256,'retired state');
 assert(r.verificationHttpStatus===404&&r.productionMutations===0,'404 verified receipt');
});
await run('retire ownershiponly after source preflight failure',{operation:'retire',owned:{},preflightFail:true},s=>assert(!s.error&&s.deleted&&s.preflight===0&&!s.d.files.has(request.privateTargetReceipt),'partial failure still retires'));
for(const key of ['CONVEX_DEPLOY_KEY','CONVEX_DEPLOYMENT','CONVEX_URL','CONVEX_DEPLOYMENT_TOKEN','CONVEX_OVERRIDE_ACCESS_TOKEN','CONVEX_SELF_HOSTED_URL','CONVEX_SELF_HOSTED_ADMIN_KEY'])await run('selector '+key,{env:{[key]:'FAKE_SELECTOR'}},s=>{assert(s.error,'selector rejects');noEffects(s);});
for(const [key,value]of Object.entries({teamId:1,teamSlug:'foreign',teamName:'foreign',requiredDeploymentType:'prod',requiredKind:'local',sharedCiTarget:true,productionDeployment:true,maximumPaidCalls:1,retirementRequired:false,projectSlug:'bad',projectName:'bad',privateEnvironmentFile:'/wrong',privateTargetReceipt:'/wrong',operation:'bad',purpose:'bad'}))await run('request '+key,{request:{...request,[key]:value}},s=>{assert(s.error,'request rejects');noEffects(s);});
for(const [key,value]of Object.entries({verdict:'FAIL',independent:false,scope:'FULL_TASK03',managementSourceSha256:'0'.repeat(64),requestSha256:'0'.repeat(64)}))await run('review '+key,{review:{[key]:value}},s=>{assert(s.error,'review rejects');noEffects(s);});
await run('scratch mode',{setup(d){d.dirs.get(scratch).mode=0o40755;}},s=>{assert(s.error,'mode reject');noEffects(s);});
await run('scratch ancestor symlink',{setup(d){d.aliases.add('/Users/SaintNick/.codex');}},s=>{assert(s.error,'symlink reject');noEffects(s);});
await run('source preflight fail before effects',{preflightFail:true},s=>{assert(s.error&&s.preflight===1,'preflight rejects');noEffects(s);});
await run('uncertain create preserves fsynced attempt',{reply(e,n){if(n===2)throw Error('FAKE_UNKNOWN_CREATE');}},s=>{
 assert(s.error&&s.net.length===2,'uncertain failure');const p=path.resolve(scratch,'provision-attempt.json');
 assert(s.d.files.has(p)&&!s.d.files.has(path.resolve(scratch,'created-project.json')),'no guessed ownership');
 assert(s.d.events.some(e=>e.path===p&&e.event==='fsync'),'attempt fsynced');
});
await run('uncertain attempt blocks blind retry',{setup(d){d.put(path.resolve(scratch,'provision-attempt.json'),{});}},s=>{assert(s.error,'retry reject');noEffects(s);});
await run('invalid created URL retains ownership',{reply(e,n){if(n===2)return reply({...ownership(),deploymentUrl:'https://wrong'});}},s=>assert(s.error&&s.net.length===2&&s.d.files.has(path.resolve(scratch,'created-project.json')),'known exclusive response retained'));
for(const [name,n,delta]of [['project team',3,{teamId:1}],['deployment cloud',4,{kind:'local'}],['deployment dev',4,{deploymentType:'prod'}],['sole dev',5,{}]])await run(name,{reply(e,count){if(count!==n)return;return reply(n===3?{...project(),...delta}:n===4?{...deployed(),...delta}:[deployed(),{...deployed(),name:'second-dev-456'}]);}},s=>assert(s.error&&s.net.length===n&&s.d.files.has(path.resolve(scratch,'created-project.json')),'metadata guard before key retained ownership'));
await run('native validator empty dev suffix',{reply(e,n){if(n===6)return reply({deployKey:'dev:'+deployment+'|'});}},s=>assert(s.error&&s.net.length===6&&!s.d.files.has(request.privateEnvironmentFile),'native target key validation'));
await run('owned record hardlink',{operation:'retire',owned:{},setup(d){d.hardlinks.set(path.resolve(scratch,'created-project.json'),2);}},s=>{assert(s.error,'hardlink reject');noEffects(s);});
await run('ownership request mismatch',{operation:'retire',owned:{requestSha256:'0'.repeat(64)}},s=>{assert(s.error,'ownerbinding reject');noEffects(s);});
await run('current target ownership mismatch',{operation:'retire',owned:{},target:{projectId:992}},s=>{assert(s.error,'targetbinding reject');noEffects(s);});
await run('GET404 required retirement',{operation:'retire',owned:{},reply(e,n){if(n===5)return reply(project());}},s=>assert(s.error&&s.net.length===5&&s.deleted&&!s.d.files.has(path.resolve(qa,'task03-target-retirement.json')),'no false retiredreceipt'));
await run('180s deadline and30s call timeout',{advanceMs:60000},s=>assert(s.error&&s.net.length===3&&s.timeouts.every(n=>n>0&&n<=30000),'bounded dispatch'));
await run('7call ceiling exact api directprobe',{},async s=>{
 assert(!s.error,'initial success');await s.api('/projects/991');let e;try{await s.api('/projects/991');}catch(x){e=x;}
 assert(e?.message==='Management operation ceiling'&&s.net.length===7,'8th rejects beforefetch');
});

const noCredentialOutput=s=>{assert(!s.d.files.has(request.privateEnvironmentFile)&&!s.d.files.has(request.privateTargetReceipt),'no private target/environment write');assert(!s.logs.join('').includes('SECRET_SENTINEL'),'no private console content');};
await run('malformed key JSON private-safe failure',{reply(e,n){if(n===6)return {status:200,text:async()=> 'SECRET_SENTINEL_123'};},summary(s){return {privateDiagnosticSafe:!s.error?.message.includes('SECRET_SENTINEL')};}},s=>{assert(s.error?.message==='Management JSON rejected; private contents withheld','sanitized malformed key');noCredentialOutput(s);});
await run('newline key denied before envwrite',{reply(e,n){if(n===6)return reply({deployKey:'dev:'+deployment+'|FAKE_KEY\nCONVEX_SELF_HOSTED_ADMIN_KEY=FAKE_INJECTED_KEY'});}},s=>{assert(s.error?.message==='Development key mismatch','newline rejected');noCredentialOutput(s);});
await run('malformed account JSON private-safe before effects',{setup(d){d.put('/Users/SaintNick/.convex/config.json','SECRET_SENTINEL_123');}},s=>{assert(s.error?.message==='Management JSON rejected; private contents withheld','sanitized malformed config');noEffects(s);});
for(const token of [undefined,null,1,false,''])await run('account accessToken type '+String(token),{setup(d){d.put('/Users/SaintNick/.convex/config.json',{accessToken:token});}},s=>{assert(s.error?.message==='Configured Convex account authentication missing','token type rejects');noEffects(s);});
const prefix='dev:'+deployment+'|';
for(const code of [...Array.from({length:33},(_,i)=>i),127,0x2028,0x2029])await run('key control U+'+code.toString(16).padStart(4,'0'),{reply(e,n){if(n===6)return reply({deployKey:prefix+'KEY'+String.fromCodePoint(code)+'VALUE'});}},s=>{assert(s.error?.message==='Development key mismatch'&&s.net.length===6,'control rejected');noCredentialOutput(s);});
for(const value of [undefined,null,0,1,true,false,[],{},[prefix+'FAKE_KEY']])await run('key nonstring '+JSON.stringify(value),{reply(e,n){if(n===6)return reply({deployKey:value});}},s=>{assert(s.error?.message==='Development key mismatch'&&s.net.length===6,'nonstring rejected');noCredentialOutput(s);});
await run('key wrong production prefix',{reply(e,n){if(n===6)return reply({deployKey:'prod:'+deployment+'|FAKE_KEY'});}},s=>{assert(s.error?.message==='Development key mismatch','prod prefix rejected');noCredentialOutput(s);});
await run('key too long8193',{reply(e,n){if(n===6)return reply({deployKey:prefix+'X'.repeat(8193-prefix.length)});}},s=>{assert(s.error?.message==='Development key mismatch','length ceiling rejected');noCredentialOutput(s);});
await run('key boundary8192 exact3 roundtrip',{reply(e,n){if(n===6)return reply({deployKey:prefix+'X'.repeat(8192-prefix.length)});}},s=>{assert(!s.error&&s.net.length===6,'8192 accepted');const env=parseEnv(s.d.files.get(request.privateEnvironmentFile).text);assert(Object.keys(env).length===3&&env.CONVEX_DEPLOY_KEY.length===8192,'threeentries exact8192');});
for(const suffix of ['FAKE#COMMENT','FAKE"VALUE','FAKE\'VALUE'])await run('env parser loss case '+suffix,{reply(e,n){if(n===6)return reply({deployKey:prefix+suffix});}},s=>{const text=Object.entries({CONVEX_DEPLOY_KEY:prefix+suffix,CONVEX_DEPLOYMENT:'dev:'+deployment,CONVEX_URL:'https://'+deployment+'.convex.cloud'}).map(([k,v])=>k+'='+v+'\n').join('');const preserved=parseEnv(text).CONVEX_DEPLOY_KEY===prefix+suffix;if(!preserved){assert(s.error?.message==='Private environment roundtrip rejected','parse loss rejected');noCredentialOutput(s);}else assert(!s.error,'exact roundtrip accepted');});
await run('private response size ceiling',{reply(e,n){if(n===6)return {status:200,text:async()=> 'SECRET_SENTINEL'+ 'X'.repeat(2_000_001)};}},s=>{assert(s.error?.message==='Management response size rejected; private contents withheld','size fail sanitized');noCredentialOutput(s);});
await run('ownership durable before verification',{},s=>{assert(!s.error,'provision positive');const durable=s.d.events.findIndex(e=>e.event==='fsync'&&e.path===path.resolve(scratch,'created-project.json'));const getProject=s.d.events.findIndex(e=>e.event==='fetch'&&e.url.endsWith('/projects/991'));assert(durable>=0&&durable<getProject,'ownership fsync precedes live verify');});
const keyFailure=await run('postcreate key denial retains exclusive ownership',{reply(e,n){if(n===6)return reply({deployKey:prefix+'FAKE\rKEY'});}},s=>{assert(s.error&&s.d.files.has(path.resolve(scratch,'created-project.json')),'keyfailure ownership retained');noCredentialOutput(s);});
const copyPrivate=(prior,d)=>{for(const [p,f]of prior.d.files)if(p.startsWith(scratch+'/'))d.put(p,f.text,f.mode);};
await run('retire exact postcreate key failure despite sourcefailure',{operation:'retire',preflightFail:true,setup(d){copyPrivate(keyFailure,d);}},s=>assert(!s.error&&s.deleted&&s.net.length===5&&s.preflight===0,'owned keyfailure target physically retired'));
const targetWriteFailure=await run('postcreate targetsave diskfailure preserves ownership env',{setup(d){const original=d.fs.openSync;d.fs.openSync=(p,flags,mode)=>{if(p===request.privateTargetReceipt&&flags==='wx')throw Error('FAKE_DISK_FAILURE');return original(p,flags,mode);};}},s=>assert(s.error?.message==='FAKE_DISK_FAILURE'&&s.d.files.has(path.resolve(scratch,'created-project.json'))&&s.d.files.has(request.privateEnvironmentFile)&&!s.d.files.has(request.privateTargetReceipt),'partial artifact failure ownership retained'));
await run('retire exact partial envsave targetfailure',{operation:'retire',preflightFail:true,setup(d){copyPrivate(targetWriteFailure,d);}},s=>assert(!s.error&&s.deleted&&s.net.length===5&&s.preflight===0&&!s.d.files.has(request.privateTargetReceipt),'partial provisioning retired without fabricated target'));
console.log(JSON.stringify({runtime:process.version,scope:'TASK03_DISPOSABLE_TARGET_MANAGEMENT_ONLY',managementSourceSha256:digest,guardSourceSha256:hash(guardSource),requestSha256:requestDigest,caseCount:results.length,results,limitations:['All helper config/fs/fetch substituted in-memory; no actual credential read, network or helper disk mutation. Evidence files are written only outside VM by authorized reviewer persistence.','Exact helper source plus ephemeral export of api for one bound probe; real source never changed.','Exact guard validateTarget and native Node parseEnv execute; preparationReviewed injectable pass/fail represents reviewed prerequisite, not sourcePreflight certification.','This does not certify live API shape/availability, native foundation, or fullTask03.']},null,2));

