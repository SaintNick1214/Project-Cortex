/** QA-only external HTTPS peer. No provider/token/real terminal receipt. */
import { internalMutation, internalQuery, httpAction } from "./_generated/server";
import { v } from "convex/values";
import { makeFunctionReference } from "convex/server";
const fixedRun="admission-68061eae2f544b359edc485d5b2ae889";
const fields = { run: v.string(), dispatchDigest: v.string() };
function valid(run: string, digest: string) {
  if (run!==fixedRun || !/^admission-[a-f0-9]{32}$/.test(run) || !/^[a-f0-9]{64}$/.test(digest)) throw new Error("QA_PEER_INVALID");
}
export const record = internalMutation({ args: fields, handler: async (ctx,args) => {
  valid(args.run,args.dispatchDigest);
  const rows = await ctx.db.query("qaAdmissionPeerEffects").withIndex("by_run_dispatch",q=>q.eq("run",args.run).eq("dispatchDigest",args.dispatchDigest)).take(2);
  if(rows.length>1) throw new Error("QA_PEER_AMBIGUOUS");
  const row=rows[0]; if(row) { if(row.requestCount>=8)throw new Error("QA_PEER_BUDGET");
    await ctx.db.patch("qaAdmissionPeerEffects",row._id,{requestCount:row.requestCount+1}); }
  else await ctx.db.insert("qaAdmissionPeerEffects",{...args,requestCount:1,effectCount:1,createdAt:Date.now()});
  return { requestCount: row ? row.requestCount+1 : 1, effectCount:1 };
} });
export const counter = internalQuery({ args:fields,handler:async(ctx,args)=>{
  valid(args.run,args.dispatchDigest);const rows=await ctx.db.query("qaAdmissionPeerEffects").withIndex("by_run_dispatch",q=>q.eq("run",args.run).eq("dispatchDigest",args.dispatchDigest)).take(2);
  if(rows.length>1)throw new Error("QA_PEER_AMBIGUOUS");return {requestCount:rows[0]?.requestCount??0,effectCount:rows[0]?.effectCount??0};
} });
function same(a:string,b:string) { let different=a.length^b.length; for(let i=0;i<128;i++)different|=(a.charCodeAt(i)||0)^(b.charCodeAt(i)||0);return different===0; }
export const effect = httpAction(async(ctx,request)=>{
  const denied=()=>new Response("denied",{status:403,headers:{"Content-Type":"text/plain","Cache-Control":"no-store"}});
  const secret=process.env.CORTEX_QA_TASK04_PEER_SECRET, supplied=request.headers.get("x-cortex-qa-peer")??"";
  if(!secret||secret.length<32||secret.length>128||supplied.length>128||!same(secret,supplied)||request.method!=="POST")return denied();
  if(Number(request.headers.get("content-length")??0)>2048)return denied();
  try {const reader=request.body?.getReader();if(!reader)return denied();let length=0;const chunks:Uint8Array[]=[];
    while(true){const {done,value}=await reader.read();if(done)break;length+=value.byteLength;if(length>2048){await reader.cancel();return denied();}chunks.push(value);}
    const all=new Uint8Array(length);let cursor=0;for(const chunk of chunks){all.set(chunk,cursor);cursor+=chunk.length;}
    const args:unknown=JSON.parse(new TextDecoder("utf-8",{fatal:true}).decode(all));
    if(!args||typeof args!=="object"||Array.isArray(args)||Object.keys(args).sort().join(",")!=="dispatchDigest,run")return denied();
    const object=args as Record<string,unknown>;if(typeof object.run!=="string"||typeof object.dispatchDigest!=="string")return denied();
    valid(object.run,object.dispatchDigest);
    const result=await ctx.runMutation(makeFunctionReference<"mutation",{run:string;dispatchDigest:string},{requestCount:number;effectCount:number}>("qualificationPeer:record"),{run:object.run,dispatchDigest:object.dispatchDigest});
    return new Response(JSON.stringify(result),{status:200,headers:{"Content-Type":"application/json","Cache-Control":"no-store"}});
  }catch{return denied();}
});
