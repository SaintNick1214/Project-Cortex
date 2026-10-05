import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {execFileSync} from 'node:child_process';
import {repositoryRoot as originalRoot} from './repository-location.mjs';
const base=path.dirname(fileURLToPath(import.meta.url)),work=path.join(originalRoot,'work/resume/task04-current-catalog-release-c4');
const fixture=fs.mkdtempSync(path.join(work,'relocation-'));
const target=path.join(fixture,'arbitrary-checkout-location');
const packetRelative='_goals/convex-backend-runtime-2026-10-02/qa/task04-current-catalog-release-c4';
const packet=path.join(target,packetRelative),runtime=path.join(target,'work/resume/task04-current-catalog-release-c4');
const h=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const expected=JSON.parse(fs.readFileSync(path.join(base,'source-runtime.json'),'utf8')).sources;
const transition=JSON.parse(fs.readFileSync(path.join(base,'source-transition.json'),'utf8'));
const moduleNames=['current-compose.mjs','private-compose.mjs','containment.mjs','native-probe.mts','offline-guard.mjs','repository-location.mjs','release-preconditions.mjs','source-runtime.json','source-before.json','source-transition.json','approved-additions.json','proposed-four-file-exact.patch'];
const outcomes=[];const commands=[];
function child(args,cwd=target){const startUTC=new Date().toISOString();try{const stdout=execFileSync(process.execPath,args,{cwd,env:{PATH:'/usr/bin:/bin',TSX_DISABLE_CACHE:'1',NODE_OPTIONS:'--import '+path.join(packet,'offline-guard.mjs')},encoding:'utf8',maxBuffer:16*1024*1024});commands.push({argv:[process.execPath,...args],cwd,startUTC,endUTC:new Date().toISOString(),exit:0,stdout,stderr:''});return stdout}catch(error){commands.push({argv:[process.execPath,...args],cwd,startUTC,endUTC:new Date().toISOString(),exit:error.status??1,stdout:String(error.stdout??''),stderr:String(error.stderr??'')});throw error}}
try{
 fs.mkdirSync(target);for(const row of expected){const p=path.join(target,row.path);fs.mkdirSync(path.dirname(p),{recursive:true});fs.copyFileSync(path.join(base,'preimages',row.path),p);assert.equal(h(p),row.sha256)}
 fs.mkdirSync(packet,{recursive:true});for(const name of moduleNames){fs.copyFileSync(path.join(base,name),path.join(packet,name));assert.equal(h(path.join(packet,name)),h(path.join(base,name)))}
 for(const folder of ['preimages','postimages'])fs.cpSync(path.join(base,folder),path.join(packet,folder),{recursive:true});
 // Keep six fenced package.json files ordinary/single-link; reuse the other
 // installed package entries through literal links, never relax source fences.
 const dependencyLinks=[];const installed=path.join(originalRoot,'node_modules');
 for(const name of fs.readdirSync(installed)){
  const source=path.join(installed,name),destination=path.join(target,'node_modules',name);
  if(!fs.existsSync(destination)){fs.symlinkSync(source,destination);dependencyLinks.push({path:path.relative(target,destination),target:source})}
  else for(const child of fs.readdirSync(source)){const p=path.join(destination,child);if(!fs.existsSync(p)){const sourceChild=path.join(source,child);fs.symlinkSync(sourceChild,p);dependencyLinks.push({path:path.relative(target,p),target:sourceChild})}}
 }
 fs.mkdirSync(path.join(runtime,'diagnostics'),{recursive:true});fs.mkdirSync(path.join(runtime,'test-scratch'));
 const relocated=await import(pathToFileURL(path.join(packet,'current-compose.mjs')).href);
 const location=await import(pathToFileURL(path.join(packet,'repository-location.mjs')).href);assert.equal(location.repositoryRoot,target);assert.notEqual(target,originalRoot);outcomes.push({name:'exact module bytes discover arbitrary checkout without caller/environment override',root:target});
 const positive=JSON.parse(child([path.join(packet,'current-compose.mjs'),path.join(runtime,'positive')]));assert.deepEqual(positive.currentComposition.totals,{baselineTables:26,additiveTables:5,currentTables:31,indexes:184,policyInternal:16});assert.equal(positive.currentComposition.currentEndpoints,275);outcomes.push({name:'normal CLI relocated POST positive',endpoints:275});
 const post=JSON.parse(child([path.join(packet,'release-preconditions.mjs'),'POST']));assert.equal(post.exactRootRows,136);outcomes.push({name:'relocated read-only POST validates actual relocated graph',rows:136});
 const mkdir=fs.mkdirSync,mkdtemp=fs.mkdtempSync;
 function deny(label){const dest=path.join(runtime,'denied-'+label);let count=0;fs.mkdirSync=(...a)=>{count++;return mkdir(...a)};fs.mkdtempSync=(...a)=>{count++;return mkdtemp(...a)};try{assert.throws(()=>relocated.compose(dest),/SOURCE_BYTES_DRIFT/)}finally{fs.mkdirSync=mkdir;fs.mkdtempSync=mkdtemp}assert.equal(count,0);assert.ok(!fs.existsSync(dest));assert.deepEqual(fs.readdirSync(runtime).filter(n=>n.startsWith('private-')),[]);outcomes.push({name:'relocated '+label+' denies0allocations',allocations:0})}
 for(let mask=0;mask<15;mask++){for(const [i,row]of transition.changedOnly.entries())fs.copyFileSync(path.join(base,mask&(1<<i)?'postimages':'preimages-before',row.path),path.join(target,row.path));deny('mixed-'+mask)}
 for(const row of transition.changedOnly)fs.copyFileSync(path.join(base,'postimages',row.path),path.join(target,row.path));
 for(const row of transition.changedOnly){const p=path.join(target,row.path),bytes=fs.readFileSync(p);fs.writeFileSync(p,Buffer.concat([bytes,Buffer.from(' ')]));deny('corrupt-'+row.path.replaceAll('/','-'));fs.writeFileSync(p,bytes)}
 // Actual planned postimage tests run with relative imports and normal CLI in relocated checkout.
 const config=path.join(packet,'relocated-jest.config.mjs');fs.writeFileSync(config,"import config from '../../../../jest.config.mjs';\nexport default {...config,rootDir:"+JSON.stringify(target)+",roots:["+JSON.stringify(path.join(target,'tests'))+"],setupFiles:["+JSON.stringify(path.join(packet,'offline-guard.mjs'))+"],setupFilesAfterEnv:[],reporters:['default'],cacheDirectory:"+JSON.stringify(path.join(runtime,'cache'))+"};\n");
 const resultFile=path.join(runtime,'actual-postimage-four.json');child(['--experimental-vm-modules',path.join(originalRoot,'node_modules/jest/bin/jest.js'),'--config',config,'--runInBand','--no-cache','--json','--outputFile',resultFile,'--runTestsByPath',...transition.changedOnly.map(r=>path.join(target,r.path))]);
 const result=JSON.parse(fs.readFileSync(resultFile,'utf8'));assert.equal(result.numPassedTests,454);assert.equal(result.numFailedTests,0);assert.equal(result.numPendingTests,0);
 const old=JSON.parse(fs.readFileSync(path.join(base,'final-four.json'),'utf8'));for(const suite of result.testResults){const name=transition.changedOnly.find(r=>suite.name.endsWith(r.path)).path;const prior=old.testResults.find(r=>r.name.endsWith(name));assert.deepEqual(suite.assertionResults.map(a=>a.fullName),prior.assertionResults.map(a=>a.fullName))}
 fs.writeFileSync(path.join(base,'relocated-four.json'),JSON.stringify(result,null,2)+'\n');outcomes.push({name:'actual four planned postimages normal CLI in arbitrary checkout',passed:454,allFullNamesEqual:true});
 for(const row of expected)assert.equal(h(path.join(target,row.path)),row.sha256);
 const invalid=path.join(fixture,'wrong-packet-name');fs.mkdirSync(invalid);fs.copyFileSync(path.join(base,'repository-location.mjs'),path.join(invalid,'repository-location.mjs'));fs.copyFileSync(path.join(base,'containment.mjs'),path.join(invalid,'containment.mjs'));await assert.rejects(import(pathToFileURL(path.join(invalid,'repository-location.mjs')).href),/FIXED_PACKET_ANCESTRY/);outcomes.push({name:'wrong structural packet ancestry rejects before source effects'});
 console.log(JSON.stringify({scope:'EXACT_MODULE_RELOCATED_CHECKOUT_OFFLINE_ONLY',groups:outcomes.length,outcomes,commands,dependencyLinks,actualOriginalRootApplied:false,relocatedModuleBytesExact:true,originalCheckoutNotReadAsRuntimeRoot:true,nativeServices:'NOT_RUN'}));
}finally{fs.rmSync(fixture,{recursive:true,force:true})}
