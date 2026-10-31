"""Copy the independently reviewed finite public candidate into a fresh owned volume."""
import hashlib
import json
import os
from pathlib import Path
import stat

EXPECTED_FREEZE = '1030329b0f57cfb98de6135c4b8de7031d11a5c856fe56fa2d1d57d05d144799'
FREEZE_NAME = 'candidate-freeze-attempt4.json'
FIELDS = ('st_dev', 'st_ino', 'st_mode', 'st_nlink', 'st_uid', 'st_gid', 'st_size', 'st_mtime_ns', 'st_ctime_ns')
SOURCE = Path('/input')
OWNED = Path('/owned')

def identity(s):
    return {name: str(getattr(s, name)) for name in FIELDS}

def read_owned_source(name):
    p = Path(name)
    assert not p.is_absolute() and '..' not in p.parts
    path = SOURCE / p
    part = SOURCE
    for component in p.parts[:-1]:
        part /= component
        assert stat.S_ISDIR(part.lstat().st_mode) and not part.is_symlink()
    before = path.lstat()
    assert stat.S_ISREG(before.st_mode) and before.st_nlink == 1
    assert before.st_uid == 501 and before.st_gid == 20
    fd = os.open(path, os.O_RDONLY | os.O_NOFOLLOW)
    try:
        assert identity(before) == identity(os.fstat(fd))
        chunks = []
        while True:
            data = os.read(fd, 1048576)
            if not data:
                break
            chunks.append(data)
        content = b''.join(chunks)
        assert identity(before) == identity(os.fstat(fd)) == identity(path.lstat())
        assert len(content) == before.st_size
        return content, identity(before)
    finally:
        os.close(fd)

assert OWNED.is_dir() and not OWNED.is_symlink() and not list(OWNED.iterdir())
freeze_bytes, _ = read_owned_source(FREEZE_NAME)
assert hashlib.sha256(freeze_bytes).hexdigest() == EXPECTED_FREEZE
freeze = json.loads(freeze_bytes)
assert len(freeze['files']) == 1338 and freeze['actualExternalRequests'] == freeze['actualDeployments'] == 0
review_bytes, _ = read_owned_source('independent-preparation-review.json')
review = json.loads(review_bytes)
assert review['verdict'] == 'PASS' and review['independent'] is True
assert review['scope'] == 'BOUNDED_03_FOUNDATION_CURRENT_DELTA_PREPARATION'
assert review['candidateSha256'] == EXPECTED_FREEZE
expected = {row['path']: row for row in freeze['files']}
assert len(expected) == 1338
generated = ['managed-fixture/fixture/convex/_generated/' + n for n in ['api.d.ts', 'api.js', 'dataModel.d.ts', 'server.d.ts', 'server.js']]
names = list(expected) + [FREEZE_NAME, 'independent-preparation-review.json'] + generated
assert len(names) == len(set(names)) == 1345
baseline_bytes, _ = read_owned_source('managed-fixture-copy-manifest.json')
baseline_pin = expected['managed-fixture-copy-manifest.json']
assert len(baseline_bytes) == baseline_pin['bytes'] and hashlib.sha256(baseline_bytes).hexdigest() == baseline_pin['sha256']
baseline = {row['copy']: row for row in json.loads(baseline_bytes)['files'] if row.get('officialCodegenMutable') is True}
assert set(baseline) == set(generated) and len(baseline) == 5
expected.update(baseline)
os.chown(OWNED, 501, 20)
os.chmod(OWNED, 0o700)
candidate = OWNED / 'candidate'
candidate.mkdir(mode=0o700)
for name in ('private', 'native', 'receipts'):
    (OWNED / name).mkdir(mode=0o700)
rows = []
for name in names:
    content, source_identity = read_owned_source(name)
    digest = hashlib.sha256(content).hexdigest()
    if name in expected:
        assert digest == expected[name]['sha256'] and len(content) == expected[name]['bytes']
    path = candidate / name
    path.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600)
    try:
        with os.fdopen(fd, 'wb', closefd=False) as stream:
            stream.write(content)
            stream.flush()
        os.fchown(fd, 501, 20)
        os.fchmod(fd, 0o600)
        os.fsync(fd)
        after = os.fstat(fd)
        assert after.st_uid == 501 and after.st_gid == 20 and after.st_nlink == 1
        rows.append({'path': name, 'sha256': digest, 'bytes': len(content), 'sourceIdentityDecimal': source_identity, 'destinationIdentityDecimal': identity(after)})
    finally:
        os.close(fd)
for root, dirs, files in os.walk(OWNED):
    os.chown(root, 501, 20)
    os.chmod(root, 0o700)
for row in rows:
    path = candidate / row['path']
    fd = os.open(path, os.O_RDONLY | os.O_NOFOLLOW)
    try:
        assert row['destinationIdentityDecimal'] == identity(os.fstat(fd)) == identity(path.lstat())
        with os.fdopen(os.dup(fd), 'rb') as stream:
            assert hashlib.file_digest(stream, 'sha256').hexdigest() == row['sha256']
        assert row['destinationIdentityDecimal'] == identity(os.fstat(fd)) == identity(path.lstat())
    finally:
        os.close(fd)
receipt = {'scope': 'NEW_PROSPECTIVE_LINUX_PUBLIC_CANDIDATE_CUSTODY_ONLY', 'sourceFreezeSha256': EXPECTED_FREEZE, 'files': rows, 'baselineGeneratedCompared': True, 'actualServiceRequests': 0, 'qualificationAccepted': False, 'privateBytesCopied': False}
path = OWNED / 'public-transfer-receipt.json'
with path.open('x') as stream:
    json.dump(receipt, stream, indent=2)
    stream.write('\n')
    stream.flush()
    os.fsync(stream.fileno())
os.chown(path, 501, 20)
os.chmod(path, 0o600)
print(json.dumps({'scope': receipt['scope'], 'files': len(rows), 'bytes': sum(row['bytes'] for row in rows), 'sourceFreezeSha256': EXPECTED_FREEZE, 'uid': 501, 'gid': 20, 'actualServiceRequests': 0, 'privateBytesCopied': False}))
