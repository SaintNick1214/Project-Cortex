/** Parent-only strict terminal C7 profile adaptation. Imports are inert; execution requires exact module identity. */
import assert from 'node:assert/strict';
import {readFileSync,lstatSync,realpathSync} from 'node:fs';
import {resolve,dirname,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createPrivateKey,createPublicKey,sign,randomBytes} from 'node:crypto';
import {livePreflight,root,repo,scratch,json,exclusive,sha256,canonical,preservationPreflight} from './guard.mjs';


export const profileContract=Object.freeze({"version":1,"operation":"2380c3b6-aabd-482a-b1c4-14c0ca1ee0f1","purpose":"task04-model-drift-native-extra-c1","projectName":"cortex-task04-admission-disposable-6b49a7cbfb07","projectSlug":"cortex-task04-admission-disposable-6b49a7cbfb07","kind":"cloud","deploymentType":"dev","productionDeployment":false,"sharedCiTarget":false,"privateEnvironmentFile":"work/backend-runtime/task04-model-drift-native-extra-c1/deploy.env","provisionCalls":5,"provisionDeadlineMs":150000,"retirementCalls":5,"retirementDeadlineMs":180000,"runId":"admission-851322911e0342cfb35ea33e2f3f7d75"});
export const acceptedSourceBindings=Object.freeze([{"path":"convex-dev/runtimeModelPolicy.ts","sha256":"c8279d4496eb9b6eb5763732dbb7e54cefe27e028f285fe3e31a639af1535710"},{"path":"convex-dev/runtimePolicySchema.ts","sha256":"4467a4d4e424fa57cd07de95bce702108765747cfb6afa8a0756fea253926534"},{"path":"tests/unit/runtime/model-policy-admission.test.ts","sha256":"817def96244c30f0eb176afa90163f38d5c9deac842d714c9ad3c3d69829e967"},{"path":"_goals/convex-backend-runtime-2026-10-02/qa/task04-terminal-capture-product-c2-review/report.md","sha256":"5253118d0aebba82536c4e6fe416503b77432ab00a4f79200d9b24546bc2747f"},{"path":"_goals/convex-backend-runtime-2026-10-02/qa/task04-terminal-capture-product-c2-coordinator-acceptance.json","sha256":"4230f5f60bf3b9d739760d4c07cccebe63ad7b84336a9e365f1236e96002be4d"},{"path":"_goals/convex-backend-runtime-2026-10-02/qa/task04-native-admission-c8-coordinator-acceptance.json","sha256":"55807c0ee5e6e134ec28826dd15e352899dc55925cae4b4003c32e18d8391298"},{"path":"_goals/convex-backend-runtime-2026-10-02/qa/task04-model-drift-charge-only-c1-coordinator-acceptance.json","sha256":"f47f15b61609035802f9ddef11ce9b6a3d701e940c7ac50cf7047cdf8cec9862"},{"path":"tests/unit/runtime/model-policy-model-drift.test.ts","sha256":"9d5fe93afe4d55bdbe5181ddadfd48639057f8c5357f0e753b9cd9e3bb21d379"},{"path":"convex-dev/runtimeGateway.ts","sha256":"e796e43aafe70c37d8af7330a969e5b643eb58e86be7621cc7c08991ff1224be"},{"path":"tests/unit/runtime/gateway-terminal-composition.test.ts","sha256":"d324b1a85beb20fc98c1d81bc9fc592969be452ddd2d3a00886df464edc8dba1"},{"path":"convex-dev/schema.ts","sha256":"b95bdd8b643b9d8d7f3d6ed2770181cff15e116110af3b3648bb4492e58495c2"}]);
export const candidateArgument="task04-model-drift-native-extra-preparation-c1";
export function strictProfile(){assert.equal(root,resolve(repo,"_goals/convex-backend-runtime-2026-10-02/qa/task04-model-drift-native-extra-preparation-c1"),'PARENT_PROFILE_ROOT');const request=json(resolve(root,'project-request.json'));assert.equal(JSON.stringify(request),JSON.stringify(profileContract),'PARENT_PROFILE_CONTRACT');assert.equal(scratch,resolve(repo,dirname(profileContract.privateEnvironmentFile)),'PARENT_PROFILE_SCRATCH');for(const row of acceptedSourceBindings)assert.equal(sha256(readFileSync(canonical(resolve(repo,row.path),repo))),row.sha256,'PARENT_ACCEPTED_SOURCE_DRIFT');return request;}
export function parentDeadline(deadline){assert.ok(Date.now()<deadline,'PARENT_TOTAL_TIME_BUDGET');}

export const historicalSources=Object.freeze({
 'owned-foundation-29178d862bcf4a31926b4530c322efd4.json':{sha256:'dad0b33db5ab6c59412116e8f422119a60659032bc56204cf2b5b3f5db12c988',bytes:13654},
 'owned-journal-foundation-29178d862bcf4a31926b4530c322efd4.jsonl':{sha256:'a4ab88d904f3962efe5998eb73c501df8a4c64b37cbc0f6f22da0a4cbb0a2e9d',bytes:12268502},
 'qualify-325ff9b9-223e-47c5-b245-f50e5162b0cc.json':{sha256:'754c6876005896ed566a3c6118f67a31b9526406f2678e9ec3754d5bc9cd75fe',bytes:454},
 'target-retirement.json':{sha256:'83d36a299f18465aedd12c0280a810e1eacef20b30b7ba172d1ff0a95dcf97f2',bytes:529}
});
export const historicalLocatorHashes=Object.freeze({
 _storage:'e51631743959cf873fe52e7914faf30ac6e11eeec8aff0e1234969ce6966f12e',facts:'8d499e7290d76f479b9202346c1bd4fabc530b7d73102876171eb0aba7e9e299',governancePolicies:'f08f2a6840d72dd4591a62744badcd5e9255479041d1345b7f218e83550a704e',graphSyncQueue:'4aa1dffcca9a8e4b0a8740748a11c986f87176dccb082a033e5d2a0db5c5cae7',memories:'acfe0428377f70f6f2a07d7437bf056f96f9d43b980435fb016a59c352e1949d',runtimeAuthGrants:'4de07a16762f266ec7dbcd2c862376fca5f156cfae371328ee7188d8262ab14f',runtimeAuthMemberships:'f5d6891e916aca25e89f17e42018a447d8f875401ddaf542f569d04510540775',runtimeAuthPrincipals:'4e7f6ff86813439433bb88a01f43e0ab6c7463f08eb2bd27538bc786d264b7ec',runtimeMemoryVectors:'15c9c0762537c8c8e78e800d640b8faef6b1f16ff9446fe76a8a8d06ca1e8a36'
});
export function exactKeys(value,keys){assert.ok(value&&typeof value==='object'&&!Array.isArray(value),'PARENT_OBJECT');assert.deepEqual(Object.keys(value).sort(),[...keys].sort(),'PARENT_FIELDS');}
export function boundedId(id){assert.equal(typeof id,'string','PARENT_LOCATOR');assert.ok(id.length>0&&id.length<=128&&!/[\s\x00-\x1f\x7f]/.test(id),'PARENT_LOCATOR');return id;}
export function privateParentFile(path,base){canonical(path,base,true);const file=lstatSync(path),parent=dirname(path),directory=lstatSync(parent);assert.ok(file.isFile()&&file.uid===process.getuid()&&file.nlink===1&&(file.mode&511)===384,'PARENT_PRIVATE_FILE');assert.ok(directory.isDirectory()&&!directory.isSymbolicLink()&&directory.uid===process.getuid()&&(directory.mode&511)===448&&realpathSync(parent)===parent,'PARENT_PRIVATE_DIRECTORY');return path;}
export function readPrivate(path,base){return readFileSync(privateParentFile(path,base));}
export function currentTarget(phase,previous){const request=strictProfile();const {target,values}=livePreflight(phase);assert.equal(target.purpose,request.purpose,'PARENT_PURPOSE');assert.equal(target.kind,'cloud','PARENT_KIND');assert.equal(target.deploymentType,'dev','PARENT_DEVELOPMENT');assert.equal(target.productionDeployment,false,'PARENT_PRODUCTION');assert.equal(target.sharedCiTarget,false,'PARENT_SHARED');assert.equal(target.projectSlug,request.projectSlug,'PARENT_SLUG');assert.equal(target.projectName,request.projectName,'PARENT_NAME');assert.equal(target.privateEnvironmentFile,request.privateEnvironmentFile,'PARENT_ENV_PATH');assert.ok(![3138249,3138926,3139060,3139165,3139288,3139416,3139649].includes(target.projectId),'PARENT_RETIRED_PROJECT');assert.ok(!['admired-walrus-730','efficient-ox-979','fiery-setter-784','kindhearted-dalmatian-90','helpful-possum-136','rightful-goldfinch-553','courteous-boar-322','impressive-anaconda-728','exciting-snake-863'].includes(target.deploymentName),'PARENT_RETIRED_DEPLOYMENT');assert.equal(target.operation,request.operation,'PARENT_OPERATION');assert.equal(target.runId,request.runId,'PARENT_RUN');assert.equal(scratch,resolve(repo,dirname(request.privateEnvironmentFile)),'PARENT_PRIVATE_PATH');const identity={operation:target.operation,runId:target.runId,requestSha256:target.requestSha256,projectId:target.projectId,projectSlug:target.projectSlug,projectName:target.projectName,deploymentName:target.deploymentName,deploymentUrl:target.deploymentUrl,privateEnvironmentFile:target.privateEnvironmentFile};assert.equal(identity.requestSha256,sha256(JSON.stringify(request)),'PARENT_REQUEST');if(previous)assert.deepEqual(identity,previous,'PARENT_TARGET_CHANGED');return {target,values,identity};}
export function historicalEvidence(){const old=resolve(repo,'work/backend-runtime/task03-foundation-live-c11'),original={};for(const[name,expected]of Object.entries(historicalSources)){const bytes=readFileSync(canonical(resolve(old,name),old));assert.equal(bytes.length,expected.bytes,'HISTORICAL_SOURCE_BYTES');assert.equal(sha256(bytes),expected.sha256,'HISTORICAL_SOURCE_HASH');original[name]=bytes;}
 const names=Object.keys(historicalSources),owned=JSON.parse(original[names[0]]),qualified=JSON.parse(original[names[2]]),retired=JSON.parse(original[names[3]]);assert.equal(qualified.status,'PASS');assert.equal(qualified.cleanupComplete,true);assert.equal(qualified.counts.failed,0);assert.equal(qualified.counts.skipped,0);assert.equal(qualified.counts.blocked,0);assert.equal(retired.status,'PASS');assert.equal(retired.deletionHttpStatus,200);assert.equal(retired.absentProjectHttpStatus,404);assert.equal(retired.projectId,3138249);assert.equal(retired.verifiedOnlyDevelopmentCloudDeployment,true);assert.equal(retired.managementCalls,5);assert.equal(owned.files.length,2);assert.equal(typeof owned.run,'string');assert.ok(original[names[1]].toString().endsWith('\n'),'HISTORICAL_PARTIAL_JOURNAL');
 const journal=original[names[1]].toString().trimEnd().split('\n').map(s=>JSON.parse(s)),ids={_storage:boundedId(owned.files[0].id)},witnesses=[];
 for(const table of Object.keys(historicalLocatorHashes).filter(t=>t!=='_storage')){const refs=owned.refs.filter(row=>row.table===table);assert.ok(refs.length>0,'HISTORICAL_REF');ids[table]=boundedId(refs[0].id);}
 for(const [table,id]of Object.entries(ids)){assert.equal(sha256(id),historicalLocatorHashes[table],'HISTORICAL_LOCATOR_HASH');const witness=journal.findIndex(row=>row.run===owned.run&&(table==='_storage'?row.files?.some(f=>f.id===id):row.refs?.some(ref=>ref.table===table&&ref.id===id)));assert.ok(witness>=0,'HISTORICAL_JOURNAL_WITNESS');witnesses.push({table,locatorSHA256:sha256(id),journalRow:witness+1});}
 return {ids,sources:historicalSources,historicalOwnedRunSHA256:sha256(owned.run),journalWitnesses:witnesses};
}
export function initialProof(target,evidence,observedAt=new Date().toISOString()){return {operation:target.operation,runId:target.runId,observedAt,historicalTargetProjectId:3138249,historicalQualification:'PASS',historicalOwnedCleanup:true,historicalProjectDeletion:200,historicalProjectAbsence:404,storageCreatedHere:0,currentTargetDecoder:'NOT_RUN',newOperationAttemptIDs:'PENDING_CURRENT_CORE_OWNERSHIP',sources:evidence.sources,historicalOwnedRunSHA256:evidence.historicalOwnedRunSHA256,journalWitnesses:evidence.journalWitnesses,locators:Object.entries(evidence.ids).map(([table,id])=>({table,locatorSHA256:sha256(id),provenance:'previously native-issued owned locator; original target cleaned and retired; current decoding not claimed'}))};}
export function validateHistoricalInputs(target,history,proof,evidence){exactKeys(history,['operation','runId','ids','provenanceSHA256']);assert.equal(history.operation,target.operation);assert.equal(history.runId,target.runId);exactKeys(history.ids,Object.keys(historicalLocatorHashes));for(const[table,id]of Object.entries(history.ids))assert.equal(sha256(boundedId(id)),historicalLocatorHashes[table]);assert.equal(typeof proof.observedAt,'string');assert.ok(Number.isFinite(Date.parse(proof.observedAt)),'PROOF_TIMESTAMP');const expected=initialProof(target,evidence,proof.observedAt);assert.deepEqual(proof,expected,'INITIAL_PROVENANCE');assert.equal(history.provenanceSHA256,sha256(JSON.stringify(proof)),'INITIAL_PROVENANCE_DIGEST');}
let setupStarted=false;
export async function main(){
 assert.equal(setupStarted,false,'PARENT_SETUP_ALREADY_STARTED');setupStarted=true;
 const deadline=Date.now()+120000;
 const effects={signatures:0,peerSecrets:0,configurationCalls:0,privateOutputs:[],privateOutputStates:[]};
 const output=(name,value)=>{
  const path=resolve(scratch,name),state={name,created:false,written:false,durable:false,closed:false};
  exclusive(path,value,true,undefined,{deadlineMs:deadline,beforeCreate:()=>parentDeadline(deadline),observe:phase=>{
   if(phase==='created'){assert.equal(state.created,false,'PARENT_OUTPUT_CREATED_ONCE');state.created=true;effects.privateOutputs.push(name);effects.privateOutputStates.push(state);}
   else{assert.equal(state.created,true,'PARENT_OUTPUT_CREATED');assert.ok(['written','durable','closed'].includes(phase),'PARENT_OUTPUT_PHASE');state[phase]=true;}
  }});
  parentDeadline(deadline);
 };
 try{
  if(process.argv[2]!==undefined)assert.equal(process.argv[2],candidateArgument,'PARENT_CANDIDATE');
  strictProfile();preservationPreflight();parentDeadline(deadline);
  const {target,values,identity}=currentTarget();
  for(const name of ['initial-physical-id-provenance.json','historical-native-locators.json','identities.json','peer-config.json','parent-inputs-receipt.json'])assert.equal(lstatSync(resolve(scratch,name),{throwIfNoEntry:false}),undefined,'PARENT_SETUP_EXISTING_OUTPUT');
  const keyPath=resolve(repo,'work/backend-runtime/qualification/jwt-private.pem');privateParentFile(keyPath,repo);
  const evidence=historicalEvidence();parentDeadline(deadline);
  const privateKey=createPrivateKey(readPrivate(keyPath,repo)),pub=createPublicKey(privateKey).export({format:'jwk'});
  const config=readFileSync(canonical(resolve(root,'fixture/convex/auth.config.ts'),root),'utf8');
  const jwks=JSON.parse(Buffer.from(config.match(/base64,([A-Za-z0-9+/=]+)/)[1],'base64'));
  assert.ok(Array.isArray(jwks.keys)&&jwks.keys.length===1,'PARENT_JWKS');const expected=jwks.keys[0];
  assert.equal(expected.kty,'RSA','PARENT_JWKS');assert.equal(typeof expected.kid,'string','PARENT_JWKS');assert.ok(expected.kid.length>0,'PARENT_JWKS');assert.equal(pub.n,expected.n);assert.equal(pub.e,expected.e);
  const issuer=config.match(/issuer: "([^"]+)"/)[1],aud=config.match(/applicationID: "([^"]+)"/)[1],now=Math.floor(Date.now()/1000);
  const jwt=(subject,override={})=>{
   const head=Buffer.from(JSON.stringify({alg:'RS256',typ:'JWT',kid:expected.kid})).toString('base64url');
   const payload=Buffer.from(JSON.stringify({iss:issuer,aud,sub:subject,iat:now,exp:now+7200,...override})).toString('base64url'),input=head+'.'+payload,bytes=Buffer.from(input);
   parentDeadline(deadline);const signature=sign('RSA-SHA256',bytes,privateKey);effects.signatures++;
   return input+'.'+signature.toString('base64url');
  };
  const owner=target.runId+'-security-owner',foreign=target.runId+'-security-foreign',forged=jwt(owner).split('.'),damaged=Buffer.from(forged[2],'base64url');damaged[0]^=1;forged[2]=damaged.toString('base64url');
  const identities={operation:target.operation,runId:target.runId,ownerJWT:jwt(owner),readerJWT:jwt(target.runId+'-security-reader'),identities:{noJWT:null,forgedJWT:forged.join('.'),wrongIssuer:jwt(owner,{iss:'https://wrong-cortex-qualification.invalid'}),wrongAudience:jwt(owner,{aud:'wrong-cortex-task01'}),expiredJWT:jwt(owner,{exp:now-60,iat:now-120}),ungranted:jwt(target.runId+'-ungranted'),foreign:jwt(foreign)}};
  assert.equal(effects.signatures,8);
  const proof=initialProof(target,evidence),history={operation:target.operation,runId:target.runId,ids:evidence.ids,provenanceSHA256:sha256(JSON.stringify(proof))};validateHistoricalInputs(target,history,proof,evidence);
  currentTarget(undefined,identity);preservationPreflight();
  output('initial-physical-id-provenance.json',proof);
  output('historical-native-locators.json',history);
  output('identities.json',identities);
  parentDeadline(deadline);const peerSecret=randomBytes(32).toString('hex');effects.peerSecrets++;
  output('peer-config.json',{operation:target.operation,peerSecret});
  currentTarget(undefined,identity);
  const startedAt=new Date().toISOString(),url=target.deploymentUrl+'/api/update_environment_variables',options={method:'POST',redirect:'error',headers:{Authorization:'Convex '+values.CONVEX_DEPLOY_KEY,'Content-Type':'application/json'},body:JSON.stringify({changes:[{name:'CORTEX_QA_TASK04_PEER_SECRET',value:peerSecret}]}),signal:AbortSignal.timeout(30000)};
  parentDeadline(deadline);effects.configurationCalls++;const response=await fetch(url,options);
  assert.equal(response.status,200,'owned peer environment update');const body=await response.text();assert.ok(Buffer.byteLength(body)<=16384);
  currentTarget(undefined,identity);preservationPreflight();
  const receipt={operation:target.operation,runId:target.runId,status:'PASS',startedAt,observedAt:new Date().toISOString(),adapterSourceSHA256:sha256(readFileSync(canonical(fileURLToPath(import.meta.url),repo))),keysCreated:0,signatures:effects.signatures,identityNegativeCount:7,storageCreated:0,configurationCalls:effects.configurationCalls,configurationVariable:'CORTEX_QA_TASK04_PEER_SECRET',configurationHTTPStatus:response.status,historicalProvenanceSHA256:sha256(readPrivate(resolve(scratch,'initial-physical-id-provenance.json'),scratch)),currentTargetDecoder:'NOT_RUN',currentCoreOwnership:'PENDING'};
  output('parent-inputs-receipt.json',receipt);
  process.stdout.write(JSON.stringify({status:'PASS',keysCreated:0,signatures:effects.signatures,storageCreated:0,configurationCalls:effects.configurationCalls,currentTargetDecoder:'NOT_RUN',currentCoreOwnership:'PENDING'})+'\n');
 }catch(error){
  // Nonsecret successful-effect counts survive failure; no additional private output, retry, reset or rollback.
  if(error&&typeof error==='object'){try{Object.defineProperty(error,'parentSetupEffects',{value:Object.freeze({status:'FAIL',signatures:effects.signatures,peerSecrets:effects.peerSecrets,configurationCalls:effects.configurationCalls,privateOutputs:Object.freeze([...effects.privateOutputs]),privateOutputStates:Object.freeze(effects.privateOutputStates.map(state=>Object.freeze({...state})))}),enumerable:true});}catch{}}
  throw error;
 }
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))await main();
