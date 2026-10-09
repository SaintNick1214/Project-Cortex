import assert from 'node:assert/strict';
import {readFile, writeFile, access, readdir} from 'node:fs/promises';
import {dirname, join} from 'node:path';
import {spawn, spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';

const q=dirname(new URL(import.meta.url).pathname);
const site='/Users/SaintNick/Documents/Cortex/cortexmemory.dev/docs-site';
const website=dirname(site);
const output='/Users/SaintNick/.codex/tmp/cortex-backend-runtime-docs-build4-20261009';
const tool='/Users/SaintNick/.codex/tmp/cortex-runtime-toolchain-20261005/node_modules';
const npm=join(tool,'npm/bin/npm-cli.js');
const guard=join(q,'../../task16-provider-demo-quality1/offline-guard1.cjs');
const sha=value=>createHash('sha256').update(value).digest('hex');
const pin=async path=>{const b=await readFile(path);return {path,bytes:b.length,sha256:sha(b)};};
const source=JSON.parse(await readFile(join(q,'website-context4.json')));
const before=await readFile(source.doc);
assert.equal(before.length,source.bytes);assert.equal(sha(before),source.sha256);
const prior=await readFile(join(q,'backend-runtime3.mdx'),'utf8');
const blocks=text=>[...text.matchAll(/```(?:typescript|ts|tsx)\s*\n([\s\S]*?)```/g)].map(match=>match[1]);
const currentBlocks=blocks(before.toString());
assert.equal(currentBlocks.length,3);assert.deepEqual(currentBlocks,blocks(prior));
const preserved=[];
for(const name of await readdir(q)) {
  if(!name.endsWith('4.mjs')&&!['checks4.json','website-build4-command.json','website-build4.log','handoff4.json'].includes(name)) {
    preserved.push(await pin(join(q,name)));
  }
}
let outputExists=true;
try{await access(output);}catch(error){if(error.code==='ENOENT')outputExists=false;else throw error;}
assert.equal(outputExists,false,'preserve prior output; no overwrite');
const git=(...args)=>{const result=spawnSync('/usr/bin/git',args,{cwd:website,encoding:'utf8',env:{PATH:'/usr/bin:/bin'}});assert.equal(result.status,0,result.stderr);return result.stdout;};
const statusBefore=git('status','--porcelain=v1','--untracked-files=all');
const env={HOME:'/Users/SaintNick',PATH:join(tool,'.bin')+':/usr/bin:/bin:/usr/sbin:/sbin',TMPDIR:process.env.TMPDIR??'/tmp',LANG:'en_US.UTF-8',CI:'true',CORTEX_TEST_ENV_MODE:'explicit',NODE_OPTIONS:'--max-old-space-size=6144 --require '+guard,npm_config_audit:'false',npm_config_fund:'false'};
const args=[npm,'run','build','--','--out-dir',output];
const start=Date.now(),startedAtUtc=new Date().toISOString();
const child=spawn(process.execPath,args,{cwd:site,env,detached:true,stdio:['ignore','pipe','pipe']});
let log='',closed=false,timedOut=false,result;
child.stdout.on('data',bytes=>log+=bytes);child.stderr.on('data',bytes=>log+=bytes);
const kill=signal=>{if(!closed)try{process.kill(-child.pid,signal);}catch{}};
const timer=setTimeout(()=>{timedOut=true;kill('SIGTERM');},120000);
const hard=setTimeout(()=>{if(timedOut)kill('SIGKILL');},125000);
try{result=await new Promise((resolve,reject)=>{child.once('error',reject);child.once('close',(exit,signal)=>{closed=true;resolve({exit,signal});});});}
finally{clearTimeout(timer);clearTimeout(hard);}
let groupPresent=false;try{process.kill(-child.pid,0);groupPresent=true;}catch(error){if(error.code!=='ESRCH')groupPresent=true;}
const command={name:'website-build4',cwd:site,command:[process.execPath,...args],pid:child.pid,startedAtUtc,closedAtUtc:new Date().toISOString(),elapsedMs:Date.now()-start,...result,timedOut,timeoutMs:120000,naturalExit:closed&&!timedOut,ownedChildClosed:closed,ownedProcessGroupPresentAfterWait:groupPresent,log:join(q,'website-build4.log'),logSha256:sha(log),environment:{minimalExplicit:true,names:Object.keys(env).sort(),credentialNamesPassed:[],networkAndExistingEnvFileGuard:await pin(guard)},source4:source,output};
await writeFile(command.log,log,{flag:'wx'});
await writeFile(join(q,'website-build4-command.json'),JSON.stringify(command,null,2)+'\n',{flag:'wx'});
try {
 assert.equal(result.exit,0,log.slice(-2500));assert.equal(timedOut,false);assert.equal(groupPresent,false);
 assert.equal(sha(await readFile(source.doc)),source.sha256);
 const route=join(output,'getting-started/backend-runtime/index.html');
 const html=await readFile(route,'utf8');
 assert.ok(html.includes('Original endpoint authorization has scoped independent acceptance.'));
 assert.ok(html.includes('Remaining cross-layer adversarial/media outcomes, selected quality checks and'));
 const statusAfter=git('status','--porcelain=v1','--untracked-files=all');assert.equal(statusAfter,statusBefore,'preserve website dirty source');
 for(const p of preserved)assert.deepEqual(await pin(p.path),p,'preserve original source3 receipts/archives');
 const checks={schemaVersion:1,status:'WEBSITE_SOURCE4_BUILD_PASS',createdAtUtc:new Date().toISOString(),node:process.version,npm:'12.2.0',checks:[command],source4:source,route:await pin(route),renderedSource4StatusParagraphs:true,typescriptExampleApplicability:{count:3,unchangedFromSource3:true,sha256:currentBlocks.map(sha),reuse:await pin(join(q,'checks3.json')),rerun:false},websiteContext:{root:website,branch:git('branch','--show-current').trim(),head:git('rev-parse','HEAD').trim(),dirtyStatusUnchanged:true,dirtyStatusSha256:sha(statusBefore),package:await pin(join(site,'package.json')),config:await pin(join(site,'docusaurus.config.ts'))},priorReceiptsPreserved:preserved,build3OutputPreserved:true,actualWebsiteBrowser:false,actualServiceCalls:0,serversStarted:0,sourceEdits:0,productionDeploy:false,packagePublish:false,gitMutations:false,independentAcceptancePromotion:false};
 await writeFile(join(q,'checks4.json'),JSON.stringify(checks,null,2)+'\n',{flag:'wx'});
 await writeFile(join(q,'handoff4.json'),JSON.stringify({schemaVersion:1,status:checks.status,closedAtUtc:new Date().toISOString(),checks:await pin(join(q,'checks4.json')),command:await pin(join(q,'website-build4-command.json')),source4:source,output,route:checks.route,naturalExit:true,ownedProcessGroupAbsent:true,typescriptExamples:checks.typescriptExampleApplicability,source3ReceiptsPreserved:true,dirtyWebsiteUntouched:true,noBrowserOrServer:true,noServiceGitPublishOrIndependentGrant:true},null,2)+'\n',{flag:'wx'});
 console.log(JSON.stringify({status:checks.status,elapsedMs:command.elapsedMs,pid:child.pid,ownedProcessGroupPresentAfterWait:groupPresent,output,route,examplesUnchanged:3,modelCalls:0}));
}catch(error){await writeFile(join(q,'checks4.json'),JSON.stringify({status:'FAIL',checks:[command],error:{name:error.name,message:error.message},source4:source,actualServiceCalls:0},null,2)+'\n',{flag:'wx'});throw error;}
