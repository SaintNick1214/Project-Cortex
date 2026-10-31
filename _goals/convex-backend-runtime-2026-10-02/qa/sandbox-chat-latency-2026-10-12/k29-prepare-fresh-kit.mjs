/** Individually adapt four controls and six helpers only after source acceptance.
 * No archive/dependency/cache/evidence copying and no build or service access. */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const Q=path.dirname(fileURLToPath(import.meta.url));
const R=path.resolve(Q,'../../../..');
const P='/Users/SaintNick/Documents/Cortex/Project-Cortex-Proofs';
const oldName='manual-sandbox-delivery-plan-2026-10-14',newName='manual-sandbox-native-snapshot-2026-10-14';
const oldQa=path.join(Q,'kit-checks-delivery-plan'),qa=path.join(Q,'kit-checks-native-snapshot');
const oldKit=path.join(P,oldName),kit=path.join(P,newName);
const baseline=JSON.parse(fs.readFileSync(path.join(Q,'k29-packaging-input-baseline.json')));
const digest=b=>createHash('sha256').update(b).digest('hex');
const read=p=>{assert.ok(fs.lstatSync(p).isFile());return fs.readFileSync(p);};
const commit=process.argv[2];
assert.equal(process.argv.length,3);assert.match(commit??'',/^[a-f0-9]{40}$/);
assert.equal(process.version,'v24.15.0');
const pinned='/Users/SaintNick/.codex/tmp/cortex-runtime-toolchain-20261005/node_modules/.bin';
const env={...process.env,PATH:pinned+path.delimiter+process.env.PATH,npm_config_userconfig:'/dev/null'};
assert.equal(execFileSync('npm',['--version'],{env,encoding:'utf8'}).trim(),'12.2.0');
const git=args=>execFileSync('git',args,{cwd:R,env,maxBuffer:20*1024*1024});
assert.equal(git(['rev-parse','HEAD']).toString().trim(),commit);
const reviewPath=path.join(Q,'k29-independent-review.json');
const review=JSON.parse(read(reviewPath));
assert.equal(review.verdict,'PASS');assert.equal(review.sourceOnly,true);assert.deepEqual(review.breakingFindings,[]);
assert.equal(review.verifiedInputs.hashesMatchBeforeAndAtFinalization,true);
assert.equal(review.verifiedInputs.packet,'k29-review-packet-v1.json');
const packetPath=path.join(Q,review.verifiedInputs.packet);
const packet=JSON.parse(read(packetPath));
assert.equal(digest(read(packetPath)),review.verifiedInputs.packetSha256);
assert.deepEqual(review.verifiedInputs.hashes.core,packet.hashes.core);
function verifySource(){
 assert.equal(git(['rev-parse','HEAD']).toString().trim(),commit);
 assert.ok(Object.keys(packet.hashes.core).length>0);
 for(const [name,expected] of Object.entries(packet.hashes.core)){
  assert.ok(!path.isAbsolute(name)&&!name.split('/').includes('..'));
  assert.equal(digest(read(path.join(R,name))),expected,name);
  assert.equal(digest(git(['show',commit+':'+name])),expected,name);
 }
}
function verifyOld(){
 for(const [name,expected] of Object.entries(baseline.oldFiles))assert.equal(digest(read(path.join(oldKit,name))),expected,name);
 for(const [name,expected] of Object.entries(baseline.oldHelpers))assert.equal(digest(read(path.join(oldQa,name))),expected,name);
}
verifySource();verifyOld();assert.ok(!fs.existsSync(kit));assert.ok(!fs.existsSync(qa));
const transformations=[];
function adapt(bytes,name){
 let text=bytes.toString();
 for(const [before,after] of [[oldName,newName],['kit-checks-delivery-plan','kit-checks-native-snapshot'],[baseline.oldCommit,commit],['cortex-sandbox-delivery-plan:20261014','cortex-sandbox-native-snapshot:20261014']]){
  const occurrences=text.split(before).length-1;
  if(occurrences){transformations.push({name,before,occurrences});text=text.replaceAll(before,after);}
 }
 assert.ok(!text.includes(oldName)&&!text.includes('kit-checks-delivery-plan')&&!text.includes('SOURCE_COMMIT_UNREADY'));
 return Buffer.from(text);
}
const controls=['prepare.mjs','image/Dockerfile','image/install-candidates.mjs','image/entrypoint.mjs'];
const planned=controls.map(name=>({root:kit,name,bytes:adapt(read(path.join(oldKit,name)),name)}));
for(const name of Object.keys(baseline.oldHelpers))planned.push({root:qa,name,bytes:adapt(read(path.join(oldQa,name)),name)});
assert.equal(planned.length,10);
for(const item of planned.filter(p=>p.name.endsWith('.mjs')))execFileSync(process.execPath,['--check','--input-type=module'],{input:item.bytes,env,stdio:['pipe','pipe','pipe']});
verifySource();verifyOld();fs.mkdirSync(kit);fs.mkdirSync(qa);
for(const name of ['staging','artifacts','cache','image','image/archives'])fs.mkdirSync(path.join(kit,name));
const identity={version:1,id:randomUUID(),ownerUid:process.getuid(),ownerGid:process.getgid()};
fs.writeFileSync(path.join(kit,'identity.json'),JSON.stringify(identity,null,2)+'\n',{flag:'wx',mode:0o600});
for(const item of planned)fs.writeFileSync(path.join(item.root,item.name),item.bytes,{flag:'wx'});
verifySource();verifyOld();
const receipt={status:'FRESH_CONTROLS_PREPARED_ONLY',acceptedSourceCommit:commit,kit,qa,identity,review:{path:reviewPath,sha256:digest(read(reviewPath)),packetSha256:review.verifiedInputs.packetSha256},toolchain:{node:process.version,npm:'12.2.0',pinned},unchangedHistoricalInputs:baseline.oldFiles,unchangedConsumerSources:baseline.oldHelpers,created:planned.map(p=>({path:path.join(p.root,p.name),sha256:digest(read(path.join(p.root,p.name)))})),transformations,expectedBackend:{files:170,tables:78,components:2,purposefulRoots:32,registeredEndpointsUnchangedFromK28:true},versions:{sdk:'0.39.0',cli:'0.39.0',provider:'0.39.0',catalog:'1.3.3',basic:'1.4.2',vercel:'1.4.2',catalogDescriptors:15,historicalDescriptors:14},futureRecipe:{isolatedBuilds:3,actualPacks:4,consumerGroups:4,imageBuilds:1,platform:'linux/arm64',user:'sandbox',tag:'cortex-sandbox-native-snapshot:20261014',blindRetries:0},buildsExecuted:0,packsExecuted:0,imagesBuilt:0,serviceCalls:0,inferenceCalls:0,sourceSpeedOrNativeAcceptance:false};
fs.writeFileSync(path.join(qa,'preparation-receipt.json'),JSON.stringify(receipt,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({status:receipt.status,acceptedSourceCommit:commit,kit,qa,identity,controls:4,consumerHelpers:6,archivesCopied:0}));
