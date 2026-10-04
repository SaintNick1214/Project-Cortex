import {actionGeneric,makeFunctionReference} from 'convex/server';
import {v} from 'convex/values';
import {convexGateway} from '@convex-dev/ai-sdk-provider';
import {BINDING,ACCOUNT_HASH,NATIVE_INSTALLATION_ENABLED,OWNER_RUN_ID,SOURCE_WINDOW} from './installed.ts';
import {REQUESTS} from './requests.ts';
import {STAGE_ISSUER_SOURCE_HASH,STAGE_VERIFIER_SOURCE_HASH,STAGE_KEY_ID} from './stage-pins.ts';
import type {Case,Data} from './contracts.ts';
import {canonical,parseCanonical,vector,digest,record,same,caseFor,fail,hash,count,binding,one,str} from './validate.ts';
import {root,sourceCurrent,type Action} from './store.ts';
import {type Context} from './proofs.ts';
import {observeGenerate,observeEmbed,observeStream,observeTranscript,nativeEvent,makeEvent,type Event,type Observed,type Transcript} from './observer.ts';
export const REFERENCES={reserve:makeFunctionReference<'mutation'>('guard:reserveCheckpoint'),enter:makeFunctionReference<'mutation'>('guard:enterPeer'),capture:makeFunctionReference<'mutation'>('guard:capture'),stop:makeFunctionReference<'mutation'>('guard:stop'),attach:makeFunctionReference<'mutation'>('guard:attach'),stage:makeFunctionReference<'mutation'>('lifecycle:stageAndTrigger'),trigger:makeFunctionReference<'query'>('lifecycle:inspectTrigger')};
export interface Driver {execute(c:Case,ctx:Context,signal:AbortSignal,onEvents:(events:Event[])=>Promise<boolean>):Promise<Observed>}
export class Ownership {
 pending=0;closed=false;timedOut=false;private tasks=new Set<Promise<unknown>>();readonly failures:unknown[]=[];
 readonly clock:()=>number;constructor(clock:()=>number=Date.now){this.clock=clock}
 track<T>(p:Promise<T>):Promise<T>{this.pending++;const task=p.finally(()=>{this.pending--;this.tasks.delete(task)});this.tasks.add(task);void task.catch(error=>{this.failures.push(error)});return task}
 async before<T>(p:Promise<T>,deadline:number):Promise<T>{let timer:ReturnType<typeof setTimeout>|undefined;try{if(this.clock()>=deadline)throw new Error('LOCAL_DEADLINE_UNKNOWN');return await Promise.race([p,new Promise<never>((_,reject)=>{timer=setTimeout(()=>{this.timedOut=true;reject(new Error('LOCAL_DEADLINE_UNKNOWN'))},Math.max(0,deadline-this.clock()))})])}finally{if(timer)clearTimeout(timer)}}
 async join():Promise<void>{await Promise.allSettled([...this.tasks]);}
 async cleanup(milliseconds:number){this.closed=true;try{await this.before(Promise.allSettled([...this.tasks]),this.clock()+milliseconds)}catch{}return {pending:this.pending,timedOut:this.timedOut}}
}
/** Supported modelId-only factory closure. No token lookup, custom fetch, high-level retry,
 * usage/providerOptions mutation, or private provider constructor occurs here. SDK gatewayFetch
 * obtains the action-local getServiceToken only during the invocation after current enter. */
export const OFFICIAL_DRIVER:Driver=Object.freeze({async execute(c:Case,ctx:Context,signal:AbortSignal,onEvents:(events:Event[])=>Promise<boolean>){const native=REQUESTS[c.scenarioId].native;if(c.method==='embed'){const model=convexGateway.embeddingModel(c.modelId);if(!('values'in native))fail('REQUEST_INTERFACE');return observeEmbed(ctx,await model.doEmbed({values:[...native.values],abortSignal:signal}))}if(!('prompt'in native))fail('REQUEST_INTERFACE');const params={maxOutputTokens:native.maxOutputTokens,prompt:native.prompt.map(m=>{if(m.role==='system')return {role:'system' as const,content:m.content};if(m.role==='user')return {role:'user' as const,content:m.content.map(p=>({...p}))};return {role:'assistant' as const,content:m.content.map(p=>({...p}))}}),abortSignal:signal};const model=convexGateway(c.modelId);if(c.method==='generate')return observeGenerate(ctx,await model.doGenerate(params));const events:Event[]=[];let ended:Transcript['ended']='reader-done';const stream=await model.doStream({...params,includeRawChunks:true}),reader=stream.stream.getReader(),readerOwner=new Ownership();let readerDone=false;try{while(true){const item=await readerOwner.before(readerOwner.track(reader.read()),ctx.originalDeadline);if(item.done){readerDone=true;break;}const event=await nativeEvent(events.length,item.value);if(events.length>=512)fail('STREAM_BOUND');canonical({version:1,method:'stream',events:[...events,event],ended:'reader-done'},180000);events.push(event);if(await onEvents(events)){ended='abort';break}}}catch(primaryError){readerOwner.failures.push(primaryError);ended=signal.aborted?'abort':'error';if(!signal.aborted){const marker=await makeEvent(events.length,'unsupported',{type:'malformed-or-unbounded-native-part'});try{canonical({version:1,method:'stream',events:[...events,marker],ended},180000);if(events.length>=512)fail('STREAM_BOUND');events.push(marker)}catch{events.length=0;events.push(await makeEvent(0,'unsupported',{type:'observation-bound-violation'}))}}}finally{if(!readerDone){const cancelling=readerOwner.track(Promise.resolve().then(()=>reader.cancel('EXPERIMENT_READER_CLOSED')));try{await readerOwner.before(cancelling,ctx.originalDeadline)}catch(error){readerOwner.failures.push(error)}}try{reader.releaseLock()}catch(error){readerOwner.failures.push(error)}}const observed=await observeStream(ctx,events,ended);return {...observed,readerOwnership:readerOwner}}});
export async function validateRequest(c:Case){const r=REQUESTS[c.scenarioId];same(await digest(canonical({method:c.method,modelId:c.modelId,params:r.native},180000)),c.normalizedNativeRequestHash);same(await digest(canonical(r.wireExpected,180000)),c.expectedWireBodyHash)}
export function buildRunner(driver:Driver|null,timing={entry:1000,native:15000,persistence:1000,cleanup:1000}){return async(ctx:Action,args:{scenarioId:string;ownerRunId:string})=>{record(args,'scenarioId ownerRunId');if(args.ownerRunId!==OWNER_RUN_ID)fail('FORBIDDEN');const c=caseFor(args.scenarioId),life=new Ownership(),abort=new AbortController(),entryDeadline=Date.now()+timing.entry;let ticket:Data|null=null,entered=false;const authority={...args,principalHash:BINDING.operatorHash};try{await life.before(life.track(root(ctx)),entryDeadline);if(!driver)fail('OFFICIAL_NATIVE_DRIVER_NOT_IMPLEMENTED');await life.before(life.track(validateRequest(c)),entryDeadline);ticket=record(await life.before(life.track(ctx.runMutation(REFERENCES.reserve,authority)),entryDeadline));if(ticket.dispatch!==true)return {status:String(ticket.status),dispatched:false,pending:life.pending};if(life.closed||Date.now()>=entryDeadline)fail('LOCAL_DEADLINE_UNKNOWN');const dispatchIdentity=String(ticket.dispatchIdentity);const fence=record(await life.before(life.track(ctx.runMutation(REFERENCES.enter,{...authority,dispatchIdentity})),entryDeadline));if(fence.enter!==true||life.closed||Date.now()>=entryDeadline)return {status:'fenced-unknown',dispatched:false,pending:life.pending};entered=true;const nativeDeadline=Date.now()+timing.native,persistDeadline=nativeDeadline+timing.persistence;const oc:Context={binding:BINDING,scenarioId:c.scenarioId,dispatchIdentity,enteredAt:Number(fence.enteredAt),now:Date.now(),originalDeadline:nativeDeadline,sourceClosureHash:BINDING.installedClosureHash};let triggerAttempted=false;
const onEvents=async(events:Event[])=>{
 if(driver!==OFFICIAL_DRIVER||!['C09','C10'].includes(c.scenarioId)||triggerAttempted||life.closed||abort.signal.aborted||Date.now()>=nativeDeadline)return false;
 const partial=await observeStream({...oc,now:Date.now()},events,'reader-done'),first=partial.eligible[0];
 if(!first||life.closed||abort.signal.aborted||Date.now()>=nativeDeadline)return false;
 triggerAttempted=true;const phaseStartedAt=Date.now(),stageDeadline=phaseStartedAt+1000;
 try {
  const preparing=life.track(prepareStage(c,oc,partial,phaseStartedAt));
  const prepared=await life.before(preparing,Math.min(stageDeadline,nativeDeadline));
  if(!prepared){life.closed=true;abort.abort();return false;}
  const stageArgs=prepared.args,submittedAt=prepared.submittedAt;let submitted=false;
  // All WebCrypto awaits, scalar/combined bounds and frozen arguments are complete.
  const finalAdmissionAt=Date.now();
  if(finalAdmissionAt<phaseStartedAt||finalAdmissionAt>=stageDeadline||finalAdmissionAt>=nativeDeadline||finalAdmissionAt<SOURCE_WINDOW.checkedAt||finalAdmissionAt>=SOURCE_WINDOW.expiresAt||submittedAt<phaseStartedAt||submittedAt>finalAdmissionAt||submitted||life.closed||abort.signal.aborted){life.closed=true;abort.abort();return false;}
  submitted=true;
  const firstRpc=ctx.runMutation(REFERENCES.stage,stageArgs);
  const stagePending=life.track(firstRpc);
  try {const staged=record(await life.before(stagePending,Math.min(stageDeadline,nativeDeadline)));return staged.kind==='triggered'||staged.kind==='replay';}
  catch {const inspectArgs={accountHash:ACCOUNT_HASH,dispatchIdentity};const inspectAt=Date.now();if(inspectAt>=stageDeadline||inspectAt>=nativeDeadline||life.closed||abort.signal.aborted){life.closed=true;abort.abort();return false;}
   const inspected=record(await life.before(life.track(ctx.runQuery(REFERENCES.trigger,inspectArgs)),Math.min(stageDeadline,nativeDeadline)));return inspected.kind==='recorded';}
 }catch{life.closed=true;abort.abort();return false;}
};
// Native closure called once, only after reserve/checkpoint plus immediate current enter.
const observed=life.track(Promise.resolve().then(()=>{if(life.closed||Date.now()>=nativeDeadline||!sourceCurrent(Date.now()))fail('LOCAL_DEADLINE_UNKNOWN');return driver.execute(c,oc,abort.signal,onEvents)}));const persisted=life.track(observed.then(async obs=>{if(obs.readerOwnership?.pending)void life.track(obs.readerOwnership.join());const contextCanonical=canonical({...oc,now:Date.now()},4096),captureArgs={scenarioId:c.scenarioId,dispatchIdentity,observationCanonical:canonical(obs.receipt,8192),contextCanonical,transcriptCanonical:obs.transcriptCanonical};let result:unknown;try{result=await ctx.runMutation(REFERENCES.capture,captureArgs)}catch(error){if(Date.now()>=persistDeadline)throw error;result=await ctx.runMutation(REFERENCES.capture,captureArgs)};if(!life.closed&&Date.now()<persistDeadline&&obs.receipt.reason==='none'&&obs.privateResultCanonical!==null){const attachment=record(await ctx.runMutation(REFERENCES.attach,{...authority,dispatchIdentity,privateResultCanonical:obs.privateResultCanonical}));if(attachment.attached===true&&['E11','E14'].includes(c.scenarioId)){const fence=record(await ctx.runQuery(makeFunctionReference<'query'>('managed:getFence'),{scenarioId:c.scenarioId,dispatchIdentity}),'fenceCanonical'),privateResult=record(parseCanonical(obs.privateResultCanonical,40177),'profile vector'),values=vector(privateResult.vector);const managedResult=c.scenarioId==='E11'?await ctx.runMutation(makeFunctionReference<'mutation'>('managed:writeE11'),{fenceCanonical:fence.fenceCanonical,vector:values,receiptHash:await digest(canonical(obs.receipt,8192))}):await ctx.runAction(makeFunctionReference<'action'>('managed:searchE14'),{fenceCanonical:fence.fenceCanonical,queryVector:values});if(record(managedResult).kind==='denied')await ctx.runMutation(REFERENCES.stop,{})}}return result}));await life.before(observed,nativeDeadline);await life.before(persisted,Math.min(persistDeadline,Date.now()+timing.persistence));return {status:'captured',dispatched:true,pending:life.pending};}catch(error){life.closed=true;abort.abort();if(ticket?.dispatch===true){const stopped=life.track(ctx.runMutation(REFERENCES.stop,{}));try{await life.before(stopped,Date.now()+timing.persistence)}catch{}}if(error instanceof Error&&error.message==='OFFICIAL_NATIVE_DRIVER_NOT_IMPLEMENTED')throw error;return {status:entered?'native-unknown':ticket?'checkpoint-unknown':'entry-denied',dispatched:entered,pending:life.pending};}finally{await life.cleanup(timing.cleanup)}}}
/** New fixture is uninstalled. Only ROOT-reviewed new source/operator capsule can enable native. */
export const run=actionGeneric({args:{scenarioId:v.string(),ownerRunId:v.string()},handler:buildRunner(NATIVE_INSTALLATION_ENABLED?OFFICIAL_DRIVER:null)});

// Uninstalled key custody. No getter/mint/config argument exists. DUMMY VM config is tests only.
const PRIVATE_STAGE_KEY_BYTES:Uint8Array|null=null;
const P_KEYS='domain version keyId accountHash targetHash manifestHash operatorHash installedClosureHash issuerSourceHash verifierSourceHash binding scenarioId dispatchIdentity nativeHash expectedWireHash observerTranscriptCanonical partSequence rawPartDigest stageCanonical stageHash phaseStartedAt phaseExpiresAt';
const S_KEYS='domain version nominationHash nominationMac submittedAt phaseExpiresAt';
const NOMINATION_DOMAIN='cortex.experiment.stage-nomination-seal.v1\n';
const SUBMISSION_DOMAIN='cortex.experiment.stage-submission-seal.v1\n';
const hexBytes=(value:string)=>Uint8Array.from(value.match(/../g)??[],part=>parseInt(part,16));
const hex=(bytes:ArrayBuffer)=>Array.from(new Uint8Array(bytes),v=>v.toString(16).padStart(2,'0')).join('');
async function stageKey(){return PRIVATE_STAGE_KEY_BYTES===null?null:await crypto.subtle.importKey('raw',new Uint8Array(PRIVATE_STAGE_KEY_BYTES),{name:'HMAC',hash:'SHA-256'},false,['sign','verify']);}
function capability(value:string){
 const cap=record(parseCanonical(value,193000),'version nominationCanonical nominationMac submissionCanonical submissionMac',193000);
 if(cap.version!==1)fail('CAPABILITY_VERSION');hash(cap.nominationMac);hash(cap.submissionMac);
 const p=record(parseCanonical(str(cap.nominationCanonical,190000),190000),P_KEYS,190000),s=record(parseCanonical(str(cap.submissionCanonical,4096),4096),S_KEYS,4096);
 const c=caseFor(p.scenarioId);one(p.scenarioId,['C09','C10']);
 const transcript=parseCanonical(str(p.observerTranscriptCanonical,180000),180000),stage=record(parseCanonical(str(p.stageCanonical,c.conditionalPrivateMaximumBytes),c.conditionalPrivateMaximumBytes),'text',c.conditionalPrivateMaximumBytes);
 // Replace encoded canonical leaves with decoded subtrees; count combined nodes/depth BEFORE retention/RPC.
 canonical({...cap,nominationCanonical:{...p,observerTranscriptCanonical:transcript,stageCanonical:stage},submissionCanonical:s},Number.MAX_SAFE_INTEGER);
 if(p.domain!=='cortex.experiment.stage-nomination.v1'||p.version!==1||s.domain!=='cortex.experiment.stage-submission.v1'||s.version!==1)fail('CAPABILITY_VERSION');
 for(const k of ['keyId','accountHash','targetHash','manifestHash','operatorHash','installedClosureHash','issuerSourceHash','verifierSourceHash','dispatchIdentity','nativeHash','expectedWireHash','rawPartDigest','stageHash'])hash(p[k]);
 for(const k of ['nominationHash','nominationMac'])hash(s[k]);binding(p.binding);same(p.binding,BINDING);
 same([p.keyId,p.accountHash,p.targetHash,p.manifestHash,p.operatorHash,p.installedClosureHash,p.issuerSourceHash,p.verifierSourceHash,p.nativeHash,p.expectedWireHash],[STAGE_KEY_ID,ACCOUNT_HASH,BINDING.targetHash,BINDING.manifestHash,BINDING.operatorHash,BINDING.installedClosureHash,STAGE_ISSUER_SOURCE_HASH,STAGE_VERIFIER_SOURCE_HASH,c.normalizedNativeRequestHash,c.expectedWireBodyHash]);
 count(p.partSequence,0,511);const started=count(p.phaseStartedAt),expires=count(p.phaseExpiresAt),submitted=count(s.submittedAt);count(s.phaseExpiresAt);
 if(expires!==started+1000||started<SOURCE_WINDOW.checkedAt||expires>SOURCE_WINDOW.expiresAt||submitted<started||submitted>=expires||s.phaseExpiresAt!==expires)fail('CAPABILITY_TIME');
 if(typeof stage.text!=='string'||!stage.text||!stage.text.isWellFormed())fail('CAPABILITY_TEXT');
 return {cap,p,s,stage,c};
}
async function prepareStage(c:Case,oc:Context,observed:Observed,phaseStartedAt:number){
 const key=await stageKey();if(!key)return null;const first=observed.eligible[0];if(!first)return null;
 const stageCanonical=canonical({text:first.text},c.conditionalPrivateMaximumBytes),stageHash=await digest(stageCanonical);
 const p={domain:'cortex.experiment.stage-nomination.v1',version:1,keyId:STAGE_KEY_ID,accountHash:ACCOUNT_HASH,targetHash:BINDING.targetHash,manifestHash:BINDING.manifestHash,operatorHash:BINDING.operatorHash,installedClosureHash:BINDING.installedClosureHash,issuerSourceHash:STAGE_ISSUER_SOURCE_HASH,verifierSourceHash:STAGE_VERIFIER_SOURCE_HASH,binding:BINDING,scenarioId:c.scenarioId,dispatchIdentity:oc.dispatchIdentity,nativeHash:c.normalizedNativeRequestHash,expectedWireHash:c.expectedWireBodyHash,observerTranscriptCanonical:observed.transcriptCanonical,partSequence:first.partSequence,rawPartDigest:first.rawPartDigest,stageCanonical,stageHash,phaseStartedAt,phaseExpiresAt:phaseStartedAt+1000};
 const nominationCanonical=canonical(p,190000),nominationMac=hex(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(NOMINATION_DOMAIN+nominationCanonical)));
 const s={domain:'cortex.experiment.stage-submission.v1',version:1,nominationHash:await digest(nominationCanonical),nominationMac,submittedAt:Date.now(),phaseExpiresAt:p.phaseExpiresAt};
 const submissionCanonical=canonical(s,4096),submissionMac=hex(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(SUBMISSION_DOMAIN+submissionCanonical)));
 const capabilityCanonical=canonical({version:1,nominationCanonical,nominationMac,submissionCanonical,submissionMac},193000);
 capability(capabilityCanonical);
 const args=Object.freeze({scenarioId:c.scenarioId,dispatchIdentity:oc.dispatchIdentity,binding:BINDING,stageCanonical,stageHash,partSequence:first.partSequence,rawPartDigest:first.rawPartDigest,capabilityCanonical});
 return {args,submittedAt:s.submittedAt};
}
/** Verification only: no callable/exported issuer, key getter or supplied key/proof choice. */
export async function verifyStageCapability(args:Data):Promise<boolean>{try{
 const value=capability(str(args.capabilityCanonical,193000));const {cap,p,s}=value;
 same([p.scenarioId,p.dispatchIdentity,p.binding,p.stageCanonical,p.stageHash,p.partSequence,p.rawPartDigest],[args.scenarioId,args.dispatchIdentity,args.binding,args.stageCanonical,args.stageHash,args.partSequence,args.rawPartDigest]);
 const key=await stageKey();if(!key)return false;
 if(!await crypto.subtle.verify('HMAC',key,hexBytes(String(cap.nominationMac)),new TextEncoder().encode(NOMINATION_DOMAIN+String(cap.nominationCanonical)))||!await crypto.subtle.verify('HMAC',key,hexBytes(String(cap.submissionMac)),new TextEncoder().encode(SUBMISSION_DOMAIN+String(cap.submissionCanonical))))return false;
 if(s.nominationHash!==await digest(String(cap.nominationCanonical))||s.nominationMac!==cap.nominationMac||p.stageHash!==await digest(String(p.stageCanonical)))return false;
 const context:Context={binding:BINDING,scenarioId:value.c.scenarioId,dispatchIdentity:String(p.dispatchIdentity),enteredAt:Number(p.phaseStartedAt),now:Number(p.phaseStartedAt),originalDeadline:Number(p.phaseExpiresAt),sourceClosureHash:BINDING.installedClosureHash};
 const backing=await observeTranscript(context,String(p.observerTranscriptCanonical));
 // Full original transcript canonical must match method/ending too, not reconstructed caller evidence.
 if(backing.transcriptCanonical!==p.observerTranscriptCanonical)return false;
 const first=backing.eligible[0];return !!first&&first.partSequence===p.partSequence&&first.rawPartDigest===p.rawPartDigest&&canonical({text:first.text},value.c.conditionalPrivateMaximumBytes)===p.stageCanonical;
 }catch{return false;}}
