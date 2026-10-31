/** Finite, read-only actual private custody/crypto observer. Never prints private bytes. */
import assert from 'node:assert/strict';
import {constants,closeSync,fstatSync,lstatSync,openSync,readSync,readdirSync,realpathSync} from 'node:fs';
import {createHash,createPrivateKey,createPublicKey,sign,verify,constants as cryptoConstants} from 'node:crypto';
const OP='c9fbaa34-8ca8-4153-b8bd-1cfe60a8241f';
const source='/owned/native/source-'+OP,destination='/owned/private';
const names=['jwt-private.pem','target.json','deploy.env'];
const fields=['dev','ino','mode','nlink','uid','gid','size','mtimeNs','ctimeNs'];
const outputFields=['st_dev','st_ino','st_mode','st_nlink','st_uid','st_gid','st_size','st_mtime_ns','st_ctime_ns'];
const id=s=>Object.fromEntries(fields.map((k,i)=>[outputFields[i],String(s[k])]));
const sha=b=>createHash('sha256').update(b).digest('hex');
const held=[];let phase='runtime';
function openHeld(path,directory=false){
 const before=lstatSync(path,{bigint:true}),fd=openSync(path,constants.O_RDONLY|constants.O_NOFOLLOW|(directory?constants.O_DIRECTORY:0));
 const row={path,fd,pin:id(before),directory};held.push(row);return row;
}
function qualify(row,collect=false){
 const {path,fd,pin,directory}=row;let prefix='';
 for(const component of path.split('/').filter(Boolean)){prefix+='/'+component;const s=lstatSync(prefix,{bigint:true});assert.equal(s.isSymbolicLink(),false);assert.equal(realpathSync(prefix),prefix);if(prefix!==path)assert.equal(s.isDirectory(),true);}
 const before=lstatSync(path,{bigint:true});assert.equal(before.isDirectory(),directory);assert.equal(directory||before.isFile(),true);
 assert.equal(pin.st_uid,'501');assert.equal(pin.st_gid,'20');assert.equal(BigInt(pin.st_mode)&0o777n,directory?0o700n:0o600n);
 if(!directory)assert.equal(pin.st_nlink,'1');
 assert.deepEqual(id(before),pin);assert.deepEqual(id(fstatSync(fd,{bigint:true})),pin);
 if(directory)return {path,identityDecimal:pin,ownerModeNoAlias:true};
 assert.ok(BigInt(pin.st_size)>0n&&BigInt(pin.st_size)<=65536n);
 const chunks=[],hash=createHash('sha256'),buffer=Buffer.alloc(65536);let size=0,n=0,offset=0;
 while((n=readSync(fd,buffer,0,buffer.length,offset))!==0){size+=n;offset+=n;assert.ok(BigInt(size)<=BigInt(pin.st_size));hash.update(buffer.subarray(0,n));if(collect)chunks.push(Buffer.from(buffer.subarray(0,n)));}
 assert.equal(String(size),pin.st_size);assert.deepEqual(id(fstatSync(fd,{bigint:true})),pin);assert.deepEqual(id(lstatSync(path,{bigint:true})),pin);
 return {path,sha256:hash.digest('hex'),bytes:size,identityDecimal:pin,fullEOF:true,allNinePreOpenPostFinal:true,...(collect?{body:Buffer.concat(chunks)}:{})};
}
function json(buffer){return JSON.parse(buffer.toString('utf8'));}
function compareOriginal(row,expected,identityField){assert.equal(row.sha256,expected.sha256);assert.equal(row.bytes,expected.bytes);assert.deepEqual(row.identityDecimal,expected[identityField]);}
function noBody(row){const {body,name,...rest}=row;return rest;}
function validateCurrentBinding(bindingRow,requestRow){
 assert.deepEqual(bindingRow.identityDecimal,CURRENT_BINDING_ORIGINAL_NINE);
 assert.equal(bindingRow.sha256,'3cf0becc5cbb8718bb01c3566e9cb8d71aae1f8c30348aeff7ac40e3f5e9b08e');
 const binding=json(bindingRow.body),request=json(requestRow.body);
 assert.deepEqual(Object.keys(binding).sort(),['operation','requestSha256','projectSlug','projectName','teamId','privateEnvironmentFile','forbiddenRetiredDeployments'].sort());
 for(const field of ['operation','requestSha256','projectSlug','projectName','teamId','privateEnvironmentFile']){
  const expected=field==='requestSha256'?sha(JSON.stringify(request)):request[field];assert.equal(binding[field],expected);
  assert.equal(typeof binding[field],field==='teamId'?'number':'string');
 }
 assert.equal(binding.operation,OP);assert.equal(binding.projectSlug,'cortex-foundation-delta-312f13a61cc6');assert.equal(binding.projectName,binding.projectSlug);assert.equal(binding.teamId,325340);
 assert.deepEqual(binding.forbiddenRetiredDeployments,['efficient-ox-979','fiery-setter-784','admired-walrus-730','quaint-jellyfish-819','joyous-ostrich-974','gallant-mastiff-565','brilliant-chinchilla-648']);
 assert.equal(request.requiredKind,'cloud');assert.equal(request.requiredDeploymentType,'dev');assert.equal(request.maximumPaidCalls,0);assert.equal(request.productionDeployment,false);assert.equal(request.sharedCiTarget,false);assert.equal(request.retirementRequired,true);
 return {binding,request};
}
try{
 assert.equal(process.version,'v24.15.0');assert.equal(process.platform,'linux');assert.equal(process.arch,'x64');assert.equal(process.getuid(),501);assert.equal(process.getgid(),20);
 assert.equal(process.env.HOME,'/tmp');assert.equal(Number(lstatSync('/tmp').mode)&0o777,0o700);assert.equal(Object.keys(process.env).some(k=>k.startsWith('CONVEX')),false);
 assert.equal(process.env.NODE_OPTIONS,undefined);
 // This separately observed public binding is qualified before ANY private stat/open/read.
 const currentBindingHandle=openHeld('/current-transport-binding.json'),currentRequestHandle=openHeld('/prep/project-request.json');
 const currentBindingRow=qualify(currentBindingHandle,true),currentRequestRow=qualify(currentRequestHandle,true);
 validateCurrentBinding(currentBindingRow,currentRequestRow);
 const roots=[openHeld(source,true),openHeld(destination,true)];
 const receiptHandles={native:openHeld('/owned/receipts/source-'+OP+'.json'),destination:openHeld(destination+'/private-receive-custody.json')};
 const sourceHandles=[...names,'transport-stage.json'].map(name=>({name,handle:openHeld(source+'/'+name)}));
 const destHandles=names.map(name=>({name,handle:openHeld(destination+'/'+name)}));
 const publicHandles={binding:currentBindingHandle,request:currentRequestHandle,identity:openHeld('/prep/fresh-identity-public.json'),auth:openHeld('/prep/managed-fixture/fixture/convex/auth.config.ts')};
 // All actual private descriptors are captured and held before first content/identity qualification.
 const preContentObservationStart=performance.now();Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,20000);assert.ok(performance.now()-preContentObservationStart>=20000);
 phase='receipt';
 const nativeReceiptRow=qualify(receiptHandles.native,true),destReceiptRow=qualify(receiptHandles.destination,true);
 const nativeReceipt=json(nativeReceiptRow.body),destReceipt=json(destReceiptRow.body);
 assert.equal(nativeReceipt.scope,'NEW_PROSPECTIVE_NATIVE_SOURCE_ACQUISITION');assert.equal(nativeReceipt.status,'PASS');assert.equal(nativeReceipt.operation,OP);assert.equal(nativeReceipt.hostTuplesAreNativeAuthority,false);assert.equal(nativeReceipt.exactEOF,true);assert.equal(nativeReceipt.filesHeldThroughReceipt,true);
 assert.equal(destReceipt.scope,'NEW_PROSPECTIVE_LINUX_PRIVATE_RECEIVE');assert.equal(destReceipt.operation,OP);assert.equal(destReceipt.sourceDescriptorHeld,true);assert.equal(destReceipt.actualServiceRequests,0);
 assert.deepEqual(nativeReceipt.files.map(r=>r.path),[...names,'transport-stage.json']);assert.deepEqual(destReceipt.files.map(r=>r.path),names);
 assert.deepEqual(readdirSync(source).sort(),[...names,'transport-stage.json'].sort());assert.deepEqual(readdirSync(destination).sort(),[...names,'private-receive-custody.json'].sort());
 const rootRows=roots.map(r=>qualify(r));assert.deepEqual(rootRows[0].identityDecimal,nativeReceipt.nativeDirectoryIdentityDecimal);
 phase='custody';
 const sourceRows=sourceHandles.map(({name,handle})=>({name,...qualify(handle,true)}));const destRows=destHandles.map(({name,handle})=>({name,...qualify(handle,true)}));
 for(const row of sourceRows){compareOriginal(row,nativeReceipt.files.find(r=>r.path===row.name),'nativeIdentityDecimal');}
 for(const row of destRows){const expected=destReceipt.files.find(r=>r.path===row.name);compareOriginal(row,expected,'destinationIdentityDecimal');const original=sourceRows.find(r=>r.name===row.name);assert.deepEqual(original.identityDecimal,expected.sourceIdentityDecimal);assert.equal(row.sha256,original.sha256);assert.equal(row.bytes,original.bytes);assert.deepEqual(row.body,original.body);}
 const transport=json(sourceRows.find(r=>r.name==='transport-stage.json').body);assert.equal(transport.operation,OP);assert.equal(transport.files.length,3);assert.equal(transport.sourceDescriptorHeld,true);
 for(const row of sourceRows.filter(r=>names.includes(r.name)))assert.equal(row.sha256,transport.files.find(r=>r.path===row.name).sha256);
 const publicRows=Object.fromEntries(Object.entries(publicHandles).map(([k,v])=>[k,qualify(v,true)]));
 const binding=json(publicRows.binding.body),request=json(publicRows.request.body),fresh=json(publicRows.identity.body);
 assert.equal(publicRows.binding.sha256,'3cf0becc5cbb8718bb01c3566e9cb8d71aae1f8c30348aeff7ac40e3f5e9b08e');
 assert.equal(sha(JSON.stringify(request)),binding.requestSha256);assert.equal(binding.operation,OP);assert.equal(nativeReceipt.requestSha256,binding.requestSha256);assert.equal(destReceipt.requestSha256,binding.requestSha256);assert.equal(transport.requestSha256,binding.requestSha256);
 assert.equal(publicRows.auth.sha256,fresh.freshAuthSha256);assert.equal(fresh.algorithm,'RS256');assert.equal(fresh.modulusLength,2048);
 phase='crypto';
 const auth=publicRows.auth.body.toString('utf8');
 const authMatch=auth.match(/providers:\s*\[\{\s*type:\s*"customJwt",\s*applicationID:\s*"([^"]+)",\s*issuer:\s*"([^"]+)",\s*jwks:\s*"(data:text\/plain;charset=utf-8;base64,[A-Za-z0-9+/=]+)",\s*algorithm:\s*"RS256"\s*\}\s*\]/);
 assert.ok(authMatch);assert.equal(authMatch[1],fresh.audience);assert.equal(authMatch[2],fresh.issuer);
 const encoded=authMatch[3].split(',')[1],decoded=Buffer.from(encoded,'base64');assert.equal(decoded.toString('base64'),encoded);const jwks=json(decoded);assert.deepEqual(jwks,fresh.publicJwks);assert.equal(jwks.keys.length,1);
 const jwk=jwks.keys[0];assert.equal(jwk.kid,fresh.kid);assert.equal(jwk.alg,'RS256');assert.equal(jwk.use,'sig');assert.equal(jwk.kty,'RSA');assert.equal(sha(JSON.stringify(jwk)),fresh.publicJwkSha256);
 const pem=destRows.find(r=>r.name==='jwt-private.pem').body,key=createPrivateKey(pem);assert.equal(key.type,'private');assert.equal(key.asymmetricKeyType,'rsa');assert.equal(key.asymmetricKeyDetails.modulusLength,2048);
 const publicKey=createPublicKey(key),derived=publicKey.export({format:'jwk'});assert.equal(derived.kty,jwk.kty);assert.equal(derived.n,jwk.n);assert.equal(derived.e,jwk.e);
 const frozenPublic=createPublicKey({key:jwk,format:'jwk'});assert.equal(frozenPublic.asymmetricKeyDetails.modulusLength,2048);
 const proof=Buffer.from('cortex-task03-independent-local-rs256-proof:'+OP),signature=sign('RSA-SHA256',proof,{key,padding:cryptoConstants.RSA_PKCS1_PADDING});
 assert.equal(verify('RSA-SHA256',proof,{key:frozenPublic,padding:cryptoConstants.RSA_PKCS1_PADDING},signature),true);
 assert.equal(verify('RSA-SHA256',Buffer.concat([proof,Buffer.from('changed')]),{key:frozenPublic,padding:cryptoConstants.RSA_PKCS1_PADDING},signature),false);
 phase='env';
 const env=destRows.find(r=>r.name==='deploy.env').body.toString('utf8');assert.ok(env.endsWith('\n'));
 const lines=env.slice(0,-1).split('\n');assert.equal(lines.length,3);
 const values={};for(const line of lines){const m=line.match(/^(CONVEX_DEPLOY_KEY|CONVEX_DEPLOYMENT|CONVEX_URL)=([^\s\x00-\x20\x7f\u2028\u2029]+)$/u);assert.ok(m);assert.equal(Object.hasOwn(values,m[1]),false);values[m[1]]=m[2];}
 assert.deepEqual(Object.keys(values),['CONVEX_DEPLOY_KEY','CONVEX_DEPLOYMENT','CONVEX_URL']);
 phase='target';
 const target=json(destRows.find(r=>r.name==='target.json').body);assert.deepEqual(Object.keys(target).sort(),[...request.targetFields].sort());
 for(const k of ['operation','purpose','projectName','projectSlug','teamId','privateEnvironmentFile'])assert.equal(target[k],request[k]);
 for(const k of ['operation','requestSha256','projectSlug','projectName','teamId','privateEnvironmentFile'])assert.equal(target[k],binding[k]);
 assert.equal(target.requestSha256,binding.requestSha256);assert.equal(target.kind,'cloud');assert.equal(target.deploymentType,'dev');
 for(const k of ['active','isolationVerified','freshManagedProject'])assert.equal(target[k],true);
 for(const k of ['retired','deleted','productionDeployment','sharedCiTarget'])assert.equal(target[k],false);
 assert.equal(request.requiredKind,'cloud');assert.equal(request.requiredDeploymentType,'dev');assert.equal(request.maximumPaidCalls,0);assert.equal(request.sharedCiTarget,false);assert.equal(request.productionDeployment,false);assert.equal(request.retirementRequired,true);
 assert.equal(target.teamId,325340);assert.ok(Number.isSafeInteger(target.projectId)&&target.projectId>0);assert.ok(/^cortex-foundation-delta-[a-f0-9]{12}$/.test(target.projectSlug));assert.equal(target.projectName,target.projectSlug);
 assert.ok(/^[a-z0-9]+(?:-[a-z0-9]+)+$/.test(target.deploymentName));assert.equal(binding.forbiddenRetiredDeployments.includes(target.deploymentName),false);
 assert.ok(Number.isFinite(Date.parse(target.createdAt))&&Date.parse(target.createdAt)>=Date.parse(fresh.generatedAt));assert.equal(target.deploymentUrl,'https://'+target.deploymentName+'.convex.cloud');
 const prefix='dev:'+target.deploymentName+'|';assert.equal(values.CONVEX_DEPLOYMENT,'dev:'+target.deploymentName);assert.equal(values.CONVEX_URL,target.deploymentUrl);assert.ok(values.CONVEX_DEPLOY_KEY.startsWith(prefix)&&values.CONVEX_DEPLOY_KEY.length>prefix.length&&values.CONVEX_DEPLOY_KEY.length<=8192);
 // Independent current observation: keep every original descriptor held for 20 seconds.
 const observationStart=performance.now();Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,20000);assert.ok(performance.now()-observationStart>=20000);
 phase='final';
 const original=new Map([...sourceRows,...destRows,...Object.values(publicRows),nativeReceiptRow,destReceiptRow].map(r=>[r.path,noBody(r)]));
 for(const row of held){const final=qualify(row);if(!row.directory)assert.deepEqual(final,original.get(row.path));}
 const result={scope:'ACTUAL_PRIVATE_CUSTODY_CRYPTO_ENV_TARGET_ONLY',status:'PASS',operation:OP,nativeSourceFiles:4,privateDestinationFiles:3,sourceOriginalNineFullEOFHashSize:true,destinationOriginalNineFullEOFHashSize:true,currentDescriptorsHeldThroughFinal:true,allPrivateSourceDestinationFullBytes:true,nativeSourceDirectoryOriginalNine:true,destinationDirectoryCurrentNine:true,ownedMode600Nlink1NoAliases:true,receiptDurableAndHeldFlags:true,sourceFiles:sourceRows.map(({name,...r})=>({name,...noBody(r)})),destinationFiles:destRows.map(({name,...r})=>({name,...noBody(r)})),receiptRows:[noBody(nativeReceiptRow),noBody(destReceiptRow)],directoryRows:rootRows,publicRows:Object.fromEntries(Object.entries(publicRows).map(([k,v])=>[k,noBody(v)])),rsa2048:true,privateKeyMatchesFrozenSingleJwk:true,rs256SignVerify:true,changedMessageRejected:true,kidIssuerAudienceAuthConfigMatch:true,publicJwkSha256:fresh.publicJwkSha256,privateKeySha256:destRows.find(r=>r.name==='jwt-private.pem').sha256,exactEnvironmentEntries:3,envSelectorMatchesOwnedDevTarget:true,freshIsolatedCloudDev:true,productionSharedLocalTargets:false,maximumPaidCalls:0,currentTransportBindingSha256:publicRows.binding.sha256,currentTransportBindingSixFieldsCanonical:true,currentTransportBindingSeparatePublicInput:true,currentTransportBindingOriginalNineFullEOFHashSize:true,targetBindingHash:sha(JSON.stringify({projectId:target.projectId,deploymentName:target.deploymentName,projectSlug:target.projectSlug,requestSha256:target.requestSha256})),externalRequests:0,serviceDeployments:0,volumeWrites:0,privateBytesPrinted:false,jwtTokensCreated:0,officialCliDispatched:false,nativeFoundationAccepted:false,fullTask03:false};
 const raw=Buffer.from(JSON.stringify(result)+'\n');assert.ok(raw.length<=262144);process.stdout.write(raw);
}catch{process.stdout.write(JSON.stringify({scope:'ACTUAL_PRIVATE_CUSTODY_CRYPTO_ENV_TARGET_ONLY',status:'FAIL_PRESERVED',failurePhase:phase,privateBytesPrinted:false,externalRequests:0,officialCliDispatched:false,nativeFoundationAccepted:false,fullTask03:false})+'\n');process.exitCode=1;}
finally{for(const row of held)closeSync(row.fd);}
