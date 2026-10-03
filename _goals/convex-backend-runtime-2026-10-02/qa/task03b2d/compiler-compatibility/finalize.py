import datetime
import hashlib
import json
import pathlib
import subprocess

root = pathlib.Path.cwd()
qa = root / '_goals/convex-backend-runtime-2026-10-02/qa/task03b2d/compiler-compatibility'
before = json.loads((qa / 'before.json').read_text())
records = json.loads((qa / 'commands.json').read_text())
sha = lambda data: hashlib.sha256(data).hexdigest()
now = datetime.datetime.now(datetime.timezone.utc).isoformat()
expected = {
    'convex-dev/governance.ts': ('Object.hasOwn(durations, options.period)', 'Object.prototype.hasOwnProperty.call(durations, options.period)'),
    'convex-dev/runtimeWorkerAuth.ts': ('Object.hasOwn(fields, key)', 'Object.prototype.hasOwnProperty.call(fields, key)'),
}
initial = {entry['file']: entry['sha256'] for entry in before['allowedProductsAndHostConfig']}
products = []
for name, (old, new) in expected.items():
    committed = subprocess.check_output(['git', 'show', before['head'] + ':' + name], cwd=root)
    current = (root / name).read_bytes()
    assert sha(committed) == initial[name], name + ' original source differs from reviewed HEAD'
    assert committed.count(old.encode()) == 1, name + ' original own-property check count'
    assert current == committed.replace(old.encode(), new.encode(), 1), name + ' unexpected product delta'
    products.append({'file': name, 'beforeSha256': initial[name], 'sha256': sha(current), 'replacements': 1})
preserved = []
for group in ('preservedQa', 'originalCiReceipts'):
    changed = []
    for entry in before[group]:
        path = root / entry['file']
        if not path.is_file() or sha(path.read_bytes()) != entry['sha256']:
            changed.append({'file': entry['file'], 'beforeSha256': entry['sha256'], 'observedSha256': sha(path.read_bytes()) if path.is_file() else None})
    if group == 'preservedQa':
        assert not changed, str(changed)
    else:
        assert all(item['file'].endswith('qa/ci-followups/worker-closure-failures.json') for item in changed), str(changed)
    preserved.append({'group': group, 'count': len(before[group]), 'changed': changed})
config = 'convex-dev/tsconfig.json'
assert sha((root / config).read_bytes()) == initial[config]
tests = json.loads((qa / 'tests.json').read_text())
counts = {key: tests[key] for key in ('success', 'numTotalTests', 'numPassedTests', 'numFailedTests', 'numPendingTests', 'numTotalTestSuites', 'numPassedTestSuites', 'numFailedTestSuites', 'numPendingTestSuites')}
assert tests['success'] and tests['numTotalTests'] == tests['numPassedTests'] == 185
assert tests['numTotalTestSuites'] == tests['numPassedTestSuites'] == 3
assert tests['numFailedTests'] == tests['numPendingTests'] == tests['numFailedTestSuites'] == tests['numPendingTestSuites'] == 0
by_name = {entry['name']: entry for entry in records}
assert by_name['backend-initial']['exitCode'] == 2
for name in ('backend-final', 'scoped-types', 'lint', 'lint-d-scope', 'tests', 'diff'):
    assert by_name[name]['exitCode'] == 0, name
patch = subprocess.check_output(['git', 'diff', '--', *expected], cwd=root)
(qa / 'change.patch').write_bytes(patch)
verification = {'verifiedAt': now, 'products': products, 'hostCompilerConfig': {'file': config, 'sha256': initial[config], 'unchanged': True}, 'preservation': preserved, 'testCounts': counts, 'exactTwoReplacementsOnly': True}
(qa / 'preservation.json').write_text(json.dumps(verification, indent=2) + '\n')
report = '''# D compiler compatibility follow-up

The actual backend typecheck initially failed with TS2550 at `governance.ts:434` and `runtimeWorkerAuth.ts:52`. Both `Object.hasOwn` calls now use `Object.prototype.hasOwnProperty.call`, preserving the own-property checks while supporting the backend's ES2021 library.

Only those two product expressions changed. The host compiler configuration, D tests, schema, generated code, manifests, and SDK consumers were not changed by this executor. No stage, commit, deploy, or live operation was performed.

The earlier D scoped configuration uses ES2022, so its successful check did not establish ES2021 backend compatibility. That original qualification remains preserved. This follow-up ran the unchanged actual backend configuration and recorded the original failure before applying the repair.

| Check | Outcome |
| --- | --- |
| Initial actual backend ES2021 typecheck | Exit 2; exactly two TS2550 diagnostics, retained |
| Actual backend ES2021 typecheck after repair | PASS, exit 0 |
| Existing D scoped types | PASS, exit 0 |
| Changed-file lint and full existing D scoped lint | PASS, exit 0 |
| Existing D registered-handler/native-schema/catalog suite | PASS, 185 tests / 3 suites / 0 pending |
| Scoped diff whitespace check | PASS, exit 0 |

`commands.json` records argv, cwd, timestamps, exit codes, source hashes, and raw logs. `preservation.json` verifies exact two-expression changes against reviewed HEAD cd5671449beb64ed1ca4a284a761cad60ab70525, the unchanged backend compiler config, all 139 preexisting D QA files (including canonical catalogs and historical freezes), and the unchanged original private CI log. The parent-owned `qa/ci-followups/worker-closure-failures.json` changed concurrently after the initial snapshot; this executor did not write it, and both observed hashes are recorded without overwriting the parent receipt. New evidence and the new freeze are confined to this directory.

This bounded repair does not resolve the separate root SDK governance consumer diagnostic or establish full CI, live, graph projection, or storage lifecycle coverage. Parent independent review remains required before integration.
'''
(qa / 'report.md').write_text(report)
artifacts = [{'file': str(path.relative_to(root)), 'sha256': sha(path.read_bytes())} for path in sorted(qa.iterdir()) if path.is_file() and path.name != 'source-freeze.json']
freeze = {'status': 'FINAL_SOURCE_FREEZE_PENDING_PARENT_INDEPENDENT_REVIEW', 'frozenAt': now, 'head': subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=root, text=True).strip(), 'sourceFiles': products, 'hostCompilerConfig': verification['hostCompilerConfig'], 'checks': [{'name': item['name'], 'exitCode': item['exitCode']} for item in records], 'testCounts': counts, 'preservation': preserved, 'artifacts': artifacts, 'scope': 'Two own-property expressions only; new compiler-compatibility QA only; no staging/commit/deployment/live operations.'}
(qa / 'source-freeze.json').write_text(json.dumps(freeze, indent=2) + '\n')
print(json.dumps({'frozenAt': now, 'sourceFiles': products, 'preservation': preserved, 'testCounts': counts}, indent=2))
