from pathlib import Path
import json,re,hashlib
r=Path('/workspace/Project-Cortex');old=r/'_goals/convex-backend-runtime-2026-10-02/qa/task04-terminal-capture-parent-inputs-c7-preparation';q=r/'_goals/convex-backend-runtime-2026-10-02/qa/task04-terminal-capture-parent-inputs-c8-preparation';base=r/'_goals/convex-backend-runtime-2026-10-02/qa/task04-terminal-capture-native-extension-preparation-c3'
for name in ['extension','regression']:
 profile=base if name=='extension' else base/'regression';request=json.loads((profile/'project-request.json').read_text());source=(old/f'parent-inputs-{name}.mjs').read_text().replace('native-extension-preparation-c2','native-extension-preparation-c3').replace('native-extension-c2','native-extension-c3').replace('native-regression-c2','native-regression-c3')
 source=re.sub(r'export const profileContract=Object.freeze\(.*?\);', 'export const profileContract=Object.freeze('+json.dumps(request,separators=(',',':'))+');',source,count=1)
 begin=source.index('export async function main()');end=source.index('if(process.argv[1]',begin)
 main='''let setupStarted=false;
export async function main(){
 assert.equal(setupStarted,false,'PARENT_SETUP_ALREADY_STARTED');setupStarted=true;
 const deadline=Date.now()+120000;
 const effects={signatures:0,peerSecrets:0,configurationCalls:0,privateOutputs:[]};
 const output=(name,value)=>{const path=resolve(scratch,name);parentDeadline(deadline);exclusive(path,value);effects.privateOutputs.push(name);};
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
  const issuer=config.match(/issuer: "([^\"]+)"/)[1],aud=config.match(/applicationID: "([^\"]+)"/)[1],now=Math.floor(Date.now()/1000);
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
  process.stdout.write(JSON.stringify({status:'PASS',keysCreated:0,signatures:effects.signatures,storageCreated:0,configurationCalls:effects.configurationCalls,currentTargetDecoder:'NOT_RUN',currentCoreOwnership:'PENDING'})+'\\n');
 }catch(error){
  // Nonsecret successful-effect counts survive failure; no additional private output, retry, reset or rollback.
  if(error&&typeof error==='object'){try{Object.defineProperty(error,'parentSetupEffects',{value:Object.freeze({status:'FAIL',signatures:effects.signatures,peerSecrets:effects.peerSecrets,configurationCalls:effects.configurationCalls,privateOutputs:Object.freeze([...effects.privateOutputs])}),enumerable:true});}catch{}}
  throw error;
 }
}
'''
 source=source[:begin]+main+source[end:];(q/f'parent-inputs-{name}.mjs').write_text(source)
 watcher=(old/f'current-inputs-{name}.mjs').read_text().replace('native-extension-preparation-c2','native-extension-preparation-c3');(q/f'current-inputs-{name}.mjs').write_text(watcher)
# Public original preimages and immutable failures are retained, never rewritten.
for n in ['accepted-c6-parent-inputs.mjs.text','accepted-c6-current-inputs.mjs.text','accepted-c6-results-final02.json','accepted-c6-prior-review-results.json']:(q/n).write_bytes((old/n).read_bytes())
(q/'prior-c7-results-extension.json').write_bytes((old/'results-extension.json').read_bytes());(q/'prior-c7-results-regression.json').write_bytes((old/'results-regression.json').read_bytes())
review=r/'_goals/convex-backend-runtime-2026-10-02/qa/task04-terminal-capture-parent-inputs-c7-review'
for n in ['report.md','qa-manifest.json','hostile-extension.mjs.text','hostile-regression.mjs.text']:(q/('prior-c7-review-'+n)).write_bytes((review/n).read_bytes())
