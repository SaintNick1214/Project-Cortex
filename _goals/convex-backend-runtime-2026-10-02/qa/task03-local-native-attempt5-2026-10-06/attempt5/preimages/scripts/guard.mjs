/** Prospective current-source guard. No historical acceptance is promoted to current live evidence. */
import { lstatSync, readFileSync, realpathSync, writeFileSync, readdirSync } from 'node:fs';
import { dirname, resolve, sep, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { parseEnv } from 'node:util';
export const preparation=resolve(dirname(fileURLToPath(import.meta.url)),'..');
export const repo=resolve(preparation,'../../../..');
export const fixture=resolve(preparation,'managed-fixture');
export const scratch='/Users/SaintNick/.codex/tmp/cortex-runtime-task03-attempt4-private-20261006';
export const sha256=value=>createHash('sha256').update(value).digest('hex');
const reject=()=>{throw new Error('Current foundation preflight rejected; no operation dispatched');};
export function canonical(path,base,privateFile=false){
 if(typeof path!=='string'||path!==resolve(path)||!(path===base||path.startsWith(base+sep)))reject();
 let part=sep;for(const component of path.split(sep).filter(Boolean)){part=resolve(part,component);const stat=lstatSync(part,{throwIfNoEntry:false});if(!stat||stat.isSymbolicLink()||realpathSync(part)!==part||(part!==path&&!stat.isDirectory()))reject();}
 const stat=lstatSync(path);if(stat.isFile()&&stat.nlink!==1)reject();if(privateFile&&(!stat.isFile()||stat.uid!==process.getuid()||(stat.mode&0o777)!==0o600))reject();return path;
}
const json=path=>JSON.parse(readFileSync(canonical(path,preparation),'utf8'));
const productFiles=(root,rows=[])=>{for(const entry of readdirSync(root,{withFileTypes:true})){const p=resolve(root,entry.name);canonical(p,repo);if(entry.isDirectory())productFiles(p,rows);else if(entry.isFile()&&/\.(?:ts|js|json)$/.test(entry.name))rows.push(relative(repo,p));}return rows;};
export function candidateFiles(directory=preparation,rows=[]){for(const entry of readdirSync(directory,{withFileTypes:true})){const p=resolve(directory,entry.name),rel=relative(preparation,p);if(rel==='tmp'||rel==='candidate-freeze-attempt4.json'||rel==='independent-preparation-review.json'||/^managed-fixture\/fixture\/convex\/_generated\/(api\.d\.ts|api\.js|dataModel\.d\.ts|server\.d\.ts|server\.js)$/.test(rel))continue;canonical(p,preparation);if(entry.isDirectory())candidateFiles(p,rows);else if(entry.isFile())rows.push(rel);else reject();}return rows.sort();}
export function sourcePreflight(){
 const source=json(resolve(preparation,'source-inventory.json'));
 for(const row of source.files)if(sha256(readFileSync(canonical(resolve(repo,row.path),repo)))!==row.sha256)reject();
 const actual=[...productFiles(resolve(repo,'src')),...productFiles(resolve(repo,'convex-dev'))].sort();if(JSON.stringify(actual)!==JSON.stringify(source.productRootPaths))reject();
 const copies=json(resolve(preparation,'managed-fixture-copy-manifest.json'));
 for(const row of copies.files){if(sha256(readFileSync(canonical(resolve(repo,row.source),repo)))!==row.sha256)reject();if(!row.officialCodegenMutable&&sha256(readFileSync(canonical(resolve(preparation,row.copy),preparation)))!==row.sha256)reject();}
 const projection=json(resolve(preparation,'attempt2/compiler-projection.json'));
 if(projection.version!=='6.0.3'||projection.count!==114||projection.files.length!==114)reject();
 for(const row of projection.files){if(sha256(readFileSync(canonical(resolve(repo,row.source),repo)))!==row.sha256||sha256(readFileSync(canonical(resolve(preparation,row.copy),preparation)))!==row.sha256)reject();}
 const dependencyRoot=resolve(fixture,'fixture/node_modules');
 if(JSON.stringify(readdirSync(dependencyRoot).sort())!==JSON.stringify(['typescript']))reject();
 const projectedFiles=productFiles(dependencyRoot).map(path=>relative(preparation,resolve(repo,path))).sort();
 if(JSON.stringify(projectedFiles)!==JSON.stringify(projection.files.map(row=>row.copy).filter(path=>/\.(?:ts|js|json)$/.test(path)).sort()))reject();
 for(const row of json(resolve(preparation,'attempt2/cli-source-pins.json')).files)if(sha256(readFileSync(canonical(resolve(repo,row.path),repo)))!==row.sha256)reject();
 const fresh=json(resolve(preparation,'fresh-identity-public.json'));if(sha256(readFileSync(canonical(resolve(fixture,'fixture/convex/auth.config.ts'),preparation)))!==fresh.freshAuthSha256)reject();
 for(const row of json(resolve(preparation,'historical-script-provenance.json')).files){if(sha256(readFileSync(canonical(resolve(repo,row.historicalSource),repo)))!==row.sha256)reject();if(row.preimage&&sha256(readFileSync(canonical(resolve(preparation,row.preimage),preparation)))!==row.sha256)reject();}
 const frozen=json(resolve(preparation,'candidate-freeze-attempt4.json'));if(frozen.state!=='FROZEN_AWAITING_INDEPENDENT_PREPARATION_REVIEW'||frozen.actualExternalRequests!==0||frozen.actualDeployments!==0)reject();
 for(const row of frozen.files)if(sha256(readFileSync(canonical(resolve(preparation,row.path),preparation)))!==row.sha256)reject();
 if(JSON.stringify(candidateFiles())!==JSON.stringify(frozen.files.map(row=>row.path).sort()))reject();
 for(const [name,version] of Object.entries({convex:'1.46.0',ws:'8.21.0','https-proxy-agent':'7.0.6',typescript:'6.0.3'})){const p=canonical(resolve(repo,'node_modules',name,'package.json'),repo);if(JSON.parse(readFileSync(p)).version!==version)reject();}
 return {source,copies,frozen};
}
export function validateTarget(target,request,values,inherited={}){
 const allowed=['CONVEX_DEPLOY_KEY','CONVEX_DEPLOYMENT','CONVEX_URL'];if(Object.keys(values).some(key=>!allowed.includes(key)))reject();
 if(['CONVEX_DEPLOYMENT_TOKEN','CONVEX_OVERRIDE_ACCESS_TOKEN','CONVEX_SELF_HOSTED_URL','CONVEX_SELF_HOSTED_ADMIN_KEY'].some(key=>inherited[key]))reject();
 if(target.operation!==request.operation||target.requestSha256!==sha256(JSON.stringify(request))||target.purpose!==request.purpose||target.projectName!==request.projectName||target.projectSlug!==request.projectSlug||!/^cortex-foundation-delta-[a-f0-9]{12}$/.test(target.projectSlug)||target.teamId!==325340||target.teamId!==request.teamId||target.freshManagedProject!==true||target.kind!=='cloud'||target.deploymentType!=='dev'||target.active!==true||target.retired!==false||target.deleted!==false||target.isolationVerified!==true||target.productionDeployment!==false||target.sharedCiTarget!==false||!Number.isSafeInteger(target.projectId)||target.projectId<=0||!Number.isFinite(Date.parse(target.createdAt))||Date.parse(target.createdAt)<Date.parse(json(resolve(preparation,'fresh-identity-public.json')).generatedAt)||!/^[a-z0-9]+(?:-[a-z0-9]+)+$/.test(target.deploymentName??'')||['efficient-ox-979','fiery-setter-784','admired-walrus-730','quaint-jellyfish-819','joyous-ostrich-974','gallant-mastiff-565'].includes(target.deploymentName)||target.deploymentUrl!==`https://${target.deploymentName}.convex.cloud`||target.privateEnvironmentFile!==request.privateEnvironmentFile)reject();
 if(values.CONVEX_DEPLOYMENT!==`dev:${target.deploymentName}`||values.CONVEX_URL!==target.deploymentUrl||!values.CONVEX_DEPLOY_KEY?.startsWith(`dev:${target.deploymentName}|`)||values.CONVEX_DEPLOY_KEY.length<=`dev:${target.deploymentName}|`.length)reject();
 for(const key of allowed)if(inherited[key]&&inherited[key]!==values[key])reject();return target;
}
export function preparationReviewed(){sourcePreflight();const review=json(resolve(preparation,'independent-preparation-review.json'));if(review.verdict!=='PASS'||review.independent!==true||review.scope!=='BOUNDED_03_FOUNDATION_CURRENT_DELTA_PREPARATION'||review.candidateSha256!==sha256(readFileSync(resolve(preparation,'candidate-freeze-attempt4.json'))))reject();canonical(scratch,scratch);const stat=lstatSync(scratch);if(!stat.isDirectory()||stat.uid!==process.getuid()||(stat.mode&0o777)!==0o700)reject();canonical(resolve(scratch,'jwt-private.pem'),scratch,true);}
export function livePreflight(){
 preparationReviewed();if(process.platform!=='linux'||process.version!=='v24.15.0')reject();
 const ledger=json(resolve(preparation,'path-ledger.json'));if(ledger.cases.length!==275||ledger.cases.filter(row=>row.visibility==='public').length!==200||ledger.cases.filter(row=>row.visibility==='internal').length!==75||ledger.cases.some(row=>row.argumentsStatus!=='NATIVE_VALIDATOR_SHAPE_VERIFIED_REAL_IDS_REQUIRED_LIVE'||!row.ownedPositiveStatus.startsWith('PREPARED_')))reject();
 const receipt=resolve(scratch,'target.json'),env=resolve(scratch,'deploy.env');if(process.env.CORTEX_FOUNDATION_TARGET_RECEIPT!==receipt||process.env.CORTEX_FOUNDATION_DEPLOY_ENV!==env)reject();canonical(receipt,scratch,true);canonical(env,scratch,true);
 const values=parseEnv(readFileSync(env,'utf8'));const request=json(resolve(preparation,'project-request.json'));return {target:validateTarget(JSON.parse(readFileSync(receipt)),request,values,process.env),values};
}
export function appendRedactedReceipt(name,value){
 if(!/^[a-z][a-z0-9-]{1,70}\.json$/.test(name))reject();const allowed=new Set(['operation','phase','status','counts','elapsedMs','sourceDigest','cleanupComplete','retired','startedAt','observedAt','argv','exitCode','failureClass']);if(Object.keys(value).some(key=>!allowed.has(key)))reject();if(!['PASS','FAIL','BLOCKED'].includes(value.status)||typeof value.phase!=='string'||!/^[a-z0-9-]+$/.test(value.phase))reject();if(value.argv&&(!Array.isArray(value.argv)||value.argv.some(arg=>typeof arg!=='string'||arg.length>512||/Bearer |[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]+/.test(arg))))reject();if(value.failureClass!==undefined&&!/^[a-z_]+$/.test(value.failureClass))reject();if(value.counts&&Object.values(value.counts).some(count=>!Number.isSafeInteger(count)||count<0))reject();if(value.sourceDigest!==undefined&&!/^[a-f0-9]{64}$/.test(value.sourceDigest))reject();canonical(scratch,scratch);writeFileSync(resolve(scratch,name),JSON.stringify(value,null,2)+'\n',{flag:'wx',mode:0o600});
}
export function verifyCodegen(target){
 const receiptPath=canonical(process.env.CORTEX_FOUNDATION_CODEGEN_RECEIPT,scratch,true),receipt=JSON.parse(readFileSync(receiptPath));const names=['api.d.ts','api.js','dataModel.d.ts','server.d.ts','server.js'];
 if(receipt.operation!==target.operation||receipt.officialCodegen!==true||receipt.typecheck!=='enable'||receipt.status!=='PASS'||!Array.isArray(receipt.files)||receipt.files.length!==names.length||JSON.stringify(receipt.files.map(file=>file.path).sort())!==JSON.stringify(names.map(name=>'fixture/convex/_generated/'+name).sort()))reject();
 for(const row of receipt.files)if(sha256(readFileSync(canonical(resolve(fixture,row.path),fixture)))!==row.sha256)reject();
 const api=readFileSync(resolve(fixture,'fixture/convex/_generated/api.d.ts'),'utf8');const ledger=json(resolve(preparation,'path-ledger.json'));for(const module of new Set([...ledger.cases.map(row=>row.path.split(':')[0]),'qualificationOwned','qualificationDelta']))if(!api.includes('/'+module+'.js"')&&!api.includes('/'+module+'.js\''))reject();
 return receiptPath;
}
export function safeProcessFailure(result){if(result.timedOut)return 'timeout_unknown_dispatch';if(result.overflow)return 'output_ceiling';if(result.code===0)return 'none';const raw=String(result.stderr??'')+' '+String(result.stdout??'');if(/typecheck|TypeScript|error TS\d/i.test(raw))return 'cli_typecheck';if(/authenticat|Unauthorized|deploy key|InvalidAuth/i.test(raw))return 'cli_authentication';if(/Could not resolve|Cannot find module|Unable to find/i.test(raw))return 'cli_source_binding';if(/connect|fetch failed|network|timed out/i.test(raw))return 'cli_transport';if(/codegen/i.test(raw))return 'cli_codegen';return 'cli_unknown_failure';}
