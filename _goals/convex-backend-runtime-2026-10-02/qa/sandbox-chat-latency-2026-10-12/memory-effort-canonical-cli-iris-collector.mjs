/** Genuine installed Basic CLI pair. Inert until Root authorizes this serialized window. */
import fs from 'node:fs/promises';
import {writeSync} from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {spawn,execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {performance} from 'node:perf_hooks';
import {fileURLToPath,pathToFileURL} from 'node:url';
const Q=path.dirname(fileURLToPath(import.meta.url)),R=path.resolve(Q,'../../../..'),P='/Users/SaintNick/Documents/Cortex/Project-Cortex-Proofs';
import {parsePins,readReady,pendingMetadata,readReviewedSource,KIT} from './memory-effort-canonical-native-pins.mjs';
const PROFILE='cortex-text-small-1536-v1';
const hash=bytes=>createHash('sha256').update(bytes).digest('hex'),readJson=async p=>JSON.parse(await fs.readFile(p,'utf8'));
const inputs=[{effort:'normal',memoryOmitted:true,text:'My favorite flower is iris. Acknowledge it in one brief sentence.'},{effort:'normal',memoryOmitted:true,text:'What is my favorite flower?'}];
const args=process.argv.slice(2),mode=args.shift()??'--local-preflight';assert(['--local-preflight','--run'].includes(mode));
if(mode==='--local-preflight'){
 assert.equal(args.length,0);assert.equal(process.version,'v24.15.0');
 console.log(JSON.stringify({...pendingMetadata(),turns:inputs,originalDeadlineMs:30000,source:'installed Basic npm start; one persistent CLI transport',goVariable:'CORTEX_MEMORY_EFFORT_CANONICAL_CLI_IRIS_GO=1',financeReceiptVariable:'CORTEX_MEMORY_EFFORT_CANONICAL_CLI_FINANCE_RECEIPT',minimumHeadroom:1300000,dockerCalls:0}));process.exit(0);
}
const pins=parsePins(args);assert(!pins.localPreflight);
assert.equal(process.env.CORTEX_MEMORY_EFFORT_CANONICAL_CLI_IRIS_GO,'1','Explicit Root serialized CLI GO required before READY/session/service/private read');
assert.equal(process.version,'v24.15.0');assert.equal(process.env.HOME,'/Users/SaintNick');
const SESSION=pins.sessionId,SOURCE=pins.sourceCommit,IMAGE=pins.imageId,READY=pins.readyPath,TRACE=pins.tracePath;
const ready=await readReady(pins),trace=await readJson(TRACE);
assert.equal(trace.sessionId,SESSION);assert.equal(trace.sourceCommit,SOURCE);assert.equal(trace.imageId,IMAGE);assert.equal(trace.enabled,true);assert.equal(trace.readback,1);assert.equal(trace.directGetExit,0);assert.equal(trace.measuredTurnsBeforeEnable,0);
const financePath=process.env.CORTEX_MEMORY_EFFORT_CANONICAL_CLI_FINANCE_RECEIPT;assert(financePath&&path.dirname(financePath)===Q&&/^memory-effort-canonical-finance-before-[0-9]+\.json$/.test(path.basename(financePath)));const finance=await readJson(financePath);assert.equal(finance.status,'QUIET_EXACT_FINANCE_VERIFIED');assert.equal(finance.sessionId,SESSION);assert.equal(finance.sourceCommit,SOURCE);assert.equal(finance.imageId,IMAGE);assert.equal(finance.targetId,pins.targetId);assert.equal(finance.clientsClosed,true);assert.equal(finance.stableAcrossCollection,true);assert(finance.finance.remainingUnits>=1300000);assert(Date.now()>=finance.finishedAt&&Date.now()-finance.finishedAt<=120000,'Fresh quiet headroom required');await run();

async function run(){
 const startedAt=new Date().toISOString(),stamp=Date.now(),prefix=path.join(Q,'memory-effort-canonical-cli-iris-'+stamp);
 const out={version:1,status:'RUNNING',startedAt,sessionId:SESSION,sourceCommit:SOURCE,imageId:IMAGE,paidRetries:0,resubmissions:0,originalDeadlineMs:30000,turns:[],maximumFreshIntents:2,readinessSamples:[],profile:null,readiness:null,guards:[],clientsClosed:false,canonicalNativeVerification:'PENDING Root native readback',resourceCleanupOwner:'Root',callbackCoverage:'Unchanged installed Basic process.stdout.write callback acknowledgement only; no SDK callback.begin/end brackets exist or are fabricated; no installed-source patching or monkey-patching.'};
 let child,closed,exitResult,stdout='',stderr='',logBytes=0,stdoutFd,stderrFd,chunksFd,exitRequested=false,failure;
 const guard=label=>out.guards.push(label),execute=promisify(execFile);
 const save=async()=>fs.writeFile(prefix+'.json',JSON.stringify(out,null,2)+'\n');
 const command=async(args,options={})=>execute('/Applications/Docker.app/Contents/Resources/bin/docker',args,{encoding:'utf8',timeout:30000,maxBuffer:4*1024*1024,...options});
 try{
  // No session, management credential, Docker or live read occurs above this GO boundary.
  out.currentGuard='module-import';const {loadSession,createContext}=await import(pathToFileURL(path.join(P,'sandbox-env/runner.mjs'))),{verifyCloud}=await import(pathToFileURL(path.join(P,'sandbox-env/cloud.mjs')));
  out.currentGuard='exact-live-session';const session=await loadSession(P,SESSION);assert.equal(session.phase,'READY');assert.equal(session.launcherPid,ready.launcherPid);assert.equal(session.ownerUid,process.getuid());assert.equal(session.ownerGid,process.getgid());assert.equal(session.launcherHost,os.hostname());process.kill(ready.launcherPid,0);
  assert.equal(session.runDir,path.join(P,'.sandbox-env-runs',SESSION));assert.equal(session.backendDir,path.join(session.runDir,'host'));
  for(const key of ['id','name','kind','teamId','projectId','reference','deploymentType','isDefault','expiresAt','deploymentUrl','disposable'])assert.equal(session.target[key],ready.target[key]);
  for(const key of ['id','name','imageId'])assert.equal(session.container[key],ready.container[key]);
  out.currentGuard='readonly-context';const originalSession=JSON.stringify(session),scope=prefix+'-checks';await fs.mkdir(scope,{mode:0o700});const ctx=await createContext({...session,runDir:scope,receiptDir:scope},{logger:()=>{}});ctx.persist=async()=>assert.equal(JSON.stringify(session),originalSession,'Read-only verification changed session');const fetch_=ctx.fetch;ctx.fetch=(url,options={})=>{assert.equal((options.method??'GET').toUpperCase(),'GET');return fetch_(url,options);};
  out.currentGuard='fresh-management-target';const target=await verifyCloud(session,ctx);for(const key of ['id','name','teamId','projectId','reference','expiresAt','isDefault'])assert.equal(target[key],ready.target[key]);guard('fresh exact READY launcher and management deployment verified once');
  out.currentGuard='owned-container';const inspected=JSON.parse((await command(['container','inspect',session.container.id])).stdout)[0];
  assert.equal(inspected.Id,ready.container.id);assert.equal(inspected.Image,IMAGE);assert.equal(inspected.Name,'/'+ready.container.name);assert.equal(inspected.State.Running,true);assert.equal(inspected.State.Paused,false);assert.equal(inspected.State.OOMKilled,false);assert.equal(inspected.Config.Labels['dev.cortex.disposable-sandbox'],SESSION);assert.equal(inspected.Config.Labels['dev.cortex.disposable-sandbox.root'],session.runDir);guard('exact running owned Docker image and labels verified once');
  out.currentGuard='artifact-provenance';const artifactBytes=await fs.readFile(path.join(KIT,'image/archives/manifest.json')),artifact=JSON.parse(artifactBytes),sdk=artifact.packages.find(p=>p.role==='sdk'),cliArchive=artifact.packages.find(p=>p.role==='cli');assert.equal(artifact.sourceCommit,SOURCE);assert.equal(sdk.version,'0.39.0');assert.equal(sdk.sha256,'6aee999b1d993670a15add3ca3f38a54534583c3fa837bf2834b598a8fb30f8c');assert.equal(cliArchive.version,'0.39.0');assert.equal(cliArchive.sha256,'847367abe21d000cd34b3bb59f1d7aadaacfbd8fdc3b36baf85baba822345f8b');const proposal=(await readJson(path.join(Q,'memory-effort-canonical-package-integration-proposal.json'))).next;assert.equal(proposal.sourceCommit,SOURCE);assert.equal(proposal.kit,KIT);assert.equal(proposal.imageId,IMAGE);assert.equal(hash(artifactBytes),proposal.artifactManifestSha256);for(const archive of [sdk,cliArchive]){const expected=proposal.packages.find(value=>value.role===archive.role);assert(expected);assert.equal(expected.sha256,archive.sha256);assert.equal(expected.filename,archive.filename);assert.equal(hash(await fs.readFile(path.join(KIT,'image/archives',archive.filename))),archive.sha256);}
  assert.equal((await fs.readFile(path.join(KIT,'image-id.txt'),'utf8')).trim(),IMAGE);
  const prepared=await readJson(path.join(session.receiptDir,'host-prepared.json'));assert.equal(prepared.sourceCommit,SOURCE);
  const runtime=await readJson(path.join(session.backendDir,'manual-runtime.json'));assert.equal(runtime.inputSelectionVersion,2);assert.equal(runtime.memoryEffortPolicyVersion,1);
  out.currentGuard='independent-reviewed-source';const sourceManifest=await readReviewedSource(pins);assert.equal(proposal.sourceReview.path,pins.reviewPath);assert.equal(proposal.sourceReview.sha256,pins.reviewSha256);assert.equal(hash(await fs.readFile(proposal.sourceReview.path)),pins.reviewSha256);
  for(const [file,expected]of Object.entries(sourceManifest.sourceHashes)){const bytes=(await execute('git',['show',SOURCE+':'+file],{cwd:R,encoding:'buffer',timeout:30000,maxBuffer:12*1024*1024})).stdout;assert.equal(hash(bytes),expected);}
  out.currentGuard='genuine-installed-basic';const guardCode=`import fs from 'node:fs';import path from 'node:path';import{createHash}from'node:crypto';import{createRequire}from'node:module';const r=createRequire('/work/basic/package.json'),sha=p=>createHash('sha256').update(fs.readFileSync(p)).digest('hex'),pkg=JSON.parse(fs.readFileSync('package.json')),base=path.dirname(r.resolve('@cortexmemory/sdk/runtime'));console.log(JSON.stringify({version:pkg.version,start:pkg.scripts.start,sdkVersion:JSON.parse(fs.readFileSync(path.resolve(base,'../../package.json'))).version,sdkRuntimeSha256:sha(path.join(base,'index.js')),files:Object.fromEntries(['src/index.ts','src/chat.ts','src/cortex.ts','src/memory-effort.ts'].map(p=>[p,sha(p)])),deploymentUrl:process.env.CONVEX_URL??process.env.NEXT_PUBLIC_CONVEX_URL,agentId:process.env.AGENT_ID,agentVersion:Number(process.env.AGENT_VERSION??'1'),timeoutMs:Number(process.env.RUNTIME_TIMEOUT_MS??'30000')}));`;
  const installed=JSON.parse((await command(['exec','--workdir','/work/basic',session.container.name,'node','--env-file-if-exists=.env.local','--input-type=module','-e',guardCode])).stdout);
  assert.equal(installed.version,'1.5.0');assert.equal(installed.sdkVersion,'0.39.0');assert.equal(installed.start,'node --env-file-if-exists=.env.local --import tsx src/index.ts');assert.equal(installed.deploymentUrl,ready.target.deploymentUrl);assert.equal(installed.agentId,runtime.agentId);assert.equal(installed.agentVersion,runtime.agentVersion);assert.equal(installed.timeoutMs,30000);
  const catalog=JSON.parse((await execute('git',['show',SOURCE+':packages/cortex-templates/catalog.json'],{cwd:R,encoding:'utf8',timeout:30000,maxBuffer:4*1024*1024})).stdout),basic=catalog.templates.find(t=>t.id==='basic'&&t.version==='1.5.0');
  for(const [file,digest]of Object.entries(installed.files))assert.equal(digest,basic.files.find(f=>f.path===file).hash);
  const sdkRuntime=(await execute('/usr/bin/tar',['-xOf',path.join(KIT,'image/archives',sdk.filename),'package/dist/client-runtime/index.js'],{encoding:'buffer',timeout:30000,maxBuffer:16*1024*1024})).stdout;assert.equal(installed.sdkRuntimeSha256,hash(sdkRuntime));
  out.install={artifactSha256:hash(artifactBytes),sdkArchiveSha256:sdk.sha256,cliArchiveSha256:cliArchive.sha256,reviewedSourceFiles:Object.keys(sourceManifest.sourceHashes).length,installed};guard('fresh accepted SDK archive and actual installed Basic source/default30000ms timeout verified once');
  guard('backend latency trace was enabled/read back1 before measured turns');out.readyMetadataSha256=hash(await fs.readFile(READY));out.traceMetadataSha256=hash(await fs.readFile(TRACE));
  stdoutFd=await fs.open(prefix+'-stdout.log','wx');stderrFd=await fs.open(prefix+'-stderr.log','wx');chunksFd=await fs.open(prefix+'-chunks.jsonl','wx');
  const args=['exec','--interactive','--workdir','/work/basic','--env','CORTEX_RUNTIME_LATENCY_TRACE=1',session.container.name,'npm','start'];
  out.command=['/Applications/Docker.app/Contents/Resources/bin/docker',...args];out.processStartAt=new Date().toISOString();const processStarted=performance.now();
  child=spawn('/Applications/Docker.app/Contents/Resources/bin/docker',args,{stdio:['pipe','pipe','pipe']});
  child.stdin.on('error',error=>{if(error.code!=='EPIPE')failure={code:error.code??'STDIN_ERROR'};});
  const receive=(stream,fd)=>bytes=>{logBytes+=bytes.length;if(logBytes>2*1024*1024){failure={code:'OUTPUT_BOUND'};return;}if(stream==='stdout')stdout+=bytes.toString();else stderr+=bytes.toString();writeSync(fd.fd,bytes);writeSync(chunksFd.fd,JSON.stringify({stream,atMs:performance.now()-processStarted,text:bytes.toString()})+'\n');};
  child.stdout.on('data',receive('stdout',stdoutFd));child.stderr.on('data',receive('stderr',stderrFd));
  closed=new Promise(resolve=>{child.once('error',error=>{failure={code:error.code??'SPAWN_ERROR'};});child.once('close',(exitCode,signal)=>{exitResult={exitCode,signal,endedAt:new Date().toISOString(),source:'Direct docker child close event; no pipeline or tee'};resolve(exitResult);});});
  async function bounded(promise,ms){let timer;try{return await Promise.race([promise,new Promise((_,reject)=>timer=setTimeout(()=>reject(Object.assign(Error('EXIT_DEADLINE'),{code:'EXIT_DEADLINE'})),ms))]);}finally{clearTimeout(timer);}}
  async function waitFor(predicate,ms){const start=performance.now();while(!predicate()){if(failure)throw Object.assign(Error(failure.code),{code:failure.code});if(exitResult)throw Object.assign(Error('EARLY_CHILD_EXIT'),{code:'EARLY_CHILD_EXIT'});if(performance.now()-start>ms)throw Object.assign(Error('COLLECTOR_DEADLINE'),{code:'COLLECTOR_DEADLINE'});await new Promise(resolve=>setTimeout(resolve,25));}}
  const events=text=>text.split(/\r?\n/).flatMap(line=>{const start=line.indexOf('{');if(start<0)return[];try{return[JSON.parse(line.slice(start))];}catch{return[];}});
  async function step(line,label,complete,ms=35000){out.lastStep=label;const offsets={stdout:stdout.length,stderr:stderr.length},began=performance.now();child.stdin.write(line+'\n');await waitFor(()=>{const output=stdout.slice(offsets.stdout),errors=stderr.slice(offsets.stderr);if(/Command failed:/.test(errors))throw Object.assign(Error('CLI_COMMAND_FAILED'),{code:'CLI_COMMAND_FAILED'});return complete(output,errors);},ms);return{label,stdout:stdout.slice(offsets.stdout),stderr:stderr.slice(offsets.stderr),hostElapsedMs:performance.now()-began};}
  await waitFor(()=>stdout.includes('You: '),15000);
  async function canonical(label,input){
   const result=await step('/history',label,text=>text.endsWith('You: '));const page=events(result.stdout).find(value=>Array.isArray(value.page));assert(page&&page.isDone===true&&page.continueCursor===null);
   const users=page.page.filter(row=>row.role==='user');assert.equal(users.length,1);assert.equal(users[0].parts.filter(part=>part.type==='text').map(part=>part.text).join('\n'),input.text);
   const replies=page.page.filter(row=>row.role==='assistant'&&row.status==='success').flatMap(row=>row.parts.filter(part=>part.type==='text').map(part=>part.text));assert(replies.join('\n').trim().length>0,'Missing genuine canonical model reply');
   return {page,userMessageId:users[0].id,answer:replies.join('\n')};
  }
  async function indexed(label){
   const started=performance.now();let cutoff;
   while(performance.now()-started<30000){
    const result=await step('/readiness',label,text=>text.endsWith('You: '),Math.max(1,Math.min(35000,30000-(performance.now()-started))));
    const value=events(result.stdout).find(row=>row.version===1&&row.profile?.profileId===PROFILE&&row.stages?.facts&&row.stages?.vectors);assert(value,'Missing ordinary public readiness');
    if(cutoff===undefined)cutoff=value.cutoff;assert.equal(value.cutoff,cutoff,'Scoped cutoff changed in the quiet CLI window');
    out.readinessSamples.push({label,elapsedMs:performance.now()-started,value});await save();
    const facts=value.stages.facts,vectors=value.stages.vectors;
    if(facts.hole?.state==='failed'||vectors.hole?.state==='failed')throw Object.assign(Error('Actual indexing hole retained'),{code:'INDEXING_FAILED'});
    if(facts.complete&&vectors.complete&&facts.hole===null&&vectors.hole===null){out.readiness=value;return value;}
    await new Promise(resolve=>setTimeout(resolve,250));
   }
   throw Object.assign(Error('No paid replay or normalization after indexing deadline'),{code:'INDEXING_DEADLINE'});
  }
  async function completeMemory(label,runId){
   const started=performance.now();
   while(performance.now()-started<30000){
    const result=await step('/observe',label,text=>text.endsWith('You: '),Math.max(1,Math.min(35000,30000-(performance.now()-started))));const match=/Run (run:[a-f0-9]{64}): (\w+); memory (\w+); graph (\w+)/.exec(result.stdout);assert(match);assert.equal(match[1],runId);assert.equal(match[2],'complete');
    if(match[3]==='failed')throw Object.assign(Error('Actual ordinary memory failure retained'),{code:'RUN_MEMORY_FAILED'});
    if(match[3]==='complete')return {runId,responseStatus:match[2],memoryStatus:match[3],graphStatus:match[4],readOnlyRedisplayNotNewGeneration:true,hostElapsedMs:result.hostElapsedMs};
    await new Promise(resolve=>setTimeout(resolve,250));
   }
   throw Object.assign(Error('Ordinary memory-complete projection deadline'),{code:'MEMORY_COMPLETION_DEADLINE'});
  }
  const normal=await step('/effort show','show-default-normal',text=>text.includes('Memory effort: normal.')&&text.endsWith('You: '),5000);out.defaultNormalShown=true;
  const initialNew=await step('/new','initial-new-conversation',text=>text.includes('Next send starts a new conversation.')&&text.endsWith('You: '),5000);out.initialNewConversationCommand={confirmed:true,stdout:initialNew.stdout,hostElapsedMs:initialNew.hostElapsedMs};
  for(const [index,input]of inputs.entries()){
   if(index===1){const selected=await step('/new','new-conversation',text=>text.includes('Next send starts a new conversation.')&&text.endsWith('You: '),5000);out.newConversationCommand={confirmed:true,stdout:selected.stdout,hostElapsedMs:selected.hostElapsedMs};}
   const turn=await step(input.text,index===0?'first-normal-seed':'warm-normal-new-conversation',(text,errors)=>/Run run:[a-f0-9]{64}: (?:complete|failed|cancelled|waiting_approval); memory/.test(text)&&text.endsWith('You: '));
   const terminal=/Run (run:[a-f0-9]{64}): (\w+); memory (\w+); graph (\w+)/.exec(turn.stdout),request=/Request ID: ([a-f0-9-]{36})/.exec(turn.stdout),effort=events(turn.stdout).find(event=>event.type==='cortex-memory-effort'),cli=events(turn.stderr).filter(event=>event.type==='cortex-cli-latency'),begin=cli.find(event=>event.phase==='submit.begin'),first=cli.find(event=>event.phase==='answer.first_printed');
   const sample={...input,requestId:request?.[1],runId:terminal?.[1],responseStatus:terminal?.[2],memoryStatusAtPrint:terminal?.[3],graphStatus:terminal?.[4],memoryEffort:effort,firstStdout:first,submit:begin,hostElapsedMs:turn.hostElapsedMs,clientEvents:events(turn.stderr).filter(event=>event.type==='cortex-client-latency'),timingTargetMs:6000,timingPass:first?.durationMs<=6000};out.turns.push(sample);await save();
   assert(request&&terminal);assert.equal(terminal[2],'complete');assert(begin&&first,'Missing actual first printed-answer diagnostic');assert.equal(begin.commandId,first.commandId);assert(first.atMs>=begin.atMs&&first.durationMs>=0);assert(Math.abs(first.atMs-begin.atMs-first.durationMs)<0.1);assert.equal(effort.requestedEffort,'normal');assert.equal(effort.effectiveEffort,'normal');assert.equal(effort.maxDepth,4);assert.equal(effort.maxEntries,8);assert.equal(effort.maxContextTokens,32768);
   sample.canonical=await canonical(index===0?'seed-history':'warm-history',input);sample.functionalPass=index===0?true:/iris/i.test(sample.canonical.answer);await save();
   sample.indexedReadiness=await indexed(index===0?'seed-indexed-readiness':'warm-indexed-readiness');sample.ordinaryMemory=await completeMemory(index===0?'seed-memory-complete':'warm-memory-complete',sample.runId);await save();
   if(index===1){assert.notEqual(sample.canonical.userMessageId,out.turns[0].canonical.userMessageId);assert(!sample.canonical.page.page.some(row=>row.id===out.turns[0].canonical.userMessageId));assert(sample.functionalPass,'Warm canonical answer omitted iris');}
  }
  assert.equal(out.turns.length,2);assert.notEqual(out.turns[0].requestId,out.turns[1].requestId);assert.notEqual(out.turns[0].runId,out.turns[1].runId);
  {const result=await step('/profile','profile',text=>text.endsWith('You: '));const value=events(result.stdout).find(event=>event.profile?.profileId===PROFILE);assert(value);out.profile=value;}
  child.stdin.write('/exit\n');exitRequested=true;await bounded(closed,10000);assert.equal(exitResult.exitCode,0);assert.equal(exitResult.signal,null);
  out.clientsClosed=true;out.observerCloseEvidence='Both watches reached canonical terminal output; verified installed watch finally releases subscriptions; /exit executes closeRuntimeConnection and direct Docker child closed naturally0.';
  out.status=out.turns.every(turn=>turn.timingPass)?'CLI_PAIR_FUNCTIONAL_AND_NORMAL_TIMING_PASS':'CLI_PAIR_FUNCTIONAL_PASS_NORMAL_TIMING_MISS';out.exit=exitResult;out.timingDefinition='CLI monotonic submit.begin to first nonblank answer stdout-write acknowledgement, independent of host chunk/transaction clocks.';
 }catch(error){failure={code:typeof error?.code==='string'?error.code:'ASSERTION_OR_GUARD_FAILED',name:error?.name??'Error',guard:out.currentGuard,location:String(error?.stack??'').split('\n').filter(line=>line.trim().startsWith('at ')&&line.includes('memory-effort-canonical-cli-iris-collector.mjs')).map(line=>line.trim()).slice(0,2),messageSha256:hash(String(error?.message??error))};out.status='FAIL';out.failure=failure;process.exitCode=1;
 }finally{
  if(child&&!exitResult){if(!exitRequested){child.stdin.write('/exit\n');exitRequested=true;}await Promise.race([closed,new Promise(resolve=>setTimeout(resolve,5000).unref())]);if(!exitResult){child.kill('SIGINT');await Promise.race([closed,new Promise(resolve=>setTimeout(resolve,5000).unref())]);}}
  out.clientsClosed=!child||(exitRequested&&exitResult?.exitCode===0&&exitResult?.signal===null);out.clientCloseEvidence=child?'Exact installed main finally closes its connection; /exit requested and direct child exit retained.':'No Basic client process allocated';
  out.exit=exitResult??null;out.exitRequested=exitRequested;out.endedAt=new Date().toISOString();
  for(const fd of [stdoutFd,stderrFd,chunksFd])if(fd)await fd.close();
  out.logs=[];for(const suffix of ['-stdout.log','-stderr.log','-chunks.jsonl']){try{const bytes=await fs.readFile(prefix+suffix);out.logs.push({path:prefix+suffix,bytes:bytes.length,sha256:hash(bytes)});}catch{}}
  await save();console.log(JSON.stringify({status:out.status,receipt:prefix+'.json',runs:out.turns.map(t=>({runId:t.runId,requestId:t.requestId,effort:t.effort,firstStdoutMs:t.firstStdout?.durationMs})),exit:out.exit,paidRetries:0,resourceCleanupOwner:'Root'}));
 }
}
