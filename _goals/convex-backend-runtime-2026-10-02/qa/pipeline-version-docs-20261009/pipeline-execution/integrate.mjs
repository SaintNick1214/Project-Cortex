import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import yaml from 'js-yaml';
const show = (ref, path) => execFileSync('git', ['show', `${ref}:${path}`], { encoding: 'utf8' });
const parentPath = '.github/workflows/pr-checks.yml';
let parentSource = show('origin/dev', parentPath);
const parent = yaml.load(parentSource), previous = yaml.load(show('HEAD', parentPath));
const childPath = '.github/workflows/managed-ci.yml';
const child = yaml.load(readFileSync(childPath, 'utf8'));
const modernChild = structuredClone(child);
const setupSteps = sha => [
  { uses: 'actions/checkout@v6', with: { ref: sha, 'persist-credentials': false, 'sparse-checkout': '/*\n!/_goals/\n!/work/\n', 'sparse-checkout-cone-mode': false } },
  { uses: './.github/actions/cortex-setup' },
  { name: 'Install dependencies', run: 'npm ci' },
];
const functionalSteps = job => job.steps.slice(job.steps.findIndex(step => /npm ci/.test(step.run ?? '')) + 1);
const secretNames = ['CORTEX_CI_AUTH_PRIVATE_KEY', 'CORTEX_CI_CONVEX_URL', 'CORTEX_CI_CONVEX_URL_CLI', 'CORTEX_CI_CONVEX_DEPLOY_KEY', 'CORTEX_CI_CONVEX_DEPLOY_KEY_CLI'];
child.on.workflow_call.secrets = Object.fromEntries(secretNames.map(name => [name, { required: false }]));
parent.jobs['managed-tests'].secrets = Object.fromEntries(secretNames.map(name => [name, '${{ secrets.' + name + ' }}']));
for (const name of ['setup-and-purge', 'test-typescript', 'test-vercel-ai-provider', 'test-cli']) {
  const job = structuredClone(previous.jobs[name]);
  job.if = modernChild.jobs[name].if;
  job.needs = modernChild.jobs[name].needs;
  if (!job.needs) delete job.needs;
  job.permissions = modernChild.jobs[name].permissions;
  job.steps = [...setupSteps('${{ inputs.candidate-sha }}'), ...functionalSteps(job)];
  if (name === 'setup-and-purge') {
    job.steps.splice(3, 0, {
      name: 'Refuse stale candidates before any shared preparation',
      env: { GITHUB_TOKEN: '${{ github.token }}', CI_CANDIDATE_SHA: '${{ inputs.candidate-sha }}' },
      run: 'node scripts/ci-managed.mjs freshness',
    });
  }
  if (name === 'test-typescript') {
    const units = job.steps.find(step => /--shard=/.test(step.run ?? ''));
    units.run = units.run.replace('--maxWorkers=75%', '--runInBand');
  }
  child.jobs[name] = job;
}
const cleanup = structuredClone(previous.jobs['cleanup-runtime-fixtures']);
cleanup.needs = ['setup-and-purge', 'test-typescript', 'test-vercel-ai-provider', 'test-cli'];
cleanup.if = `always() && inputs.queue_probe != true && contains(fromJSON(inputs.selection).selected, 'cleanup-runtime-fixtures') && (needs.setup-and-purge.result == 'success' || needs.setup-and-purge.result == 'failure' || needs.setup-and-purge.result == 'cancelled')`;
cleanup.steps = [...setupSteps('${{ inputs.candidate-sha }}'), ...functionalSteps(cleanup)];
child.jobs['cleanup-runtime-fixtures'] = cleanup;
child.jobs['managed-outcomes'].needs.push('cleanup-runtime-fixtures');
// Keep the aggregate last, after both independent cleanup outcomes are available.
const aggregate = child.jobs['managed-outcomes'];
delete child.jobs['managed-outcomes'];
child.jobs['managed-outcomes'] = aggregate;
writeFileSync(childPath, '# One exact-candidate managed lifecycle owns the shared lock through guarded preparation, scoped consumers and cleanup.\n' + yaml.dump(child, { lineWidth: -1, noRefs: true, quotingType: '"' }));
for (const name of ['graph-contracts', 'native-proof-contracts']) {
  const job = parent.jobs[name], branch = previous.jobs[name];
  Object.assign(job.env, { CORTEX_CI_TARGET_CLASS: branch.env.CORTEX_CI_TARGET_CLASS, CORTEX_CI_NATIVE_OWNER: branch.env.CORTEX_CI_NATIVE_OWNER });
  const prepare = job.steps.find(step => /generate_admin_key/.test(step.run ?? ''));
  prepare.run = branch.steps.find(step => /generate_admin_key/.test(step.run ?? '')).run;
  const proof = job.steps.find(step => /--runTestsByPath/.test(step.run ?? ''));
  proof.run = branch.steps.find(step => /--runTestsByPath/.test(step.run ?? '')).run;
  if (name === 'graph-contracts') {
    proof.run = proof.run.replace('          ', '');
    // Cleanup must run after either graph consumer fails; it cannot short-circuit the second outcome.
    proof.run = proof.run.replace('npx tsx scripts/cleanup-test-data.ts native\n', '');
    job.steps.push({ name: 'Retire isolated native graph fixtures after every consumer outcome', if: 'always()', run: 'npx tsx scripts/cleanup-test-data.ts native' });
  }
}
const publicSteps = parent.jobs['public-contracts'].steps;
publicSteps.splice(publicSteps.findIndex(step => step.run === 'npm run test:contracts') + 1, 0,
  { run: 'npm run build --workspace=@cortexmemory/cli' },
  { name: 'Exercise disposable-target, scoped JWT, lifecycle, installation and environment guards offline', run: 'node --test scripts/ci/*.test.mjs' });
parent.jobs['code-quality'].steps.find(step => /ci-contract.mjs offline-unit/.test(step.run ?? '')).run = 'npm run build:backend\ntimeout --signal=TERM --kill-after=5s 240s node scripts/ci-contract.mjs offline-unit\n';
const packages = parent.jobs['offline-packages'];
const cliSteps = functionalSteps(previous.jobs['test-cli']);
const cliNames = ['Build the CLI executable before command contracts', 'Install supported completion shells for command contracts', 'Prepare isolated command fixtures from current built dependencies', 'Run CLI unit and command contracts without live credentials', 'Remove owned offline command fixtures after success or failure'];
const cli = cliSteps.filter(step => cliNames.includes(step.name)).map(step => ({ ...structuredClone(step), if: step.if ? `always() && needs.detect-changes.outputs.cli == 'true'` : `needs.detect-changes.outputs.cli == 'true'` }));
const lint = { name: 'CLI lint and types', if: "needs.detect-changes.outputs.cli == 'true'", run: 'npm run lint --workspace=@cortexmemory/cli\nnpm run typecheck --workspace=@cortexmemory/cli\n' };
const provider = packages.steps.find(step => step.name === 'Provider types, exports and mocked unit/integration');
provider.run = provider.run.replaceAll('-- --runInBand', '-- --runInBand --forceExit=false');
provider.env = { CONVEX_URL: 'https://unit.invalid', CONVEX_URL_CLI: 'https://unit.invalid', CORTEX_TEST_ENV_MODE: 'explicit', CORTEX_CI_AUTH_PRIVATE_KEY: '', CORTEX_TEST_AUTH_TOKEN: '', CORTEX_TEST_READER_TOKEN: '', CORTEX_TEST_OUTSIDER_TOKEN: '', CORTEX_TEST_FIXTURE: '' };
packages.steps.splice(packages.steps.findIndex(step => step.name === 'CLI lint, types, build and unit'), 1, lint, ...cli);
// Replace only changed jobs, leaving modern comments and the remaining source intact.
for (const name of ['managed-tests', 'graph-contracts', 'native-proof-contracts', 'public-contracts', 'code-quality', 'offline-packages']) {
  const start = parentSource.indexOf(`  ${name}:\n`);
  const rest = parentSource.slice(start + 1);
  const next = rest.search(/^  [a-z][a-z0-9-]*:\s*$/m);
  let end = next < 0 ? parentSource.length : start + 1 + next;
  const comment = parentSource.slice(start, end).indexOf('\n  #');
  if (comment >= 0) end = start + comment;
  const rendered = yaml.dump({ [name]: parent.jobs[name] }, { lineWidth: -1, noRefs: true, quotingType: '"' }).split('\n').filter(Boolean).map(line => '  ' + line).join('\n') + '\n\n';
  parentSource = parentSource.slice(0, start) + rendered + parentSource.slice(end);
}
writeFileSync(parentPath, parentSource);
let security = show('origin/dev', '.github/workflows/security.yml');
security = security.replace(/      - name: Setup Node\.js\n        uses: actions\/setup-node@v6\n        with:\n          node-version: "24"(?:\n          cache: "npm")?\n(?:      - name: Use declared npm version\n        run: npm install --global npm@12\.2\.0\n)?/g, '      - uses: ./.github/actions/cortex-setup\n        with:\n          cache: "false"\n');
writeFileSync('.github/workflows/security.yml', security);
