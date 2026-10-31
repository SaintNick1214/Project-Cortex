import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import vm from 'node:vm';
const R='/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion',F=R+'/_goals/convex-backend-runtime-2026-10-02/qa/local-resume-2026-10-05/task03-attempt6-integrated-repair1',J=F+'-source-review2',Q=R+'/_goals/convex-backend-runtime-2026-10-02/qa/task03-local-native-attempt6-2026-10-06';
const src=readFileSync(F+'/target-management.mjs','utf8'),requestOriginal=JSON.parse(readFileSync(Q+'/project-request.json','utf8')),freeze=readFileSync(Q+'/candidate-freeze-attempt6.json');
const hash=b=>createHash('sha256').update(b).digest('hex'), rows=[];
const requestCode=src.slice(src.indexOf('function request()'),src.indexOf('function reviewedHelper()'));
const reviewedCode=src.slice(src.indexOf('function reviewedHelper()'),src.indexOf('function repairPreparationReviewed()'));
const repairCode=src.slice(src.indexOf('function repairPreparationReviewed()'),src.indexOf('let calls = 0;'));
function test(id,fn,deny=false){let accepted=true;try{fn();}catch{accepted=false;}if(accepted===deny)throw Error('Unexpected control outcome '+id);rows.push({id,status:'PASS',observedAccepted:accepted,realPrivateAccess:0,realServiceEffects:0});}
function context(requestChange={},reviewChange={},prepChange={}){
 const r={...structuredClone(requestOriginal),...requestChange},events=[];
 const prep={verdict:'PASS',independent:true,scope:'BOUNDED_03_FOUNDATION_CURRENT_DELTA_PREPARATION',candidateSha256:hash(freeze),candidateMembers:1907,...prepChange};
 const review={verdict:'PASS',independent:true,scope:'TASK03_DISPOSABLE_TARGET_MANAGEMENT_ONLY',managementSourceSha256:hash(src),requestSha256:hash(JSON.stringify(r)),...reviewChange};
 const s=requestOriginal.privateEnvironmentFile.slice(0,-'/deploy.env'.length);
 const c={qa:F,preparation:Q,scratch:s,envPath:s+'/deploy.env',targetPath:s+'/target.json',requestPath:Q+'/project-request.json',hash,json:path=>{events.push(['json',path]);if(path.endsWith('/project-request.json'))return r;if(path.endsWith('/task03-attempt6-management-review.json'))return review;if(path.endsWith('/independent-preparation-review.json'))return prep;throw Error('Unrecognized mock path');},readFileSync:path=>{events.push(['read',path]);if(path===F+'/target-management.mjs')return src;if(path===Q+'/candidate-freeze-attempt6.json')return freeze;throw Error('Unexpected actual file read');},fileURLToPath:()=>F+'/target-management.mjs',__mockMeta:{url:'MOCK_PUBLIC_SOURCE_URL'},resolve:(...p)=>p.join('/'),sourcePreflight:()=>events.push(['sourcePreflight']),canonical:(p,base,privateFile)=>events.push(['canonical',p,privateFile===true]),lstatSync:()=>({isDirectory:()=>true,uid:501,mode:0o700}),process:{getuid:()=>501},reject:()=>{throw Error('EXPECTED_BOUNDED_DENIAL');}};
 vm.createContext(c);vm.runInContext((requestCode+reviewedCode+repairCode).replaceAll('import.meta','__mockMeta'),c);return {c,events};
}
test('exact-nonpaid-dev-request',()=>{const{c}=context();if(c.request().operation!==requestOriginal.operation)throw Error('wrong operation');});
for(const[k,v]of Object.entries({teamId:1,teamSlug:'foreign',teamName:'foreign',requiredDeploymentType:'prod',requiredKind:'local',sharedCiTarget:true,productionDeployment:true,maximumPaidCalls:false,retirementRequired:false,projectSlug:'foreign',projectName:'foreign',privateEnvironmentFile:'foreign',privateTargetReceipt:'foreign',operation:'foreign',purpose:'foreign'}))test('request-deny-'+k,()=>context({[k]:v}).c.request(),true);
test('exact-management-source-request-review',()=>context().c.reviewedHelper());
for(const[k,v]of Object.entries({verdict:'REJECT',independent:1,scope:'foreign',managementSourceSha256:'foreign',requestSha256:'foreign'}))test('helper-deny-'+k,()=>context({}, {[k]:v}).c.reviewedHelper(),true);
test('repair-preparation-before-mocked-private-guards',()=>{const{c,events}=context();c.repairPreparationReviewed();if(events[0][0]!=='sourcePreflight'||events.filter(x=>x[0]==='canonical').length!==2||events.at(-1)[2]!==true)throw Error('Wrong source/private guard order');});
for(const[k,v]of Object.entries({verdict:'REJECT',independent:1,scope:'foreign',candidateSha256:'foreign'}))test('repair-preparation-deny-'+k,()=>{const{c,events}=context({}, {}, {[k]:v});try{c.repairPreparationReviewed();}finally{if(events.some(x=>x[0]==='canonical'))throw Error('Private guard reached before invalid review denied');}},true);
// The full actual implementation is source-inspected; no main body, API, credentials or target is evaluated.
if(!src.includes('const deadline = Date.now() + 180_000')||!src.includes('++calls > 7')||!src.includes('Math.min(30_000, deadline - Date.now())')||!src.includes("await api(`/projects/${owned.id}/delete`, 'POST')")||!src.includes("GET', undefined, 404"))throw Error('Original management bounds/retirement removed');
rows.push({id:'original-180s-seven-30s-and-owned-200-404-retirement-source-preserved',status:'PASS',realPrivateAccess:0,realServiceEffects:0});
writeFileSync(J+'/independent-management-results.json',JSON.stringify({scope:'EXACT_MANAGEMENT_SOURCE_REQUEST_AND_PREPARATION_AST_DATA_ONLY',status:'PASS',managementSourceSha256:hash(src),requestSha256:hash(JSON.stringify(requestOriginal)),count:rows.length,rows,privateReads:0,serviceCalls:0,actualTargetAccepted:false},null,2)+'\n',{flag:'wx',mode:0o600});
console.log(JSON.stringify({controls:rows.length,status:'PASS_SOURCE_ONLY',privateReads:0,serviceCalls:0}));
