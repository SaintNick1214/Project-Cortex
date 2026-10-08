import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile, writeFile, mkdir, chmod } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
const QA = dirname(new URL(import.meta.url).pathname);
const pointerPath = join(QA, 'fixture-pointer.json');
const publish = async (name, value) => writeFile(join(QA, `${name}.json`), JSON.stringify(value, null, 2) + '\n');
const privateWrite = async (path, value) => { await writeFile(path, JSON.stringify(value, null, 2) + '\n', { mode: 0o600 }); await chmod(path, 0o600); };
const token = JSON.parse(await readFile(join(homedir(), '.convex/config.json'), 'utf8')).accessToken;
assert.equal(typeof token, 'string'); assert.ok(token.length > 20);
async function api(method, path, body) {
  const response = await fetch(`https://api.convex.dev${path}`, { method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'Convex-Client': 'npm-cli-1.46.0' }, ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(30_000) });
  let data; try { data = await response.json(); } catch { data = null; }
  return { status: response.status, data };
}
const stage = process.argv[2];
if (stage === 'teams') {
  const result = await api('GET', '/api/teams');
  const teams = Array.isArray(result.data) ? result.data : result.data?.teams;
  const selected = teams?.find(t => t.id === 325340);
  await publish('team-access', { observedAt: new Date().toISOString(), httpStatus: result.status, accessibleTeamCount: teams?.length ?? null, selectedTeam: selected ? { id: selected.id, slug: selected.slug, name: selected.name } : null, secretsPrinted: false });
  assert.equal(result.status, 200); assert.ok(selected?.slug, 'Required disposable team is not accessible');
  const operation = randomUUID(); const suffix = operation.replaceAll('-', '').slice(0, 12);
  const privateDirectory = join(homedir(), '.codex/tmp', `cortex-task06-stock-native-${suffix}`);
  await mkdir(privateDirectory, { mode: 0o700 }); await chmod(privateDirectory, 0o700);
  const state = { operation, teamId: selected.id, teamSlug: selected.slug, projectName: `cortex-task06-stock-v2-${suffix}`, requestedAt: new Date().toISOString(), freshDisposable: true, deploymentType: 'dev', production: false, privateDirectory };
  await privateWrite(join(privateDirectory, 'state.json'), state);
  await publish('fixture-pointer', { operation, privateDirectory, projectName: state.projectName, teamId: state.teamId });
  console.log(JSON.stringify({ stage, status: 'PASS', selectedTeamId: state.teamId, privateDirectory, operation }));
} else {
  const pointer = JSON.parse(await readFile(pointerPath, 'utf8'));
  const statePath = join(pointer.privateDirectory, 'state.json');
  const state = JSON.parse(await readFile(statePath, 'utf8'));
  assert.equal(state.operation, pointer.operation); assert.equal(state.teamId, 325340); assert.equal(state.projectName, pointer.projectName); assert.ok(/^cortex-task06-stock-v2-[a-f0-9]{12}$/.test(state.projectName)); assert.equal(state.production, false);
  if (stage === 'provision') {
    assert.equal(state.projectId, undefined); assert.equal(state.projectSlug, undefined);
    const created = await api('POST', `/v1/teams/${state.teamId}/create_project`, { projectName: state.projectName, deploymentType: 'dev', deploymentRegion: null });
    await publish('project-create', { operation: state.operation, observedAt: new Date().toISOString(), httpStatus: created.status, projectId: created.data?.id, projectSlug: created.data?.slug, requestedName: state.projectName, deploymentType: 'dev' });
    if (created.data?.id) state.projectId = created.data.id;
    if (created.data?.slug) state.projectSlug = created.data.slug;
    await privateWrite(statePath, state);
    assert.equal(created.status, 200); assert.ok(state.projectSlug); assert.ok(state.projectId);
    const provisioned = await api('POST', '/api/deployment/provision_and_authorize', { teamSlug: state.teamSlug, projectSlug: state.projectSlug, deploymentType: 'dev' });
    assert.equal(provisioned.status, 200); assert.equal(typeof provisioned.data?.adminKey, 'string');
    const { adminKey, url, deploymentName } = provisioned.data;
    assert.equal(url, `https://${deploymentName}.convex.cloud`);
    state.deploymentName = deploymentName; state.url = url;
    await privateWrite(join(state.privateDirectory, 'credentials.json'), { adminKey, url, deploymentName, operation: state.operation });
    await privateWrite(statePath, state);
    const verify = await api('GET', `/v1/teams/${state.teamId}/projects/${state.projectSlug}`);
    await privateWrite(join(state.privateDirectory, 'project-verification.json'), verify);
    await publish('target-provision', { operation: state.operation, projectId: state.projectId, projectSlug: state.projectSlug, teamId: state.teamId, deploymentName, url, createHttpStatus: created.status, provisionHttpStatus: provisioned.status, readbackHttpStatus: verify.status, requestedType: 'dev', productionMutations: 0, currentProjectMatches: verify.data?.id === state.projectId, createdAt: new Date().toISOString() });
    assert.equal(verify.status, 200); assert.equal(verify.data?.id, state.projectId);
    const deployment = await api('GET', `/v1/deployments/${deploymentName}`);
    const deployments = await api('GET', `/v1/projects/${state.projectId}/list_deployments`);
    await publish('target-isolation', { operation: state.operation, projectId: state.projectId, deploymentName, deploymentHttpStatus: deployment.status, listHttpStatus: deployments.status, deployment: deployment.data, deployments: deployments.data });
    assert.equal(deployment.status, 200); assert.equal(deployments.status, 200);
    assert.equal(deployment.data?.deploymentType, 'dev'); assert.equal(deployment.data?.projectId, state.projectId);
    assert.equal(deployment.data?.deploymentUrl, state.url);
    assert.ok(Array.isArray(deployments.data)); assert.equal(deployments.data.length, 1); assert.equal(deployments.data[0]?.name, deploymentName);
    console.log(JSON.stringify({ stage, status: 'CREATED_READBACK_MATCHED', operation: state.operation, projectId: state.projectId, deploymentName, privateDirectory: state.privateDirectory }));
  } else if (stage === 'deploy-key') {
    const current = await api('GET', `/v1/deployments/${state.deploymentName}`);
    assert.equal(current.status, 200); assert.equal(current.data?.projectId, state.projectId); assert.equal(current.data?.deploymentType, 'dev'); assert.equal(current.data?.kind, 'cloud');
    const key = await api('POST', `/v1/deployments/${state.deploymentName}/create_deploy_key`, { name: `task06-stock-native-${state.operation}`, expiresAt: Date.now()+86400000 });
    assert.equal(key.status, 200); assert.equal(typeof key.data?.deployKey, 'string'); assert.ok(key.data.deployKey.startsWith(`dev:${state.deploymentName}|`));
    const path = join(state.privateDirectory, 'credentials.json'); const credentials = JSON.parse(await readFile(path,'utf8'));
    await privateWrite(path, { ...credentials, deployKey: key.data.deployKey });
    await publish('dev-key', {operation:state.operation,projectId:state.projectId,deploymentName:state.deploymentName,httpStatus:key.status,mode:'0600',expiresInMs:86400000,printed:false});
    console.log(JSON.stringify({stage,status:'PASS',deploymentName:state.deploymentName}));
  } else if (stage === 'retire') {
    assert.ok(Number.isSafeInteger(state.projectId) && state.projectId > 0);
    const current = await api('GET', `/v1/projects/${state.projectId}`);
    if (current.status !== 404) {
      assert.equal(current.status, 200); assert.equal(current.data?.id, state.projectId);
      assert.equal(current.data?.slug, state.projectSlug);
      const deleted = await api('POST', `/v1/projects/${state.projectId}/delete`);
      await publish('retirement-delete', { operation: state.operation, projectId: state.projectId, projectSlug: state.projectSlug, deletionHttpStatus: deleted.status, at: new Date().toISOString() });
      assert.equal(deleted.status, 200);
    }
    const absent = await api('GET', `/v1/projects/${state.projectId}`);
    await publish('retirement', { operation: state.operation, projectId: state.projectId, projectSlug: state.projectSlug, deploymentName: state.deploymentName, readbackHttpStatus: absent.status, retired: absent.status === 404, productionMutations: 0, at: new Date().toISOString() });
    assert.equal(absent.status, 404); state.retired = true; await privateWrite(statePath, state);
    console.log(JSON.stringify({ stage, status: 'PASS', projectId: state.projectId, verificationHttpStatus: absent.status }));
  } else if (stage === 'inspect') {
    const project = JSON.parse(await readFile(join(state.privateDirectory, 'project-verification.json'), 'utf8'));
    const scrub = value => Array.isArray(value) ? value.map(scrub) : value && typeof value === 'object' ? Object.fromEntries(Object.entries(value).filter(([k]) => !/token|key|secret|password|credential/i.test(k)).map(([k,v]) => [k,scrub(v)])) : value;
    console.log(JSON.stringify(scrub(project)));
  } else { throw new Error('Unknown management stage'); }
}
