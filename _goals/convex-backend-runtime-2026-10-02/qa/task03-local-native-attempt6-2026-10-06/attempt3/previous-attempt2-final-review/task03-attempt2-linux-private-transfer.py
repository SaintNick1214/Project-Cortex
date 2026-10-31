"""Transport only the current operation's three private files; print no contents."""
import hashlib
import json
import os
from pathlib import Path
import stat

FIELDS = ('st_dev', 'st_ino', 'st_mode', 'st_nlink', 'st_uid', 'st_gid', 'st_size', 'st_mtime_ns', 'st_ctime_ns')
source = Path('/secret')
destination = Path('/owned/private')
assert os.getuid() == 501 and os.getgid() == 20
assert destination.is_dir() and not destination.is_symlink() and not list(destination.iterdir())
for directory in (source, destination):
    s = directory.lstat()
    assert s.st_uid == 501 and s.st_gid == 20 and stat.S_IMODE(s.st_mode) == 0o700

def identity(s):
    return {name: str(getattr(s, name)) for name in FIELDS}

rows = []
for name in ('jwt-private.pem', 'target.json', 'deploy.env'):
    path = source / name
    before = path.lstat()
    assert stat.S_ISREG(before.st_mode) and before.st_nlink == 1
    assert before.st_uid == 501 and before.st_gid == 20 and stat.S_IMODE(before.st_mode) == 0o600
    assert 0 < before.st_size <= 65536
    fd = os.open(path, os.O_RDONLY | os.O_NOFOLLOW)
    try:
        assert identity(before) == identity(os.fstat(fd))
        with os.fdopen(os.dup(fd), 'rb') as stream:
            content = stream.read()
        assert len(content) == before.st_size
        assert identity(before) == identity(os.fstat(fd)) == identity(path.lstat())
    finally:
        os.close(fd)
    if name == 'target.json':
        target = json.loads(content)
        assert target['operation'] == '511363b3-8cec-4e98-95d8-ecd4865457a8'
        assert target['requestSha256'] == 'e085a6822de67476645f04d89f5ca6b8951ab845ae1b0663382abfbef95a13c2'
        assert target['projectSlug'] == 'cortex-foundation-delta-cd358019d808' and target['teamId'] == 325340
        assert target['kind'] == 'cloud' and target['deploymentType'] == 'dev'
        assert target['active'] is True and target['retired'] is False and target['deleted'] is False
        assert target['isolationVerified'] is True and target['freshManagedProject'] is True
        assert target['productionDeployment'] is False and target['sharedCiTarget'] is False
    dest = destination / name
    out = os.open(dest, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600)
    try:
        with os.fdopen(out, 'wb', closefd=False) as stream:
            stream.write(content)
            stream.flush()
        os.fsync(out)
        after = os.fstat(out)
        assert after.st_uid == 501 and after.st_gid == 20 and after.st_nlink == 1 and stat.S_IMODE(after.st_mode) == 0o600
    finally:
        os.close(out)
    check = os.open(dest, os.O_RDONLY | os.O_NOFOLLOW)
    try:
        assert identity(after) == identity(os.fstat(check)) == identity(dest.lstat())
        with os.fdopen(os.dup(check), 'rb') as stream:
            digest = hashlib.file_digest(stream, 'sha256').hexdigest()
        assert digest == hashlib.sha256(content).hexdigest()
        assert identity(after) == identity(os.fstat(check)) == identity(dest.lstat())
    finally:
        os.close(check)
    rows.append({'path': name, 'bytes': len(content), 'sha256': digest, 'sourceIdentityDecimal': identity(before), 'destinationIdentityDecimal': identity(after)})
receipt = {'scope': 'NEW_PROSPECTIVE_CURRENT_OPERATION_PRIVATE_TRANSPORT_ONLY', 'files': rows, 'privateContentsPrinted': False, 'actualServiceRequests': 0, 'qualificationAccepted': False}
with Path('/owned/private-transfer-receipt.json').open('x') as stream:
    json.dump(receipt, stream, indent=2)
    stream.write('\n')
    stream.flush()
    os.fsync(stream.fileno())
print(json.dumps({'scope': receipt['scope'], 'files': len(rows), 'privateContentsPrinted': False, 'actualServiceRequests': 0}))
