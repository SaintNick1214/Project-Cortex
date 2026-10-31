import { createHash } from 'node:crypto';
import { closeSync, fsyncSync, lstatSync, openSync, readFileSync, realpathSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseEnv } from 'node:util';
import { preparation, preparationReviewed, scratch, validateTarget } from '../task03-local-native-attempt3-2026-10-05/scripts/guard.mjs';

const qa = dirname(fileURLToPath(import.meta.url));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const parseJson = text => { try { return JSON.parse(text); } catch { throw Error('Management JSON rejected; private contents withheld'); } };
const json = path => parseJson(readFileSync(path, 'utf8'));
const requestPath = resolve(preparation, 'project-request.json');
const ownershipPath = resolve(scratch, 'created-project.json');
const targetPath = resolve(scratch, 'target.json');
const envPath = resolve(scratch, 'deploy.env');
const selectors = ['CONVEX_DEPLOY_KEY', 'CONVEX_DEPLOYMENT', 'CONVEX_URL', 'CONVEX_DEPLOYMENT_TOKEN', 'CONVEX_OVERRIDE_ACCESS_TOKEN', 'CONVEX_SELF_HOSTED_URL', 'CONVEX_SELF_HOSTED_ADMIN_KEY'];
const reject = message => { throw Error(message); };
const absent = path => { if (lstatSync(path, { throwIfNoEntry: false })) reject('Exclusive output exists; inspect prior outcome before retry'); };
function save(path, value) {
  const fd = openSync(path, 'wx', 0o600);
  try { writeFileSync(fd, JSON.stringify(value, null, 2) + '\n'); fsyncSync(fd); } finally { closeSync(fd); }
  const parent = openSync(dirname(path), 'r'); try { fsyncSync(parent); } finally { closeSync(parent); }
}
function ownedPrivate(path, directory = false) {
  let part = '/';
  for (const component of path.split('/').filter(Boolean)) {
    part = resolve(part, component); const s = lstatSync(part);
    if (s.isSymbolicLink() || realpathSync(part) !== part || (part !== path && !s.isDirectory())) reject('Private path alias rejected');
  }
  const s = lstatSync(path);
  if (s.uid !== process.getuid() || (s.mode & 0o777) !== (directory ? 0o700 : 0o600)
    || (directory ? !s.isDirectory() : !s.isFile() || s.nlink !== 1)) reject('Private ownership or mode rejected');
}
function request() {
  const r = json(requestPath);
  if (r.teamId !== 325340 || r.teamSlug !== 'nicholasgeil' || r.teamName !== 'Cortex Memory'
    || r.requiredDeploymentType !== 'dev' || r.requiredKind !== 'cloud' || r.sharedCiTarget !== false
    || r.productionDeployment !== false || r.maximumPaidCalls !== 0 || r.retirementRequired !== true
    || !/^cortex-foundation-delta-[a-f0-9]{12}$/.test(r.projectSlug) || r.projectName !== r.projectSlug
    || r.privateEnvironmentFile !== envPath || r.privateTargetReceipt !== targetPath
    || !/^[a-f0-9-]{36}$/.test(r.operation) || r.purpose !== 'current-authorization-foundation-delta-20261005') reject('Exact fresh nonpaid foundation request required');
  return r;
}
function reviewedHelper() {
  const review = json(resolve(qa, 'task03-attempt3-management-review.json'));
  if (review.verdict !== 'PASS' || review.independent !== true || review.scope !== 'TASK03_DISPOSABLE_TARGET_MANAGEMENT_ONLY'
    || review.managementSourceSha256 !== hash(readFileSync(fileURLToPath(import.meta.url)))
    || review.requestSha256 !== hash(JSON.stringify(request()))) reject('Independent exact-source management review required');
}
let calls = 0; const deadline = Date.now() + 180_000;
async function api(path, method = 'GET', body, expected = 200, base = 'v1') {
  if (++calls > 7 || Date.now() >= deadline) reject('Management operation ceiling');
  const configPath = '/Users/SaintNick/.convex/config.json';
  const token = json(configPath).accessToken;
  if (typeof token !== 'string' || !token || token.length > 8192
    || [...token].some(c => { const code = c.codePointAt(0); return code <= 32 || code === 127 || code === 0x2028 || code === 0x2029; })) reject('Configured Convex account authentication rejected');
  let response;
  try {
    response = await fetch(`https://api.convex.dev/${base}${path}`, {
      method, redirect: 'error', signal: AbortSignal.timeout(Math.min(30_000, deadline - Date.now())),
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
  } catch { reject(`Management ${method} ${path} transport failure; dispatch uncertain; private diagnostics withheld`); }
  if (response.status !== expected) reject(`Management ${method} ${path} returned HTTP ${response.status}`);
  if (expected === 404 || response.status === 204) return { httpStatus: response.status };
  let text;
  try { text = await response.text(); } catch { reject(`Management ${method} ${path} response failure; dispatch uncertain; private diagnostics withheld`); }
  if (Buffer.byteLength(text) > 2_000_000) reject('Management response size rejected; private contents withheld');
  return text ? parseJson(text) : { httpStatus: response.status };
}
async function verify(projectId, deploymentName, r) {
  const p = await api(`/projects/${projectId}`);
  if (p.id !== projectId || p.name !== r.projectName || p.slug !== r.projectSlug
    || (p.teamId !== undefined && p.teamId !== r.teamId)) reject('Observed owned project mismatch');
  const d = await api(`/deployments/${encodeURIComponent(deploymentName)}`);
  if (d.name !== deploymentName || d.projectId !== projectId || d.deploymentType !== 'dev'
    || d.kind !== 'cloud' || d.deploymentUrl !== `https://${deploymentName}.convex.cloud`) reject('Observed isolated development deployment mismatch');
  const list = await api(`/projects/${projectId}/list_deployments`);
  if (!Array.isArray(list) || list.length !== 1 || list[0].name !== deploymentName
    || list[0].projectId !== projectId || list[0].deploymentType !== 'dev') reject('Target is not a sole disposable development deployment');
  return d;
}

ownedPrivate(scratch, true); reviewedHelper();
const operation = process.argv[2], r = request(), requestSha256 = hash(JSON.stringify(r));
if (operation === 'provision') {
  preparationReviewed();
  for (const key of selectors) if (process.env[key]) reject('Inherited target selector rejected before provisioning');
  for (const p of [ownershipPath, targetPath, envPath, resolve(scratch, 'provision-attempt.json')]) absent(p);
  const teams = await api('/teams', 'GET', undefined, 200, 'api');
  if (!Array.isArray(teams) || !teams.some(t => t.id === r.teamId && t.slug === r.teamSlug && t.name === r.teamName)) reject('Account team ownership not verified');
  save(resolve(scratch, 'provision-attempt.json'), { operation: r.operation, requestSha256, at: new Date().toISOString(), outcome: 'CREATE_NOT_YET_ACKNOWLEDGED; do not blindly retry an uncertain POST' });
  const p = await api(`/teams/${r.teamId}/create_project`, 'POST', { projectName: r.projectName, deploymentType: 'dev' });
  save(ownershipPath, { operation: r.operation, requestSha256, id: p.id, slug: p.slug, requestedName: r.projectName, deploymentName: p.deploymentName, createdAt: new Date().toISOString() });
  if (!Number.isSafeInteger(p.id) || p.id <= 0 || p.slug !== r.projectSlug || !/^[a-z0-9]+(?:-[a-z0-9]+)+$/.test(p.deploymentName ?? '')
    || p.deploymentUrl !== `https://${p.deploymentName}.convex.cloud`) reject('Created response mismatch; exclusive ownership retained');
  const d = await verify(p.id, p.deploymentName, r);
  const key = await api(`/deployments/${d.name}/create_deploy_key`, 'POST', { name: 'cortex-task03-current-foundation-20261005', expiresAt: Date.now() + 3 * 24 * 60 * 60 * 1000 });
  const prefix = `dev:${d.name}|`;
  if (typeof key.deployKey !== 'string' || !key.deployKey.startsWith(prefix) || key.deployKey.length <= prefix.length
    || key.deployKey.length > 8192 || [...key.deployKey].some(c => { const code = c.codePointAt(0); return code <= 32 || code === 127 || code === 0x2028 || code === 0x2029; })) reject('Development key mismatch');
  const values = { CONVEX_DEPLOY_KEY: key.deployKey, CONVEX_DEPLOYMENT: `dev:${d.name}`, CONVEX_URL: d.deploymentUrl };
  const envText = Object.entries(values).map(([k, v]) => `${k}=${v}\n`).join('');
  const parsedEnv = parseEnv(envText);
  if (Object.keys(parsedEnv).length !== 3 || Object.entries(values).some(([k, v]) => parsedEnv[k] !== v)) reject('Private environment roundtrip rejected');
  const target = { operation: r.operation, requestSha256, purpose: r.purpose, projectName: r.projectName, projectSlug: r.projectSlug,
    teamId: r.teamId, projectId: p.id, deploymentName: d.name, deploymentUrl: d.deploymentUrl, kind: 'cloud', deploymentType: 'dev',
    createdAt: new Date().toISOString(), active: true, retired: false, deleted: false, isolationVerified: true,
    productionDeployment: false, sharedCiTarget: false, privateEnvironmentFile: envPath, freshManagedProject: true };
  validateTarget(target, r, values, {});
  const fd = openSync(envPath, 'wx', 0o600);
  try { writeFileSync(fd, envText); fsyncSync(fd); } finally { closeSync(fd); }
  save(targetPath, target);
  save(resolve(qa, 'task03-attempt3-target-provision.json'), { operation: r.operation, requestSha256, projectId: p.id, deploymentName: d.name,
    deploymentType: 'dev', kind: 'cloud', isolationVerified: true, managementCalls: calls, privateCredentialsPrinted: false });
  console.log('Fresh isolated nonpaid foundation target verified; credentials remain private');
} else if (operation === 'retire') {
  // Physical retirement must remain possible after a failed source/deploy/codegen preflight.
  ownedPrivate(ownershipPath); const owned = json(ownershipPath);
  if (owned.operation !== r.operation || owned.requestSha256 !== requestSha256 || owned.slug !== r.projectSlug || owned.requestedName !== r.projectName
    || !Number.isSafeInteger(owned.id) || owned.id <= 0 || !/^[a-z0-9]+(?:-[a-z0-9]+)+$/.test(owned.deploymentName ?? '')) reject('Exclusive created-project ownership mismatch');
  const retirementPath = resolve(qa, 'task03-attempt3-target-retirement.json'); absent(retirementPath);
  const preimagePath = resolve(scratch, 'target-pre-retirement.json'), replacementPath = resolve(scratch, 'target-retired-replacement.json');
  absent(preimagePath); absent(replacementPath);
  let target;
  if (lstatSync(targetPath, { throwIfNoEntry: false })) {
    ownedPrivate(targetPath); target = json(targetPath);
    if (target.projectId !== owned.id || target.deploymentName !== owned.deploymentName || target.operation !== r.operation || target.requestSha256 !== requestSha256
      || target.active !== true || target.retired !== false || target.deleted !== false) reject('Current target ownership mismatch');
    const fd = openSync(preimagePath, 'wx', 0o600); try { writeFileSync(fd, readFileSync(targetPath)); fsyncSync(fd); } finally { closeSync(fd); }
  }
  await verify(owned.id, owned.deploymentName, r);
  await api(`/projects/${owned.id}/delete`, 'POST');
  const absentProject = await api(`/projects/${owned.id}`, 'GET', undefined, 404);
  const retiredAt = new Date().toISOString();
  if (target) { save(replacementPath, { ...target, active: false, retired: true, deleted: true, retiredAt, preRetirementReceiptSha256: hash(readFileSync(preimagePath)) }); renameSync(replacementPath, targetPath); }
  save(retirementPath, { operation: r.operation, requestSha256, projectId: owned.id, deploymentName: owned.deploymentName, retiredAt,
    deletionHttpStatus: 200, verificationHttpStatus: absentProject.httpStatus, retired: true, deleted: true, managementCalls: calls, productionMutations: 0 });
  console.log('Owned foundation project retired; GET404 verified');
} else reject('Explicit provision or retire operation required');
