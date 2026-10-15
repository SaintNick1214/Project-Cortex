/** Scalar timing enablement only after exact fresh READY, Root GO and fresh target/Docker identity. */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {parsePins,readReady,Q,PROOFS_ROOT,pendingMetadata,verifyRuntimeIdentity,readReviewedSource,assertSessionIdentity} from './memory-effort-canonical-native-pins.mjs';
let pins;
try{pins=parsePins(process.argv.slice(2));}catch{console.log(JSON.stringify({...pendingMetadata(),pinValidation:'PENDING_OR_INVALID'}));process.exitCode=2;}
if(pins){if(pins.localPreflight||process.env.CORTEX_MEMORY_EFFORT_CANONICAL_TRACE_GO!=='1'){console.log(JSON.stringify({...pendingMetadata(),collector:'SCALAR_TRACE_ENABLE'}));if(!pins.localPreflight)process.exitCode=2;}else await enable();}
async function enable(){
 assert.equal(process.version,'v24.15.0');assert.equal(process.env.HOME,'/Users/SaintNick');
 const ready=await readReady(pins);await readReviewedSource(pins);
 const {loadSession,createContext}=await import(pathToFileURL(path.join(PROOFS_ROOT,'sandbox-env/runner.mjs')));
 const {getDeployKey}=await import(pathToFileURL(path.join(PROOFS_ROOT,'sandbox-env/cloud.mjs')));
 const session=await loadSession(PROOFS_ROOT,pins.sessionId);assertSessionIdentity(pins,session);const ctx=await createContext(session,{logger:()=>{}});ctx.persist=async()=>{};
 const originalFetch=ctx.fetch;ctx.fetch=(url,options={})=>{assert.equal((options.method??'GET').toUpperCase(),'GET');return originalFetch(url,options);};
 await verifyRuntimeIdentity(ctx,pins,ready);
 const stat=await fs.lstat(session.deploymentKeyPath);assert.ok(stat.isFile()&&!stat.isSymbolicLink()&&stat.uid===process.getuid()&&(stat.mode&0o077)===0);
 const key=await getDeployKey(session,ctx);assert.ok(key.startsWith('dev:'+ready.target.name+'|'));
 const cli=path.join(session.backendDir,'node_modules/convex/bin/main.js'),options={cwd:session.backendDir,env:{CONVEX_DEPLOY_KEY:key,CONVEX_DEPLOYMENT:'dev:'+session.target.name},timeoutMs:30000};
 await verifyRuntimeIdentity(ctx,pins,ready);
 const set=await ctx.command('memory-effort-canonical-trace-set',ctx.node,[cli,'env','set','CORTEX_RUNTIME_LATENCY_TRACE','1'],options);assert.equal(set.code,0);
 const get=await ctx.command('memory-effort-canonical-trace-get',ctx.node,[cli,'env','get','CORTEX_RUNTIME_LATENCY_TRACE'],options);assert.equal(get.code,0);assert.equal(get.stdout.trim(),'1');
 const receipt={enabled:true,readback:1,sessionId:session.id,target:session.target.name,targetId:session.target.id,sourceCommit:ready.sourceCommit,imageId:ready.container.imageId,measuredTurnsBeforeEnable:0,directSetExit:set.code,directGetExit:get.code,at:new Date().toISOString()};
 await fs.writeFile(pins.tracePath,JSON.stringify(receipt,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify(receipt));
}
