import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";
const r=process.cwd(),j=path.join(r,"_goals/convex-backend-runtime-2026-10-02/qa/local-resume-2026-10-05/task07-product-independent-review1");
const sourcePath=path.join(r,"convex-dev/runtimeAgent.ts");
const source=fs.readFileSync(path.join(j,"validator-boundary-preimage1.ts.txt"),"utf8");
await build({entryPoints:[sourcePath],outfile:path.join(j,"validator-boundary-preimage1.mjs"),bundle:true,platform:"node",format:"esm",packages:"external",logLevel:"silent",plugins:[{name:"captured-author-preimage",setup(b){b.onLoad({filter:/runtimeAgent\.ts$/},async a=>a.path===sourcePath?{contents:source,loader:"ts",resolveDir:path.dirname(sourcePath)}:undefined)}}]});
const runtime=await import(pathToFileURL(path.join(j,"validator-boundary-preimage1.mjs")));
const base={reference:{tenantId:"t",tenantEpoch:1,memorySpaceId:"s",memorySpaceEpoch:1,principalId:"p",principalVersion:1,membershipId:"m",membershipVersion:1,grantId:"g",grantVersion:1},runId:"r",attemptNumber:1,leaseVersion:1};
const model={...base,ordinal:0};const tool={...model,call:{toolCallId:"tc",toolName:"memory_recall",inputCanonical:'{"limit":1,"text":"x"}'}};
const checks=[];
for(const [kind,args,action] of [["model",model,(c,a)=>runtime.modelStepHandler(c,a)],["tool",tool,(c,a)=>runtime.toolStep._handler(c,a)]]){
 let reads=0;
 const ctx={runQuery:async (_ref,wire)=>{reads++;const shape=JSON.parse(runtime.hydrateExecution.exportArgs());const fields=Object.keys(shape.value);const extras=Object.keys(wire).filter(k=>!fields.includes(k));checks.push({kind,callee:"hydrateExecution",fields,actualKeys:Object.keys(wire),extras});if(extras.length)throw new Error("UNKNOWN_REGISTERED_FIELDS:"+extras.join(","));throw new Error("POSITIVE_SHAPE_NO_HANDLER_EFFECT");}};
 try{await action(ctx,args);checks.push({kind,unexpectedSuccess:true});}catch(e){checks.push({kind,denial:String(e.message),reads});}
}
const shape=JSON.parse(runtime.hydrateExecution.exportArgs());
const exactProjection=Object.fromEntries(Object.keys(shape.value).map(k=>[k,base[k]]));
checks.push({kind:"positive",exactAttemptKeys:Object.keys(exactProjection),extras:Object.keys(exactProjection).filter(k=>!Object.hasOwn(shape.value,k))});
fs.writeFileSync(path.join(j,"validator-boundary-independent-red1.json"),JSON.stringify({sourceSha256:crypto.createHash("sha256").update(source).digest("hex"),checks,serviceCalls:0,modelCalls:0,ordinaryRuntimeImport:true},null,2)+"\n");
console.log(JSON.stringify(checks));
