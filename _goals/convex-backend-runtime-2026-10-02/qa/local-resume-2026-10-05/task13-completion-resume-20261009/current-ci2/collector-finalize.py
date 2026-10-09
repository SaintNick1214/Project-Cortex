from pathlib import Path
from collections import Counter
import datetime, hashlib, importlib.util, json, re

Q = Path(__file__).resolve().parent
HEAD = '8ca8f15c96900a4824298c7b63eee02fab0b7ea5'
BASELINE_SHA = 'ded9b2c441a96ae833bd2a50abe79cc9597b143b1bb5b4ab920a04eca44659e3'
STAMP = datetime.datetime.now(datetime.timezone.utc).isoformat()

def read(p): return json.loads(p.read_text())
def write(name, value): (Q / name).write_text(json.dumps(value, indent=2) + '\n')
def sha(p): return hashlib.sha256(p.read_bytes()).hexdigest()
def count_sum(blocks): return {k: sum(b[k] for b in blocks) for k in ['tests', 'passed', 'failed', 'skipped']}

pr = read(sorted((Q / 'polls').glob('collector-pr-*.json'))[-1])['run']
security = read(sorted((Q / 'polls').glob('collector-security-*.json'))[-1])['run']
assert pr['headSha'] == security['headSha'] == HEAD
assert pr['status'] == security['status'] == 'completed'
assert pr['conclusion'] == security['conclusion'] == 'success'
assert sha(Q / 'prospective-baseline1.json') == BASELINE_SHA
counts = read(Q / 'collector-counts1.json')['jobs']
assert not any(v['testForcedExitObserved'] for v in counts.values())
assert all(v['totals']['failed'] == v['totals']['skipped'] == 0 for v in counts.values())

def job(name): return next(j for j in pr['jobs'] if j['name'] == name)
def receipt(j): return 'logs/collector-pr-job-' + str(j['databaseId']) + '.log'
def result(j): return counts[Path(receipt(j)).name]
def artifact_result(name):
    p = next((Q / 'artifacts').rglob(name)); v = read(p)
    assert v['success'] and v['numFailedTests'] == v['numPendingTests'] == 0
    return {'path': str(p.relative_to(Q)), 'tests': v['numTotalTests'], 'passed': v['numPassedTests'], 'failed': v['numFailedTests'], 'skipped': v['numPendingTests'], 'suites': v['numTotalTestSuites'], 'assertions': [a['fullName'] for f in v['testResults'] for a in f['assertionResults']]}

sdk_jobs = sorted((j for j in pr['jobs'] if j['name'].startswith('Test TypeScript SDK (Shard ')), key=lambda j: j['name'])
sdk_unit_blocks = [b for j in sdk_jobs for b in result(j)['blocks'] if 'ci-sdk-runtime-results.json' not in b['command']]
assert len(sdk_jobs) == len(sdk_unit_blocks) == 5
sdk_sets = [set(read(p)) for p in sorted((Q / 'artifacts').rglob('ci-sdk-discovery.json'))]
assert len(sdk_sets) == 5 and all(s == sdk_sets[0] for s in sdk_sets)
sdk_discovery = {'files': len(sdk_sets[0]), 'unitFiles': sum('/tests/unit/' in x for x in sdk_sets[0]), 'allFiveSetsEqual': True, 'artifacts': [str(p.relative_to(Q)) for p in sorted((Q / 'artifacts').rglob('ci-sdk-discovery.json'))], 'scope': 'Every discovered SDK unit file selected once across five shards; other files remain discovered and only explicit current actual/native contracts are executed.'}
cli_job = job('Test Cortex CLI'); cli_blocks = result(cli_job)['blocks']
provider_job = job('Test Vercel AI Provider'); provider_blocks = result(provider_job)['blocks']
cli_discovery_path = next((Q / 'artifacts').rglob('ci-cli-discovery.json')); cli_paths = read(cli_discovery_path)
provider_discovery_path = next((Q / 'artifacts').rglob('ci-provider-discovery.json')); provider_paths = read(provider_discovery_path)
cleanup_job = job('Retire exact CI fixture authority')
cleanup = []
for p in sorted((Q / 'artifacts/ci-runtime-cleanup-receipts').rglob('*.json')):
    v = read(p)
    assert v['retirement']['status'] == 'RETIRED_FIXTURE_AUTHORITY'
    assert v['verification']['status'] == 'RETIRED_FIXTURE_READS_DENIED'
    assert set(v['verification']['verifiedRoles']) == {'owner', 'reader', 'outsider'}
    assert all('37999830726-1' in t for t in v['retirement']['retired'])
    assert not v['retirement']['globalPurge'] and not v['retirement']['physicalRowDeletion']
    cleanup.append({'path': str(p.relative_to(Q)), **v})
assert len(cleanup) == 2 and cleanup_job['conclusion'] == 'success'

scope = {
    'sdkControlled': {'status': 'PASS', 'counts': count_sum(sdk_unit_blocks), 'suites': sum(b['suites']['tests'] for b in sdk_unit_blocks), 'shards': [{'jobId': j['databaseId'], 'name': j['name'], 'raw': receipt(j), 'counts': count_sum([b for b in result(j)['blocks'] if 'ci-sdk-runtime-results.json' not in b['command']])} for j in sdk_jobs], 'discovery': sdk_discovery, 'normalClosure': 'All test commands explicitly --forceExit=false and completed without forced-exit/worker/timeout evidence. Discovery-only listTests invocations inherited forceExit and are disclosed separately.'},
    'sdkActual': {'status': 'PASS_ACTUAL_AUTHENTICATED_REGISTERED_RUNTIME', **artifact_result('ci-sdk-runtime-results.json'), 'normalClosure': 'Explicit --forceExit=false, bounded 240s subprocess; exit0/natural close.', 'asyncMediaQualification': False},
    'cliControlledAndCommand': {'status': 'PASS', 'jobId': cli_job['databaseId'], 'raw': receipt(cli_job), 'counts': count_sum([b for b in cli_blocks if 'test:fast' in b['command']]), 'suites': sum(b['suites']['tests'] for b in cli_blocks if 'test:fast' in b['command']), 'discovery': {'path': str(cli_discovery_path.relative_to(Q)), 'files': len(cli_paths), 'commandFiles': sum('/tests/commands/' in x for x in cli_paths), 'historicalE2EUnselected': [x.rsplit('/packages/cortex-cli/', 1)[-1] for x in cli_paths if '/tests/e2e/' in x]}, 'normalClosure': 'Canonical runner disables forced exit;63 selected unit/command suites naturally close with no forced-exit/worker/timeout evidence.', 'offlinePrerequisiteCleanup': 'OWNED_FIXTURES_REMOVED in raw log after command suite; no service operations in prerequisite helper.'},
    'cliActual': {'status': 'PASS_ACTUAL_AUTHENTICATED_REGISTERED_RUNTIME', **artifact_result('ci-cli-runtime-results.json'), 'normalClosure': 'Explicit --forceExit=false, bounded 240s subprocess; exit0/natural close.', 'asyncMediaQualification': False},
    'providerControlled': {'status': 'PASS', 'jobId': provider_job['databaseId'], 'raw': receipt(provider_job), 'counts': count_sum([b for b in provider_blocks if '--selectProjects e2e-remote' not in b['command']]), 'suites': sum(b['suites']['tests'] for b in provider_blocks if '--selectProjects e2e-remote' not in b['command']), 'discovery': {'path': str(provider_discovery_path.relative_to(Q)), 'files': len(provider_paths), 'historicalE2EUnselected': [x.rsplit('/packages/vercel-ai-provider/', 1)[-1] for x in provider_paths if '/tests/e2e/' in x and not x.endswith(('/remote-runtime.test.ts', '/graph-runtime.test.ts'))], 'graphRuntimeScope': 'graph-runtime.test.ts belongs to separately executed graph4 contract; not provider paid actual suite.'}, 'normalClosure': 'Every selected provider controlled command explicitly --forceExit=false, natural close with zero skips.'},
    'providerActual': {'status': 'PASS_ONE_ACTUAL_CURRENT_QUALIFIED_AGENT_REMOTE_REQUEST', **artifact_result('ci-provider-remote-results.json'), 'unpaidPublicationReceipt': str(next((Q / 'artifacts').rglob('ci-provider-agent.json')).relative_to(Q)), 'normalClosure': 'Explicit --forceExit=false/watchman=false, bounded 210s subprocess; exit0/natural close.', 'asyncMediaQualification': False},
}
for key, name in [('graphs', 'Neo4j and Memgraph contracts'), ('privacy', 'Serialized native export, erasure and scope proofs'), ('catalog', 'Independent template catalog'), ('packedPublicBrowserContracts', 'Packed package and browser contracts')]:
    j = job(name); scope[key] = {'status': 'PASS', 'jobId': j['databaseId'], 'raw': receipt(j), 'counts': result(j)['totals'], 'normalClosure': 'Completed success, no test forced-exit/worker/timeout evidence.'}
scope['graphs']['split'] = {'root': 53, 'provider': 4, 'eachCommandForceExitFalse': True}
scope['privacy']['files'] = ['tests/user-export.test.ts', 'tests/fact-history-provenance.test.ts', 'tests/facts-revision-scope.test.ts', 'tests/domain-scope.test.ts', 'tests/domain-operations.test.ts', 'tests/memorySpaces.test.ts', 'tests/operation-sequences.test.ts', 'tests/gdprCascade.test.ts']
scope['packedPublicBrowserContracts']['split'] = '53 CI offline guards +10 delivery/release +14 installer controls; separate packed public/browser scripts succeeded without numeric test totals.'
for key, folder in [('basicInstalled', 'packages/cortex-cli/templates/basic'), ('canonicalInstalled', 'packages/vercel-ai-provider/quickstart'), ('chatInstalled', 'packages/cortex-cli/templates/chat-sdk-quickstart')]:
    j = job('Build demo (' + folder + ')')
    scope[key] = {'status': 'PASS_FRESH_INSTALLED_ENABLED_OFFICIAL_CODEGEN_AND_PRODUCTION_BUILD', 'jobId': j['databaseId'], 'raw': receipt(j), 'counts': result(j)['totals'], 'unitStep': '112/112 Basic units executed naturally' if key == 'basicInstalled' else 'Explicitly skipped by Basic-only matrix condition; no current UI/unit count claimed.', 'liveChatPaidExecution': False}
quality = job('Code Quality (Lint & Type Check)')
scope['quality'] = {'status': 'PASS', 'jobId': quality['databaseId'], 'raw': receipt(quality), 'eslint': {'errors': 0, 'warnings': 234}, 'typecheck': 'PASS'}
provision = job('Deploy & Provision Scoped Runtime Fixtures')
scope['fixtureProvision'] = {'status': 'PASS_GUARDED_DISTINCT_DEV_DEPLOY_COMPILED_MANIFEST_AND_SCOPED_JWT_PROVISION', 'jobId': provision['databaseId'], 'raw': receipt(provision), 'artifacts': [str(p.relative_to(Q)) for p in sorted((Q / 'artifacts/ci-runtime-fixture-receipts').rglob('*.json'))], 'compiledManifest': {'id': 'cortex-gateway-agent-defaults-2026-10-08', 'revision': 16, 'freshNativeQualification': False}}
scope['cleanup'] = {'status': 'PASS_EXACT_OWNED_RETIREMENT_AND_FRESH_ROLE_DENIAL', 'jobId': cleanup_job['databaseId'], 'raw': receipt(cleanup_job), 'receipts': cleanup}
scope['security'] = {'workflowConclusion': security['conclusion'], 'codeQL': 'PASS', 'secretScanning': 'PASS', 'dependencyReview': 'PASS', 'license': 'PASS', 'dependencyVulnerabilityScan': 'Trivy job completed successfully and uploaded; workflow conclusion does not assert zero vulnerability findings.', 'semgrep': 'UNAVAILABLE: inherited optional action1.36.0 crashes on invalid rule severity MEDIUM; continue-on-error masks it at job level and SARIF upload is skipped. No clean scan claimed.', 'stepsSkipped': [{'job': j['name'], 'step': s['name']} for j in security['jobs'] for s in j['steps'] if s['conclusion'] == 'skipped'], 'jobsSkipped': [j['name'] for j in security['jobs'] if j['conclusion'] == 'skipped']}
write('collector-scope-outcomes1.json', scope)
write('collector-final1.json', {'capturedAt': STAMP, 'headSha': HEAD, 'prRun': pr, 'securityRun': security})
semgrep = next(j for j in security['jobs'] if 'Semgrep' in j['name'])
semgrep_raw = Q / ('logs/collector-security-job-' + str(semgrep['databaseId']) + '.log')
write('collector-inherited-semgrep1.json', {'status': 'OPTIONAL_INHERITED_SCAN_UNAVAILABLE', 'jobId': semgrep['databaseId'], 'jobConclusion': semgrep['conclusion'], 'raw': str(semgrep_raw.relative_to(Q)), 'errorLines': [{'line': i + 1, 'text': l} for i, l in enumerate(semgrep_raw.read_text().splitlines()) if 'invalid rule severity' in l], 'sarifUpload': 'skipped', 'rerunOrSourceRepair': False})
write('collector-report1.json', {'status': 'CURRENT_CI_SUCCESS_COLLECTION_CLOSED', 'capturedAt': STAMP, 'headSha': HEAD, 'sixFileProductCandidateDigest': '5dbbf14a3cb31e9f256519b447c92bd1b30b74ffc934d39fe1f7e9e4f5d4c255', 'prRun': {'id': pr['databaseId'], 'url': pr['url'], 'status': pr['status'], 'conclusion': pr['conclusion'], 'jobs': dict(Counter(j['conclusion'] for j in pr['jobs']))}, 'securityRun': {'id': security['databaseId'], 'url': security['url'], 'status': security['status'], 'conclusion': security['conclusion'], 'jobs': dict(Counter(j['conclusion'] for j in security['jobs']))}, 'cleanupClosed': True, 'scopeOutcomes': 'collector-scope-outcomes1.json', 'counts': 'collector-counts1.json', 'optionalInheritedScan': 'collector-inherited-semgrep1.json', 'naturalClose': 'All selected executing test commands close naturally, including root53/provider4 graphs; SDK discovery-only listTests inherited forced-exit banners remain explicitly disclosed.', 'zeroTestSkips': True, 'conditionalStepSkips': 'Canonical/Chat Basic-only units, SDK actual on shards2–5, main-only release paths, OpenAPI audit and optional Semgrep SARIF; Scorecard job skipped. Exact metadata retained.', 'nativeFinancialAfterRead': 'Whole-run+cleanup signal already sent to Root before aggregation; single financial read separately owned by native agent.', 'actualAsyncQualification': False, 'fullGoalAcceptance': False, 'protectedBaseline': {'path': 'prospective-baseline1.json', 'sha256BeforeAndAfter': BASELINE_SHA}, 'protectedPreviousScope': 'current-ci1 and native-before1 untouched; no historical artifacts copied.', 'writes': 'Collector QA files/logs/metadata/selected current artifacts only; no product/tests/Git/services/rerun effects.'})

# Check retained redacted raw receipts without printing credential content.
spec = importlib.util.spec_from_file_location('collector', Q / 'collector-current2.py'); module = importlib.util.module_from_spec(spec); spec.loader.exec_module(module)
scan = [*sorted((Q / 'logs').glob('*.log')), *sorted((Q / 'artifacts').rglob('*.json'))]
hits = []
for p in scan:
    value = p.read_text()
    for name, pattern in module.RULES:
        if pattern.search(value): hits.append({'path': str(p.relative_to(Q)), 'rule': name})
write('collector-credential-scan1.json', {'status': 'PASS' if not hits else 'FAIL', 'filesChecked': len(scan), 'hits': hits, 'contentPrinted': False})
assert not hits

summary = '''CI2 closed successfully at HEAD 8ca8f15c96900a4824298c7b63eee02fab0b7ea5. PR Checks37999830726 has19 successful jobs; Security37999830718 has8 successful jobs and skipped Scorecard.

SDK controlled:7492/7492 across163 unit files; SDK actual:7/7. CLI unit/command:1840/1840 across63 suites; CLI actual:7/7. Provider controlled:360/360 across16 suites; provider actual:1/1. Native graph root53/provider4, privacy217, Basic112 units, catalog24 and77 offline CI/release/installer assertions passed. Executing tests have0 skips and natural close, including both corrected graph commands. SDK listTests discovery-only inherited forced-exit banners are retained separately. SDK discovery281files is identical across5 shards; CLI discovery68files and provider23files are preserved.

All three fresh installed demos passed genuine enabled official Convex codegen and production builds. Canonical/Chat unit steps are unselected by the Basic-only matrix; no current paid chat/UI or async media qualification is inferred. Quality passes with234 warnings/0 errors.

Both current SDK/CLI tenant and outsider scopes were retired; fresh owner/reader/outsider reads were denied. Global purge and physical row deletion were false. Native owns the single separate financial after-read and received whole-run closure before aggregation.

Required selected security jobs passed. Optional inherited Semgrep remains unavailable after its invalid MEDIUM severity crash; SARIF upload was skipped. OpenAPI audit and Scorecard remain unselected. Workflow success is not a claim of clean Semgrep or zero vulnerability findings.

Only collector-prefixed QA evidence was written. The prospective baseline hash is unchanged; current-ci1/native-before1, source, Git and service configuration are untouched. No retries or async/full-goal acceptance grant.
'''
(Q / 'collector-report1.md').write_text(summary)
handoff = {'status': 'CLOSED_READ_ONLY_CURRENT_CI_SUCCESS', 'headSha': HEAD, 'prRunId': pr['databaseId'], 'securityRunId': security['databaseId'], 'report': str(Q / 'collector-report1.json'), 'scopeCounts': str(Q / 'collector-scope-outcomes1.json'), 'exactFinalMetadata': str(Q / 'collector-final1.json'), 'optionalScanReceipt': str(Q / 'collector-inherited-semgrep1.json'), 'evidenceIndex': str(Q / 'collector-evidence-index1.json'), 'cleanupReceipts': [str(Q / r['path']) for r in cleanup], 'remaining': 'Native financial after-read separately owned; genuine async service readiness/qualification remains open. No acceptance promotion by collector.'}
write('collector-handoff1.json', handoff)
selected = [*sorted((Q / 'logs').glob('*.log')), *sorted((Q / 'artifacts').rglob('*.json')), *sorted(Q.glob('collector-*.json')), *sorted(Q.glob('collector-*.jsonl')), *sorted(Q.glob('collector-*.py')), Q / 'collector-report1.md']
selected = sorted(set(p for p in selected if p.name != 'collector-evidence-index1.json'))
write('collector-evidence-index1.json', {'capturedAt': STAMP, 'headSha': HEAD, 'scope': 'Current final metadata, all selected current job logs/discovery/runtime/fixture/cleanup artifacts and collector receipts; intermediate polls retained separately, not historical archives.', 'entries': [{'path': str(p.relative_to(Q)), 'bytes': p.stat().st_size, 'sha256': sha(p)} for p in selected], 'protectedBaseline': {'path': 'prospective-baseline1.json', 'sha256': BASELINE_SHA}})
print(json.dumps({'status': handoff['status'], 'report': handoff['report'], 'evidencePins': len(selected), 'credentialScan': 'PASS', 'sdkControlled': scope['sdkControlled']['counts'], 'cliControlled': scope['cliControlledAndCommand']['counts'], 'providerControlled': scope['providerControlled']['counts']}))
