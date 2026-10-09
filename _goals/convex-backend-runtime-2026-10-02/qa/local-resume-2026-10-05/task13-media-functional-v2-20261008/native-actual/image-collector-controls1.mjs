import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {dirname,join} from 'node:path';
import {createHash} from 'node:crypto';
const q=dirname(new URL(import.meta.url).pathname),start=performance.now(),deadlineMs=30000;
const source=await readFile(join(q,'imageCollector.fixture.ts'),'utf8');
const ts=createRequire(import.meta.url)('/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion/node_modules/typescript');
const output=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText;
const {withImageWireCollector}=await import('data:text/javascript;base64,'+Buffer.from(output).toString('base64'));
const expectedBody={model:'openai/gpt-image-1',prompt:'A small blue square centered on a plain white background. No text.',n:1,size:'1024x1024',quality:'low',output_format:'png'};
const original=globalThis.fetch,observations=[],checks=[];
try{
 let requests=0,checkpoints=0;
 const fake=async()=>{requests++;return new Response(JSON.stringify({data:[{b64_json:'AA=='}],usage:{input_tokens:7},model:'raw-unqualified'}),{status:200});};globalThis.fetch=fake;
 const opts={method:'POST',headers:{Authorization:'Bearer QA_ONLY_NOT_A_REAL_TOKEN'},body:JSON.stringify(expectedBody)};
 await withImageWireCollector({expectedBody,beforeDispatch:async()=>{checkpoints++;},observe:async v=>{observations.push(v);},work:async()=>{
   const first=await fetch('https://ai-gateway.convex.dev/v1/images/generations',opts);assert.equal((await first.json()).data.length,1);
   await assert.rejects(fetch('https://ai-gateway.convex.dev/v1/images/generations',opts),/WIRE_MISMATCH/);
 }});
 assert.equal(requests,1);assert.equal(checkpoints,1);assert.equal(observations.length,1);assert.equal(observations[0].rawUsageCanonical,'{"input_tokens":7}');assert.equal(observations[0].servingModelIdentityUnqualified,true);assert.equal(globalThis.fetch,fake);
 checks.push({name:'exact body forwards one issued request only and preserves raw unqualified metadata',status:'PASS'});
 for(const body of [{...expectedBody,quality:'high'}, {...expectedBody,files:[]}])await assert.rejects(withImageWireCollector({expectedBody,beforeDispatch:async()=>{checkpoints++;},observe:async()=>{},work:()=>fetch('https://ai-gateway.convex.dev/v1/images/generations',{...opts,body:JSON.stringify(body)})}),/WIRE_MISMATCH/);
 assert.equal(requests,1);assert.equal(checkpoints,1);assert.equal(globalThis.fetch,fake);
 checks.push({name:'unqualified options deny before checkpoint and native dispatch',status:'PASS'});
 let cancelled=false;
 const over=async()=>new Response(new ReadableStream({start(controller){controller.enqueue(new Uint8Array(28_000_001));},cancel(){cancelled=true;}}));globalThis.fetch=over;
 await assert.rejects(withImageWireCollector({expectedBody,beforeDispatch:async()=>{},observe:async()=>{throw Error('OVERSIZE_OBSERVED');},work:()=>fetch('https://ai-gateway.convex.dev/v1/images/generations',opts)}),/ENCODED_RESPONSE_TOO_LARGE/);
 assert.equal(cancelled,true);assert.equal(globalThis.fetch,over);
 checks.push({name:'encoded oversize cancels reader before native parser and restores isolate fetch',status:'PASS'});
 assert.ok(performance.now()-start<deadlineMs);
 await writeFile(join(q,'image-collector-controls1.json'),JSON.stringify({scope:'QA_ONLY_SYNTHETIC_COLLECTOR_CONTROLS_NOT_PROVIDER_QUALIFICATION',status:'PASS',pid:process.pid,deadlineMs,elapsedMs:performance.now()-start,sourceSha256:createHash('sha256').update(source).digest('hex'),checks,realServiceCalls:0,realModelCalls:0,sourceProductChanged:false},null,2)+'\n',{flag:'wx'});
 console.log(JSON.stringify({status:'PASS',checks:checks.length,realModelCalls:0}));
}finally{globalThis.fetch=original;}
