/** Private disposable fixture; never shipped in the SDK. */
import {internalMutation as mutation} from "../../../convex-dev/_generated/server";
import {v} from "convex/values";
import {captureInsertedRow} from "../../../convex-dev/lib/referenceLifecycle";
const kind = v.union(v.literal("memories"), v.literal("facts"), v.literal("conversations"));
export const seed = mutation({args:{kind,tenantId:v.optional(v.string()),memorySpaceId:v.string(),prefix:v.string(),start:v.number(),count:v.number(),owner:v.optional(v.string()),participantId:v.optional(v.string()),sourceMemoryId:v.optional(v.string()),conversationId:v.optional(v.string()),embedding:v.optional(v.boolean()),raw:v.optional(v.boolean()),special:v.optional(v.boolean())},handler:async(ctx,a)=>{
 if(!Number.isInteger(a.count)||a.count<0||a.count>16)throw new Error("fixture batch");
 if(!a.memorySpaceId.startsWith("task22-ci-") || !/^(mem|fact|conv)-task22-ci-/.test(a.prefix))throw new Error("fixture ownership");
 const ids:string[]=[];
 for(let i=a.start;i<a.start+a.count;i++){
  const common={tenantId:a.tenantId,memorySpaceId:a.memorySpaceId,createdAt:1700000000000+i,updatedAt:1700000000000+i};
  const text=`comma, quote" newline\n雪 ${a.prefix}-${i}`;
  const metadata=a.special?{integer:9223372036854775807n,bytes:new Uint8Array([0,255]).buffer,nested:{unicode:"雪",finite:1.25}}:{fixture:a.prefix};
  if(a.kind==="memories"){
   const row={...common,memoryId:a.prefix+i,content:text,contentType:"raw" as const,sourceType:"system" as const,sourceTimestamp:1700000000000,importance:i%2?90:30,tags:i%2?["selected","shared"]:["other"],participantId:a.participantId,userId:a.owner,version:1,previousVersions:[],accessCount:0,lastAccessed:1700000000000+i,metadata,...a.conversationId?{conversationRef:{conversationId:a.conversationId,messageIds:["m1"]}}:{},...a.embedding?{embedding:Array.from({length:1536},(_,j)=>j===0?1:0)}:{}};
   ids.push(a.raw?await ctx.db.insert("memories",row):await captureInsertedRow(ctx,"memories",row));
  }else if(a.kind==="facts"){
   const row={...common,factId:a.prefix+i,fact:text,factType:"custom" as const,confidence:90,sourceType:"manual" as const,tags:["selected"],userId:a.owner,participantId:a.participantId,version:1,metadata,...a.sourceMemoryId?{sourceRef:{memoryId:a.sourceMemoryId,...a.conversationId?{conversationId:a.conversationId}:{}}}:{}};
   ids.push(a.raw?await ctx.db.insert("facts",row):await captureInsertedRow(ctx,"facts",row));
  }else{
   const row={...common,conversationId:a.prefix+i,type:"user-agent" as const,participantId:a.participantId,participants:{userId:a.owner??"owner",agentId:"assistant"},messages:[{id:"m1",role:"user" as const,content:text,timestamp:1700000000000},{id:"m2",role:"agent" as const,content:"last",timestamp:1700000000001}],messageCount:2,metadata};
   ids.push(a.raw?await ctx.db.insert("conversations",row):await captureInsertedRow(ctx,"conversations",row));
  }
 }
 return ids;
}});
