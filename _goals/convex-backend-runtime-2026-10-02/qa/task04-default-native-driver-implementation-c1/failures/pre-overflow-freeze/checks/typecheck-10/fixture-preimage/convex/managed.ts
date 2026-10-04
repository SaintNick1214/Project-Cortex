import {internalMutationGeneric,internalQueryGeneric,internalActionGeneric,makeFunctionReference} from 'convex/server';
import {v,type GenericId} from 'convex/values';
import {BINDING,ACCOUNT_HASH,SCOPE} from './installed.ts';
import {PROFILE} from './cases.ts';
import type {Account,Data} from './contracts.ts';
import {load,root,installation,resources,liveResources,ownFields,strip,type Read} from './store.ts';
import {record,parseCanonical,canonical,digest,same,hash,id,count,vector,fail,list} from './validate.ts';
import {scopeProfileHash,vectorRow} from './repository-codec.ts';
function denied(error:unknown){const code=error instanceof Error?error.message:'';return {kind:'denied',reason:code==='SCOPE'||code==='WRONG_OWNER'?'scope':code==='COLLISION'?'collision':code==='CLOSED'||code==='NOT_PROVISIONED'||code==='NOT_INSTALLED'?'closed':'stale'}}
export const provisionOwned=internalMutationGeneric({args:{},handler:async ctx=>{
 await root(ctx);await load(ctx);const old=await ctx.db.query('fixtureInstallation').withIndex('by_account',q=>q.eq('accountHash',ACCOUNT_HASH)).unique();if(old){await resources(ctx,await installation(ctx));return {created:false}}
 const grantId=await ctx.db.insert('fixtureGrants',{...ownFields,...SCOPE,grantHash:BINDING.grantHash,epoch:BINDING.grantEpoch,active:true,profileHash:BINDING.profileHash});
 const sourceId=await ctx.db.insert('fixtureSources',{...ownFields,...SCOPE,sourceKey:BINDING.sourceRecordHash,sourceHash:BINDING.sourceRecordHash,revision:BINDING.sourceRevision,epoch:BINDING.sourceEpoch,profileHash:BINDING.profileHash,tombstone:false});
 const chunkId=await ctx.db.insert('fixtureChunks',{...ownFields,...SCOPE,sourceId,chunkKey:BINDING.sourceRecordHash,sourceRevision:BINDING.sourceRevision,sourceHash:BINDING.sourceRecordHash,profileHash:BINDING.profileHash,textHash:BINDING.sourceRecordHash,tombstone:false});
 await ctx.db.insert('fixtureInstallation',{...ownFields,...SCOPE,grantId,sourceId,chunkId});return {created:true}
}});
export async function checkFence(ctx:Read,text:string,s:Account){
 const f=record(parseCanonical(text,4096),'binding tenantHash spaceHash ownerHash grantId sourceId chunkId sourceHash sourceRevision chunkTextHash profileHash dispatchIdentity');same(f.binding,BINDING);
 for(const [key,val]of Object.entries(SCOPE)){hash(f[key]);if(f[key]!==val)fail('SCOPE')}
 hash(f.dispatchIdentity);hash(f.sourceHash);hash(f.chunkTextHash);same(f.profileHash,BINDING.profileHash);count(f.sourceRevision,1);
 const r=await liveResources(ctx,s);same([f.grantId,f.sourceId,f.chunkId,f.sourceHash,f.sourceRevision,f.chunkTextHash],[r.o.grantId,r.o.sourceId,r.o.chunkId,r.source.sourceHash,r.source.revision,r.chunk.textHash]);return {f,...r}
}
function qualified(s:Account,dispatchIdentity:unknown,scenario:string){const a=s.attempts.find(a=>a.scenarioId===scenario&&a.dispatchIdentity===dispatchIdentity);if(!a||a.state!=='terminal'||a.known===null||!a.facts||a.facts.money!=='validated-whole-invocation-usd'||a.facts.serving!=='validated-bound-premises'||a.facts.usage!=='validated-raw-mapped'||a.attachment==='closed')fail('CLOSED');return a}
async function resultVectorHash(values:number[]){return digest(canonical({profile:PROFILE,vector:values},40177))}
export const writeE11=internalMutationGeneric({args:{fenceCanonical:v.string(),vector:v.array(v.number()),receiptHash:v.string()},handler:async(ctx,args)=>{let writing=false;try{
 record(args,'fenceCanonical vector receiptHash');await root(ctx);const {s}=await load(ctx);const r=await checkFence(ctx,args.fenceCanonical,s),a=qualified(s,r.f.dispatchIdentity,'E11'),values=vector(args.vector);hash(args.receiptHash);
 if(args.receiptHash!==await digest(a.firstCapture!)||await resultVectorHash(values)!==a.facts!.resultHash)fail('COLLISION');
 const vectorHash=await digest(canonical({domain:'cortex.experiment.vector.v1',version:1,profileHash:BINDING.profileHash,vector:values},60000));
 const writeKey=await digest(canonical({binding:BINDING,dispatchIdentity:a.dispatchIdentity,sourceId:r.o.sourceId,sourceRevision:r.source.revision,sourceHash:r.source.sourceHash,chunkId:r.o.chunkId,chunkTextHash:r.chunk.textHash,profileHash:BINDING.profileHash}));
 const all=await ctx.db.query('fixtureVectors').take(2);if(all.length>1)fail('COLLISION');
 const old=await ctx.db.query('fixtureVectors').withIndex('by_write',q=>q.eq('writeKey',writeKey)).unique();if(all.length&&!old)fail('COLLISION');
 if(old){try{const d=await vectorRow(strip(old));same([d.tenantHash,d.spaceHash,d.ownerHash,d.dispatchIdentity,d.receiptHash,d.vector,d.sourceId,d.chunkId,d.sourceRevision,d.sourceHash,d.profileHash,d.tombstone],[SCOPE.tenantHash,SCOPE.spaceHash,SCOPE.ownerHash,a.dispatchIdentity,args.receiptHash,values,r.o.sourceId,r.o.chunkId,r.source.revision,r.source.sourceHash,BINDING.profileHash,false])}catch{fail('COLLISION')}return {kind:'replay',vectorId:old._id,vectorHash}}
 const tupleHash=await scopeProfileHash({...SCOPE,profileHash:BINDING.profileHash});writing=true;
 const vectorId=await ctx.db.insert('fixtureVectors',{...ownFields,...SCOPE,sourceId:r.o.sourceId,chunkId:r.o.chunkId,sourceRevision:count(r.source.revision,1),sourceHash:String(r.source.sourceHash),profileHash:BINDING.profileHash,scopeProfileHash:tupleHash,vector:values,receiptHash:args.receiptHash,dispatchIdentity:a.dispatchIdentity,writeKey,tombstone:false});return {kind:'written',vectorId,vectorHash}
 }catch(error){if(writing)throw error;return denied(error)}}});
export const preflight=internalQueryGeneric({args:{fenceCanonical:v.string()},handler:async(ctx,args)=>{try{
 record(args,'fenceCanonical');await root(ctx);const {s}=await load(ctx),r=await checkFence(ctx,args.fenceCanonical,s);qualified(s,r.f.dispatchIdentity,'E14');return {kind:'current',fenceCanonical:args.fenceCanonical,scopeProfileHash:await scopeProfileHash({...SCOPE,profileHash:BINDING.profileHash}),snapshotHash:await digest(canonical({grantEpoch:r.grant.epoch,sourceEpoch:r.source.epoch,sourceRevision:r.source.revision,sourceHash:r.source.sourceHash,profileHash:BINDING.profileHash}))}
 }catch(error){return denied(error)}}});
export const hydrate=internalQueryGeneric({args:{fenceCanonical:v.string(),snapshotHash:v.string(),candidates:v.array(v.object({id:v.id('fixtureVectors'),score:v.number()}))},handler:async(ctx,args)=>{try{
 record(args,'fenceCanonical snapshotHash candidates');await root(ctx);const {s}=await load(ctx),r=await checkFence(ctx,args.fenceCanonical,s);qualified(s,r.f.dispatchIdentity,'E14');hash(args.snapshotHash);same(args.snapshotHash,await digest(canonical({grantEpoch:r.grant.epoch,sourceEpoch:r.source.epoch,sourceRevision:r.source.revision,sourceHash:r.source.sourceHash,profileHash:BINDING.profileHash})));
 const matches:Data[]=[];for(const item of list(args.candidates,1)){const p=record(item,'id score');id(p.id);if(typeof p.score!=='number'||!Number.isFinite(p.score)||Object.is(p.score,-0))fail('SCORE');const row=await ctx.db.get(p.id as GenericId<string>);if(!row)continue;
 try{const d=await vectorRow(strip(row));same([d.tenantHash,d.spaceHash,d.ownerHash,d.sourceId,d.chunkId,d.sourceRevision,d.sourceHash,d.profileHash,d.tombstone],[SCOPE.tenantHash,SCOPE.spaceHash,SCOPE.ownerHash,r.o.sourceId,r.o.chunkId,r.source.revision,r.source.sourceHash,BINDING.profileHash,false]);const storage=qualified(s,d.dispatchIdentity,'E11');if(d.receiptHash!==await digest(storage.firstCapture!)||await resultVectorHash(vector(d.vector))!==storage.facts!.resultHash)continue}catch{continue}
 matches.push({sourceKey:r.source.sourceKey,sourceRevision:r.source.revision,sourceHash:r.source.sourceHash,profileHash:BINDING.profileHash,score:p.score})}return {kind:'current',matches}
 }catch(error){return denied(error)}}});
export const searchE14=internalActionGeneric({args:{fenceCanonical:v.string(),queryVector:v.array(v.number())},handler:async(ctx,args)=>{try{
 record(args,'fenceCanonical queryVector');await root(ctx);const query=vector(args.queryVector);const pre=record(await ctx.runQuery(makeFunctionReference<'query'>('managed:preflight'),{fenceCanonical:args.fenceCanonical}));if(pre.kind!=='current')return pre;
 const {s}=await ctx.runQuery(makeFunctionReference<'query'>('managed:queryAuthorization'),{fenceCanonical:args.fenceCanonical}) as {s:Data};same(s.resultHash,await resultVectorHash(query));
 const result=await ctx.vectorSearch('fixtureVectors','by_default_embedding_v1',{vector:query,limit:1,filter:q=>q.eq('scopeProfileHash',String(pre.scopeProfileHash))});
 const hydrated=record(await ctx.runQuery(makeFunctionReference<'query'>('managed:hydrate'),{fenceCanonical:args.fenceCanonical,snapshotHash:pre.snapshotHash,candidates:result.map(x=>({id:x._id,score:x._score}))}));if(hydrated.kind!=='current')return hydrated;
 const current=record(await ctx.runQuery(makeFunctionReference<'query'>('managed:preflight'),{fenceCanonical:args.fenceCanonical}));if(current.kind!=='current'||current.snapshotHash!==pre.snapshotHash)return {kind:'denied',reason:'stale'};return hydrated
 }catch(error){return denied(error)}}});
export const queryAuthorization=internalQueryGeneric({args:{fenceCanonical:v.string()},handler:async(ctx,args)=>{await root(ctx);record(args,'fenceCanonical');const {s}=await load(ctx),r=await checkFence(ctx,args.fenceCanonical,s),a=qualified(s,r.f.dispatchIdentity,'E14');return {s:{resultHash:a.facts!.resultHash}}}});
export const readOwned=internalQueryGeneric({args:{fenceCanonical:v.string(),vectorId:v.id('fixtureVectors')},handler:async(ctx,args)=>{try{
 record(args,'fenceCanonical vectorId');await root(ctx);const {s}=await load(ctx),r=await checkFence(ctx,args.fenceCanonical,s),row=await ctx.db.get(args.vectorId);if(!row)fail('MISSING_VECTOR');const d=await vectorRow(strip(row));same([d.tenantHash,d.spaceHash,d.ownerHash,d.sourceId,d.chunkId,d.sourceHash,d.sourceRevision,d.profileHash,d.tombstone],[SCOPE.tenantHash,SCOPE.spaceHash,SCOPE.ownerHash,r.o.sourceId,r.o.chunkId,r.source.sourceHash,r.source.revision,BINDING.profileHash,false]);const a=qualified(s,d.dispatchIdentity,'E11');same(d.receiptHash,await digest(a.firstCapture!));same(await resultVectorHash(vector(d.vector)),a.facts!.resultHash);return {kind:'current',sourceHash:r.source.sourceHash,sourceRevision:r.source.revision,vectorHash:await digest(canonical({domain:'cortex.experiment.vector.v1',version:1,profileHash:BINDING.profileHash,vector:d.vector},60000))}
 }catch(error){return denied(error)}}});
