"""Independent phase-one public fixture review; all mounted inputs are readonly."""
import hashlib
import json
import os
from pathlib import Path
import stat
import sys

ROOT = Path('/owned')
SOURCE = Path('/source')
FIELDS = ('st_dev', 'st_ino', 'st_mode', 'st_nlink', 'st_uid', 'st_gid', 'st_size', 'st_mtime_ns', 'st_ctime_ns')
FREEZE_SHA = '2fb8d11a7e6c0bcaf92b2fe8d7ff228a6e554f9241c07c22079e6be8bcc870ef'
APPROVAL_SHA = 'b452d7a77591651bb71c9e768db3ff3e3367654a79ecbbf3f07ad850cf6bdef6'
held = []

def ident(s):
    return {name: str(getattr(s, name)) for name in FIELDS}

def canonical(path, base):
    assert path == base or base in path.parents
    assert path.resolve() == path
    parent = base
    assert stat.S_ISDIR(parent.lstat().st_mode) and not parent.is_symlink()
    for part in path.relative_to(base).parts[:-1]:
        parent /= part
        assert stat.S_ISDIR(parent.lstat().st_mode) and not parent.is_symlink()

def read_held(path, base, mode=None):
    canonical(path, base)
    before = path.lstat()
    assert stat.S_ISREG(before.st_mode) and before.st_nlink == 1
    assert (before.st_uid, before.st_gid) == (501, 20)
    if mode is not None:
        assert stat.S_IMODE(before.st_mode) == mode
    fd = os.open(path, os.O_RDONLY | os.O_NOFOLLOW)
    held.append((path, fd, ident(before)))
    assert ident(os.fstat(fd)) == ident(before)
    parts = []
    while True:
        part = os.read(fd, 1048576)
        if not part:
            break
        parts.append(part)
    content = b''.join(parts)
    assert len(content) == before.st_size
    assert ident(os.fstat(fd)) == ident(path.lstat()) == ident(before)
    return content, ident(before)

def check_dirs(base, empty=False):
    rows = []
    for root, dirs, files in os.walk(base, followlinks=False):
        p = Path(root)
        s = p.lstat()
        assert stat.S_ISDIR(s.st_mode) and not p.is_symlink()
        assert (s.st_uid, s.st_gid, stat.S_IMODE(s.st_mode)) == (501, 20, 0o700)
        fd = os.open(p, os.O_RDONLY | os.O_NOFOLLOW | os.O_DIRECTORY)
        assert ident(os.fstat(fd)) == ident(s)
        held.append((p, fd, ident(s)))
        if empty:
            assert not dirs and not files
        rows.append({'path': str(p.relative_to(ROOT)), 'identityDecimal': ident(s)})
        for name in dirs + files:
            assert not (p / name).is_symlink()
    return rows

try:
    assert os.getuid() == 501 and os.getgid() == 20
    assert Path('/sys/fs/cgroup/memory.max').read_text().strip() == '536870912'
    assert Path('/sys/fs/cgroup/memory.swap.max').read_text().strip() == '0'
    assert set(p.name for p in ROOT.iterdir()) == {'candidate', 'private', 'public-transfer-receipt.json'}
    directories = check_dirs(ROOT)
    assert not list((ROOT / 'private').iterdir())
    receipt_bytes, receipt_identity = read_held(ROOT / 'public-transfer-receipt.json', ROOT, 0o600)
    receipt = json.loads(receipt_bytes)
    assert receipt['scope'] == 'NEW_PROSPECTIVE_LINUX_PUBLIC_CANDIDATE_CUSTODY_ONLY'
    assert receipt['sourceFreezeSha256'] == FREEZE_SHA
    assert receipt['actualServiceRequests'] == 0 and receipt['privateBytesCopied'] is False
    assert receipt['qualificationAccepted'] is False and receipt['baselineGeneratedCompared'] is True
    transfer = {r['path']: r for r in receipt['files']}
    assert len(transfer) == len(receipt['files']) == 972
    freeze_bytes, _ = read_held(ROOT / 'candidate/candidate-freeze-attempt3.json', ROOT, 0o600)
    assert hashlib.sha256(freeze_bytes).hexdigest() == FREEZE_SHA
    freeze = json.loads(freeze_bytes)
    assert len(freeze['files']) == 965
    expected = {r['path']: r for r in freeze['files']}
    assert len(expected) == 965
    approval_bytes, _ = read_held(ROOT / 'candidate/independent-preparation-review.json', ROOT, 0o600)
    assert hashlib.sha256(approval_bytes).hexdigest() == APPROVAL_SHA
    approval = json.loads(approval_bytes)
    assert approval['verdict'] == 'PASS' and approval['independent'] is True
    assert approval['scope'] == 'BOUNDED_03_FOUNDATION_CURRENT_DELTA_PREPARATION'
    assert approval['candidateSha256'] == FREEZE_SHA
    baseline_bytes, _ = read_held(ROOT / 'candidate/managed-fixture-copy-manifest.json', ROOT, 0o600)
    baseline = json.loads(baseline_bytes)
    mutable = {r['copy']: r for r in baseline['files'] if r.get('officialCodegenMutable') is True}
    names = {'managed-fixture/fixture/convex/_generated/' + n for n in ['api.d.ts', 'api.js', 'dataModel.d.ts', 'server.d.ts', 'server.js']}
    assert set(mutable) == names and set(freeze['mutableOfficialCodegenOnly']) == names
    expected.update(mutable)
    expected['candidate-freeze-attempt3.json'] = {'sha256': FREEZE_SHA, 'bytes': len(freeze_bytes)}
    expected['independent-preparation-review.json'] = {'sha256': APPROVAL_SHA, 'bytes': len(approval_bytes)}
    actual = set()
    for root, dirs, files in os.walk(ROOT / 'candidate', followlinks=False):
        actual.update(str((Path(root) / n).relative_to(ROOT / 'candidate')) for n in files)
    assert actual == set(expected) == set(transfer) and len(actual) == 972
    rows = []
    aliases = set()
    source_historical_drift = []
    for name in sorted(actual):
        row = expected[name]
        content, current = read_held(ROOT / 'candidate' / name, ROOT, 0o600)
        digest = hashlib.sha256(content).hexdigest()
        assert (digest, len(content)) == (row['sha256'], row['bytes'])
        old = transfer[name]
        assert (old['sha256'], old['bytes']) == (digest, len(content))
        assert old['destinationIdentityDecimal'] == current
        alias = (current['st_dev'], current['st_ino'])
        assert alias not in aliases
        aliases.add(alias)
        source, source_id = read_held(SOURCE / name, SOURCE)
        assert (hashlib.sha256(source).hexdigest(), len(source)) == (digest, len(content))
        if source_id != old['sourceIdentityDecimal']:
            source_historical_drift.append({'path': name, 'changedFields': [k for k in FIELDS if source_id[k] != old['sourceIdentityDecimal'][k]], 'cause': 'UNKNOWN'})
        rows.append({'path': name, 'sha256': digest, 'bytes': len(content), 'identityDecimal': current, 'sourceCurrentIdentityDecimal': source_id, 'destinationAll9EqualsTransfer': True})
    assert sum(r['bytes'] for r in rows) == 25212514
    for path, fd, before in held:
        assert ident(os.fstat(fd)) == ident(path.lstat()) == before
    result = {'status': 'PASS', 'scope': 'ACTUAL_PUBLIC_LINUX_CUSTODY_ONLY', 'files': rows, 'fileCount': len(rows), 'bytes': sum(r['bytes'] for r in rows), 'sourceFreezeSha256': FREEZE_SHA, 'approvalSha256': APPROVAL_SHA, 'transferReceiptSha256': hashlib.sha256(receipt_bytes).hexdigest(), 'transferReceiptCurrentIdentityDecimal': receipt_identity, 'directories': directories, 'currentDestinationAll9': 'PASS', 'heldSourcePathContinuity': 'PASS', 'currentSourceContentEquality': 'PASS', 'historicalSourceTupleObservation': {'status': 'FAIL' if source_historical_drift else 'PASS', 'drifts': source_historical_drift, 'scope': 'Transfer-time Linux source tuples only; drift cause unknown; not a Task03 operational verdict'}, 'baselineGenerated': {'status': 'PASS', 'files': sorted(names), 'classification': 'PUBLIC_MANUAL_PRECODEGEN_BASELINE_ONLY'}, 'privateChild': 'EMPTY_NO_BYTE_READS', 'actualMemoryBytes': 536870912, 'actualSwapMaxBytes': 0, 'sourceAndDestinationMutations': 0, 'serviceRequests': 0, 'qualificationAccepted': False, 'fullTask03': 'OPEN'}
    print(json.dumps(result))
    sys.stdout.flush()
    for path, fd, before in held:
        assert ident(os.fstat(fd)) == ident(path.lstat()) == before
finally:
    for _, fd, _ in held:
        os.close(fd)
