import { createHash, randomBytes } from 'node:crypto';
import { lstatSync, readFileSync, realpathSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const qa = dirname(fileURLToPath(import.meta.url));
const fixtureQa = resolve(qa, '../task01-local-runtime-2026-10-05');
const scratch = '/Users/SaintNick/.codex/tmp/cortex-runtime-task01-private-20261005';
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const json = path => JSON.parse(readFileSync(path, 'utf8'));
const save = (path, value) => writeFileSync(path, JSON.stringify(value, null, 2) + '\n', {flag:'wx', mode:0o600});
const requestPath = resolve(qa, 'task01-project-request.json');
const targetPath = resolve(qa, 'task01-target.json');
const ownershipPath = resolve(scratch, 'created-project.json');
const envPath = resolve(scratch, 'deploy.env');
const selectors = ['CONVEX_DEPLOY_KEY','CONVEX_DEPLOYMENT','CONVEX_URL','CONVEX_DEPLOYMENT_TOKEN','CONVEX_OVERRIDE_ACCESS_TOKEN','CONVEX_SELF_HOSTED_URL','CONVEX_SELF_HOSTED_ADMIN_KEY'];

function assertPrivateRoot() {
  const stat = lstatSync(scratch);
  if (!stat.isDirectory() || stat.isSymbolicLink() || realpathSync(scratch) !== scratch
    || (stat.mode & 0o777) !== 0o700 || stat.uid !== process.getuid()) throw Error('Private scratch ownership mismatch');
}
function assertAbsent(path) {
  if (lstatSync(path, {throwIfNoEntry:false})) throw Error('Exclusive operation output already exists; inspect prior outcome before retry');
}
function approvedSource() {
  const review = json(resolve(qa, 'task01-preparation-review.json'));
  const inventoryPath = resolve(fixtureQa, 'evidence/deliverables.json');
  if (review.verdict !== 'PASS' || review.scope !== 'PREPARATION_ONLY'
    || review.deliverableInventorySha256 !== hash(readFileSync(inventoryPath))
    || review.managementSourceSha256 !== hash(readFileSync(fileURLToPath(import.meta.url)))) throw Error('Fresh independent preparation/source review required');
  const inventory = json(inventoryPath);
  const rows = inventory.files ?? inventory.rows;
  if (!Array.isArray(rows)) throw Error('Unexpected reviewed source inventory');
  for (const row of rows) {
    const path = resolve(fixtureQa, row.file);
    if (!path.startsWith(fixtureQa + '/') || hash(readFileSync(path)) !== row.sha256) throw Error('Reviewed fixture source drift');
  }
}
function request() {
  const r = json(requestPath);
  if (r.operation !== 'create-disposable-development-target' || r.purpose !== 'qualification'
    || r.teamId !== 325340 || r.teamSlug !== 'nicholasgeil' || r.deploymentType !== 'dev'
    || r.kind !== 'cloud' || r.productionDeployment !== false || r.sharedCiTarget !== false
    || !/^Cortex runtime disposable qualification [a-f0-9]{12}$/.test(r.projectName)
    || r.projectSlug !== r.projectName.toLowerCase().replaceAll(' ','-')) throw Error('Exact disposable qualification request required');
  return r;
}
let calls = 0;
const deadline = Date.now() + 180_000;
async function api(path, method='GET', body, expected=200, base='v1') {
  if (++calls > 7 || Date.now() >= deadline) throw Error('Management operation ceiling');
  const token = json('/Users/SaintNick/.convex/config.json').accessToken;
  if (typeof token !== 'string' || !token) throw Error('Configured Convex account authentication missing');
  const response = await fetch(`https://api.convex.dev/${base}${path}`, {
    method, redirect:'error', signal:AbortSignal.timeout(Math.min(30_000, deadline-Date.now())),
    headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},
    ...(body ? {body:JSON.stringify(body)} : {}),
  });
  if (response.status !== expected) throw Error(`Management ${method} ${path} returned HTTP ${response.status}`);
  if (expected === 404 || response.status === 204) return {httpStatus:response.status};
  const text = await response.text();
  return text ? JSON.parse(text) : {httpStatus:response.status};
}
async function verify(projectId, deploymentName, r) {
  const p = await api(`/projects/${projectId}`);
  if (p.id !== projectId || p.slug !== r.projectSlug || p.name !== r.projectName
    || (p.teamId !== undefined && p.teamId !== r.teamId)) throw Error('Observed owned project mismatch');
  const d = await api(`/deployments/${encodeURIComponent(deploymentName)}`);
  if (d.name !== deploymentName || d.projectId !== projectId || d.deploymentType !== 'dev'
    || d.kind !== 'cloud' || d.deploymentUrl !== `https://${deploymentName}.convex.cloud`) throw Error('Observed disposable development deployment mismatch');
  const list = await api(`/projects/${projectId}/list_deployments`);
  if (!Array.isArray(list) || list.length !== 1 || list[0].name !== deploymentName
    || list[0].projectId !== projectId || list[0].deploymentType !== 'dev') throw Error('Owned project is not an isolated sole development deployment');
  return d;
}

const operation = process.argv[2];
assertPrivateRoot();
if (operation === 'prepare') {
  const suffix = randomBytes(6).toString('hex');
  save(requestPath, {operation:'create-disposable-development-target',purpose:'qualification',
    teamId:325340,teamSlug:'nicholasgeil',projectName:`Cortex runtime disposable qualification ${suffix}`,
    projectSlug:`cortex-runtime-disposable-qualification-${suffix}`,deploymentType:'dev',kind:'cloud',
    productionDeployment:false,sharedCiTarget:false,createdAt:new Date().toISOString(),
    authorization:'Existing user authorization for fresh disposable instance and uncapped qualification inference; production excluded'});
  console.log('Fresh exclusive qualification request prepared; no service effect');
} else if (operation === 'provision') {
  approvedSource();
  const r = request();
  for (const key of selectors) if (process.env[key]) throw Error('Inherited target selector conflicts before provisioning');
  for (const path of [targetPath, ownershipPath, envPath, resolve(scratch,'provision-attempt.json')]) assertAbsent(path);
  const teams = await api('/teams','GET',undefined,200,'api');
  if (!Array.isArray(teams) || !teams.some(t=>t.id===r.teamId && t.slug===r.teamSlug)) throw Error('Configured team ownership not verified');
  save(resolve(scratch,'provision-attempt.json'), {at:new Date().toISOString(),requestSha256:hash(readFileSync(requestPath)),
    outcome:'CREATE_NOT_YET_ACKNOWLEDGED; never blindly repeat POST after an uncertain result'});
  const p = await api(`/teams/${r.teamId}/create_project`,'POST',{projectName:r.projectName,deploymentType:'dev'});
  save(ownershipPath, {operation:r.operation,requestSha256:hash(readFileSync(requestPath)),id:p.id,slug:p.slug,
    requestedName:r.projectName,deploymentName:p.deploymentName,createdAt:new Date().toISOString()});
  if (!Number.isSafeInteger(p.id) || p.id<=0 || p.slug!==r.projectSlug
    || !/^[a-z0-9]+(?:-[a-z0-9]+)+$/.test(p.deploymentName??'')
    || p.deploymentUrl!==`https://${p.deploymentName}.convex.cloud`) throw Error('Created response mismatch; exclusive ownership retained');
  const d = await verify(p.id,p.deploymentName,r);
  const key = await api(`/deployments/${d.name}/create_deploy_key`,'POST',{
    name:'cortex-task01-local-applicability-20261005',expiresAt:Date.now()+3*24*60*60*1000});
  if (!key.deployKey?.startsWith(`dev:${d.name}|`)) throw Error('Created key does not select verified development deployment');
  writeFileSync(envPath, `CONVEX_DEPLOY_KEY=${key.deployKey}\nCONVEX_DEPLOYMENT=dev:${d.name}\nCONVEX_URL=${d.deploymentUrl}\n`, {flag:'wx',mode:0o600});
  const target = {...r,projectId:p.id,deploymentName:d.name,deploymentUrl:d.deploymentUrl,isolationVerified:true,
    active:true,retired:false,deleted:false,privateEnvironmentFile:envPath,verifiedAt:new Date().toISOString(),
    managementCalls:calls,fixtureSourceReview:'task01-preparation-review.json'};
  save(targetPath,target);
  console.log(JSON.stringify({operation:'verified-disposable-qualification-target',projectId:p.id,deploymentName:d.name,
    deploymentType:'dev',kind:'cloud',isolationVerified:true,privateCredentialsPrinted:false}));
} else if (operation === 'retire') {
  approvedSource();
  const r = request(), t = json(targetPath), owned = json(ownershipPath);
  const stat = lstatSync(targetPath);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink!==1 || stat.uid!==process.getuid()
    || realpathSync(targetPath)!==targetPath) throw Error('Current target receipt ownership mismatch');
  const retirementPath = resolve(qa,'task01-target-retirement.json');
  const preimagePath = resolve(qa,'task01-target-pre-retirement.json');
  const replacementPath = resolve(qa,'task01-target-retired-replacement.json');
  for (const path of [retirementPath,preimagePath,replacementPath]) assertAbsent(path);
  if (t.retired || t.deleted || t.projectId!==owned.id || t.deploymentName!==owned.deploymentName
    || owned.requestSha256!==hash(readFileSync(requestPath))) throw Error('Exclusive target ownership mismatch');
  await verify(t.projectId,t.deploymentName,r);
  writeFileSync(preimagePath,readFileSync(targetPath),{flag:'wx',mode:0o600});
  const deleted = await api(`/projects/${t.projectId}/delete`,'POST');
  const absent = await api(`/projects/${t.projectId}`,'GET',undefined,404);
  const retiredAt = new Date().toISOString();
  save(replacementPath,{...t,active:false,retired:true,deleted:true,retiredAt,
    preRetirementReceiptSha256:hash(readFileSync(preimagePath))});
  renameSync(replacementPath,targetPath);
  save(retirementPath, {operation:'retire-owned-disposable-qualification-target',
    at:new Date().toISOString(),projectId:t.projectId,deploymentName:t.deploymentName,deletionHttpStatus:200,
    verificationHttpStatus:absent.httpStatus,retired:true,deleted:true,managementCalls:calls,
    responseKeys:Object.keys(deleted),productionMutations:0});
  console.log('Owned disposable qualification target retired; GET404 verified');
} else throw Error('Explicit prepare, provision or retire operation required');
