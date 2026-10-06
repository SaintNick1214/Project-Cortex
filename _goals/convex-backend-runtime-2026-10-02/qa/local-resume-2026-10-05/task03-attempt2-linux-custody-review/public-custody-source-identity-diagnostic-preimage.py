"""Independent read-only qualification of the named Linux public copy."""
import hashlib
import json
import os
from pathlib import Path
import stat

FIELDS = ('st_dev', 'st_ino', 'st_mode', 'st_nlink', 'st_uid', 'st_gid', 'st_size', 'st_mtime_ns', 'st_ctime_ns')
FREEZE = 'candidate-freeze-attempt2-repair1.json'
EXPECTED_FREEZE = 'cd5e0c71e1839f079906becb9c5e0a90aba2261890ec4fb7997bc2981db966f5'
INPUT, OWNED = Path('/input'), Path('/owned')

def identity(value):
    return {name: str(getattr(value, name)) for name in FIELDS}

def read_stable(base, name, destination=False):
    relative = Path(name)
    assert not relative.is_absolute() and '..' not in relative.parts and '.' not in relative.parts
    path = base / relative
    ancestor = base
    held = []
    try:
        for component in [None] + list(relative.parts[:-1]):
            if component is not None:
                ancestor /= component
            before = ancestor.lstat()
            assert stat.S_ISDIR(before.st_mode) and not ancestor.is_symlink()
            if destination:
                assert (before.st_uid, before.st_gid, stat.S_IMODE(before.st_mode)) == (501, 20, 0o700)
            fd = os.open(ancestor, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW)
            assert identity(before) == identity(os.fstat(fd))
            held.append((ancestor, fd, identity(before)))
        before = path.lstat()
        assert stat.S_ISREG(before.st_mode) and before.st_nlink == 1
        assert (before.st_uid, before.st_gid) == (501, 20)
        if destination:
            assert stat.S_IMODE(before.st_mode) == 0o600
        fd = os.open(path, os.O_RDONLY | os.O_NOFOLLOW)
        try:
            assert identity(before) == identity(os.fstat(fd))
            data = bytearray()
            digest = hashlib.sha256()
            while True:
                chunk = os.read(fd, 1048576)
                if not chunk:
                    break
                data.extend(chunk)
                digest.update(chunk)
            assert len(data) == before.st_size
            assert identity(before) == identity(os.fstat(fd)) == identity(path.lstat())
            for directory, directory_fd, original in held:
                assert original == identity(os.fstat(directory_fd)) == identity(directory.lstat())
            return bytes(data), digest.hexdigest(), identity(before)
        finally:
            os.close(fd)
    finally:
        for _, fd, _ in held:
            os.close(fd)

assert os.getuid() == 501 and os.getgid() == 20
assert set(p.name for p in OWNED.iterdir()) == {'candidate', 'private', 'public-transfer-receipt.json'}
private_stat = (OWNED / 'private').lstat()
assert stat.S_ISDIR(private_stat.st_mode) and not (OWNED / 'private').is_symlink()
assert (private_stat.st_uid, private_stat.st_gid, stat.S_IMODE(private_stat.st_mode)) == (501, 20, 0o700)
assert not list((OWNED / 'private').iterdir())
receipt_bytes, receipt_hash, receipt_identity = read_stable(OWNED, 'public-transfer-receipt.json', True)
receipt = json.loads(receipt_bytes)
assert receipt['scope'] == 'NEW_PROSPECTIVE_LINUX_PUBLIC_CANDIDATE_CUSTODY_ONLY'
assert receipt['sourceFreezeSha256'] == EXPECTED_FREEZE
assert receipt['baselineGeneratedCompared'] is True and receipt['qualificationAccepted'] is False
assert receipt['actualServiceRequests'] == 0 and receipt['privateBytesCopied'] is False
freeze_bytes, freeze_hash, _ = read_stable(OWNED / 'candidate', FREEZE, True)
assert freeze_hash == EXPECTED_FREEZE
freeze = json.loads(freeze_bytes)
assert len(freeze['files']) == 833 and freeze['actualExternalRequests'] == freeze['actualDeployments'] == 0
frozen = {row['path']: row for row in freeze['files']}
assert len(frozen) == 833
generated = {'managed-fixture/fixture/convex/_generated/' + name for name in ['api.d.ts', 'api.js', 'dataModel.d.ts', 'server.d.ts', 'server.js']}
names = set(frozen) | {FREEZE, 'independent-preparation-review.json'} | generated
assert len(names) == 840
rows = {row['path']: row for row in receipt['files']}
assert len(receipt['files']) == len(rows) == 840 and set(rows) == names
actual = set()
directories = []
for root, dirs, files in os.walk(OWNED / 'candidate', followlinks=False):
    root = Path(root)
    original = root.lstat()
    assert stat.S_ISDIR(original.st_mode) and not root.is_symlink()
    assert (original.st_uid, original.st_gid, stat.S_IMODE(original.st_mode)) == (501, 20, 0o700)
    directories.append({'path': str(root.relative_to(OWNED)), 'identityDecimal': identity(original)})
    for name in dirs:
        assert not (root / name).is_symlink()
    for name in files:
        path = root / name
        assert not path.is_symlink()
        actual.add(str(path.relative_to(OWNED / 'candidate')))
assert actual == names
baseline_bytes, _, _ = read_stable(OWNED / 'candidate', 'managed-fixture-copy-manifest.json', True)
baseline = {row['copy']: row for row in json.loads(baseline_bytes)['files'] if row.get('officialCodegenMutable') is True}
assert set(baseline) == generated and len(baseline) == 5
pins = dict(frozen)
pins.update(baseline)
results = []
for name in sorted(names):
    source, source_hash, source_identity = read_stable(INPUT, name)
    destination, destination_hash, destination_identity = read_stable(OWNED / 'candidate', name, True)
    row = rows[name]
    assert source == destination and source_hash == destination_hash == row['sha256']
    assert len(source) == len(destination) == row['bytes']
    assert source_identity == row['sourceIdentityDecimal'], json.dumps({'path': name, 'boundary': 'SOURCE_RECEIPT_IDENTITY', 'actual': source_identity, 'recorded': row['sourceIdentityDecimal']})
    assert destination_identity == row['destinationIdentityDecimal'], json.dumps({'path': name, 'boundary': 'DESTINATION_RECEIPT_IDENTITY', 'actual': destination_identity, 'recorded': row['destinationIdentityDecimal']})
    assert len(source_identity) == len(destination_identity) == 9
    if name in pins:
        assert source_hash == pins[name]['sha256'] and len(source) == pins[name]['bytes']
    results.append({'path': name, 'sha256': source_hash, 'bytes': len(source), 'sourceIdentityDecimal': source_identity, 'destinationIdentityDecimal': destination_identity, 'heldFdFullRead': True, 'allNineSourceAndDestinationStableAndReceiptExact': True})
review_bytes, _, _ = read_stable(OWNED / 'candidate', 'independent-preparation-review.json', True)
review = json.loads(review_bytes)
assert review['scope'] == 'BOUNDED_03_FOUNDATION_CURRENT_DELTA_PREPARATION' and review['verdict'] == 'PASS' and review['independent'] is True
assert review['candidateSha256'] == EXPECTED_FREEZE and review['average'] == 4.2
assert sum(row['bytes'] for row in results) == 24129478
for row in directories:
    assert row['identityDecimal'] == identity((OWNED / row['path']).lstat())
assert read_stable(OWNED, 'public-transfer-receipt.json', True)[1:] == (receipt_hash, receipt_identity)
assert not list((OWNED / 'private').iterdir())
print(json.dumps({'scope': 'INDEPENDENT_ACTUAL_LINUX_PUBLIC_CUSTODY_ONLY', 'verdict': 'PASS', 'freezeSha256': EXPECTED_FREEZE, 'files': results, 'directories': directories, 'bytes': 24129478, 'publicTransferReceiptSha256': receipt_hash, 'publicTransferReceiptIdentityDecimal': receipt_identity, 'generatedBaselineFiles': sorted(generated), 'privateDirectoryEmpty': True, 'privateBytesRead': False, 'uid': os.getuid(), 'gid': os.getgid(), 'actualServiceRequests': 0, 'prospectiveCustodyOnly': True}, indent=2))
