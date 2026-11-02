/** Functional CI selection and final outcomes. No service calls or credentials. */
import { appendFileSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { aggregateManaged, managedJobs } from './ci-managed.mjs';
import { readNulCommand } from './ci-main-release.mjs';

export const ciJobs = ['detect-changes', 'code-quality', 'public-contracts', 'offline-packages', 'template-catalog', 'candidate-artifacts', 'demo-contracts', 'graph-contracts', 'native-proof-contracts', ...managedJobs];
const repositoryRoot = fileURLToPath(new URL('../', import.meta.url));
// Current unit tests use fake transports and controlled Gateway peers, including
// the restored dispatch regression catalog. Actual runtime, native and graph
// tests remain separate selected service qualification.
export function discoverOfflineUnitFiles(root = repositoryRoot) {
  return readdirSync(resolve(root, 'tests/unit'), { recursive: true, withFileTypes: true })
    .filter(entry => entry.isFile() && entry.name.endsWith('.test.ts'))
    .map(entry => relative(root, resolve(entry.parentPath, entry.name)).replaceAll('\\', '/'))
    .sort();
}
export const offlineUnitFiles = discoverOfflineUnitFiles();
const demoFolders = ['packages/cortex-cli/templates/basic', 'packages/cortex-cli/templates/chat-sdk-quickstart', 'packages/vercel-ai-provider/quickstart'];
const bot = value => typeof value === 'string' && /(?:\[bot\]|^dependabot|^renovate)/i.test(value);
const docs = path => /\.(?:md|mdx|txt)$/i.test(path) || /^(?:_goals|_research|work|\.agents)\//.test(path);
const topology = path => path === '.main-release-policy.json' || (/^\.github\/workflows\/[^/]+\.ya?ml$/.test(path) && !/^\.github\/workflows\/(?:security|publish|auto-merge)\.ya?ml$/.test(path)) || /^\.github\/actions\//.test(path) || /^scripts\/ci\//.test(path) || /^scripts\/(?:ci-[^/]+\.mjs|prepare-ci-backend\.mjs|cleanup-test-data\.ts|install-ci-demo\.mjs|lib\/ci-[^/]+\.ts)$/.test(path) || /^tests\/ci-[^/]+\.test\.mjs$/.test(path);
const shared = path => /^(?:src|convex-dev)\//.test(path) || /^(?:package(?:-lock)?\.json|convex\.json|tsconfig[^/]*\.json|jest\.config\.[^/]+|eslint\.config\.[^/]+|tsup\.config\.[^/]+)$/.test(path) || /^tests\/.*\.(?:ts|tsx)$/.test(path);

/** Retain deletions and additions independently, including both moved endpoints. */
export async function changedCiPaths(baseSha, headSha, cwd = process.cwd(), { limits } = {}) {
  if (!/^[a-f0-9]{40}$/.test(baseSha ?? '') || !/^[a-f0-9]{40}$/.test(headSha ?? '') || /^0+$/.test(headSha)) throw new Error('Exact base and nonzero head commits required');
  // Both forms read committed objects, so sparse/dirty indexes cannot hide paths.
  const args = /^0+$/.test(baseSha) ? ['ls-tree', '--full-tree', '-r', '--name-only', '-z', headSha] : ['diff', '--no-relative', '--no-renames', '--name-only', '-z', baseSha, headSha];
  const { records } = await readNulCommand('git', args, { cwd, limits });
  if (records.some(path => !path)) throw new Error('Git returned an empty change path');
  return records;
}

export function selectCi({ eventName, event = {}, repository, actor, ref, files, fullCi = false }) {
  if (!['pull_request', 'push', 'workflow_dispatch'].includes(eventName)) throw new Error('Unsupported functional CI event');
  if (typeof repository !== 'string' || !/^[^/]+\/[^/]+$/.test(repository) || !Array.isArray(files) || files.some(path => typeof path !== 'string' || !path || path.startsWith('/') || path.split('/').includes('..'))) throw new Error('Repository and complete relative change paths required');
  if (typeof fullCi !== 'boolean') throw new Error('fullCi must be a boolean');
  const pr = event.pull_request;
  if (eventName === 'pull_request' && (!pr || typeof pr.draft !== 'boolean' || !pr.head?.repo?.full_name || !pr.user?.type)) throw new Error('Complete PR trust/draft metadata required');
  const trusted = eventName === 'push' || (Boolean(actor) && !bot(actor) && event.sender?.type !== 'Bot' && (eventName !== 'pull_request' || (pr.head.repo.full_name === repository && pr.user.type !== 'Bot' && !bot(pr.user.login))));
  if (eventName === 'push' && ref !== 'refs/heads/main') throw new Error('Functional push CI is main-only');
  const forceFull = eventName === 'push' || (eventName === 'workflow_dispatch' && fullCi);
  const sourcePipeline = files.some(topology);
  const sdk = forceFull || sourcePipeline || files.some(path => !docs(path) && shared(path));
  const cli = sdk || files.some(path => !docs(path) && path.startsWith('packages/cortex-cli/'));
  const provider = sdk || files.some(path => !docs(path) && path.startsWith('packages/vercel-ai-provider/') && !path.startsWith(`${demoFolders[2]}/`));
  const demos = demoFolders.filter(folder => sdk || cli || (provider && folder !== demoFolders[0]) || files.some(path => !docs(path) && (path.startsWith(`${folder}/`) || path.startsWith('packages/cortex-templates/'))));
  const catalog = sdk || cli || demos.length > 0 || files.some(path => !docs(path) && path.startsWith('packages/cortex-templates/'));
  const serviceReady = trusted && !(eventName === 'pull_request' && pr.draft);
  const serviceCandidates = { 'candidate-artifacts': demos.length > 0, 'demo-contracts': demos.length > 0, 'graph-contracts': sdk, 'native-proof-contracts': sdk, 'setup-and-purge': sdk || provider || cli, 'test-typescript': sdk, 'test-vercel-ai-provider': provider, 'test-cli': cli, 'cleanup-runtime-fixtures': sdk || provider || cli };
  const selected = ['detect-changes', 'code-quality', 'public-contracts'];
  if (cli || provider) selected.push('offline-packages');
  if (catalog) selected.push('template-catalog');
  const deferred = [], unavailable = [];
  for (const [job, affected] of Object.entries(serviceCandidates)) {
    if (!affected) continue;
    if (serviceReady) selected.push(job);
    else (trusted ? deferred : unavailable).push(job);
  }
  // Existing delivery artifact schema; these flags describe package source paths,
  // independently of whether draft/untrusted service qualification is available.
  const delivery = {
    sdk: files.some(path => /^(?:src|convex-dev)\//.test(path) || /^(?:package(?:-lock)?\.json|tsconfig[^/]*\.json)$/.test(path)),
    provider: files.some(path => /^packages\/vercel-ai-provider\/(?:src\/|react\/|package\.json$|tsconfig[^/]*\.json$)/.test(path)),
    cli: files.some(path => /^packages\/cortex-cli\/(?:src\/|scripts\/|package\.json$)/.test(path)),
    templates: files.some(path => /^packages\/(?:cortex-templates\/|cortex-cli\/templates\/|vercel-ai-provider\/quickstart\/)/.test(path)),
  };
  return { trusted, mode: serviceReady ? 'ready' : trusted ? 'draft-fast' : 'untrusted-fast', sourcePipeline, forceFull, sdk, cli, provider, demos, catalog, selected, deferred, unavailable, delivery };
}

export function aggregateCi(selection, needs) {
  if (!selection || !['selected', 'deferred', 'unavailable'].every(key => Array.isArray(selection[key])) || !needs || typeof needs !== 'object') throw new Error('Selection and complete job outcomes required');
  const groups = [...selection.selected, ...selection.deferred, ...selection.unavailable];
  if (groups.some(job => !ciJobs.includes(job)) || new Set(groups).size !== groups.length || !['detect-changes', 'code-quality', 'public-contracts'].every(job => selection.selected.includes(job))) throw new Error('Invalid required CI selection');
  const reasons = [], executed = [];
  for (const job of ciJobs) {
    const result = needs[job]?.result;
    if (selection.selected.includes(job)) {
      if (result !== 'success') reasons.push(`${job}: required success, received ${result ?? 'missing'}`);
      else executed.push(job);
    } else if (result !== 'skipped') reasons.push(`${job}: expected intentional skip, received ${result ?? 'missing'}`);
  }
  for (const job of Object.keys(needs)) if (!ciJobs.includes(job)) reasons.push(`${job}: unclassified job must be added to the coverage contract`);
  return { passed: reasons.length === 0, selected: selection.selected, executed, deferred: selection.deferred, unavailable: selection.unavailable, notApplicable: ciJobs.filter(job => !groups.includes(job)), reasons };
}

/** A reusable workflow success alone cannot certify its selected leaf jobs. */
export function aggregateParentCi(selection, needs, sha) {
  if (!/^[a-f0-9]{40}$/.test(sha ?? '') || !selection || !Array.isArray(selection.selected) || !needs || typeof needs !== 'object') throw new Error('Exact candidate, selection and parent outcomes required');
  const expanded = { ...needs }, reasons = [];
  const caller = expanded['managed-tests'];
  delete expanded['managed-tests'];
  const selected = selection.selected.includes('setup-and-purge');
  if (managedJobs.some(job => Object.hasOwn(expanded, job))) reasons.push('managed-tests: leaf outcomes must come from the called workflow receipt');
  for (const job of managedJobs) delete expanded[job];
  if (caller?.result !== (selected ? 'success' : 'skipped')) reasons.push(`managed-tests: required ${selected ? 'success' : 'skipped'}, received ${caller?.result ?? 'missing'}`);
  if (selected) {
    try {
      const receipt = JSON.parse(caller?.outputs?.receipt ?? '');
      const observed = aggregateManaged(selection, receipt.outcomes, sha);
      if (receipt.schema !== 1 || receipt.kind !== 'managed-functional' || receipt.sha !== sha || receipt.passed !== true || !observed.passed || JSON.stringify(receipt.selected) !== JSON.stringify(observed.selected) || !Array.isArray(receipt.reasons) || receipt.reasons.length) throw new Error('wrong-SHA, incomplete or unsuccessful managed receipt');
      if (caller.result === 'success') Object.assign(expanded, observed.outcomes);
    } catch (error) { reasons.push(`managed-tests: invalid required receipt (${error.message})`); }
  } else {
    if (caller?.outputs?.receipt) reasons.push('managed-tests: unexpected receipt for intentionally unselected lifecycle');
    for (const job of managedJobs) expanded[job] = { result: 'skipped' };
  }
  const result = aggregateCi(selection, expanded);
  result.reasons.push(...reasons);
  result.passed = result.reasons.length === 0;
  return result;
}

export function ciSummary(result) {
  return ['## Functional CI coverage', `Result: ${result.passed ? 'PASS for selected coverage' : 'FAIL'}`, ...['selected', 'executed', 'deferred', 'unavailable', 'notApplicable'].map(key => `- ${key}: ${result[key].join(', ') || 'none'}`), '- Deferred draft coverage and unavailable fork/bot services are not completed proof.', `- Current controlled SDK unit discovery: ${offlineUnitFiles.length} files. Managed qualification records complete discovery, selected authenticated runtime outcomes and cleanup separately.`, ...result.reasons.map(reason => `- BLOCKED: ${reason}`)].join('\n') + '\n';
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  try {
    const command = process.argv[2];
    if (command === 'select') {
      const event = JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8'));
      const files = process.argv[3] ? readFileSync(process.argv[3], 'utf8').split('\0').filter(Boolean) : await changedCiPaths(process.env.BASE_SHA, process.env.HEAD_SHA);
      const selection = selectCi({ eventName: process.env.GITHUB_EVENT_NAME, event, repository: process.env.GITHUB_REPOSITORY, actor: process.env.GITHUB_ACTOR, ref: process.env.GITHUB_REF, files, fullCi: event.inputs?.full_ci === true || event.inputs?.full_ci === 'true' });
      const outputs = { selection: JSON.stringify(selection), 'candidate-artifacts': selection.selected.includes('candidate-artifacts'), 'offline-packages': selection.selected.includes('offline-packages'), 'template-catalog': selection.selected.includes('template-catalog'), 'demo-contracts': selection.selected.includes('demo-contracts'), 'graph-contracts': selection.selected.includes('graph-contracts'), 'native-proof-contracts': selection.selected.includes('native-proof-contracts'), managed: selection.selected.includes('setup-and-purge'), 'managed-sdk': selection.selected.includes('test-typescript'), 'managed-provider': selection.selected.includes('test-vercel-ai-provider'), 'managed-cli': selection.selected.includes('test-cli'), cli: selection.cli, provider: selection.provider, demos: JSON.stringify(selection.demos), ...Object.fromEntries(Object.entries(selection.delivery).map(([key, value]) => [`${key}-release`, value])) };
      appendFileSync(process.env.GITHUB_OUTPUT, Object.entries(outputs).map(([key, value]) => `${key}=${value}`).join('\n') + '\n');
      if (process.env.GITHUB_EVENT_NAME === 'push') writeFileSync('delivery-paths.json', JSON.stringify({ sha: process.env.GITHUB_SHA, ...selection.delivery }));
      console.log(JSON.stringify(selection, null, 2));
    } else if (command === 'aggregate') {
      const selection = JSON.parse(process.env.CI_SELECTION), needs = JSON.parse(process.env.CI_NEEDS);
      const result = process.env.CI_PARENT === 'true' ? aggregateParentCi(selection, needs, process.env.CI_CANDIDATE_SHA) : aggregateCi(selection, needs);
      const summary = ciSummary(result);
      console.log(summary);
      if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary);
      process.exitCode = result.passed ? 0 : 1;
    } else if (command === 'offline-unit') {
      const { default: config } = await import('../jest.config.mjs');
      // Bypass the live env loader rather than inventing a test deployment URL.
      const offline = { ...config, rootDir: repositoryRoot, setupFiles: [], setupFilesAfterEnv: [], reporters: ['default'], forceExit: false, watchman: false };
      const env = { PATH: process.env.PATH, HOME: process.env.HOME, TMPDIR: process.env.TMPDIR, CI: 'true', CORTEX_TEST_ENV_MODE: 'explicit', CONVEX_URL: 'https://unit.invalid', CONVEX_URL_CLI: 'https://unit.invalid' };
      const result = spawnSync(process.execPath, ['--experimental-vm-modules', 'node_modules/jest/bin/jest.js', '--config', JSON.stringify(offline), '--runInBand', '--forceExit=false', '--runTestsByPath', ...offlineUnitFiles, ...process.argv.slice(3)], { cwd: repositoryRoot, env, stdio: 'inherit' });
      if (result.error) throw result.error;
      process.exitCode = result.status ?? 1;
    } else throw new Error('Use select, aggregate or offline-unit');
  } catch (error) {
    console.error(`Functional CI: ${error.message}`);
    process.exitCode = 1;
  }
}
