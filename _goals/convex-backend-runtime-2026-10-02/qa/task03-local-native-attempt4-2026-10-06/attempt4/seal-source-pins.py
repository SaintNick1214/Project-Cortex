"""Fresh complete public source/fixture/compiler conservation; no secret reads."""
import hashlib
import json
import os
from pathlib import Path
import stat
import subprocess

Q = Path(__file__).resolve().parents[1]
REPO = Q.parents[3]
OUT = Q / 'attempt4'
FIELDS = ('st_dev', 'st_ino', 'st_mode', 'st_nlink', 'st_uid', 'st_gid', 'st_size', 'st_mtime_ns', 'st_ctime_ns')

def identity(value):
    return {k: str(getattr(value, k)) for k in FIELDS}

def digest(path):
    before = path.lstat()
    assert stat.S_ISREG(before.st_mode) and before.st_nlink == 1 and path.resolve(strict=True) == path
    fd = os.open(path, os.O_RDONLY | os.O_NOFOLLOW)
    try:
        assert identity(before) == identity(os.fstat(fd))
        value = hashlib.sha256()
        count = 0
        while count < before.st_size:
            raw = os.read(fd, min(65536, before.st_size - count))
            assert raw
            value.update(raw)
            count += len(raw)
        assert not os.read(fd, 1)
        assert identity(before) == identity(os.fstat(fd)) == identity(path.lstat())
        return value.hexdigest()
    finally:
        os.close(fd)

copy = json.loads((OUT / 'copy-965-receipt.json').read_bytes())
old = Path(copy['source'])
delta = []
for row in copy['files']:
    assert digest(old / row['path']) == row['sha256']
    current = digest(Q / row['path'])
    if current != row['sha256']:
        pre = OUT / 'preimages' / row['path']
        assert digest(pre) == row['sha256']
        delta.append({'path': row['path'], 'oldSha256': row['sha256'], 'newSha256': current, 'exactPreimage': str(pre.relative_to(Q))})
assert len(copy['files']) == 965 and len(delta) == 10
source = json.loads((Q / 'source-inventory.json').read_bytes())['files']
assert len(source) == 161 and all(digest(REPO / r['path']) == r['sha256'] for r in source)
tests = json.loads((Q / 'source-pre.json').read_bytes())['files']
assert len(tests) == 155 and tests == json.loads((Q / 'source-post.json').read_bytes())['files']
assert all(digest(REPO / p) == h for p, h in tests.items())
copies = json.loads((Q / 'managed-fixture-copy-manifest.json').read_bytes())['files']
assert len(copies) == 138 and all(digest(REPO / r['source']) == digest(Q / r['copy']) == r['sha256'] for r in copies)
history = json.loads((Q / 'historical-script-provenance.json').read_bytes())['files']
assert len(history) == 23 and all(digest(REPO / r['historicalSource']) == r['sha256'] and (not r.get('preimage') or digest(Q / r['preimage']) == r['sha256']) for r in history)
compiler = json.loads((Q / 'attempt2/compiler-projection.json').read_bytes())
assert len(compiler['files']) == 114 and compiler['version'] == '6.0.3'
assert all(digest(REPO / r['source']) == digest(Q / r['copy']) == r['sha256'] for r in compiler['files'])
assert digest(Q / 'transport-prep/private-transport.py') == 'ecb1eff9a9edf025e2b7eb9108580857ff41da8bb54e8956251b219a5bebc23e'
for rel in ['scripts/deploy.mjs', 'scripts/driver.mjs', 'scripts/cleanup.mjs', 'scripts/child-toolchain.mjs', 'scripts/process-owner.mjs', 'scripts/native-engine.mjs', 'scripts/qualify.mjs', 'original-task03.md', 'dependency-allocation.md', 'path-ledger.json', 'attempt2/linux-cli-readiness-receipt.json']:
    assert digest(Q / rel) == digest(old / rel)
new = json.loads((OUT / 'check2/source-47-controls.stdout').read_bytes())
prior = json.loads((old / 'attempt3/source-47-controls.stdout').read_bytes())
assert new['status'] == 'PASS' and new['cases'] == 47 and [r['name'] for r in new['results']] == [r['name'] for r in prior['results']]
for rel in ['attempt2/affected-controls.mjs', 'attempt2-repair1/real-owned-custody-controls.mjs']:
    assert (Q / rel).read_text().replace('candidate-freeze-attempt4.json', 'candidate-freeze-attempt3.json') == (old / rel).read_text()
assert (Q / 'scripts/incidental-custody.mjs').read_text().replace('candidate-freeze-attempt4.json', 'candidate-freeze-attempt3.json') == (old / 'scripts/incidental-custody.mjs').read_text()
ledger = json.loads((Q / 'path-ledger.json').read_bytes())['cases']
assert len(ledger) == 275 and sum(r['visibility'] == 'public' for r in ledger) == 200 and sum(r['visibility'] == 'internal' for r in ledger) == 75
private = Path('/Users/SaintNick/.codex/tmp/cortex-runtime-task03-attempt4-private-20261006')
s = private.lstat()
k = (private / 'jwt-private.pem').lstat()
assert s.st_uid == k.st_uid == 501 and s.st_gid == k.st_gid == 20 and stat.S_IMODE(s.st_mode) == 0o700 and stat.S_IMODE(k.st_mode) == 0o600 and k.st_nlink == 1
assert not any((private / name).exists() for name in ['target.json', 'deploy.env', 'created-project.json', 'provision-attempt.json', 'ownership.json'])
freeze = json.loads((OUT / 'ancestry/candidate-freeze-attempt3.json').read_bytes())
result = {'scope': 'NEW_ATTEMPT4_SOURCE_PREPARATION_ONLY', 'status': 'PASS', 'actualHead': subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=REPO, text=True).strip(), 'previousFreezeSha256': copy['sourceFreezeSha256'], 'previousMembers': 965, 'currentExactMembers': 955, 'explicitDeltas': delta, 'allPreviousBytesRecoverable': True, 'sourcePins': 161, 'testSourcePins': 155, 'managedCopies': 138, 'compilerProjection': 114, 'historicalReferences': 23, 'privateHelperUnchangedSha256': digest(Q / 'transport-prep/private-transport.py'), 'allOriginal47NamesAndAssertionsRetained': True, 'current275Public200Internal75': True, 'requiredConservedCounts': freeze['requiredConservedCounts'], 'requiredRuntimeBounds': '120s CLI/codegen/typecheck-enable;21min driver/20min native/12s-call/10000RPC/320rows/16subjects/2storage64bytes/2cleanup/all5empty policy tables/ProcessOwner reaping; paid calls0', 'reused1005Tests': 'REUSED_EXACT_SOURCE_DISCOVERY_SKIP_DEPENDENCY_PINS_NOT_RERUN', 'reusedReadinessAndTyping': 'EXACT_COMPILER114_AND_PRIOR_2GiB_LINUX_HOME0700_RECEIPTS_NOT_RERUN', 'newPrivateMetadata': {'directoryIdentity': identity(s), 'keyIdentity': identity(k), 'targetEnvOwnershipProvisionAbsent': True, 'keyBytesRead': False}, 'productWrites': 0, 'oldNamespaceWrites': 0, 'actualCredentialReads': 0, 'actualServiceCalls': 0, 'officialCLI': 'NOT_RUN', 'nativeCases': 'NOT_RUN', 'fullTask03': 'OPEN'}
(OUT / 'conservation-receipt.json').write_text(json.dumps(result, indent=2) + '\n')
print(json.dumps({'status': 'PASS', 'previousMembers': 965, 'currentExactMembers': 955, 'exactPreimages': 10, 'sourcePins': 161, 'testPins': 155, 'copies': 138, 'compiler': 114, 'historicalReferences': 23, 'privateKeyReads': 0, 'services': 0}))
