import assert from 'node:assert/strict';
import { readFile, writeFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { dirname, join, resolve } from 'node:path';

const q = dirname(new URL(import.meta.url).pathname);
const root = resolve(q, '../../../../..');
const sha = value => createHash('sha256').update(value).digest('hex');
const load = async name => JSON.parse(await readFile(join(q, name)));
const save = async (name, value) => writeFile(join(q, name), JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
const pointer = await load('fixture-pointer.json');
const actual = await load('actual-outcome-assertions2.json');
const retired = await load('retirement.json');
const deletion = await load('retirement-delete.json');
assert.equal(actual.counts.passed, 30);
assert.equal(actual.counts.failed, 0);
assert.equal(retired.retired, true);
assert.equal(retired.readbackHttpStatus, 404);
assert.equal(deletion.deletionHttpStatus, 200);
const sourcePaths = [
  'convex-dev/runtimeGatewayBackend.ts', 'convex-dev/runtimeGateway.ts',
  'convex-dev/runtimeModelPolicy.ts', 'convex-dev/runtimeModelPolicyBootstrap.ts',
  'src/domain/conflicts.ts', 'tests/unit/runtime/gateway-backend.test.ts',
  'tests/unit/runtime/model-policy-admission.test.ts', 'tests/unit/runtime/model-policy-model-drift.test.ts',
];
const source = [];
for (const path of sourcePaths) {
  const body = await readFile(join(root, path));
  source.push({ path, absolutePath: join(root, path), bytes: body.length, sha256: sha(body) });
}
const candidateDigest = sha(JSON.stringify(source.map(({ path, bytes, sha256 }) => ({ path, bytes, sha256 }))));
await save('candidate-product-digests.json', { scope: 'CURRENT_COHERENT_GATEWAY_PRODUCT_BATCH', candidateDigest, files: source });

const pricesBytes = await readFile(join(q, 'actual-public-prices.json'));
const prices = JSON.parse(pricesBytes);
const priceHash = sha(pricesBytes);
const nativeBytes = await readFile(join(root, 'node_modules/@convex-dev/ai-sdk-provider/src/index.ts'));
const sourceFacts = {
  scope: 'PRIMARY_CONTRACT_AND_CONTROL_FACTS_FOR_REVIEW', checkedAt: new Date().toISOString(),
  sources: [
    { url: 'https://docs.convex.dev/ai-gateway/api', supports: 'Chat and embedding routes; prefixed request model; restricted routing; OpenAI embedding shape.' },
    { url: 'https://docs.convex.dev/ai-gateway/usage-and-billing', supports: 'OpenRouter rates; USD Convex invoice; deployment/team limits are separate from application admission.' },
    { url: 'https://openrouter.ai/docs/cookbook/administration/usage-accounting', supports: 'Upstream usage.cost represents total account charge in credits; does not itself prove Convex pass-through completeness.' },
    { url: 'https://openrouter.ai/support', supports: 'OpenRouter credit system is denominated in USD.' },
    { url: 'https://cookbook.openai.com/examples/how_to_count_tokens_with_tiktoken', supports: 'Model-specific plain-chat framing; input envelope remains narrow and post-paid observed-token overruns deny delivery.' },
  ],
  officialProvider: { path: 'node_modules/@convex-dev/ai-sdk-provider/src/index.ts', bytes: nativeBytes.length, sha256: sha(nativeBytes), observedContract: 'SDK extracts raw usage.cost as dollar-cost metadata, but supplies no independent guarantee about all charge components.' },
  inputControl: { chat: 'Plain text system/user/assistant messages only; no tool/audio/image/provider-options/native response_format. Admission counts full UTF8 text bytes plus role bytes and 3-token per-message/terminal framing; malformed Unicode denies. Actual terminal usage over admitted bound withholds results.', embedding: 'One string vector per billable call; UTF8-byte bound; pinned default1536 profile/index; no profile-switch fallback.', semanticSchema: 'Only immutable facts-v1 or conflicts-v1 domain schemas, plain prompt JSON and strict backend parse; not native structured-output qualification.' },
  terminalCostProductionProposal: 'unavailable',
  completenessClaim: 'NOT_ESTABLISHED_FOR_CONVEX_CHAT_OR_EMBEDDING_ALL_CHARGES_BY_THIS_BATCH',
};
await save('qualification-contract-facts.json', sourceFacts);
const contractHash = sha(Buffer.from(JSON.stringify(sourceFacts, null, 2) + '\n'));
const fixture = await load('provisional-manifest2.json');
const sampleLabels = ['chat2', 'title2', 'embedding2', 'embedding-memory2', 'extract2'];
const observations = [];
for (const label of sampleLabels) {
  const bytes = await readFile(join(q, label + '.stdout'));
  const item = JSON.parse(bytes);
  const terminal = item.events.find(event => event.phase === 'terminal').original;
  observations.push({ label, path: join(q, label + '.stdout'), bytes: bytes.length, sha256: sha(bytes),
    operationKey: item.operationKey, canonicalModelId: item.modelId, actualModel: terminal.actualModel,
    providerReceiptId: terminal.receiptId, recordedAggregateCostUsd: terminal.aggregateCostUsd, usage: terminal.usage,
    result: item.result, binding: item.binding });
}
const evidenceHash = sha(JSON.stringify(observations.map(({ label, sha256, providerReceiptId }) => ({ label, sha256, providerReceiptId }))));
const modelSamples = new Map(observations.map(item => [item.canonicalModelId, item]));
const checkedAt = Date.parse(prices.at);
const priceRevision = 'openrouter-' + priceHash.slice(0, 24);
const boundRevision = 'plain-text-4096-512-ceiling100000-v1';
const receiptIds = new Map(fixture.qualifications.map((item, index) => [item.modelId, 'actual-' + pointer.operation.slice(0, 8) + '-' + index]));
const qualifications = fixture.qualifications.map(item => ({ ...item, receiptId: receiptIds.get(item.modelId),
  capabilities: item.nativeInterface === 'embedding' ? ['embedding'] : item.modelId === 'openai/gpt-4o' ? ['text'] : ['text', 'structured'],
  priceRevision, boundRevision, costBound: { ...item.costBound, provenance: 'REVIEW_REQUIRED: plain token-only envelope, captured current rates, 100000microUSD ceiling; no tools/media/plugins/BYOK.' } }));
const dispatchEvidence = fixture.dispatchEvidence.map(item => ({ ...item, receiptId: receiptIds.get(item.modelId), evidenceHash,
  priceRevision, boundRevision, checkedAt, expiresAt: checkedAt + 86400000,
  terminalCost: 'unavailable',
  inputBound: { ...item.inputBound, nativeTransformHash: sha(nativeBytes), documentHash: contractHash, proofHash: evidenceHash },
  resultBound: { ...item.resultBound, proofHash: evidenceHash } }));
const base = fixture.policies[0];
const policies = [
  { ...base, policyId: 'cortex-default-text-and-embedding-v1', version: 1,
    rules: { ...base.rules, pins: { ...base.rules.pins, priceRevision, boundRevision } } },
  { policyId: 'cortex-title-secondary-v1', version: 1, scope: 'deployment', operationKey: 'conversation.title', rules: { modelId: 'openai/gpt-4o', nativeInterface: 'chat' } },
  { policyId: 'cortex-extraction-facts-v1', version: 1, scope: 'deployment', operationKey: 'memory.extract', rules: { modelId: 'openai/gpt-4o-mini', nativeInterface: 'chat', pins: { schemaVersion: 'facts-v1' } } },
  { policyId: 'cortex-conflicts-v1', version: 1, scope: 'deployment', operationKey: 'facts.resolve', rules: { modelId: 'openai/gpt-4o-mini', nativeInterface: 'chat', pins: { schemaVersion: 'conflicts-v1' } } },
];
const priceArithmetic = qualifications.map(item => {
  const model = prices.sources.flatMap(entry => entry.models).find(entry => entry.id === item.modelId);
  assert.ok(model);
  const inputRate = Number(model.pricing.prompt);
  const outputRate = Number(model.pricing.completion ?? 0);
  const plainMaximumMicroUsd = Math.ceil((4096 * inputRate + (item.nativeInterface === 'chat' ? 512 : 0) * outputRate) * 1000000);
  return { modelId: item.modelId, pricing: model.pricing, plainMaximumMicroUsd, reservedCeilingMicroUsd: 100000,
    observedSampleReceipt: modelSamples.get(item.modelId).providerReceiptId, classification: 'CURRENT_PUBLISHED_TOKEN_PRICE_ARITHMETIC_NOT_INVOICE_RECONCILIATION_OR_ALL_FUTURE_PRICE_GUARANTEE' };
});
await save('qualification-manifest-proposal.json', {
  scope: 'MINIMAL_DEFAULT_TEXT_EMBEDDING_AND_SECONDARY_DEPLOYMENT_MANIFEST_PROPOSAL', productionInstalled: false,
  candidateDigest, fixtureOperation: pointer.operation, receiptEvidenceHash: evidenceHash,
  reviewRequiredFields: ['acceptanceHash', 'classification', 'qualified-call-ceiling assertion', 'input-envelope attestation'],
  classificationRequiredAfterAcceptance: 'reviewed-actual', acceptanceHash: null,
  manifestTemplate: { manifestId: 'cortex-default-text-gateway-v1', revision: 1, artifactRevision: candidateDigest,
    evidenceHash, budgetWindowMs: fixture.budgetWindowMs, policies, qualifications, dispatchEvidence },
  observations, priceReceipt: { path: join(q, 'actual-public-prices.json'), bytes: pricesBytes.length, sha256: priceHash }, priceArithmetic,
  functionalQualification: { actual: ['plain chat gpt-4o-mini', 'plain chat gpt-4o secondary', 'embedding default1536', 'memory.extract facts-v1 plain JSON/strict parse'],
    offlineOnly: ['facts.resolve conflicts-v1 plain JSON/strict parse'], unavailable: ['native response_format', 'tools', 'responses/messages', 'image/video'],
    fallbackModels: [], automaticFallback: false },
  unresolved: ['No compiled production registry installation yet.', 'terminalCost unavailable preserves full liability; current product withholds unknown-cost terminal results. Root is assessing a safe known-result/cost-unknown distinction separately.', 'No production all-charges aggregate assertion supplied.', 'An installed manifest must receive coherent nonauthor acceptance and a fresh installed-candidate integration run.'],
});

const unit = await load('affected-after-repair1.json');
const domain = await load('domain-consumers.json');
assert.equal(unit.numPassedTests, 373); assert.equal(unit.numFailedTests, 0);
assert.equal(domain.numPassedTests, 42); assert.equal(domain.numFailedTests, 0);
const quality = [
  { name: 'affected unit', result: 'PASS', tests: 373, suites: 4, failed: 0, skipped: unit.numPendingTests, receipt: 'affected-after-repair1.json' },
  { name: 'domain consumers', result: 'PASS', tests: 42, suites: 3, failed: 0, skipped: domain.numPendingTests, receipt: 'domain-consumers.json' },
  { name: 'root TypeScript', result: 'PASS', exit: 0, receipt: 'root-typecheck.stderr' },
  { name: 'backend TypeScript', result: 'PASS', exit: 0, receipt: 'backend-typecheck.stderr' },
  { name: 'affected eight-file ESLint', result: 'PASS', exit: 0, receipt: 'affected-lint.stderr' },
  { name: 'owned tracked diff whitespace', result: 'PASS', exit: 0, receipt: 'diff-check.stderr' },
  { name: 'actual CLI deployment/typecheck/codegen', result: 'PASS', exit: 0, receipt: 'deploy4.receipt.json' },
];
const failures = [
  'Initial manifest builder inline await inside a non-async map caused SyntaxError before writes; prepare-fixture then lacked manifest. Corrected saved build-manifest.mjs.',
  'deploy1 used provisioning adminKey instead of scoped deployKey; denied before deploy. deploy2 fixture query generic TypeScript failed. deploy3/4 later completed with typecheck enabled.',
  'chat-replay called consumeReplay before replay admission and returned an error; corrected replay2 did not repeat paid dispatch.',
  'embedding1 observed unqualified exact wire model, charged1microUSD, withheld all private bytes and permanently marked its own budget overrun. Fresh repair2 authority did not reset it.',
  'extract1 omitted fixed semantic output schema and denied before admission. Trusted operation/schema mapping repaired this actual path.',
  'First dedup-a/b fixture reused a semanticId across runs and both returned IDEMPOTENCY_CONFLICT without effects. Fresh dedup3 scope showed one winner.',
  'Initial duplicate-terminal inline Node TS import could not resolve profile.js before duplicate effects. Canonical JSON helper subsequently exercised two native terminal submissions.',
  'verify-live first oracle assumed unknown attempts expose a receipt; actual persisted uncertain state has null receipt. Preserved29/30 result; corrected assertion2 checks actual operation/attempt/account state,30/30.',
  'First closing-report inline builder repeated await/non-async-map SyntaxError before writes; corrected saved close-batch.mjs.',
];
await writeFile(join(q, 'failure-history.md'), '# Preserved scoped failures\n\n' + failures.map(value => '- ' + value).join('\n') + '\n\nC7 FULL REJECT2.8 and recorder STATIC ONLY PASS4.25 remain historical scoped verdicts; no captured missing C7 content was recovered by this batch.\n', { flag: 'wx' });
const report = {
  scope: 'TASK04_COHERENT_GATEWAY_BACKEND_ADAPTER_AND_ACTUAL_DISPOSABLE_QUALIFICATION_BATCH',
  status: 'IMPLEMENTED_AND_EXECUTED_PENDING_NONAUTHOR_REVIEW_AND_INSTALLED_MANIFEST', closedAt: new Date().toISOString(),
  operation: pointer.operation, candidateDigest, candidate: source, toolchain: { node: '24.15.0', npm: '12.2.0', convex: '1.46.0', gateway: '0.2.1', ai: '7' },
  productChanges: ['ActionCtx-native ledger composition and official Gateway factory.', 'Parent operation is forwarded to resolve and rechecked for same run/current authority; admitted child snapshot matches.', 'Exact attested default embedding terminal wire identity is accepted; arbitrary aliases and omission continue deny, raw identity retained in terminal/replay fences.', 'Fixed versioned fact/conflict semantic schemas are attached before admission; no native responseFormat/provider routing override.'],
  actual, quality, peerSeparateOffline: { tests: 47, passed: 47, path: join(dirname(q), 'task02-memory-gateway-v2/logs/jest-run3-results.json'), scope: 'independent-authored memory unit suite; no service qualification' },
  target: { teamId: 325340, projectId: 3170903, projectSlug: retired.projectSlug, deployment: retired.deploymentName, kind: 'sole fresh cloud-dev', production: false },
  cleanup: { deletionHttpStatus: deletion.deletionHttpStatus, readbackHttpStatus: retired.readbackHttpStatus, retired: true, pendingOwnedCommands: 0, credentialsPrinted: false, privateCredentialsRetainedMode600: true },
  cost: { unit: 'microUSD', originalScopeKnownSettled: 86, repairedScopeKnownSettled: 159, freshDedupScopeKnownSettled: 7, totalKnownLedgerSettled: 252, controlledUnknownRawObservedRoundedCost: 7, uncertainLiability: 100000, invoiceReconciled: false, qualifier: 'Observed rounded terminal charges, not exact invoice; controlled terminal cost omission preserved entire ceiling.' },
  bounds: sourceFacts.inputControl, qualificationProposal: join(q, 'qualification-manifest-proposal.json'),
  fullTask04Accepted: false, goalAccepted: false, productionRegistryInstalled: false,
  task04Criteria: [
    { name: 'register13 operations', state: 'existing pure registry; media remains unavailable until13; no functional media qualification' },
    { name: 'trusted versioned policy and validation', state: 'implemented/affected units and real bounded interfaces; compiled production trust still empty' },
    { name: 'atomic budget/concurrency/settlement', state: 'actual reservation before checkpoint, races, settle-once, quota denial and controlled unknown liability covered' },
    { name: 'different function models/correlated audit/no bypass', state: 'actual default/secondary models and parent/common-run audit covered; production integration pending' },
    { name: 'concurrent and secondary accounting', state: 'actual concurrency/dedup/terminal race and parent-child covered; authority/revocation public-negative scope belongs03' },
    { name: 'safe fallback and profile invariance', state: 'explicit empty fallback actual proposal, existing offline negative/currentness/profile coverage; no paid automatic fallback' },
  ],
  remaining: ['One coherent nonauthor review under acceptance-policy v2.', 'Independently accepted installed production qualification manifest/default integration; terminal cost completeness is not fabricated.', 'Actual authenticated public memory/chat integration after03-foundation; facts.resolve native plain JSON actual outcome still not run in this fixture.', 'Streaming/tools/media actual outcomes belong07/13/16 and cannot be inferred from plain doGenerate/doEmbed.'],
  failures, writers: 'All owned service/tool commands exited; report publisher performs only bounded local evidence writes.',
};
await save('report.json', report);
const md = `# Task Completion Report\n\n## Status: PARTIAL — bounded implementation and actual service batch complete; original Task04 acceptance remains open\n\nThe native ActionCtx adapter, exact-parent secondary resolution, exact qualified embedding wire identity, and fixed semantic-schema admission are implemented. Actual disposable Gateway/native-ledger outcomes passed30/30; affected units373/373 and domain consumers42/42 passed. Root/backend TypeScript, affected ESLint and enabled CLI deployment/typecheck/codegen passed. The separate memory adapter unit batch passed47/47.\n\nActual plain chat selected openai/gpt-4o-mini; same-run exact-parent title selected openai/gpt-4o. Query and memory embeddings produced finite1536-dimensional vectors with cortex-text-small-1536-v1/by_default_embedding_v1 provenance and retained raw text-embedding-3-small identity. Extraction returned one strictly parsed jasmine-tea preference under facts-v1. Native response_format, tools, streaming, Responses and media were not qualified. facts.resolve conflicts-v1 is covered offline only.\n\nTwo concurrent calls occupied the configured two slots and a third denied before dispatch. A corrected identical-call race produced one paid winner; replay and concurrent duplicate terminals added no attempt or settlement. Exhausted quota denied before checkpoint/native dispatch. A real paid call with deliberately removed terminal cost retained100000microUSD liability, released its slot, withheld output and denied another paid attempt. That controlled omission does not claim naturally unavailable Gateway cost.\n\nThe original embedding mismatch remains recorded:1microUSD charged, private bytes withheld and its budget marked overrun. Repair used fresh authority; no existing quota/run was reset. Known recorded rounded charges total252microUSD across the three scopes; the controlled-unknown raw observed7microUSD is retained separately, with100000microUSD liability. These totals are not invoice reconciliation.\n\nThe qualification proposal binds actual receipts and current public prices, permits plain text/semantic JSON and default embeddings, and selects a distinct title model. It contains no acceptance hash/classification authority and is not installed. Production terminalCost is unavailable because this batch does not independently establish all-charge completeness of Convex chat/embedding usage.cost. Its input controls are narrow UTF8/plain-chat framing and post-paid observed-token fences; full call-ceiling review remains explicit. Current unknown-cost delivery withholding is disclosed for Root's separate product decision. No fallback is configured; offline negatives retain safe fallback/profile-currentness coverage.\n\nThe sole owned cloud-dev project3170903/fearless-ox-413 was deleted with200 then404 readback. No production mutation or pending owned command remains; private scoped credentials were never printed. Production registry is still empty. C7 FULL REJECT2.8, recorder STATIC ONLY PASS4.25 and every failure in failure-history.md remain unchanged.\n\nRequirements completed for this batch: concrete reachable adapter, exact parent/current authority, controlled schema and alias regressions, meaningful actual race/quota/replay/unknown-cost outcomes, affected quality checks, and disposal. Original Task04 remains open for coherent nonauthor acceptance, installed qualification/default public integration and later extension outcomes.\n\nFiles and exact source digests: candidate-product-digests.json. Actual cases: actual-outcome-assertions2.json with named stdout/receipt triplets. Full structured report: report.json. Candidate proposal: qualification-manifest-proposal.json. Contract/pricing facts: qualification-contract-facts.json and actual-public-prices.json.\n`;
await writeFile(join(q, 'report.md'), md, { flag: 'wx' });
const receiptNames = (await readdir(q)).filter(name => name.endsWith('.receipt.json')).sort();
const receipts = [];
for (const name of receiptNames) {
  const body = await readFile(join(q, name));
  receipts.push({ path: join(q, name), bytes: body.length, sha256: sha(body) });
}
await save('command-receipt-index.json', { scope: 'ORDINARY_ACTUAL_COMMAND_RECEIPT_INDEX', receipts, fullTask04Accepted: false });
const principalNames = ['report.json', 'report.md', 'candidate-product-digests.json', 'qualification-manifest-proposal.json', 'qualification-contract-facts.json', 'actual-outcome-assertions2.json', 'command-receipt-index.json', 'failure-history.md', 'retirement-delete.json', 'retirement.json'];
const principal = [];
for (const name of principalNames) {
  const body = await readFile(join(q, name));
  principal.push({ name, path: join(q, name), bytes: body.length, sha256: sha(body) });
}
await save('closed-handoff.json', { scope: report.scope, stoppedAt: new Date().toISOString(), candidateDigest, files: principal,
  ownedCommandsPending: 0, remainingWrites: [], independentVerdict: 'PENDING', fullTask04Accepted: false, goalAccepted: false });
console.log(JSON.stringify({ candidateDigest, principal, reportStatus: report.status, remainingWrites: [] }, null, 2));
