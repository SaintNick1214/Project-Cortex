/** Shared managed lifecycle: read-only candidate refusal and complete outcome receipts. */
import { appendFileSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export const managedJobs = ['setup-and-purge', 'test-typescript', 'test-vercel-ai-provider', 'test-cli'];
const shaPattern = /^[a-f0-9]{40}$/;
const bot = value => typeof value === 'string' && /(?:\[bot\]|^dependabot|^renovate)/i.test(value);

export function requiredManagedJobs(selection) {
  if (!selection || selection.trusted !== true || selection.mode !== 'ready' || !Array.isArray(selection.selected) || new Set(selection.selected).size !== selection.selected.length) throw new Error('Trusted ready selection required for managed lifecycle');
  const selected = managedJobs.filter(job => selection.selected.includes(job));
  if (!selected.includes('setup-and-purge') || selected.length < 2) throw new Error('Managed preparation and at least one selected suite required');
  return selected;
}

export function aggregateManaged(selection, needs, sha) {
  const selected = requiredManagedJobs(selection);
  if (!shaPattern.test(sha ?? '') || !needs || typeof needs !== 'object' || Array.isArray(needs)) throw new Error('Exact candidate and managed outcomes required');
  const reasons = [], outcomes = {};
  for (const job of managedJobs) {
    const result = needs[job]?.result;
    const expected = selected.includes(job) ? 'success' : 'skipped';
    if (result !== expected) reasons.push(`${job}: required ${expected}, received ${result ?? 'missing'}`);
    outcomes[job] = { result: result ?? 'missing' };
  }
  for (const job of Object.keys(needs)) if (!managedJobs.includes(job)) reasons.push(`${job}: unclassified managed job`);
  return { schema: 1, kind: 'managed-functional', sha, passed: reasons.length === 0, selected, outcomes, reasons };
}

export function assertManagedTrust({ eventName, event = {}, repository, actor, ref }) {
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository ?? '')) throw new Error('Valid repository required');
  if (eventName === 'push' && ref === 'refs/heads/main') return;
  if (!actor || bot(actor) || event.sender?.type === 'Bot') throw new Error('Managed lifecycle requires a trusted human candidate');
  if (eventName === 'workflow_dispatch' && ref?.startsWith('refs/heads/')) return;
  const pr = event.pull_request;
  if (eventName !== 'pull_request' || !pr || pr.draft !== false || pr.head?.repo?.full_name !== repository || pr.user?.type !== 'User' || bot(pr.user.login)) throw new Error('Managed lifecycle requires a ready same-repository PR');
}

async function githubRequest(path, token) {
  if (!token) throw new Error('Read-only GitHub token required for candidate freshness');
  const response = await fetch(`https://api.github.com${path}`, { headers: { authorization: `Bearer ${token}`, accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' }, signal: AbortSignal.timeout(30_000) });
  if (!response.ok) throw new Error(`Candidate freshness lookup unavailable (HTTP ${response.status})`);
  return response.json();
}

export async function assertCurrentCandidate(input, request = path => githubRequest(path, input.token)) {
  assertManagedTrust(input);
  const { eventName, event, repository, ref, sha } = input;
  if (!shaPattern.test(sha ?? '')) throw new Error('Exact candidate SHA required');
  let actual;
  if (eventName === 'pull_request') {
    const number = event.pull_request.number ?? event.number;
    if (!Number.isSafeInteger(number) || number < 1) throw new Error('PR number required for freshness lookup');
    const pr = await request(`/repos/${repository}/pulls/${number}`);
    if (pr?.state !== 'open' || pr.draft !== false || pr.head?.repo?.full_name !== repository || pr.user?.type !== 'User' || bot(pr.user.login)) throw new Error('Candidate is no longer an open trusted ready PR; no managed proof');
    actual = pr.head.sha;
  } else {
    const branch = ref?.slice('refs/heads/'.length);
    if (!ref?.startsWith('refs/heads/') || !branch || /[\s~^:?*[\\]/.test(branch) || branch.includes('..') || branch.includes('@{')) throw new Error('Supported branch ref required for freshness lookup');
    const current = await request(`/repos/${repository}/git/ref/heads/${branch.split('/').map(encodeURIComponent).join('/')}`);
    if (current?.object?.type !== 'commit') throw new Error('Candidate branch lookup did not return a commit');
    actual = current.object.sha;
  }
  if (!shaPattern.test(actual ?? '')) throw new Error('Candidate lookup returned no exact commit');
  if (actual !== sha) throw new Error('Stale candidate refused before managed preparation; no managed proof');
  return { kind: 'current-candidate', sha, event: eventName };
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  try {
    if (process.argv[2] === 'freshness') {
      const event = JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8'));
      console.log(JSON.stringify(await assertCurrentCandidate({ eventName: process.env.GITHUB_EVENT_NAME, event, repository: process.env.GITHUB_REPOSITORY, actor: process.env.GITHUB_ACTOR, ref: process.env.GITHUB_REF, sha: process.env.CI_CANDIDATE_SHA, token: process.env.GITHUB_TOKEN })));
    } else if (process.argv[2] === 'aggregate') {
      const receipt = aggregateManaged(JSON.parse(process.env.CI_SELECTION), JSON.parse(process.env.CI_NEEDS), process.env.CI_CANDIDATE_SHA);
      appendFileSync(process.env.GITHUB_OUTPUT, `receipt=${JSON.stringify(receipt)}\n`);
      const summary = `## Managed lifecycle\nCandidate: ${receipt.sha}\nResult: ${receipt.passed ? 'PASS' : 'FAIL'}\n${receipt.reasons.map(reason => `- ${reason}`).join('\n')}\n`;
      if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary);
      console.log(summary);
      process.exitCode = receipt.passed ? 0 : 1;
    } else throw new Error('Use freshness or aggregate');
  } catch (error) {
    console.error(`Managed CI: ${error.message}`);
    process.exitCode = 1;
  }
}
