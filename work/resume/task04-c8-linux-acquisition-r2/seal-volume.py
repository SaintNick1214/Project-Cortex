"""Final fresh held-FD Linux seal, after every helper/permission/output is final."""
import json
import os
from pathlib import Path
import sys
from acquire_lib import held

def main():
    if len(sys.argv) != 1:
        raise ValueError('FIXED_OWNED_ACQUISITION_SEAL_ONLY')
    root = Path('/repair')
    output = root / 'report/linux-packet-manifest.json'
    files, directories = [], []
    for directory, dirs, names in os.walk(root, followlinks=False):
        path = Path(directory)
        if path.is_symlink() or path.stat().st_uid != os.getuid():
            raise ValueError('OWNED_LITERAL_DIRECTORY_REQUIRED')
        directories.append({'path': str(path), 'members': sorted(dirs + names)})
        for name in sorted(names):
            path = Path(directory) / name
            if path == output:
                continue
            files.append(held(path, lambda _: None))
    result = {'scope': 'FRESH_OWNED_LINUX_CONTENT_SOURCE_BASELINE_ONLY', 'filesystem': 'EXCLUSIVE_DOCKER_VOLUME', 'files': files, 'literalDirectoriesBeforeSelfSeal': directories, 'selfExcluded': str(output), 'failedC8Pins': 'PRESERVED_NONAUTHORITATIVE_NOT_REFRESHED', 'original122': 'HELD', 'native20': 'HELD', 'whole120': 'HELD', 'ROOT': 'ABSENT', 'candidateExecuted': False}
    raw = (json.dumps(result, indent=2) + '\n').encode()
    with open(output, 'xb') as stream:
        os.chmod(output, 0o600)
        stream.write(raw)
        stream.flush()
        os.fsync(stream.fileno())
    proof = held(output, lambda _: None)
    print(json.dumps({'path': str(output), 'sha256': proof['sha256'], 'bytes': proof['bytes'], 'files': len(files), 'completeLinuxNinePREPOST': True}))

if __name__ == '__main__':
    main()
