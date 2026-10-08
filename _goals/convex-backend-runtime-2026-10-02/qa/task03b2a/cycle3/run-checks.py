from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
import subprocess, datetime, json, os, hashlib, tempfile

root = Path.cwd()
qa = root / '_goals/convex-backend-runtime-2026-10-02/qa/task03b2a'
cycle = qa / 'cycle3'
logs = cycle / 'checks'
logs.mkdir(parents=True, exist_ok=True)
relative = str(qa.relative_to(root))
env = os.environ.copy()
env.update(CONVEX_URL='http://127.0.0.1:1', CONVEX_TEST_MODE='local')
def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()
def run(command):
    name, argv = command
    started = datetime.datetime.now(datetime.timezone.utc).isoformat()
    result = subprocess.run(argv, cwd=root, env=env, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
    ended = datetime.datetime.now(datetime.timezone.utc).isoformat()
    log = logs / (name + '.log')
    log.write_text(result.stdout)
    receipt = dict(name=name, argv=argv, cwd=str(root), startedAt=started, endedAt=ended, exitCode=result.returncode, log=str(log.relative_to(root)))
    print(json.dumps(receipt), flush=True)
    return receipt
def snapshot_catalog():
    return {str(path.relative_to(root)): digest(path) for path in sorted((qa / 'catalog').glob('*')) if path.is_file()}
def snapshot_temporary():
    return sorted(str(path) for path in Path(tempfile.gettempdir()).glob('cortex-metadata-inventory-*'))

archives = []
for name, expected in [('cycle1-final', 69), ('cycle2-final', 101)]:
    archive = qa / 'history' / name
    manifest = json.loads((archive / 'preservation.json').read_text())
    assert len(manifest['records']) == expected
    records = []
    for row in manifest['records']:
        target = archive / row['kind'] / (row.get('path') or row['file'])
        if row['kind'] == 'source':
            target = Path(str(target) + '.text')
        actual = digest(target)
        assert actual == row['sha256'], str(target)
        records.append(dict(file=str(target.relative_to(root)), sha256=actual))
    archives.append(dict(archive=name, count=len(records), manifestSha256=digest(archive / 'preservation.json'), records=records))
(cycle / 'archive-verification.json').write_text(json.dumps(archives, indent=2) + '\n')

first = [
    ('actual-backend-types', ['node', 'node_modules/typescript/bin/tsc', '-p', 'convex-dev/tsconfig.json', '--pretty', 'false']),
    ('backend-types', ['node', 'node_modules/typescript/bin/tsc', '--project', relative + '/tsconfig.backend.json', '--pretty', 'false']),
    ('test-types', ['node', 'node_modules/typescript/bin/tsc', '--project', relative + '/tsconfig.tests.json', '--pretty', 'false']),
    ('scoped-lint', ['node', 'node_modules/eslint/bin/eslint.js', 'convex-dev/schema.ts', 'convex-dev/immutable.ts', 'convex-dev/mutable.ts', 'convex-dev/users.ts', 'convex-dev/sessions.ts', 'convex-dev/runtimeMetadataAuth.ts', 'tests/unit/runtimeMetadataAuth', '--report-unused-disable-directives']),
    ('test-discovery', ['node', '--experimental-vm-modules', 'node_modules/jest/bin/jest.js', '--testPathPatterns=tests/unit/runtimeMetadataAuth', '--listTests', '--json', '--runInBand']),
]
with ThreadPoolExecutor(max_workers=3) as executor:
    receipts = list(executor.map(run, first))
before_catalog = snapshot_catalog()
before_temporary = snapshot_temporary()
receipts.append(run(('scoped-jest', ['node', '--experimental-vm-modules', 'node_modules/jest/bin/jest.js', '--testPathPatterns=tests/unit/runtimeMetadataAuth', '--runInBand', '--forceExit', '--silent', '--json', '--outputFile=' + relative + '/cycle3/jest-results.json'])))
after_catalog = snapshot_catalog()
after_temporary = snapshot_temporary()
assert before_catalog == after_catalog, 'Ordinary tests changed retained catalog bytes'
assert before_temporary == after_temporary, 'Inventory test leaked its temporary directory'
(cycle / 'catalog-test-preservation.json').write_text(json.dumps(dict(before=before_catalog, after=after_catalog, bytesUnchanged=True, temporaryBefore=before_temporary, temporaryAfter=after_temporary, noTemporaryLeak=True), indent=2) + '\n')
second = [
    ('ast-inventory', ['node', relative + '/inventory.mjs']),
    ('framework-registration', ['node', '--import', 'tsx', relative + '/registration-probe.mjs']),
    ('full-root-types', ['node', 'node_modules/typescript/bin/tsc', '--noEmit', '--pretty', 'false']),
    ('baseline-root-types', ['node', relative + '/baseline-root-types.mjs']),
    ('timestamp-outcomes', ['node', '--import', 'tsx', relative + '/cycle3/timestamp-probe.mjs']),
    ('diff-check', ['git', 'diff', '--check']),
    ('compiler-config-unchanged', ['git', 'diff', '--exit-code', '--', 'convex-dev/tsconfig.json']),
]
with ThreadPoolExecutor(max_workers=3) as executor:
    receipts.extend(executor.map(run, second))
(cycle / 'check-receipts.json').write_text(json.dumps(receipts, indent=2) + '\n')
files = ['convex-dev/schema.ts', 'convex-dev/immutable.ts', 'convex-dev/mutable.ts', 'convex-dev/users.ts', 'convex-dev/sessions.ts', 'convex-dev/runtimeMetadataAuth.ts'] + [str(path.relative_to(root)) for path in sorted((root / 'tests/unit/runtimeMetadataAuth').glob('*.ts'))]
(cycle / 'source-hashes.json').write_text(json.dumps([dict(file=file, sha256=digest(root / file)) for file in sorted(files)], indent=2) + '\n')
expected_codes = {name: (2 if name == 'full-root-types' else 0) for name, _ in first + second}
expected_codes['scoped-jest'] = 0
assert all(receipt['exitCode'] == expected_codes[receipt['name']] for receipt in receipts), 'Unexpected check status; inspect raw logs'
