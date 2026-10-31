import fs from "node:fs";
import {execFileSync} from "node:child_process";
import crypto from "node:crypto";
import ts from "typescript";
const baseline="126231a0102936998837dd14a64a77d2b4d09785", Q="_goals/convex-backend-runtime-2026-10-02/qa/sandbox-chat-latency-2026-10-12";
const sha=s=>crypto.createHash("sha256").update(s).digest("hex");
const old=file=>execFileSync("git",["show",`${baseline}:${file}`],{encoding:"utf8"});
const current=file=>fs.readFileSync(file,"utf8");
function body(text,name){const file=ts.createSourceFile("input.ts",text,ts.ScriptTarget.Latest,true);let result;function visit(node){if(ts.isFunctionDeclaration(node)&&node.name?.text===name&&node.body)result=node.body.getText(file);ts.forEachChild(node,visit);}visit(file);if(!result)throw Error(`Missing function ${name}`);return result;}
function tokens(text){const s=ts.createScanner(ts.ScriptTarget.Latest,true,ts.LanguageVariant.Standard,text),v=[];while(s.scan()!==ts.SyntaxKind.EndOfFileToken)v.push(s.getTokenText());return JSON.stringify(v);}
const checks=[];
function check(name,a,b,mask="None; body tokens") {checks.push({name,mask,equal:tokens(a)===tokens(b),baselineSha256:sha(a),currentSha256:sha(b)});}
for(const [file,names] of Object.entries({
 "convex-dev/runtimeIngestion.ts":["readScopeCutoff","eventById","readEventStages","retireSourceEvents","retireScopedSourceEvents"],
 "convex-dev/runtimeMemoryContext.ts":["readStageProgress","refreshScopeWatermarks","readIndexedSourceAtCutoff"],
 "convex-dev/runtimeMemoryServices.ts":["recallMemory","deriveSourceVectors"],
 "convex-dev/runtimeAgent.ts":["saveContextHandler","contextSourceBatchHandler","contextSourceHandler"]
}))for(const name of names)check(`${file}:${name}`,body(old(file),name),body(current(file),name));
let a=body(old("convex-dev/runtimeIngestion.ts"),"enqueueSourceEvent"),b=body(current("convex-dev/runtimeIngestion.ts"),"enqueueSourceEvent");
const start=b.indexOf('  const head = await ctx.db.query("runtimeIngestionSequenceHeads")'),end=b.indexOf('  const eligibility =',start);if(start<0||end<0)throw Error("Missing prospective head block");
check("enqueueSourceEvent original body",a,b.slice(0,start)+b.slice(end),"Only new atomic sequence-head block removed; original writes/predicates remain");
a=body(old("convex-dev/runtimeTranscript.ts"),"captureCutoff");b=body(current("convex-dev/runtimeTranscript.ts"),"captureCutoff");check("captureCutoff original transcript checks",a,b.replace('await readScopeSequence(ctx, run.authorityReference)','await readScopeCutoff(ctx, run.authorityReference)'),"Only authoritative sequence reader substitution");
a=body(old("convex-dev/runtimeMemoryContext.ts"),"readPendingContext");b=body(current("convex-dev/runtimeMemoryContext.ts"),"scanPendingContext");const marker='  const represented =';check("original pending scanner",a.slice(a.indexOf(marker)),b.slice(b.indexOf(marker)),"Scanner extraction only; current preflight remains in caller");
a=body(old("convex-dev/runtimeMemoryServices.ts"),"finishRecallFromEmbedding");b=body(current("convex-dev/runtimeMemoryServices.ts"),"finishRecallFromEmbedding");check("generic staged/serial recall prefix",a.slice(0,a.indexOf('  const vectorItems')),b.slice(0,b.indexOf('  const vectorItems')),"Projection/delivery moved to original shared helpers");
const originalProjection=a.slice(a.indexOf('vectors.map('),a.indexOf('  await repository.recheckAuthority();',a.indexOf('vectors.map('))).trim().replace(/;$/,"");
const projected=body(current("convex-dev/runtimeMemoryServices.ts"),"vectorRecallItems").trim().slice(1,-1).trim().replace(/^return /,"").replace(/;$/,"");check("exact vector RecallItem projection",originalProjection,projected,"Return expression extraction only");
let tail=a.slice(a.indexOf('  const items = rankResults'));
let newTail=body(current("convex-dev/runtimeMemoryServices.ts"),"completeRecallDelivery");newTail=newTail.slice(newTail.indexOf('  const items = rankResults')).replace('adapters.finalDelivery','repository.finalDelivery').replace('profileId, ...(expiresAt','profileId: profile.profileId, ...(expiresAt');check("rank/delivery/Action-clock/format tail",tail,newTail,"Explicit adapter/profile parameter names only");
const receipt={baseline,scope:"Original helper token comparisons plus declared additive seams; not native or full new-parent equivalence",checks,failed:checks.filter(c=>!c.equal).map(c=>c.name)};
fs.writeFileSync(`${Q}/whole-turn-equivalence.json`,JSON.stringify(receipt,null,2)+"\n");console.log(JSON.stringify({checks:checks.length,failed:receipt.failed}));process.exitCode=receipt.failed.length?1:0;
