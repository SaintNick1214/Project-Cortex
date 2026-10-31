"""Final Linux seal after all helper files and permissions are settled."""
import json
import os
from pathlib import Path
from acquire_lib import held, identity

root = Path('/repair')
output = root / 'final-linux-packet-manifest.json'
# Create the excluded self-seal inode before directory identity/membership PRE.
# Filling that same file later changes no parent directory entry.
fd = os.open(output, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600)
try:
    files, directories = [], []
    for directory, dirs, names in os.walk(root, followlinks=False):
        path = Path(directory)
        before = os.lstat(path)
        if path.is_symlink() or before.st_uid != os.getuid():
            raise ValueError('OWNED_LITERAL_DIRECTORY_REQUIRED')
        directories.append({'path': str(path), 'members': sorted(dirs + names), 'PRE': identity(before)})
        for name in sorted(names):
            path = Path(directory) / name
            if path != output:
                files.append(held(path, lambda _: None))
    for row in directories:
        row['POST'] = identity(os.lstat(row['path']))
        if row['PRE'] != row['POST'] or sorted(os.listdir(row['path'])) != row['members']:
            raise ValueError('LITERAL_DIRECTORY_POST_DRIFT')
    result = {'scope': 'FRESH_OWNED_LINUX_ACQUISITION_SOURCE_BASELINE_ONLY', 'exclusiveDockerVolume': 'cortex-runtime-c8-r2-acquisition-20261005-01', 'files': files, 'literalDirectories': directories, 'selfExcludedFile': str(output), 'helpersAndPermissionsFinalBeforeSeal': True, 'failedC8PinsRefreshed': False, 'priorTwoHelperFailuresPreserved': True, 'FULL8OrHIST70020Materialized': False, 'candidateOrCompilerOrConsumerExecuted': False, 'original122': 'HELD', 'native20': 'HELD', 'whole120': 'HELD', 'ROOT': 'ABSENT'}
    raw = (json.dumps(result, indent=2) + '\n').encode()
    at = 0
    while at < len(raw):
        written = os.write(fd, raw[at:])
        if not written:
            raise ValueError('SEAL_WRITE')
        at += written
    os.fsync(fd)
finally:
    os.close(fd)
for row in directories:
    if identity(os.lstat(row['path'])) != row['POST'] or sorted(os.listdir(row['path'])) != row['members']:
        raise ValueError('DIRECTORY_AFTER_SELF_SEAL_DRIFT')
proof = held(output, lambda _: None)
print(json.dumps({'path': str(output), 'bytes': proof['bytes'], 'sha256': proof['sha256'], 'files': len(files), 'directories': len(directories), 'freshLinuxNinePREPOST': True}))
