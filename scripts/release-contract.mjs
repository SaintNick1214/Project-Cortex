/** Shared delivery rules. Network/publication effects are injected for dry tests. */
export const releasePackages = [
  { key: 'sdk', name: '@cortexmemory/sdk', folder: '.', tag: 'v', paths: ['src/', 'convex-dev/', 'package.json', 'package-lock.json', 'tsconfig*.json'] },
  { key: 'provider', name: '@cortexmemory/vercel-ai-provider', folder: 'packages/vercel-ai-provider', tag: 'vercel-ai-provider-v', paths: ['packages/vercel-ai-provider/src/', 'packages/vercel-ai-provider/react/', 'packages/vercel-ai-provider/package.json', 'packages/vercel-ai-provider/tsconfig*.json'] },
  { key: 'templates', name: '@cortexmemory/templates', folder: 'packages/cortex-templates', tag: 'templates-v', paths: ['packages/cortex-templates/', 'packages/cortex-cli/templates/', 'packages/vercel-ai-provider/quickstart/'] },
  { key: 'cli', name: '@cortexmemory/cli', folder: 'packages/cortex-cli', tag: 'cli-v', paths: ['packages/cortex-cli/src/', 'packages/cortex-cli/scripts/', 'packages/cortex-cli/package.json', 'packages/cortex-cli/tsconfig*.json'] },
];
const semver = version => {
  if (typeof version !== 'string' || !/^\d+\.\d+\.\d+$/.test(version)) throw new Error(`Stable semver required: ${version}`);
  return version.split('.').map(Number);
};
const compare = (a, b) => {
  const x = semver(a), y = semver(b);
  return x[0] - y[0] || x[1] - y[1] || x[2] - y[2];
};
export function assertSourceSha(sha) {
  if (typeof sha !== 'string' || !/^[a-f0-9]{40}$/.test(sha)) throw new Error('Exact source commit required');
}
/** Workflow completion alone does not imply the separately uploaded CodeQL check passed. */
export function deliveryReady({ runs, checks, statuses, sourceSha }) {
  assertSourceSha(sourceSha);
  const successful = name => {
    const latest = runs.filter(run => run.name === name && run.head_sha === sourceSha && run.event === 'push').sort((a, b) => b.id - a.id)[0];
    return latest?.status === 'completed' && latest.conclusion === 'success' ? latest : undefined;
  };
  const tests = successful('PR Checks'), security = successful('Security Scans');
  const codeql = checks.filter(check => check.name === 'CodeQL' && check.head_sha === sourceSha).sort((a, b) => b.id - a.id)[0];
  const latestStatuses = new Map();
  for (const status of statuses) if (!latestStatuses.has(status.context)) latestStatuses.set(status.context, status);
  const snyk = [...latestStatuses.values()].filter(status => status.context.startsWith('security/snyk'));
  return { ready: Boolean(tests && security && codeql?.status === 'completed' && codeql.conclusion === 'success' && snyk.length > 0 && snyk.every(status => status.state === 'success')), checksRun: tests?.id };
}
/** Only a structured registry E404 denotes a first publication. Auth/network errors propagate. */
export function registryResult(stdout, error) {
  if (!error) {
    const value = JSON.parse(stdout);
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid npm registry metadata');
    semver(value.version);
    return value;
  }
  let value;
  try { value = JSON.parse(stdout); } catch { throw error; }
  if (value?.error?.code === 'E404') return undefined;
  throw error;
}
export function createReleasePlan({ paths, sourceSha, readManifest, registry, diffPaths }) {
  assertSourceSha(sourceSha);
  if (paths?.sha !== sourceSha) throw new Error('Release paths must match the checked main commit');
  const packages = [];
  for (const specification of releasePackages) {
    const manifest = readManifest(specification.folder);
    if (manifest.name !== specification.name) throw new Error(`Unexpected package: ${specification.folder}`);
    semver(manifest.version);
    const latest = registry(specification.name);
    let changed = paths[specification.key] === true || !latest;
    if (latest) {
      semver(latest.version);
      if (/^[a-f0-9]{40}$/.test(latest.gitHead ?? '')) changed ||= Boolean(diffPaths(latest.gitHead, sourceSha, specification.paths));
    }
    // Provider/CLI track the SDK ABI. Template-only changes never republish them.
    if (specification.key === 'provider' || specification.key === 'cli') changed ||= packages[0].changed || packages[0].released;
    const released = latest?.gitHead === sourceSha;
    if (released) changed = false;
    const version = released || !changed ? latest.version : !latest || compare(manifest.version, latest.version) > 0
      ? manifest.version
      : (() => { const [major, minor, patch] = semver(latest.version); return `${major}.${minor}.${patch + 1}`; })();
    packages.push({ ...specification, changed, released, version });
  }
  return { sourceSha, packages };
}
export function validateReleasePlan(plan, sourceSha) {
  assertSourceSha(sourceSha);
  if (plan?.sourceSha !== sourceSha || !Array.isArray(plan.packages) || plan.packages.length !== releasePackages.length) throw new Error('Release plan/source mismatch');
  for (let index = 0; index < releasePackages.length; index++) {
    const actual = plan.packages[index], expected = releasePackages[index];
    if (!actual || ['key', 'name', 'folder', 'tag'].some(key => actual[key] !== expected[key]) || typeof actual.changed !== 'boolean' || typeof actual.released !== 'boolean') throw new Error('Invalid release package/order');
    semver(actual.version);
  }
}
export async function publishReleasePlan({ plan, sourceSha, publish, visibleVersion, now = Date.now, wait, tagAndRelease, visibilityTimeoutMs = 600_000 }) {
  validateReleasePlan(plan, sourceSha);
  for (const pkg of plan.packages.filter(pkg => pkg.changed || pkg.released)) {
    if (pkg.changed) publish(pkg);
    const deadline = now() + visibilityTimeoutMs;
    let visible = false;
    while (now() < deadline) {
      try { visible = await visibleVersion(pkg) === pkg.version; } catch { /* Bounded registry processing retries. */ }
      if (visible) break;
      await wait(Math.min(10_000, Math.max(0, deadline - now())));
    }
    if (!visible) throw new Error(`Published version not visible: ${pkg.name}@${pkg.version}`);
    tagAndRelease(pkg);
  }
}
