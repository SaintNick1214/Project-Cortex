import { lstatSync, readFileSync, realpathSync, writeFileSync, readdirSync } from 'node:fs';
import { dirname, resolve, sep, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { parseEnv } from 'node:util';
export const preparation = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const repo = resolve(preparation, '../../../..');
export const fixture = resolve(preparation, '../task03-foundation-live-fixture-c2');
export const scratch = resolve(repo, 'work/backend-runtime/task03-foundation-live-c2');
export const sha256 = value => createHash('sha256').update(value).digest('hex');
const reject = () => { throw new Error('Current foundation preflight rejected; no operation dispatched'); };
export function canonical(path, base, privateFile = false) {
  if (path !== resolve(path) || !(path === base || path.startsWith(base + sep))) reject();
  let part = sep;
  for (const component of path.split(sep).filter(Boolean)) {
    part = resolve(part, component); const stat = lstatSync(part, { throwIfNoEntry: false });
    if (!stat || stat.isSymbolicLink() || realpathSync(part) !== part) reject();
    if (part !== path && !stat.isDirectory()) reject();
  }
  const stat = lstatSync(path);
  if (stat.isFile() && stat.nlink !== 1) reject();
  if (privateFile && (!stat.isFile() || stat.uid !== process.getuid() || (stat.mode & 0o777) !== 0o600)) reject();
  return path;
}
function operationalFiles(directory, selected=[]){for(const entry of readdirSync(directory,{withFileTypes:true})){if(['node_modules','_generated','evidence'].includes(entry.name))continue;const path=resolve(directory,entry.name);canonical(path,repo);if(entry.isDirectory())operationalFiles(path,selected);else if(entry.isFile()&&!entry.name.endsWith('.md')&&!['runtime-freeze.json','offline-receipts.json','independent-preparation-review.json'].includes(entry.name))selected.push(relative(repo,path));}return selected;}
const json = path => JSON.parse(readFileSync(canonical(path, repo), 'utf8'));
export function sourcePreflight() {
  const inventory = json(resolve(preparation, 'source-inventory.json'));
  for (const row of inventory.files) {
    for (const path of [resolve(repo, row.source), resolve(fixture, row.copy)]) {
      if (sha256(readFileSync(canonical(path, repo))) !== row.sha256) reject();
    }
  }
  for(const root of ['convex-dev','src']){const current=operationalFiles(resolve(repo,root));const expected=inventory.files.map(row=>row.source).filter(path=>path.startsWith(root+'/')).sort();if(JSON.stringify(current.sort())!==JSON.stringify(expected))reject();}
  if (sha256(readFileSync(resolve(fixture, inventory.authConfig.copy))) !== inventory.authConfig.sha256) reject();
  for (const row of json(resolve(preparation, 'historical-preservation.json'))) {
    if (sha256(readFileSync(canonical(resolve(repo, row.path), repo))) !== row.sha256) reject();
  }
  const freezePath=resolve(preparation,'runtime-freeze.json');
  if(lstatSync(freezePath,{throwIfNoEntry:false})){const frozen=json(freezePath).files;for(const row of frozen){if(sha256(readFileSync(canonical(resolve(repo,row.path),repo)))!==row.sha256)reject();}
 const actual=[...operationalFiles(preparation),...operationalFiles(fixture),...operationalFiles(resolve(repo,'dist')),'package.json','package-lock.json','tests/unit/runtimeMemory/fixture.ts'].sort();if(JSON.stringify(actual)!==JSON.stringify(frozen.map(row=>row.path).sort()))reject();}
  for(const [name,version] of Object.entries({convex:'1.46.0',ws:'8.21.0','https-proxy-agent':'7.0.6'})){if(json(resolve(repo,'node_modules',name,'package.json')).version!==version)reject();}
  if(json(resolve(fixture,'fixture/node_modules/typescript/package.json')).version!=='6.0.3')reject();
  return inventory;
}
export function validateTarget(target, request, values, inherited = {}) {
  const allowed = ['CONVEX_DEPLOY_KEY', 'CONVEX_DEPLOYMENT', 'CONVEX_URL'];
  if (Object.keys(values).some(key => !allowed.includes(key))) reject();
  const forbidden = ['CONVEX_DEPLOYMENT_TOKEN','CONVEX_OVERRIDE_ACCESS_TOKEN','CONVEX_SELF_HOSTED_URL','CONVEX_SELF_HOSTED_ADMIN_KEY'];
  if (forbidden.some(key => inherited[key])) reject();
  if (target.operation !== request.operation || target.requestSha256 !== sha256(JSON.stringify(request)) || target.purpose !== request.purpose
      || target.projectName !== request.projectName || target.projectSlug !== request.projectSlug
      || !/^cortex-foundation-disposable-[a-f0-9]{12}$/.test(target.projectSlug)
      || target.kind !== 'cloud' || target.deploymentType !== 'dev' || target.active !== true
      || target.retired !== false || target.deleted !== false || target.isolationVerified !== true
      || target.productionDeployment !== false || target.sharedCiTarget !== false
      || !Number.isSafeInteger(target.projectId) || target.projectId <= 0 || !Number.isFinite(Date.parse(target.createdAt))
      || !/^[a-z0-9]+(?:-[a-z0-9]+)+$/.test(target.deploymentName ?? '')
      || ['efficient-ox-979','fiery-setter-784'].includes(target.deploymentName)
      || target.deploymentUrl !== `https://${target.deploymentName}.convex.cloud`
      || target.privateEnvironmentFile !== request.privateEnvironmentFile) reject();
  if (values.CONVEX_DEPLOYMENT !== `dev:${target.deploymentName}` || values.CONVEX_URL !== target.deploymentUrl
      || !values.CONVEX_DEPLOY_KEY?.startsWith(`dev:${target.deploymentName}|`)
      || values.CONVEX_DEPLOY_KEY.length <= `dev:${target.deploymentName}|`.length) reject();
  for (const key of allowed) if (inherited[key] && inherited[key] !== values[key]) reject();
  return target;
}
export function preparationReviewed(){
 const inventory=sourcePreflight();if(inventory.state!=='FROZEN_CANDIDATE_AWAITING_INDEPENDENT_PREPARATION_REVIEW')reject();
 const freezePath=resolve(preparation,'runtime-freeze.json'),review=json(resolve(preparation,'independent-preparation-review.json'));
 if(review.verdict!=='PASS'||review.independent!==true||review.candidateSha256!==sha256(readFileSync(freezePath)))reject();
 canonical(scratch,repo);const stat=lstatSync(scratch);if(stat.uid!==process.getuid()||(stat.mode&0o777)!==0o700)reject();
}
export function livePreflight() {
  preparationReviewed();
  const ledger = json(resolve(preparation, 'path-ledger.json'));
  if (ledger.cases.length !== 259 || ledger.cases.some(row => row.argumentsStatus !== 'NATIVE_VALIDATOR_SHAPE_VERIFIED_REAL_IDS_REQUIRED_LIVE' || !row.ownedPositiveStatus.startsWith('PREPARED_'))) reject();
  canonical(scratch, repo); const stat = lstatSync(scratch);
  if (!stat.isDirectory() || stat.uid !== process.getuid() || (stat.mode & 0o777) !== 0o700) reject();
  const receipt = resolve(scratch,'target.json'), env = resolve(scratch,'deploy.env');
  if (process.env.CORTEX_FOUNDATION_TARGET_RECEIPT !== receipt || process.env.CORTEX_FOUNDATION_DEPLOY_ENV !== env) reject();
  canonical(receipt, scratch, true); canonical(env, scratch, true);
  canonical(resolve(repo,'work/backend-runtime/qualification/jwt-private.pem'), repo, true);
  const values = parseEnv(readFileSync(env,'utf8'));
  return { target: validateTarget(json(receipt), json(resolve(fixture,'project-request.json')), values, process.env), values };
}
export function appendRedactedReceipt(name, value) {
  if (!/^[a-z][a-z0-9-]{1,70}\.json$/.test(name)) reject();
  // Explicit allowlist excludes errors, tokens, private resource outputs and environment.
  const allowed = new Set(['operation','phase','status','counts','elapsedMs','sourceDigest','cleanupComplete','retired','startedAt','observedAt','argv','exitCode','failureClass']);
  if (Object.keys(value).some(key => !allowed.has(key))) reject();
  if(!['PASS','FAIL','BLOCKED'].includes(value.status)||typeof value.phase!=='string'||!/^[a-z0-9-]+$/.test(value.phase))reject();
  if(value.argv&&(!Array.isArray(value.argv)||value.argv.some(arg=>typeof arg!=='string'||arg.length>512||/Bearer |[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]+/.test(arg))))reject();
  if(value.failureClass!==undefined&&!/^[a-z_]+$/.test(value.failureClass))reject();
  if(value.counts&&Object.values(value.counts).some(count=>!Number.isSafeInteger(count)||count<0))reject();
  if(value.sourceDigest!==undefined&&!/^[a-f0-9]{64}$/.test(value.sourceDigest))reject();
  canonical(scratch, repo);
  writeFileSync(resolve(scratch,name), JSON.stringify(value,null,2)+'\n', { flag:'wx', mode:0o600 });
}
export function verifyCodegen(target) {
 const path=canonical(process.env.CORTEX_FOUNDATION_CODEGEN_RECEIPT,scratch,true),receipt=JSON.parse(readFileSync(path));
 if(receipt.operation!==target.operation||receipt.officialCodegen!==true||receipt.typecheck!=='enable'||receipt.status!=='PASS'||!Array.isArray(receipt.files)||receipt.files.length<3)reject();
 for(const file of receipt.files){if(!/^fixture\/convex\/_generated\/[A-Za-z0-9._-]+$/.test(file.path)||sha256(readFileSync(canonical(resolve(fixture,file.path),fixture)))!==file.sha256)reject();}
 for(const name of ['api','server','dataModel'])if(!receipt.files.some(file=>new RegExp('/'+name+'(?:\\.d)?\\.ts$').test(file.path)))reject();
 return path;
}
export function safeProcessFailure(result) {
 if(result.timedOut)return 'timeout_unknown_dispatch';if(result.overflow)return 'output_ceiling';if(result.code===0)return 'none';
 const raw=String(result.stderr??'')+' '+String(result.stdout??'');
 if(/typecheck|TypeScript|error TS\d/i.test(raw))return 'cli_typecheck';if(/authenticat|Unauthorized|deploy key|InvalidAuth/i.test(raw))return 'cli_authentication';
 if(/Could not resolve|Cannot find module|Unable to find/i.test(raw))return 'cli_source_binding';if(/connect|fetch failed|network|timed out/i.test(raw))return 'cli_transport';if(/codegen/i.test(raw))return 'cli_codegen';
 return 'cli_unknown_failure'; // No raw output, arbitrary provider detail, credentials or tokens escape.
}
