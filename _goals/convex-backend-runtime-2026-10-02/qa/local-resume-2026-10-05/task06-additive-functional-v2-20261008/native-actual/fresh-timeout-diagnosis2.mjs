import {readFile,writeFile} from 'node:fs/promises';
import {join,dirname} from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import assert from 'node:assert/strict';
const q=dirname(new URL(import.meta.url).pathname),out=join(q,'fresh');
const p=JSON.parse(await readFile(join(out,'fixture-pointer.json'),'utf8'));
const s=JSON.parse(await readFile(join(p.privateDirectory,'state.json'),'utf8'));
const c=JSON.parse(await readFile(join(p.privateDirectory,'credentials.json'),'utf8'));
assert.equal(s.projectId,3172211);assert.equal(s.deploymentName,'colorless-sturgeon-703');
assert.equal(s.operation,p.operation);assert.equal(s.retired,undefined);
assert.ok(c.deployKey.startsWith('dev:'+s.deploymentName+'|'));
const start=Date.now();const results=[];
for(const key of ['adminKey','deployKey']){
  const response=await fetch(s.url+'/api/get_config_hashes',{method:'POST',headers:{Authorization:'Convex '+c[key],'Content-Type':'application/json','Convex-Client':'npm-cli-1.46.0'},body:JSON.stringify({version:'1.46.0',adminKey:c[key]}),signal:AbortSignal.timeout(30000),redirect:'error'});
  const raw=await response.text();let parsed;try{parsed=JSON.parse(raw);}catch{parsed={message:raw.replaceAll(c.adminKey,'[REDACTED]').replaceAll(c.deployKey,'[REDACTED]').slice(0,3000)};}
  const moduleHashes=parsed.moduleHashes;
  results.push({credentialKind:key,httpStatus:response.status,responseKeys:Object.keys(parsed),config:parsed.config,moduleHashes:moduleHashes,nodeVersion:parsed.nodeVersion,udfServerVersion:parsed.udfServerVersion,errorMessage:parsed.message??parsed.errorMessage});
}
const {stdout}=await promisify(execFile)('/bin/ps',['-axo','pid,ppid,etime,command'],{maxBuffer:2097152});
const matches=stdout.split('\n').filter(line=>line.includes(p.privateDirectory));
const result={operation:s.operation,projectId:s.projectId,deploymentName:s.deploymentName,readOnly:true,elapsedMs:Date.now()-start,results,ownedFixtureProcessMatches:matches,ownedDescendantsObserved:matches.length,noSignalsSent:true,originalHelperTimeoutMs:120292,at:new Date().toISOString()};
const encoded=JSON.stringify(result,null,2).replaceAll(c.adminKey,'[REDACTED]').replaceAll(c.deployKey,'[REDACTED]');
await writeFile(join(out,'post-timeout-remote-config-and-children2.json'),encoded+'\n');
console.log(JSON.stringify({projectId:s.projectId,results:results.map(x=>({credentialKind:x.credentialKind,httpStatus:x.httpStatus,responseKeys:x.responseKeys,moduleHashesCount:x.moduleHashes?.length})),ownedDescendantsObserved:matches.length,elapsedMs:result.elapsedMs}));
