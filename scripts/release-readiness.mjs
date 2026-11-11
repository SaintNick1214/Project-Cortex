import { appendFileSync, readFileSync, openSync, closeSync, fstatSync, lstatSync, writeFileSync, fsyncSync, linkSync, unlinkSync, mkdirSync, rmdirSync, constants } from 'node:fs';
import { dirname, basename, isAbsolute, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { assertSourceSha, deliveryReady } from './release-contract.mjs';
import { canonical, createProofObservationContext, collectSourceProof, collectDeliveryArtifact, githubReader, newest, proofPages, proofLimits, proofJson, digest, sourcePolicy } from './release-source-proof.mjs';

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
export async function readDeliverySnapshot({ request, repository, sourceSha, cache = new Map() }) {
  assertSourceSha(sourceSha);
  if (!/^[\w.-]+\/[\w.-]+$/.test(repository)) throw new Error('Repository owner/name required');
  const base = `repos/${repository}`, context = createProofObservationContext({ repository });
  const main = async () => {
    const { data } = await request(`${base}/git/ref/heads/main`);
    assertSourceSha(data?.object?.sha);
    if (repository === sourcePolicy.repository && (data.ref !== 'refs/heads/main' || data.object.type !== 'commit')) throw new Error('Public current-main ref/commit-type authority is incomplete or contradictory');
    return data.object.sha;
  };
  const mainSha = await main();
  if (mainSha !== sourceSha) return { mainSha };
  const observations = async () => {
    const [runs, checks, statuses] = await Promise.all([
    proofPages(request, `${base}/actions/runs?branch=main&event=push&head_sha=${sourceSha}`, 'workflow_runs'),
    // filter=all preserves earlier attempts so the newest qualifying result wins.
    proofPages(request, `${base}/commits/${sourceSha}/check-runs?check_name=CodeQL&filter=all`, 'check_runs'),
    proofPages(request, `${base}/commits/${sourceSha}/statuses`),
  ]);
    if (repository === sourcePolicy.repository) { context.workflows(runs, { sourceSha }); context.checks(checks, sourceSha); context.statuses(statuses, sourceSha); }
    return { runs, checks, statuses };
  };
  const initial = await observations();
  if (repository === sourcePolicy.repository) for (const name of ['PR Checks', 'Security Scans']) {
    const run = newest(initial.runs.filter(run => run.name === name && run.head_sha === sourceSha && run.event === 'push' && run.head_branch === 'main'));
    if (run && (run.repository?.id !== sourcePolicy.repositoryId || run.head_repository?.id !== sourcePolicy.repositoryId || run.repository?.full_name !== repository || run.head_repository?.full_name !== repository || run.repository.private !== false || run.head_repository.private !== false || run.repository.fork !== false || run.head_repository.fork !== false || !Number.isSafeInteger(run.run_attempt) || run.run_attempt < 1)) throw new Error('Own-main push workflow repository/attempt binding failed');
  }
  const direct = deliveryReady({ ...initial, sourceSha, repository });
  // Non-success M records are never overridden, even when H is green.
  const canInherit = direct.authorityComplete && direct.prerequisites.filter(item => item.name === 'PR Checks' || item.name === 'Security Scans').every(item => item.state === 'success') && direct.prerequisites.filter(item => item.name !== 'PR Checks' && item.name !== 'Security Scans').some(item => item.state === 'missing') && direct.prerequisites.every(item => item.state === 'missing' || item.state === 'success');
  const sourceProof = canInherit && repository === sourcePolicy.repository ? await collectSourceProof({ request, repository, sourceSha, cache, context }) : undefined;
  let deliveryArtifact;
  const ownRun = newest(initial.runs.filter(run => run.name === 'PR Checks' && run.head_sha === sourceSha && run.event === 'push' && run.head_branch === 'main' && run.head_repository?.full_name === repository));
  const readArtifact = run => collectDeliveryArtifact({ request, base, run, sourceSha, cache, context });
  if (repository === sourcePolicy.repository && direct.authorityComplete && direct.checksRun) deliveryArtifact = await readArtifact(ownRun);
  const final = repository === sourcePolicy.repository ? await observations() : initial;
  if (repository === sourcePolicy.repository) {
    const before = deliveryReady({ ...initial, sourceSha, repository }), after = deliveryReady({ ...final, sourceSha, repository });
    if (canonical(JSON.parse(JSON.stringify(before))) !== canonical(JSON.parse(JSON.stringify(after)))) throw new Error('Latest own-main workflow/vendor selection superseded during proof collection');
    const workflowAuthority = snapshot => ['PR Checks', 'Security Scans'].map(name => {
      const run = newest(snapshot.runs.filter(run => run.name === name && run.head_sha === sourceSha && run.event === 'push' && run.head_branch === 'main' && run.head_repository?.full_name === repository));
      return run ? { id: run.id, attempt: run.run_attempt, name: run.name, path: run.path, sourceSha: run.head_sha, branch: run.head_branch, event: run.event, createdAt: run.created_at, startedAt: run.run_started_at, updatedAt: run.updated_at, repositoryId: run.repository.id, headRepositoryId: run.head_repository.id } : null;
    });
    if (canonical(workflowAuthority(initial)) !== canonical(workflowAuthority(final))) throw new Error('Latest own-main workflow attempt superseded during proof collection; source/path/start authority changed.');
    const finalOwnRun = newest(final.runs.filter(run => run.name === 'PR Checks' && run.head_sha === sourceSha && run.event === 'push' && run.head_branch === 'main' && run.head_repository?.full_name === repository));
    if (deliveryArtifact && canonical(deliveryArtifact) !== canonical(await readArtifact(finalOwnRun))) throw new Error('Delivery artifact superseded during proof collection');
  }
  const finalMainSha = await main();
  if (sourceProof) sourceProof.findings.fences.main = { ref: 'refs/heads/main', objectType: 'commit', before: mainSha, after: finalMainSha };
  return { mainSha: finalMainSha, ...final, sourceProof, deliveryArtifact, authorityObservations: { mainSha: finalMainSha, records: context.snapshot() } };
}

/** Seven observations/one minute of waits, only while results are missing or pending. */
export async function reconcileReadiness({ eventName, event, ref, repository, sourceSha, getSnapshot, wait, maxAttempts = 7, intervalMs = 10_000, expectedChecksRun, expectedChecksAttempt, expectedArtifactId, expectedArtifactDigest }) {
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
    if (snapshot.authorityObservations !== undefined) result.authorityObservations = snapshot.authorityObservations;
    result.deliveryArtifact = snapshot.deliveryArtifact;
    if (result.ready && expectedChecksRun && String(result.checksRun) !== String(expectedChecksRun)) return { ...result, ready: false, outcome: 'blocked', reasons: ['The latest PR Checks run changed after artifact selection; restart delivery with its immutable artifact.'] };
    if (result.ready && [[expectedChecksAttempt, snapshot.deliveryArtifact?.attempt], [expectedArtifactId, snapshot.deliveryArtifact?.id], [expectedArtifactDigest, snapshot.deliveryArtifact?.digest]].some(([expected, actual]) => expected !== undefined && expected !== '' && String(expected) !== String(actual))) return { ...result, ready: false, outcome: 'blocked', reasons: ['The selected immutable delivery artifact/attempt changed before publication.'] };
    if (result.ready) return { ...result, outcome: 'ready' };
    if (!result.retryable) return { ...result, outcome: 'blocked' };
    if (attempt < maxAttempts) await wait(intervalMs);
  }
  return { ...result, outcome: 'waiting', reasons: [...result.reasons, 'Bounded reconciliation expired; once prerequisites finish, dispatch dry-plan or recover for the exact current main SHA.'] };
}

export function readinessSummary(result) {
  const lines = ['## Package delivery readiness', '', `Outcome: **${result.outcome}**`, `Source: \`${result.sourceSha ?? 'invalid/missing'}\``, `Mode: ${result.mode ?? 'invalid'}; observations: ${result.attempts}`, ''];
  for (const item of result.prerequisites) lines.push(`- ${item.name}: **${item.state}**. ${item.detail}`);
  if (result.qualification) {
    const proof = result.qualification;
    lines.push('', `Qualification: **${proof.label}**. M vendor records shown as missing stay missing. M and merged PR #${proof.pr} head \`${proof.headSha}\` have exactly equal trees.`, `H CodeQL App57789: actual success #${proof.codeql.id}, completed ${proof.codeql.completedAt}.`);
    for (const status of proof.snyk) lines.push(`H ${status.context}: actual success #${status.id}, ${status.createdAt}, ${status.authority}; ${status.targetUrl}.`);
    lines.push(`Exact-M native analysis ${proof.findings.analysis} / run ${proof.findings.nativeRun}, artifact ${proof.findings.nativeArtifact.id}, member SHA256 ${proof.findings.memberSha256}; immediate baseline \`${proof.findings.baselineSha}\`, analysis ${proof.findings.baselineAnalysis}, artifact ${proof.findings.baselineArtifact.id}. Complete native and server findings are independent multiset subsets.`, 'This qualifies source inputs only. Vendor execution time and mutable vulnerability/policy databases are not equivalent. No new M vendor pass or independent administrative-bypass audit is claimed.');
    for (const [role, exported] of Object.entries(proof.findings.serverExports ?? {})) if (!exported.sarifStandardConformance) lines.push(`${role} server export: **${exported.serverFormat}**; not SARIF-standard-valid. ${exported.anomalies.length} explicit representation anomalies are bound to the authenticated native source. Original server body SHA256 ${exported.serverBodySha256}; complete pointers, original values, source facts, result classes and duplicate multiplicities are retained in the readiness JSON.`);
  }
  for (const reason of result.reasons) lines.push(`- ${reason}`);
  if (result.outcome === 'blocked') lines.push('', 'Repair/rerun the failed exact-main prerequisite, then request dry-plan before recovery. Recovery cannot waive CodeQL or Snyk.');
  if (result.ready) lines.push('', `Qualified PR Checks run: ${result.checksRun}. The plan/publication job reports actual package outcomes separately.`);
  return lines.join('\n') + '\n';
}

// Receipts are workflow artifacts, not log-sized projections of the proof. All
// proof fields remain strict JSON; only explicitly optional JS envelope fields
// (which have no JSON value) may be absent from the serialized payload.
export function readinessPayload(result) {
  const optional = /^(?:\/(?:sourceSha|mode|checksRun|securityRun|qualification|deliveryArtifact)|\/prerequisites\/\d+\/id)$/;
  let bytes = 0, work = 0;
  const emit = text => { bytes += Buffer.byteLength(text); if (bytes > proofLimits.log) throw new Error('Complete readiness receipt exceeds existing byte bound'); return text; };
  const encode = (value, pointer, depth) => {
    if (++work > proofLimits.log || depth > 128) throw new Error('Readiness receipt depth/work bound exceeded');
    if (Array.isArray(value)) { if (Object.keys(value).length !== value.length || Object.keys(value).some((key, index) => key !== String(index))) throw new Error('Unsupported readiness receipt array'); return emit('[') + value.map((item, index) => encode(item, `${pointer}/${index}`, depth + 1)).join(emit(',')) + emit(']'); }
    if (value !== null && typeof value === 'object') {
      if (![Object.prototype, null].includes(Object.getPrototypeOf(value)) || Reflect.ownKeys(value).some(key => typeof key !== 'string' || !Object.getOwnPropertyDescriptor(value, key).enumerable || !Object.hasOwn(Object.getOwnPropertyDescriptor(value, key), 'value'))) throw new Error('Unsupported readiness receipt object');
      const entries = [];
      for (const key of Object.keys(value).sort()) {
        const child = `${pointer}/${key.replaceAll('~', '~0').replaceAll('/', '~1')}`;
        if (value[key] === undefined && optional.test(child)) continue;
        entries.push(emit(JSON.stringify(key) + ':') + encode(value[key], child, depth + 1));
      }
      return emit('{') + entries.join(emit(',')) + emit('}');
    }
    return emit(canonical(value));
  };
  const text = encode(result, '', 0);
  if (Buffer.byteLength(text) > proofLimits.log) throw new Error('Complete readiness receipt exceeds existing byte bound');
  return text;
}
const receiptFormat = 'CORTEX_COMPLETE_PUBLISHING_READINESS_V1';
const receiptError = message => { throw new Error(`Readiness receipt: ${message}`); };
const sameFile = (a, b) => a.dev === b.dev && a.ino === b.ino;
function receiptDirectory(path) {
  if (process.platform !== 'linux' || typeof path !== 'string' || !isAbsolute(path) || resolve(path) !== path || [...path].some(char => char.codePointAt(0) < 32 || char.codePointAt(0) === 127) || !/^[A-Za-z0-9][A-Za-z0-9._-]*\.json$/.test(basename(path))) receiptError('an absolute normalized Linux .json path is required');
  const flags = constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW;
  let fd = openSync('/', flags);
  try {
    for (const component of dirname(path).split('/').filter(Boolean)) { const next = openSync(`/proc/self/fd/${fd}/${component}`, flags); closeSync(fd); fd = next; }
    return { fd, leaf: basename(path), path, identity: fstatSync(fd) };
  } catch (error) { closeSync(fd); throw error; }
}
function stableDirectory(directory) {
  const fresh = receiptDirectory(directory.path);
  try { if (!sameFile(directory.identity, fresh.identity)) receiptError('destination directory changed'); }
  finally { closeSync(fresh.fd); }
}
const sameReceipt = (expected, actual) => sameFile(expected, actual) && expected.uid === actual.uid && expected.gid === actual.gid && (actual.mode & 0o7777) === 0o600 && actual.isFile();
function readReceipt(directory, { created, links = 1 } = {}) {
  stableDirectory(directory);
  const path = `/proc/self/fd/${directory.fd}/${directory.leaf}`, flags = constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK;
  const fd = openSync(path, flags);
  try {
    const before = fstatSync(fd);
    if (!before.isFile() || (before.mode & 0o7777) !== 0o600 || before.nlink !== links || before.size < 1 || before.size > proofLimits.log || created && !sameReceipt(created, before)) receiptError('unsafe/substituted/incomplete/oversize receipt inode or mode');
    const bytes = readFileSync(fd), after = fstatSync(fd), latest = lstatSync(path);
    if (!sameReceipt(before, after) || !sameReceipt(before, latest) || latest.nlink !== links || after.nlink !== links || before.size !== bytes.length || after.size !== bytes.length || latest.size !== bytes.length || before.mtimeMs !== after.mtimeMs || before.ctimeMs !== after.ctimeMs || before.mtimeMs !== latest.mtimeMs || before.ctimeMs !== latest.ctimeMs || created && (!sameReceipt(created, after) || !sameReceipt(created, latest))) receiptError('receipt inode/mode/link/content changed while reading');
    stableDirectory(directory); return { bytes, identity: after };
  } finally { closeSync(fd); }
}
export function writeReadinessReceipt(result, { path, expectedReceiptPath, expectedReceiptSha256 } = {}) {
  const directory = receiptDirectory(path);
  let temp, fd, stage;
  try {
    const payloadText = readinessPayload(result), payloadSha256 = digest(payloadText);
    let fence;
    if (expectedReceiptPath !== undefined) {
      const expectedDirectory = receiptDirectory(expectedReceiptPath);
      let bytes;
      try { bytes = readReceipt(expectedDirectory).bytes; } finally { closeSync(expectedDirectory.fd); }
      if (!/^[a-f0-9]{64}$/.test(expectedReceiptSha256 ?? '') || digest(bytes) !== expectedReceiptSha256) receiptError('retained receipt digest does not match its verified upload selection');
      const expected = proofJson(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
      if (expected.format !== receiptFormat || Object.keys(expected).some(key => !['format', 'payload', 'payloadSha256', 'fence'].includes(key)) || !expected.payload || expected.payload.ready !== true || expected.payloadSha256 !== digest(canonical(expected.payload)) || expected.fence && expected.fence.matched !== true) receiptError('retained qualified receipt identity is invalid');
      fence = { matched: canonical(expected.payload) === payloadText, retainedReceiptSha256: digest(bytes), retainedPayloadSha256: expected.payloadSha256, observedPayloadSha256: payloadSha256 };
    }
    const text = canonical({ format: receiptFormat, payload: proofJson(payloadText), payloadSha256, ...(fence ? { fence } : {}) }) + '\n';
    const bytes = Buffer.from(text);
    if (bytes.length > proofLimits.log) receiptError('complete readiness receipt exceeds existing byte bound');
    stableDirectory(directory);
    const stageName = `.readiness-${randomUUID()}`, stagePath = `/proc/self/fd/${directory.fd}/${stageName}`;
    mkdirSync(stagePath, { mode: 0o700 });
    stage = { fd: openSync(stagePath, constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW), path: stagePath };
    stage.identity = fstatSync(stage.fd);
    if (!stage.identity.isDirectory() || (stage.identity.mode & 0o7777) !== 0o700) receiptError('unsafe staging directory custody');
    const stableStage = () => {
      stableDirectory(directory); const check = openSync(stage.path, constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW);
      try { const actual = fstatSync(check); if (!sameFile(stage.identity, actual) || actual.uid !== stage.identity.uid || actual.gid !== stage.identity.gid || (actual.mode & 0o7777) !== 0o700) receiptError('staging directory substituted or mode changed'); }
      finally { closeSync(check); }
    };
    temp = `/proc/self/fd/${stage.fd}/receipt.tmp`;
    fd = openSync(temp, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
    const created = fstatSync(fd);
    if (!sameReceipt(created, created) || created.nlink !== 1) receiptError('unsafe temporary receipt inode');
    writeFileSync(fd, bytes); fsyncSync(fd);
    const written = fstatSync(fd);
    if (!sameReceipt(created, written) || written.nlink !== 1 || written.size !== bytes.length) receiptError('incomplete/substituted receipt write');
    stableStage();
    // Publish without overwrite. Both aliases must refer to our still-open FD.
    linkSync(temp, `/proc/self/fd/${directory.fd}/${directory.leaf}`);
    const linked = readReceipt(directory, { created, links: 2 });
    if (!sameReceipt(created, fstatSync(fd)) || fstatSync(fd).nlink !== 2 || !linked.bytes.equals(bytes)) receiptError('installed receipt differs from created write FD');
    stableStage();
    const actual = lstatSync(temp);
    if (!sameReceipt(created, actual) || actual.nlink !== 2) receiptError('temporary receipt alias was substituted');
    unlinkSync(temp); temp = undefined; fsyncSync(stage.fd); fsyncSync(directory.fd);
    const observed = readReceipt(directory, { created });
    const final = fstatSync(fd);
    if (!sameReceipt(created, final) || final.nlink !== 1 || !sameReceipt(created, observed.identity) || !observed.bytes.equals(bytes)) receiptError('receipt created/installed/readback custody mismatch');
    proofJson(new TextDecoder('utf-8', { fatal: true }).decode(observed.bytes));
    stableStage(); rmdirSync(stage.path); // No recursive cleanup of unknown content.
    return { path, sha256: digest(observed.bytes), bytes: observed.bytes.length, payloadSha256, ...(fence ? { fence } : {}) };
  } finally {
    if (fd !== undefined) closeSync(fd);
    // A failed custody fence can mean a foreign substitution. Leave uncertain
    // names intact; never unlink the destination or recursively clean on error.
    if (stage) closeSync(stage.fd);
    closeSync(directory.fd);
  }
}

async function main() {
  if (process.argv.slice(2).some(arg => arg !== '--once')) throw new Error('Only --once is supported');
  if (!process.env.GH_TOKEN) throw new Error('An injected GitHub read token is required');
  const destination = receiptDirectory(process.env.READINESS_RECEIPT_PATH); closeSync(destination.fd);
  const request = githubReader({ token: process.env.GH_TOKEN, api: process.env.GITHUB_API_URL });
  const cache = new Map();
  let result;
  try { result = await reconcileReadiness({
    eventName: process.env.GITHUB_EVENT_NAME, event: JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8')),
    ref: process.env.GITHUB_REF, repository: process.env.GITHUB_REPOSITORY, sourceSha: process.env.SOURCE_SHA,
    getSnapshot: sourceSha => readDeliverySnapshot({ request, repository: process.env.GITHUB_REPOSITORY, sourceSha, cache }),
    wait: ms => new Promise(resolve => setTimeout(resolve, ms)), maxAttempts: process.argv.includes('--once') ? 1 : 7,
    expectedChecksRun: process.env.EXPECTED_CHECKS_RUN,
    expectedChecksAttempt: process.env.EXPECTED_CHECKS_ATTEMPT, expectedArtifactId: process.env.EXPECTED_ARTIFACT_ID, expectedArtifactDigest: process.env.EXPECTED_ARTIFACT_DIGEST,
  }); } catch (error) { result = { ready: false, outcome: 'error', attempts: 0, prerequisites: [], reasons: [error.message] }; }
  const receipt = writeReadinessReceipt(result, { path: process.env.READINESS_RECEIPT_PATH, expectedReceiptPath: process.env.EXPECTED_READINESS_RECEIPT, expectedReceiptSha256: process.env.EXPECTED_READINESS_RECEIPT_SHA256 });
  const ready = result.ready && receipt.fence?.matched !== false;
  let outputSha = '';
  try { assertSourceSha(result.sourceSha); outputSha = result.sourceSha; } catch { /* Invalid inputs must not inject workflow output lines. */ }
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `ready=${ready}\nchecks_run=${result.checksRun ?? ''}\nsource_sha=${outputSha}\nmode=${result.mode ?? ''}\n`);
  if (process.env.GITHUB_OUTPUT && ready && result.deliveryArtifact) appendFileSync(process.env.GITHUB_OUTPUT, `checks_attempt=${result.deliveryArtifact.attempt}\nartifact_id=${result.deliveryArtifact.id}\nartifact_digest=${result.deliveryArtifact.digest}\n`);
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `receipt_path=${receipt.path}\nreceipt_sha256=${receipt.sha256}\nreceipt_bytes=${receipt.bytes}\npayload_sha256=${receipt.payloadSha256}\n`);
  if (receipt.fence) console.log(`Complete prepublication readiness fence: ${canonical(receipt.fence)}`);
  const summary = readinessSummary(result) + `\nComplete readiness receipt: SHA256 ${receipt.sha256}; ${receipt.bytes} bytes.\n` + (receipt.fence?.matched === false ? 'Retained/fresh complete readiness payloads differ; no publication is authorized.\n' : '');
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary);
  console.log(summary);
  if (result.outcome === 'error' || (process.env.REQUIRE_READY === 'true' || receipt.fence) && !ready) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => {
    // Do not dump HTTP responses, authorization headers or token-bearing error objects.
    if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, 'ready=false\n');
    const summary = `## Package delivery readiness\n\nOutcome: **error**. ${error.message}\nNo publication is authorized.\n`;
    if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary);
    console.error(summary);
    process.exitCode = 1;
  });
}
