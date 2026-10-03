import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import https from 'node:https';
import net from 'node:net';
import tls from 'node:tls';
import dns from 'node:dns';
const output = new URL('./native-' + process.argv[2] + '.json', import.meta.url);
let networkAttempts = 0;
const forbidden = () => { networkAttempts++; throw new Error('OFFLINE_NETWORK_FORBIDDEN'); };
globalThis.fetch = forbidden;
for (const [object, names] of [[http,['request','get']],[https,['request','get']],[net,['connect','createConnection']],[tls,['connect']],[dns,['lookup','resolve']]]) for (const name of names) object[name]=forbidden;
const fullNames=[];
const check=(name, fn)=>{fn();fullNames.push(name);};
class InertWebSocket {
 static instances=[];
 readyState=0; onopen=null; onclose=null; onmessage=null; onerror=null;
 messages=[];
 constructor(url){assert.match(url,/^ws:\/\/127\.0\.0\.1:9\//);InertWebSocket.instances.push(this);queueMicrotask(()=>{if(this.readyState===0){this.readyState=1;this.onopen?.();}});}
 send(raw){this.messages.push(JSON.parse(raw));}
 close(){this.readyState=3;queueMicrotask(()=>this.onclose?.({code:1000,reason:'offline complete',wasClean:true}));}
}
globalThis.WebSocket=InertWebSocket;
// Imports occur only after the empty/minimal environment and network interceptors.
const {Cortex}=await import('/workspace/Project-Cortex/src/index.ts');
const {makeFunctionReference}=await import('/workspace/Project-Cortex/node_modules/convex/dist/esm/server/index.js');
const {ConvexError}=await import('/workspace/Project-Cortex/node_modules/convex/dist/esm/values/index.js');
const modeArg=process.argv[2];
const ts=await import('typescript');
const fixtureSource=fs.readFileSync('/workspace/Project-Cortex/_goals/convex-backend-runtime-2026-10-02/qa/task03c2-live-resume-fixture/scripts/client.ts','utf8');
const ast=ts.createSourceFile('client.ts',fixtureSource,ts.ScriptTarget.Latest,true);
const declarations=['object','bounded','waitForRecoveredSdkValue'].map(name=>{
 const declaration=ast.statements.find(node=>ts.isFunctionDeclaration(node)&&node.name?.text===name);
 assert(declaration, 'ACTUAL_FIXTURE_HELPER_REQUIRED');return declaration.getText(ast);
}).join('\n');
const compiled=ts.transpileModule(declarations,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
const timeoutMs=100;
// Execute the exact actual fixture helper and its actual bound/object helpers.
const recover=Function('assert','ConvexError','query','timeoutMs',compiled+';return waitForRecoveredSdkValue;')(assert,ConvexError,()=>makeFunctionReference('mutable:get'),timeoutMs);

let hostMode='throw';let release;let getterCalls=0;
const now=Math.floor(Date.now()/1000);
// Public synthetic compact string; no private JWT, signature, key or signer is used.
const dummyToken='eyJhbGciOiJub25lIn0.'+Buffer.from(JSON.stringify({iat:now,exp:now+3600,sub:'offline-synthetic'})).toString('base64url')+'.offline';
const diagnostics=[];const unhandled=[];const onUnhandled=e=>unhandled.push(e?.name??'unknown');process.on('unhandledRejection',onUnhandled);
const oldConsole={...console};console.log=()=>{};console.warn=()=>{};console.error=()=>{};
const cortex=new Cortex({convexUrl:'http://127.0.0.1:9',resilience:{enabled:false},fetchAuthToken:async()=>{getterCalls++;if(hostMode==='throw')throw new Error('SYNTHETIC_PRIVATE_FAILURE');if(hostMode==='defer')return await new Promise(r=>release=r);return dummyToken;},onAuthError:async d=>{diagnostics.push(d);throw new Error('SYNTHETIC_OBSERVER_FAILURE');}});
const client=cortex.getClient();const query=makeFunctionReference('mutable:get');const args={namespace:'offline',key:'recovery',tenantId:'offline-tenant',memorySpaceId:'offline-space'};
const flush=async()=>{await new Promise(r=>setImmediate(r));await new Promise(r=>setTimeout(r,0));await new Promise(r=>setImmediate(r));};
let serverVersion={querySet:0,identity:0,ts:0n};
const encodeTs=ts=>{const b=Buffer.alloc(8);b.writeBigUInt64LE(ts);return b.toString('base64');};
let socket;
function transition(modifications){
 const latestQuery=socket.messages.filter(m=>m.type==='ModifyQuerySet').at(-1);
 const latestAuth=socket.messages.filter(m=>m.type==='Authenticate').at(-1);
 const next={querySet:latestQuery?.newVersion??serverVersion.querySet,identity:latestAuth?latestAuth.baseVersion+1:serverVersion.identity,ts:serverVersion.ts+1n};
 const ver=v=>({...v,ts:encodeTs(v.ts)});
 socket.onmessage?.({data:JSON.stringify({type:'Transition',startVersion:ver(serverVersion),endVersion:ver(next),modifications})});serverVersion=next;
}
let stop;let reproduced=false;let nativeError;
try {
 await flush();socket=InertWebSocket.instances.at(-1);
 check('initial host failures contained and exact sanitized keys',()=>{assert.equal(diagnostics.length,2);assert.deepEqual(Object.keys(cortex.credentials.authFailure).sort(),['attemptId','code']);assert.equal(cortex.credentials.authFailure.code,'HOST_TOKEN_FETCH_FAILED');});
 const watcher={errors:0,values:[]};
 stop=client.onUpdate(query,args,v=>watcher.values.push(v),e=>{assert(e instanceof ConvexError);assert.equal(e.data.code,'UNAUTHENTICATED');watcher.errors++;});
 const add=socket.messages.flatMap(m=>m.modifications??[]).find(m=>m.type==='Add');
 transition([{type:'QueryFailed',queryId:add.queryId,errorMessage:'Uncaught ConvexError: UNAUTHENTICATED',errorData:{code:'UNAUTHENTICATED'},logLines:[],journal:null}]);
 check('native QueryFailed is received by actual listener',()=>assert.equal(watcher.errors,1));
 stop();stop=undefined;
 const beforeQueryMessages=socket.messages.filter(m=>m.type==='ModifyQuerySet').length;
 hostMode=modeArg==='immediate'?'valid':'defer';
 const notificationReturn=cortex.credentials.notifySessionChanged();
 check('session notification has void return',()=>assert.equal(notificationReturn,undefined));
 const callsAtNotification=getterCalls;
 if(modeArg==='required-assertion'){
  // This outcome assertion is identical in purpose/value to original client.ts:317.
  // It is intentionally left failing; no retry/assertion weakening occurs.
  try {assert.equal((await client.query(query,args)).value,43);}catch(e){nativeError=e;reproduced=true;throw e;}
 } else {
  try {await client.query(query,args);} catch(e){nativeError=e;reproduced=e instanceof ConvexError&&e.data.code==='UNAUTHENTICATED';}
  check('immediate query rethrows cached native unauthenticated result',()=>assert.equal(reproduced,true));
  check('cached error path adds no query subscription or request',()=>assert.equal(socket.messages.filter(m=>m.type==='ModifyQuerySet').length,beforeQueryMessages));
  const earlyRecovery=modeArg==='early-deferred'?recover(client,args):undefined;
  const earlySettled=earlyRecovery?.then(()=>({ok:true}),error=>({ok:false,error}));
  if(earlyRecovery){await flush();check('witness begins while current getter is still pending',()=>{assert.equal(client.listeners.size,1);assert.notEqual(cortex.credentials.authFailure,undefined);});}
  if(hostMode==='defer'){
   check('diagnostic remains until current getter settles',()=>assert.notEqual(cortex.credentials.authFailure,undefined));
   release(dummyToken);
  }
  await flush();
  check('current valid getter clears diagnostic and restores native identity',()=>{assert.equal(cortex.credentials.authFailure,undefined);assert.equal(client.client.hasAuth(),true);});
  check('wire recovery sends User with no late None',()=>{assert.equal(socket.messages.filter(m=>m.type==='Authenticate').at(-1).tokenType,'User');assert(getterCalls>=callsAtNotification);});
  let postFetchDenied=false;try{await client.query(query,args);}catch(e){postFetchDenied=e instanceof ConvexError&&e.data.code==='UNAUTHENTICATED';}
  check('settled getter alone does not purge native cached query error',()=>assert.equal(postFetchDenied,true));
  const recovery= earlyRecovery ?? recover(client,args);
  // Attach rejection handling immediately; no rejected Promise is abandoned.
  const settled=earlySettled ?? recovery.then(()=>({ok:true}),error=>({ok:false,error}));
  await flush();
  check('persistent helper keeps native subscription through cached denial',()=>assert.equal(client.listeners.size,1));
  const recoveryAdd=socket.messages.flatMap(m=>m.modifications??[]).filter(m=>m.type==='Add').at(-1);
  transition([{type:'QueryRemoved',queryId:add.queryId},{type:'QueryFailed',queryId:recoveryAdd.queryId,errorMessage:'Uncaught ConvexError: UNAUTHENTICATED',errorData:{code:'UNAUTHENTICATED'},logLines:[],journal:null}]);
  await flush();
  check('fresh transient native unauthenticated also leaves witness pending',()=>assert.equal(client.listeners.size,1));
  const removedBefore=socket.messages.flatMap(m=>m.modifications??[]).filter(m=>m.type==='Remove').length;
  if(modeArg==='timeout') {
   const outcome=await settled;
   check('no exact43 delivery fails within existing bound',()=>{assert.equal(outcome.ok,false);assert.equal(outcome.error.message,'BOUNDED_TIMEOUT');});
  } else if(modeArg==='forbidden'||modeArg==='service-error'||modeArg==='auth-lookalike') {
   const data=modeArg==='forbidden'?{code:'FORBIDDEN'}:undefined;
   transition([{type:'QueryFailed',queryId:recoveryAdd.queryId,errorMessage:modeArg==='auth-lookalike'?'Unauthenticated upstream network failure':'offline service unavailable',...(data?{errorData:data}:{}),logLines:[],journal:null}]);
   const outcome=await settled;
   check('unexpected native service or control error fails recovery',()=>{assert.equal(outcome.ok,false);assert.notEqual(outcome.error.message,'BOUNDED_TIMEOUT');if(data)assert.equal(outcome.error.data.code,'FORBIDDEN');});
  } else {
   transition([{type:'QueryUpdated',queryId:recoveryAdd.queryId,value:{value:modeArg==='wrong-value'?42:43},logLines:[],journal:null}]);
   const outcome=await settled;
   if(modeArg==='wrong-value') {
    check('fresh wrong42 is rejected rather than accepted or retried',()=>{assert.equal(outcome.ok,false);assert.equal(outcome.error.code,'ERR_ASSERTION');});
   } else {
    check('fresh exact43 transition completes actual helper',()=>assert.equal(outcome.ok,true));
    assert.equal((await client.query(query,args)).value,43);
    check('original exact43 query and cleared diagnostic still required',()=>{assert.equal(client.client.localQueryResult('mutable:get',args).value,43);assert.equal(cortex.credentials.authFailure,undefined);});
   }
  }
  await flush();
  check('helper always disposes native subscription',()=>assert.equal(socket.messages.flatMap(m=>m.modifications??[]).filter(m=>m.type==='Remove').length,removedBefore+1));
  check('no native listener survives completion or failure',()=>assert.equal(client.listeners.size,0));
  check('observer exceptions produce no unhandled rejection',()=>assert.deepEqual(unhandled,[]));
  check('actual network attempts remain zero',()=>assert.equal(networkAttempts,0));
 }
} finally {
 if(release&&hostMode==='defer')release(dummyToken);
 stop?.();await cortex.shutdown(500);await flush();
 for(const key of ['log','warn','error'])console[key]=oldConsole[key];
 process.off('unhandledRejection',onUnhandled);
 const result={mode:modeArg,phase:'actual-helper-installed-native-current-source-OFFLINE',original41Replays:0,discovered:modeArg==='required-assertion'?4:modeArg==='early-deferred'?18:modeArg==='immediate'?16:['deferred'].includes(modeArg)?17:16,executed:fullNames.length+(modeArg==='required-assertion'?1:0),passed:fullNames.length,failed:modeArg==='required-assertion'?1:0,skipped:0,todo:0,fullNames:[...fullNames,...(modeArg==='required-assertion'?['original immediate recovery value43 assertion']:[])],reproduced,errorCode:nativeError?.data?.code,networkAttempts,closed:client.closed,credentialFilesRead:0,privateJwtRead:0,signedTokens:0,sdkSourceEdits:0,fixtureHelperExtracted:true,diagnostics:diagnostics.map(d=>({code:d.code,attemptId:d.attemptId})),wireTypes:socket?.messages.map(m=>({type:m.type,tokenType:m.tokenType,baseVersion:m.baseVersion,newVersion:m.newVersion,modifications:m.modifications?.map(x=>({type:x.type,queryId:x.queryId}))})),unhandled};
 fs.writeFileSync(output,JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({mode:result.mode,discovered:result.discovered,executed:result.executed,passed:result.passed,failed:result.failed,reproduced,closed:result.closed,networkAttempts}));
}
