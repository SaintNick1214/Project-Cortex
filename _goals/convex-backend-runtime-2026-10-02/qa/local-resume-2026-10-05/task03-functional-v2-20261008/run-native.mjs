import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {randomUUID} from 'node:crypto';
const N=path.dirname(fileURLToPath(import.meta.url)),L=JSON.parse(fs.readFileSync(path.join(N,'fixture-locator.json')));
const {repo,fixture,scratch,node}=L,operation=randomUUID(),started=Date.now(),events=[];
const env={...process.env,PATH:path.dirname(node)+':'+process.env.PATH,CONVEX_DISABLE_ANALYTICS:'1'};
const cleared=Object.keys(env).filter(k=>/^(CONVEX_|LOCAL_CONVEX_|CLOUD_CONVEX_)/.test(k));for(const k of cleared)delete env[k];env.CONVEX_DISABLE_ANALYTICS='1';
const log=fs.openSync(path.join(scratch,'dev-cli.log'),'wx',0o600),args=[path.join(repo,'node_modules/convex/bin/main.js'),'dev','--codegen','enable','--typecheck','enable','--tail-logs','disable'];
let output='',total=0,dev,smoke,devExit,smokeExit,primary,verified=false,killed=false;
const pause=ms=>new Promise(r=>setTimeout(r,ms));
function childExit(c){return new Promise(resolve=>c.once('exit',(code,signal)=>resolve({code,signal})));}
async function stopOwned(c,exit){if(!c||c.exitCode!==null||c.signalCode!==null)return; c.kill('SIGINT');const ended=await Promise.race([exit,pause(5000).then(()=>null)]);if(!ended){c.kill('SIGKILL');await exit;}}
try{
 const prep=spawn(node,[path.join(N,'prepare-native.mjs')],{cwd:repo,env,stdio:['ignore','pipe','pipe']});let p='';prep.stdout.on('data',b=>{p+=b;});prep.stderr.on('data',b=>{p+=b;});const pre=await childExit(prep);assert.equal(pre.code,0,p);console.log(p.trim());
 assert.ok(!fs.existsSync(path.join(fixture,'.convex')));assert.ok(!fs.existsSync(path.join(process.env.HOME,'.convex/anonymous-convex-backend-state','anonymous-'+path.basename(fixture))));
 dev=spawn(node,args,{cwd:fixture,env,stdio:['ignore','pipe','pipe']});devExit=childExit(dev);
 for(const stream of [dev.stdout,dev.stderr])stream.on('data',b=>{total+=b.length;if(total>1048576){primary??=new Error('Dev output exceeded1MiB');dev.kill('SIGINT');return;}fs.writeSync(log,b);output=(output+b.toString()).slice(-262144);});
 console.log(JSON.stringify({stage:'local-backend-start',pid:dev.pid}));
 const until=Date.now()+120000;
 while(!/Convex functions ready/.test(output)){
  if(dev.exitCode!==null||dev.signalCode!==null)throw new Error('Local backend/CLI exited before functions ready; private log retained');
  if(Date.now()>until)throw new Error('Local backend deployment exceeded120s');if(primary)throw primary;await pause(250);
 }
 const cfgPath=path.join(fixture,'.convex/local/default/config.json'),cfg=JSON.parse(fs.readFileSync(cfgPath));
 assert.equal(cfg.deploymentName,'anonymous-'+path.basename(fixture));assert.ok(cfg.cloudProjectId===undefined||cfg.cloudProjectId===null);assert.ok(Number.isInteger(cfg.ports.cloud));
 const url='http://127.0.0.1:'+cfg.ports.cloud;process.kill(dev.pid,0);const response=await fetch(url+'/version',{signal:AbortSignal.timeout(5000)});assert.equal(response.ok,true);const backendVersion=(await response.text()).slice(0,256);
 // Unique anonymous name and absent legacy state bind this fresh project-local target.
 fs.writeFileSync(path.join(N,'live-target-verification.json'),JSON.stringify({status:'PASS',operation,fixture,url,backendVersion,cliPid:dev.pid,ownedPidLive:true,newProjectLocalState:true,legacySameNameAbsent:true,production:false,anonymous:true,observedAt:new Date().toISOString()},null,2)+'\n');verified=true;console.log(JSON.stringify({stage:'target-verified',url,production:false}));
 smoke=spawn(node,[path.join(N,'smoke.mjs')],{cwd:repo,env,stdio:['ignore','pipe','pipe']});smokeExit=childExit(smoke);let smokeOutput=0;
 for(const stream of [smoke.stdout,smoke.stderr])stream.on('data',b=>{smokeOutput+=b.length;if(smokeOutput>262144){primary??=new Error('Smoke output cap');smoke.kill('SIGINT');return;}fs.writeSync(log,b);if(stream===smoke.stdout)process.stdout.write(b);});
 const result=await Promise.race([smokeExit,pause(180000).then(()=>null)]);if(!result)throw new Error('Focused native smoke exceeded180s');assert.equal(result.code,0,'Native smoke failed; exact receipt retained');events.push({phase:'native-smoke',...result});
}catch(error){primary??=error;events.push({phase:'failure',name:error.name,message:String(error.message).slice(0,2048)});console.log(JSON.stringify({stage:'failed',message:String(error.message).slice(0,512)}));}
finally{
 await stopOwned(smoke,smokeExit);await stopOwned(dev,devExit);fs.closeSync(log);
 let urlClosed=true;if(verified){const proof=JSON.parse(fs.readFileSync(path.join(N,'live-target-verification.json')));try{await fetch(proof.url+'/version',{signal:AbortSignal.timeout(1500)});urlClosed=false;}catch{}}
 if(urlClosed)fs.rmSync(path.join(fixture,'.convex'),{recursive:true,force:true});fs.rmSync(path.join(scratch,'jwt-private.pem'),{force:true});
 fs.writeFileSync(path.join(N,'execution-receipt.json'),JSON.stringify({status:primary?'FAIL':'PASS',operation,cwd:fixture,nodeVersion:process.version,npmVersion:'12.2.0',argv:args,startedAt:new Date(started).toISOString(),elapsedMs:Date.now()-started,candidateDigest:L.candidateDigest,clearedSelectorNames:cleared,verified,events,ownedCLITerminated:dev?.exitCode!==null||dev?.signalCode!==null,ownedSmokeTerminated:smoke===undefined||smoke.exitCode!==null||smoke.signalCode!==null,loopbackClosed:urlClosed,ownedLocalStateRemoved:urlClosed,privateKeyRemoved:true,privateLogPath:path.join(scratch,'dev-cli.log'),noCloudOrPaidInference:true},null,2)+'\n');
 console.log(JSON.stringify({stage:'cleanup',loopbackClosed:urlClosed,privateKeyRemoved:true}));
}
if(primary)process.exitCode=1;
