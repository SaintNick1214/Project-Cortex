import { appendFileSync, readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { assertSourceSha, deliveryReady } from './release-contract.mjs';

/** Classify triggers before reading prerequisites. Recovery has no alternate gate. */
export function deliveryEvent({ eventName, event, ref, repository }) {
  const sourceSha = eventName === 'workflow_run' ? event.workflow_run?.head_sha : eventName === 'workflow_dispatch' ? event.inputs?.source_sha : event.sha;
  const mode = eventName === 'workflow_dispatch' ? event.inputs?.mode : 'recover';
  const reasons = [];
  try { assertSourceSha(sourceSha); } catch { reasons.push('An exact 40-character source SHA is required.'); }
  if (eventName === 'workflow_run') {
    const run = event.workflow_run;
    if (!['PR Checks', 'Security Scans'].includes(run?.name)) reasons.push('Only PR Checks and Security Scans completion can request delivery.');
    if (run?.event !== 'push') reasons.push(`Upstream event ${run?.event ?? 'missing'} is not a push; scheduled scans do not publish.`);
    if (run?.head_branch !== 'main') reasons.push(`Upstream branch ${run?.head_branch ?? 'missing'} is not main; dev integration does not publish.`);
    if (run?.head_repository?.full_name !== repository) reasons.push('Upstream source repository does not match this repository.');
    if (run?.conclusion !== 'success') reasons.push(`Upstream workflow concluded ${run?.conclusion ?? 'without a result'}; repair that prerequisite first.`);
  } else if (eventName === 'status') {
    if (!event.context?.startsWith('security/snyk')) reasons.push('This status is unrelated to the required Snyk gate.');
  } else if (eventName === 'workflow_dispatch') {
    if (ref !== 'refs/heads/main') reasons.push('Manual delivery must be dispatched from main.');
    if (!['dry-plan', 'recover'].includes(mode)) reasons.push('Manual mode must be dry-plan or recover.');
  } else reasons.push(`Event ${eventName} cannot request delivery.`);
  return { eligible: reasons.length === 0, sourceSha, mode: ['dry-plan', 'recover'].includes(mode) ? mode : undefined, reasons };
}

/** Follow every page of the relevant data; truncation is an error, never readiness. */
async function pages(request, path, key, maxPages = 10) {
  const values = [];
  for (let page = 1; page <= maxPages; page++) {
    const { data, hasNext } = await request(`${path}&per_page=100&page=${page}`);
    const items = key ? data?.[key] : data;
    if (!Array.isArray(items)) throw new Error('Malformed GitHub readiness response');
    values.push(...items);
    if (!hasNext) return values;
  }
  throw new Error('Readiness pagination exceeded 10 pages; no release authorized.');
}

export async function readDeliverySnapshot({ request, repository, sourceSha }) {
  assertSourceSha(sourceSha);
  if (!/^[\w.-]+\/[\w.-]+$/.test(repository)) throw new Error('Repository owner/name required');
  const base = `repos/${repository}`;
  const main = async () => {
    const { data } = await request(`${base}/git/ref/heads/main`);
    assertSourceSha(data?.object?.sha);
    return data.object.sha;
  };
  const mainSha = await main();
  if (mainSha !== sourceSha) return { mainSha };
  const [runs, checks, statuses] = await Promise.all([
    pages(request, `${base}/actions/runs?branch=main&event=push&head_sha=${sourceSha}`, 'workflow_runs'),
    // filter=all preserves earlier attempts so the newest qualifying result wins.
    pages(request, `${base}/commits/${sourceSha}/check-runs?check_name=CodeQL&filter=all`, 'check_runs'),
    pages(request, `${base}/commits/${sourceSha}/statuses?`, undefined),
  ]);
  return { mainSha: await main(), runs, checks, statuses };
}

/** Seven observations/one minute of waits, only while results are missing or pending. */
export async function reconcileReadiness({ eventName, event, ref, repository, sourceSha, getSnapshot, wait, maxAttempts = 7, intervalMs = 10_000, expectedChecksRun }) {
  if (!Number.isInteger(maxAttempts) || maxAttempts < 1 || maxAttempts > 7 || !Number.isInteger(intervalMs) || intervalMs < 0 || intervalMs > 10_000) throw new Error('Readiness reconciliation must remain bounded');
  const selected = deliveryEvent({ eventName, event, ref, repository });
  const result = { sourceSha: selected.sourceSha, mode: selected.mode, ready: false, attempts: 0, prerequisites: [], reasons: selected.reasons };
  if (!selected.eligible) return { ...result, outcome: 'ineligible' };
  assertSourceSha(sourceSha);
  if (sourceSha !== selected.sourceSha) return { ...result, outcome: 'blocked', reasons: ['Event/source SHA mismatch; no release authorized.'] };
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const snapshot = await getSnapshot(sourceSha);
    result.attempts = attempt;
    if (snapshot.mainSha !== sourceSha) return { ...result, outcome: 'superseded', reasons: [`Current main ${snapshot.mainSha} superseded source ${sourceSha}; qualify the new main commit.`] };
    const evaluated = deliveryReady({ ...snapshot, sourceSha, repository });
    Object.assign(result, evaluated);
    if (result.ready && expectedChecksRun && String(result.checksRun) !== String(expectedChecksRun)) return { ...result, ready: false, outcome: 'blocked', reasons: ['The latest PR Checks run changed after artifact selection; restart delivery with its immutable artifact.'] };
    if (result.ready) return { ...result, outcome: 'ready' };
    if (!result.retryable) return { ...result, outcome: 'blocked' };
    if (attempt < maxAttempts) await wait(intervalMs);
  }
  return { ...result, outcome: 'waiting', reasons: [...result.reasons, 'Bounded reconciliation expired; once prerequisites finish, dispatch dry-plan or recover for the exact current main SHA.'] };
}

export function readinessSummary(result) {
  const lines = ['## Package delivery readiness', '', `Outcome: **${result.outcome}**`, `Source: \`${result.sourceSha ?? 'invalid/missing'}\``, `Mode: ${result.mode ?? 'invalid'}; observations: ${result.attempts}`, ''];
  for (const item of result.prerequisites) lines.push(`- ${item.name}: **${item.state}**. ${item.detail}`);
  for (const reason of result.reasons) lines.push(`- ${reason}`);
  if (result.outcome === 'blocked') lines.push('', 'Repair/rerun the failed exact-main prerequisite, then request dry-plan before recovery. Recovery cannot waive CodeQL or Snyk.');
  if (result.ready) lines.push('', `Qualified PR Checks run: ${result.checksRun}. The plan/publication job reports actual package outcomes separately.`);
  return lines.join('\n') + '\n';
}

async function main() {
  if (process.argv.slice(2).some(arg => arg !== '--once')) throw new Error('Only --once is supported');
  if (!process.env.GH_TOKEN) throw new Error('An injected GitHub read token is required');
  const request = async path => {
    const response = await fetch(`${process.env.GITHUB_API_URL ?? 'https://api.github.com'}/${path}`, {
      headers: { authorization: `Bearer ${process.env.GH_TOKEN}`, accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' },
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new Error(`GitHub readiness read failed (${response.status}) for ${path.split('?')[0]}`);
    return { data: await response.json(), hasNext: /rel="next"/.test(response.headers.get('link') ?? '') };
  };
  const result = await reconcileReadiness({
    eventName: process.env.GITHUB_EVENT_NAME, event: JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8')),
    ref: process.env.GITHUB_REF, repository: process.env.GITHUB_REPOSITORY, sourceSha: process.env.SOURCE_SHA,
    getSnapshot: sourceSha => readDeliverySnapshot({ request, repository: process.env.GITHUB_REPOSITORY, sourceSha }),
    wait: ms => new Promise(resolve => setTimeout(resolve, ms)), maxAttempts: process.argv.includes('--once') ? 1 : 7,
    expectedChecksRun: process.env.EXPECTED_CHECKS_RUN,
  });
  let outputSha = '';
  try { assertSourceSha(result.sourceSha); outputSha = result.sourceSha; } catch { /* Invalid inputs must not inject workflow output lines. */ }
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `ready=${result.ready}\nchecks_run=${result.checksRun ?? ''}\nsource_sha=${outputSha}\nmode=${result.mode ?? ''}\n`);
  const summary = readinessSummary(result);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary);
  console.log(summary);
  if (process.env.REQUIRE_READY === 'true' && !result.ready) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => {
    // Do not dump HTTP responses, authorization headers or token-bearing error objects.
    const summary = `## Package delivery readiness\n\nOutcome: **error**. ${error.message}\nNo publication is authorized.\n`;
    if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary);
    console.error(summary);
    process.exitCode = 1;
  });
}
