from pathlib import Path
import json, hashlib, datetime, subprocess

root = Path.cwd()
qa = root / '_goals/convex-backend-runtime-2026-10-02/qa/task03b2a'
cycle = qa / 'cycle3'
def digest(file):
    return hashlib.sha256(file.read_bytes()).hexdigest()
def read(file):
    return json.loads(file.read_text())

source_hashes = read(cycle / 'source-hashes.json')
for row in source_hashes:
    assert digest(root / row['file']) == row['sha256']
for row in read(cycle / 'check-hashes.json'):
    assert digest(root / row['file']) == row['sha256']
archives = []
for name, expected in [('cycle1-final', 69), ('cycle2-final', 101)]:
    archive = qa / 'history' / name
    manifest = read(archive / 'preservation.json')
    assert len(manifest['records']) == expected
    for row in manifest['records']:
        target = archive / row['kind'] / (row.get('path') or row['file'])
        if row['kind'] == 'source':
            target = Path(str(target) + '.text')
        assert digest(target) == row['sha256'], str(target)
    archives.append(dict(cycle=name, records=expected, manifestSha256=digest(archive / 'preservation.json'), unchanged=True))
assert (qa / 'report.md').read_bytes() == (cycle / 'report.md').read_bytes()
assert (qa / 'source-hashes.json').read_bytes() == (cycle / 'source-hashes.json').read_bytes()
assert (cycle / 'checks/full-root-types.log').read_bytes() == (qa / 'history/cycle2-final/qa/checks/full-root-types.log').read_bytes()
assert read(qa / 'baseline-diagnostics.json')['diagnostics'] == []
verification = read(cycle / 'verification.json')
assert verification['tests']['total'] == verification['tests']['passed'] == 189
assert verification['registered'] == dict(total=41, public=36, internal=5, unresolved=0, dispositionsUnchanged=True, nativeValidatorsUnchanged=True)
result = subprocess.run(['git', 'diff', '--check'], stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
assert result.returncode == 0, result.stdout
head = subprocess.run(['git', 'rev-parse', 'HEAD'], stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
assert head.returncode == 0 and head.stdout.strip() == '2edd9435a545ecf0f1e3315fe7ae37c22c7b0623'
excluded = {qa / 'freeze.json', cycle / 'freeze.json', cycle / 'artifact-hashes.json'}
artifacts = [dict(file=str(file.relative_to(root)), sha256=digest(file)) for file in sorted(qa.rglob('*')) if file.is_file() and file not in excluded]
artifacts += source_hashes
artifacts.append(dict(file='convex-dev/tsconfig.json', sha256=digest(root / 'convex-dev/tsconfig.json')))
(cycle / 'artifact-hashes.json').write_text(json.dumps(dict(excludes=['current freeze.json', 'cycle3/freeze.json', 'this self-hashing manifest'], records=artifacts), indent=2) + '\n')
freeze = dict(cycle=3, frozenAt=datetime.datetime.now(datetime.timezone.utc).isoformat(), reviewedHead=head.stdout.strip(), worktree=str(root),
    noFurtherWrites=True, implementation='bounded ES2021 final-index and disposable inventory repair complete',
    independentReview='fresh cycle3 review pending; cycle1 REJECT and cycle2 NEEDS FIXES preserved',
    changedSourcesFromCycle2=verification['changedSources'], tests=verification['tests'], registered=verification['registered'],
    timestampOutcomeProbe=dict(classification='executor outcome evidence, not independent judgment', passed=14, total=14),
    actualBackendCompiler=dict(argv=['node', 'node_modules/typescript/bin/tsc', '-p', 'convex-dev/tsconfig.json', '--pretty', 'false'], exitCode=0, lib=['ES2021', 'dom'], compilerConfigurationUnchanged=True),
    scopedBackendAndTestLibraries='ES2021', scopeChecks='PASS: scoped executor gates only',
    ordinaryTestCatalogBytesUnchanged=True, ordinaryTestTemporaryCleanup=True,
    fullRoot='FAIL: identical five introduced downstream SDK consumer diagnostics', baselineDiagnostics=0,
    archives=archives, archiveRecordsVerifiedUnchanged=170,
    sourceHashes=source_hashes, checkHashes=read(cycle / 'check-hashes.json'),
    artifactRecords=len(artifacts), artifactHashesSha256=digest(cycle / 'artifact-hashes.json'),
    receiptsSha256=digest(qa / 'check-receipts.json'), contractsSha256=digest(qa / 'contracts.md'), reportSha256=digest(qa / 'report.md'),
    verificationSha256=digest(cycle / 'verification.json'), ordinaryTestPreservationSha256=digest(cycle / 'catalog-test-preservation.json'),
    unsupportedBoundaries='parent integration/fresh judgment; separately reviewed MF composite source-key bridge; SDK03C2/09; managed JWT/subscription/private-byte/deployment03C2; all17 tasks ongoing')
content = json.dumps(freeze, indent=2) + '\n'
(cycle / 'freeze.json').write_text(content)
(qa / 'freeze.json').write_text(content)
for row in artifacts:
    assert digest(root / row['file']) == row['sha256'], row['file']
assert digest(qa / 'freeze.json') == digest(cycle / 'freeze.json')
print(json.dumps(dict(frozenAt=freeze['frozenAt'], noFurtherWrites=True, sourceFiles=len(source_hashes), artifactRecords=len(artifacts), archivedRecords=170,
    freezeSha256=digest(qa / 'freeze.json'), artifactHashesSha256=freeze['artifactHashesSha256'], actualBackendES2021='PASS', testsPassed=189, registered='41=36+5', fullRootDiagnostics=5, baselineDiagnostics=0), indent=2))
