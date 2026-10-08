from pathlib import Path
r=Path('/workspace/Project-Cortex');w=r/'work/resume/task04-terminal-capture-parent-inputs-c8-preparation';q=r/'_goals/convex-backend-runtime-2026-10-02/qa/task04-terminal-capture-parent-inputs-c8-preparation';old=r/'_goals/convex-backend-runtime-2026-10-02/qa/task04-terminal-capture-parent-inputs-c7-review'
for name in ['extension','regression']:
 # The unchanged reviewer observation body is retained and executed on immutable C7; only work/cwd ownership relocated.
 reviewer=(old/f'hostile-{name}.mjs.text').read_text().replace('work/resume/task04-terminal-capture-parent-inputs-c7-review/','work/resume/task04-terminal-capture-parent-inputs-c8-preparation/reviewer-C7-')
 (w/f'reviewer-observation-C7-{name}.mjs').write_text(reviewer);(w/f'reviewer-C7-{name}').mkdir(exist_ok=True)
 # Identical requirement assertions and exact reviewer clock injections; only selected immutable subject/profile paths vary by env.
 envbody=reviewer[:reviewer.index('const failures=[];')]
 envbody=envbody.replace("const fakeLstat=p=>{const s=fs.lstatSync(p);","const fakeLstat=(p,options)=>{const s=fs.lstatSync(p,options);if(s===undefined)return s;")
 envbody=envbody.replace("const repo=process.cwd(),qa=", "const subject=process.env.C8_SUBJECT??'c8';const repo=process.cwd(),qa=")
 envbody=envbody.replace("path.resolve('_goals/convex-backend-runtime-2026-10-02/qa/task04-terminal-capture-parent-inputs-c7-preparation')","path.resolve('_goals/convex-backend-runtime-2026-10-02/qa/task04-terminal-capture-parent-inputs-'+(subject==='c7'?'c7':'c8')+'-preparation')")
 envbody=envbody.replace('work/resume/task04-terminal-capture-parent-inputs-c8-preparation/reviewer-C7-'+name,'work/resume/task04-terminal-capture-parent-inputs-c8-preparation/requirement-'+name)
 envbody=envbody.replace("candidate=path.resolve('_goals/convex-backend-runtime-2026-10-02/qa/task04-terminal-capture-native-extension-preparation-c2"+('/regression' if name=='regression' else '')+"')", "candidate=path.resolve('_goals/convex-backend-runtime-2026-10-02/qa/task04-terminal-capture-native-extension-preparation-'+(subject==='c7'?'c2':'c3')+'"+('/regression' if name=='regression' else '')+"')")
 envbody=envbody.replace("'work/backend-runtime/task04-terminal-capture-native-"+name+"-c2'", "'work/backend-runtime/task04-terminal-capture-native-"+name+"-'+(subject==='c7'?'c2':'c3')")
 footer="""const results=[];
for(const [name,change] of [['expiry-after-key-before-first-sign',{expireAfterKey:true}],['expiry-after-first-proof-before-other-outputs',{expireAfterProof:true}]]){
const e=await environment(change);let error;try{await e.parent.namespace.main();}catch(caught){error=caught;}
const stats=e.stats;assert.ok(error,'deadline must deny');assert.equal(stats.network,0);
let compliant;try{if(name.includes('first-sign'))assert.equal(stats.signatures,0,'expired derivation must prevent first signing effect');else assert.deepEqual(stats.writes,['initial-physical-id-provenance.json'],'expired first proof must prevent every later output');compliant=true;}catch(assertion){compliant=false;results.push({name,requirement:'FAIL',assertion:assertion.message,stats});continue;}
results.push({name,requirement:'PASS',stats});}
console.log(JSON.stringify({subject,results,tests:results.length,skipped:0,realSigning:0,realNetwork:0,realPrivateReads:0},null,2));
assert.equal(results.filter(r=>r.requirement==='FAIL').length,0,'same unchanged effect-boundary requirements');
"""
 (w/f'reviewer-requirement-{name}.mjs').write_text(envbody+footer);(w/f'requirement-{name}').mkdir(exist_ok=True)
 # Mid-effect matrix derives unchanged source VM environment and extends only mock clock instrumentation.
 source=(w/f'offline-{name}.mjs').read_text();head=source[:source.index('async function watcherProbe')]
 head=head.replace("let preflightCalls=0,signatures=0,network=0,keyReads=0,writes=[],stdout='',clock=0", "let preflightCalls=0,signatures=0,network=0,keyReads=0,randomCalls=0,signArguments=0,scans=0,writes=[],stdout='',clock=0")
 head=head.replace("const context=vm.createContext({provided,Buffer,", "const vmBuffer={...Buffer,from:(...args)=>{const b=Buffer.from(...args);if(typeof args[0]==='string'&&/^[A-Za-z0-9_-]+[.][A-Za-z0-9_-]+$/.test(args[0])){signArguments++;if(change.expireSignArguments===signArguments)clock+=120001;}return b;}};const context=vm.createContext({provided,Buffer:vmBuffer,")
 head=head.replace("const bytes=fs.readFileSync(mapped,...args);", "const bytes=fs.readFileSync(mapped,...args);if(change.expireAuthConfig&&mapped===path.join(root,'fixture/convex/auth.config.ts'))clock+=120001;if(change.expireHistory&&mapped.startsWith(historyVirtual+path.sep)&&path.basename(mapped)==='target-retirement.json')clock+=120001;if(change.expireReceiptRead&&path.basename(mapped)==='initial-physical-id-provenance.json'&&writes.length===4)clock+=120001;")
 head=head.replace("preservationPreflight:()=>{", "preservationPreflight:()=>{scans++;if(change.expireScanner===scans)clock+=120001;")
 head=head.replace("writes.push(path.basename(p));", "writes.push(path.basename(p));if(change.expireOutput===writes.length)clock+=120001;")
 head=head.replace("preflightCalls++;", "preflightCalls++;if(change.expirePreflight===preflightCalls)clock+=120001;")
 head=head.replace("return {status:change.httpStatus??200,text:async()=>change.httpBody??'{}'}", "if(change.expireFetch)clock+=120001;return {status:change.httpStatus??200,text:async()=>{if(change.expireFetchBody)clock+=120001;return change.httpBody??'{}';}}")
 head=head.replace("return {};},createPublicKey", "if(change.expirePrivateKey)clock+=120001;return {};},createPublicKey")
 head=head.replace("export:()=>({...expected,n:change.publicMismatch?'other':expected.n})", "export:()=>{if(change.expirePublicKey)clock+=120001;return {...expected,n:change.publicMismatch?'other':expected.n};}")
 head=head.replace("signatures++;return Buffer.alloc(64,0x42);", "signatures++;if(change.expireSign===signatures)clock+=120001;return Buffer.alloc(64,0x42);")
 head=head.replace("randomBytes:n=>Buffer.alloc(n,0x43)", "randomBytes:n=>{randomCalls++;if(change.expireRandom)clock+=120001;return Buffer.alloc(n,0x43);}")
 head=head.replace("return{preflightCalls,signatures,network,keyReads,writes,stdout}", "return{preflightCalls,signatures,network,keyReads,randomCalls,writes,stdout}")
 footer="""const outcomes=[],names=['initial-physical-id-provenance.json','historical-native-locators.json','identities.json','peer-config.json','parent-inputs-receipt.json'];
async function effectProbe(name,change,expected){const e=await environment(change);let existingBytes;if(change.existingOutput){e.put(change.existingOutput,{DUMMY:'IMMUTABLE-EXISTING'});existingBytes=fs.readFileSync(path.join(e.scratch,change.existingOutput));}let error;try{await e.parent.namespace.main();}catch(caught){error=caught;}if(existingBytes)assert.deepEqual(fs.readFileSync(path.join(e.scratch,change.existingOutput)),existingBytes);const stats=e.stats;assert.ok(error,name);assert.equal(stats.signatures,expected.signatures,name+' signatures');assert.equal(stats.network,expected.network??0,name+' config');assert.equal(stats.randomCalls,expected.randomCalls??0,name+' random');assert.deepEqual(stats.writes,names.slice(0,expected.outputs??0),name+' outputs');assert.equal(stats.stdout,'',name+' must not fabricate success');const detail=error.parentSetupEffects;assert.ok(detail,name+' retained nonsecret counters');assert.equal(detail.status,'FAIL');assert.equal(detail.signatures,stats.signatures);assert.equal(detail.configurationCalls,stats.network);assert.equal(detail.peerSecrets,stats.randomCalls);assert.deepEqual([...detail.privateOutputs],stats.writes);for(const n of stats.writes){const b=fs.readFileSync(path.join(e.scratch,n));assert.ok(b.length>0);assert.equal(fs.lstatSync(path.join(e.scratch,n)).mode&511,0o600);}const before={...stats,writes:[...stats.writes]};let second;try{await e.parent.namespace.main();}catch(caught){second=caught;}assert.match(second.message,/PARENT_SETUP_ALREADY_STARTED/);assert.deepEqual(e.stats,before,'repeat must not reset counters/deadline/reissue');outcomes.push({name,status:'PASS_EXPECTED_DENIAL',observed:stats,retainedEffects:detail,diagnostic:error.message.split('\\n')[0],repeat:'DENIED_NO_EFFECTS',realSigning:0,realNetwork:0,realPrivateReads:0});}
for(const [name,change]of [['private-key-derivation',{expirePrivateKey:true}],['public-key-derivation',{expirePublicKey:true}],['auth-source-parsing',{expireAuthConfig:true}],['historical-source-scanner',{expireHistory:true}],['entry-preservation-scanner',{expireScanner:1}]])await effectProbe(name,change,{signatures:0});
for(let n=1;n<=8;n++)await effectProbe('before-sign-'+n,{expireSignArguments:n},{signatures:n-1});
for(let n=1;n<=8;n++)await effectProbe('during-sign-'+n,{expireSign:n},{signatures:n});
await effectProbe('pre-output-preservation-scanner',{expireScanner:2},{signatures:8});
for(let n=1;n<=4;n++)await effectProbe('after-private-output-'+n,{expireOutput:n},{signatures:8,outputs:n,randomCalls:n===4?1:0});
await effectProbe('peer-secret-generation-crossing',{expireRandom:true},{signatures:8,outputs:3,randomCalls:1});
await effectProbe('peer-preflight-crossing',{expirePreflight:3},{signatures:8,outputs:4,randomCalls:1});
await effectProbe('peer-request-crossing',{expireFetch:true},{signatures:8,outputs:4,randomCalls:1,network:1});
await effectProbe('peer-response-body-crossing',{expireFetchBody:true},{signatures:8,outputs:4,randomCalls:1,network:1});
await effectProbe('final-preservation-scanner',{expireScanner:3},{signatures:8,outputs:4,randomCalls:1,network:1});
await effectProbe('receipt-source-read-crossing',{expireReceiptRead:true},{signatures:8,outputs:4,randomCalls:1,network:1});
for(const existingOutput of names)await effectProbe('existing-output-no-reissue-'+existingOutput,{existingOutput},{signatures:0});
const healthy=await environment();await healthy.parent.namespace.main();assert.equal(healthy.stats.signatures,8);assert.equal(healthy.stats.network,1);assert.equal(healthy.stats.randomCalls,1);assert.deepEqual(healthy.stats.writes,names);const successBefore=JSON.stringify(healthy.stats);await assert.rejects(healthy.parent.namespace.main(),/PARENT_SETUP_ALREADY_STARTED/);assert.equal(JSON.stringify(healthy.stats),successBefore);outcomes.push({name:'healthy-exact8-oneconfig-and-repeat-denial',status:'PASS',observed:healthy.stats,realSigning:0,realNetwork:0,realPrivateReads:0});
fs.writeFileSync(path.join(qa,'effect-matrix-PROFILE.json'),JSON.stringify({argv:process.argv,cwd:repo,utc:new Date().toISOString(),outcomes,defined:outcomes.length,executed:outcomes.length,failed:0,skipped:0,native:'NOT_RUN'},null,2)+'\\n');console.log(JSON.stringify({status:'PASS',profile:'PROFILE',tests:outcomes.length,failed:0,skipped:0,native:'NOT_RUN'}));
""".replace('PROFILE',name)
 (w/f'effect-matrix-{name}.mjs').write_text(head+footer)
