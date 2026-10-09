/** Private16C payload fixtures; not a shipped module. Exact owned prefix only. */
import { ensureLifecycleState } from "../../../convex-dev/lib/referenceLifecycle";
import { internalMutation, internalAction, internalQuery } from '../../../convex-dev/_generated/server';
import { v, ConvexError } from 'convex/values';
const scope = v.union(v.object({kind:v.literal('tenantless')}),v.object({kind:v.literal('tenant'),tenantId:v.string()}));
export const upload = internalAction({args:{userId:v.string()},handler:async(ctx,a)=>{
 if(!a.userId.startsWith('task16c-'))throw new ConvexError('FIXTURE_OWNER_REQUIRED');
 const arrays=[new Uint8Array(70001),new Uint8Array([0,255,1,128,2]),new Uint8Array(0)];for(let i=0;i<arrays[0].length;i++)arrays[0][i]=i%256;
 const storageIds=[];for(const bytes of arrays)storageIds.push(await ctx.storage.store(new Blob([bytes],{type:'application/octet-stream'})));
 return {storageIds};
}});
export const seed=internalMutation({args:{userId:v.string(),scope,storageIds:v.array(v.id('_storage')),mode:v.union(v.literal('valid'),v.literal('badSize'),v.literal('badChecksum'))},handler:async(ctx,a)=>{
 if(!a.userId.startsWith('task16c-')||a.storageIds.length!==3)throw new ConvexError('FIXTURE_OWNER_REQUIRED');
 await ensureLifecycleState(ctx);
 const tenantId=a.scope.kind==='tenant'?a.scope.tenantId:undefined,now=Date.now(),memorySpaceId=a.userId+'-space';const ids:Record<string,{domain:string,id:string}>={};const save=(label:string,domain:string,id:string)=>ids[label]={domain,id};
 const profile=await ctx.db.insert('immutable',{tenantId,type:'user',id:a.userId,userId:a.userId,version:2,previousVersions:[{version:1,timestamp:now,data:{retained:'profile'}}],createdAt:now,updatedAt:now,data:{nested:{minusZero:-0,nan:NaN,infinity:Infinity,negativeInfinity:-Infinity,bytes:new Uint8Array([0,255,128]).buffer,minimum:-9223372036854775808n,maximum:9223372036854775807n,unicode:'é🧠'},metadataUrl:'http://127.0.0.1:1/never-fetch'}});save('profile','immutable',profile);
 const space=await ctx.db.insert('memorySpaces',{tenantId,memorySpaceId,type:'team',participants:[{type:'human',id:a.userId,joinedAt:now},{type:'human',id:'foreign',joinedAt:now}],metadata:{private:true},status:'active',createdAt:now,updatedAt:now});save('space','memorySpaces',space);
 const base={tenantId,memorySpaceId,userId:a.userId,createdAt:now,updatedAt:now};
 const refs=[];for(const storageId of a.storageIds){const meta=await ctx.db.system.get(storageId);if(!meta)throw new ConvexError('FIXTURE_STORAGE_REQUIRED');refs.push({storageId,size:meta.size,mimeType:'application/octet-stream',checksum:meta.sha256});}
 const attachment=await ctx.db.insert('attachments',{...base,attachmentId:a.userId+'-attachment',storageId:a.storageIds[0],type:'file',mimeType:'application/octet-stream',filename:'non-utf8.bin',size:refs[0].size+(a.mode==='badSize'?1:0),metadata:{url:'http://127.0.0.1:1/never-fetch'},createdAt:now,updatedAt:now});save('attachment','attachments',attachment);
 const artifact=await ctx.db.insert('artifacts',{...base,artifactId:a.userId+'-artifact',kind:'custom',title:'all retained binaries',fileRef:{...refs[0],checksum:a.mode==='badChecksum'?'0'.repeat(64):refs[0].checksum},tags:[],streamingState:'final',version:3,versionPointer:3,versionHistory:[{version:1,fileRef:refs[2],timestamp:now,changeType:'create'},{version:2,fileRef:refs[1],timestamp:now,changeType:'update'},{version:3,fileRef:refs[0],timestamp:now,changeType:'update'}],collaborators:[{type:'user',id:a.userId,role:'owner',addedAt:now}],isDeleted:true});save('artifact','artifacts',artifact);
 const conversation=await ctx.db.insert('conversations',{tenantId,memorySpaceId,conversationId:a.userId+'-conversation',type:'user-agent',participants:{userId:'foreign',userIds:['foreign',a.userId],agentId:'agent'},messages:[{id:'human',role:'user',content:'full foreign participant',timestamp:now,participantId:'foreign'},{id:'tool',role:'agent',content:'no attributed author',timestamp:now,metadata:{approval:true}},{id:'system',role:'system',content:'full system',timestamp:now}],messageCount:3,createdAt:now,updatedAt:now});save('conversation','conversations',conversation);
 const snapshot=await ctx.db.insert('conversationSnapshots',{tenantId,memorySpaceId,snapshotId:a.userId+'-snapshot',conversationId:a.userId+'-conversation',createdBy:a.userId,messages:[{id:'redacted',role:'system',content:'[redacted]',timestamp:now}],conversationType:'user-agent',participants:{userId:'foreign'},messageCount:1,includedContent:{messages:true,facts:true,memories:false},redaction:{piiRedacted:true},facts:[{factId:'saved',fact:'stored snapshot value',factType:'knowledge',confidence:90}],status:'deleted',createdAt:now,snapshotOf:now});save('snapshot','conversationSnapshots',snapshot);
 const memory=await ctx.db.insert('memories',{...base,memoryId:a.userId+'-memory',content:'current',contentType:'fact',sourceType:'system',sourceTimestamp:now,importance:90,tags:[],version:3,previousVersions:[{version:1,content:'original',timestamp:now},{version:2,content:'retained',timestamp:now}],accessCount:0});save('memory','memories',memory);
 return {userId:a.userId,scope:a.scope,mode:a.mode,ids,storageIds:a.storageIds};
}});

export const profile = internalQuery({args:{userId:v.string(),id:v.id("immutable")},handler:async(ctx,a)=>{
 if(!a.userId.startsWith("task16c-ci-"))throw new ConvexError("FIXTURE_OWNER_REQUIRED");
 const row=await ctx.db.get(a.id);if(!row||row.userId!==a.userId)throw new ConvexError("FIXTURE_OWNER_REQUIRED");return row;
}});
