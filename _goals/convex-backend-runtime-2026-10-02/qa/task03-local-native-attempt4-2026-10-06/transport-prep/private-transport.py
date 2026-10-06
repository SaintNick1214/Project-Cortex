"""Prospective held-source private transport. CLI emits only fixed status/counts.

The selected child is the owned trust boundary; Docker's synthetic bind root is
only a placement ancestor. Actual use requires separate preparation/management
PASS and actual public/private custody review before any CLI/service operation.
"""
import hashlib
import json
import os
from pathlib import Path
import stat
import sys

FIELDS = ('st_dev', 'st_ino', 'st_mode', 'st_nlink', 'st_uid', 'st_gid', 'st_size', 'st_mtime_ns', 'st_ctime_ns')
NAMES = ('jwt-private.pem', 'target.json', 'deploy.env')
MANIFEST = 'transport-stage.json'

def reject():
    raise ValueError('PRIVATE_TRANSPORT_FENCE_REJECTED')

def require(value):
    if not value:
        reject()

def identity(s):
    return {name: str(getattr(s, name)) for name in FIELDS}

def canonical(path):
    p = Path(path)
    require(p.is_absolute() and str(p) == os.path.abspath(p))
    for part in [*reversed(p.parents), p]:
        require(not part.is_symlink() and part.resolve(strict=True) == part)
    return p

def owned_directory(path):
    p = canonical(path); s = p.lstat()
    require(stat.S_ISDIR(s.st_mode) and s.st_uid == 501 and s.st_gid == 20 and stat.S_IMODE(s.st_mode) == 0o700)
    return p, s

def owned_file(s):
    require(stat.S_ISREG(s.st_mode) and s.st_nlink == 1 and s.st_uid == 501 and s.st_gid == 20 and stat.S_IMODE(s.st_mode) == 0o600 and 0 < s.st_size <= 65536)

def content(fd, expected_size):
    chunks = []; offset = 0
    while offset < expected_size:
        b = os.pread(fd, min(65536, expected_size - offset), offset)
        require(bool(b)); chunks.append(b); offset += len(b)
    require(not os.pread(fd, 1, expected_size))
    return b''.join(chunks)

def open_sources(directory, names):
    root, root_before = owned_directory(directory)
    root_fd = os.open(root, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW)
    held = []
    try:
        require(identity(root_before) == identity(os.fstat(root_fd)))
        for name in names:
            path = canonical(root / name); before = path.lstat(); owned_file(before)
            fd = os.open(name, os.O_RDONLY | os.O_NOFOLLOW, dir_fd=root_fd)
            try:
                require(identity(before) == identity(os.fstat(fd)))
                data = content(fd, before.st_size)
                require(identity(before) == identity(os.fstat(fd)) == identity(path.lstat()))
                held.append({'name': name, 'path': path, 'fd': fd, 'identity': identity(before), 'bytes': data, 'sha256': hashlib.sha256(data).hexdigest()})
            except BaseException:
                os.close(fd); raise
        return root, root_before, root_fd, held
    except BaseException:
        for row in held:
            os.close(row['fd'])
        os.close(root_fd); raise

def verify_sources(root, root_before, root_fd, held):
    canonical(root); owned_directory(root)
    require(identity(root_before) == identity(os.fstat(root_fd)) == identity(root.lstat()))
    for row in held:
        canonical(row['path']); owned_file(os.fstat(row['fd'])); owned_file(row['path'].lstat())
        require(row['identity'] == identity(os.fstat(row['fd'])) == identity(row['path'].lstat()))
        require(hashlib.sha256(content(row['fd'], len(row['bytes']))).hexdigest() == row['sha256'])
        check = os.open(row['name'], os.O_RDONLY | os.O_NOFOLLOW, dir_fd=root_fd)
        try:
            require(row['identity'] == identity(os.fstat(check)))
            require(hashlib.sha256(content(check, len(row['bytes']))).hexdigest() == row['sha256'])
            require(row['identity'] == identity(os.fstat(check)))
        finally:
            os.close(check)
        require(row['identity'] == identity(os.fstat(row['fd'])) == identity(row['path'].lstat()))
    require(identity(root_before) == identity(os.fstat(root_fd)) == identity(root.lstat()))

def binding_target(rows, binding):
    target = json.loads(next(row['bytes'] for row in rows if row['name'] == 'target.json'))
    for name in ('operation', 'requestSha256', 'projectSlug', 'projectName', 'teamId', 'privateEnvironmentFile'):
        require(target.get(name) == binding[name])
    require(target.get('kind') == 'cloud' and target.get('deploymentType') == 'dev')
    for name in ('active', 'isolationVerified', 'freshManagedProject'):
        require(target.get(name) is True)
    for name in ('retired', 'deleted', 'productionDeployment', 'sharedCiTarget'):
        require(target.get(name) is False)
    require(target.get('deploymentName') not in binding['forbiddenRetiredDeployments'])

def write_exact(root, root_fd, name, data):
    canonical(root); owned_directory(root)
    require(root.lstat().st_ino == os.fstat(root_fd).st_ino and root.lstat().st_dev == os.fstat(root_fd).st_dev)
    fd = os.open(name, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600, dir_fd=root_fd)
    try:
        offset = 0
        while offset < len(data):
            count = os.write(fd, data[offset:]); require(count > 0); offset += count
        os.fsync(fd); after = os.fstat(fd); owned_file(after)
    finally:
        os.close(fd)
    check = os.open(name, os.O_RDONLY | os.O_NOFOLLOW, dir_fd=root_fd)
    try:
        require(identity(after) == identity(os.fstat(check)) == identity((root / name).lstat()))
        require(content(check, len(data)) == data)
        require(identity(after) == identity(os.fstat(check)) == identity((root / name).lstat()))
    finally:
        os.close(check)
    return identity(after)

def copy_private(source, destination, binding, stage=False):
    require(os.getuid() == 501 and os.getgid() == 20)
    names = NAMES if stage else (*NAMES, MANIFEST)
    root, before, source_fd, held = open_sources(source, names)
    dest_fd = None
    try:
        if not stage:
            require(sorted(p.name for p in root.iterdir()) == sorted(names))
            manifest = json.loads(next(r['bytes'] for r in held if r['name'] == MANIFEST))
            require(manifest['operation'] == binding['operation'] and manifest['requestSha256'] == binding['requestSha256'])
            require(len(manifest['files']) == 3 and {r['path'] for r in manifest['files']} == set(NAMES))
            require(all(next(v for v in manifest['files'] if v['path'] == r['name'])['sha256'] == r['sha256'] for r in held if r['name'] in NAMES))
        binding_target(held, binding)
        dest, _ = owned_directory(destination); require(not list(dest.iterdir()))
        dest_fd = os.open(dest, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW)
        verify_sources(root, before, source_fd, held)
        rows = []
        for row in held:
            if row['name'] not in NAMES:
                continue
            destination_identity = write_exact(dest, dest_fd, row['name'], row['bytes'])
            rows.append({'path': row['name'], 'bytes': len(row['bytes']), 'sha256': row['sha256'], 'sourceIdentityDecimal': row['identity'], 'destinationIdentityDecimal': destination_identity})
        receipt = {'scope': 'NEW_PROSPECTIVE_PRIVATE_STAGE' if stage else 'NEW_PROSPECTIVE_LINUX_PRIVATE_RECEIVE', 'operation': binding['operation'], 'requestSha256': binding['requestSha256'], 'files': rows, 'sourceDescriptorHeld': True, 'sourceDirectoryOwnershipRequired': '501:20/0700', 'privateContentsPrinted': False, 'actualServiceRequests': 0, 'qualificationAccepted': False}
        write_exact(dest, dest_fd, MANIFEST if stage else 'private-receive-custody.json', (json.dumps(receipt, indent=2)+'\n').encode())
        os.fsync(dest_fd)
        # Revalidate original held/path identity and full content AFTER durable receipt.
        verify_sources(root, before, source_fd, held)
        owned_directory(dest); require(dest.lstat().st_ino == os.fstat(dest_fd).st_ino and dest.lstat().st_dev == os.fstat(dest_fd).st_dev)
        for row in rows:
            require(row['destinationIdentityDecimal'] == identity((dest / row['path']).lstat()))
            check = os.open(row['path'], os.O_RDONLY | os.O_NOFOLLOW, dir_fd=dest_fd)
            try:
                require(row['destinationIdentityDecimal'] == identity(os.fstat(check)))
                require(hashlib.sha256(content(check, row['bytes'])).hexdigest() == row['sha256'])
                require(row['destinationIdentityDecimal'] == identity(os.fstat(check)) == identity((dest / row['path']).lstat()))
            finally:
                os.close(check)
        return receipt
    finally:
        for row in held:
            os.close(row['fd'])
        os.close(source_fd)
        if dest_fd is not None:
            os.close(dest_fd)

if __name__ == '__main__':
    try:
        require(len(sys.argv) == 5 and sys.argv[1] in ('stage', 'receive'))
        binding = json.loads(canonical(sys.argv[4]).read_bytes())
        receipt = copy_private(sys.argv[2], sys.argv[3], binding, stage=sys.argv[1] == 'stage')
        print(json.dumps({'scope': receipt['scope'], 'status': 'PASS', 'files': 3, 'privateContentsPrinted': False, 'serviceCalls': 0}))
    except BaseException:
        print(json.dumps({'scope': 'PRIVATE_TRANSPORT_ONLY', 'status': 'FAIL', 'failureClass': 'private_transport_fence', 'privateContentsPrinted': False, 'serviceCalls': 0}))
        sys.exit(1)
