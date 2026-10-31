"""Infrastructure capture launcher; explicit owned TMPDIR/environment binding."""
import json
import os
from pathlib import Path
import sys

ROOT = Path('/var/tmp/cortex-task04-c8-r3-phase')
TEMP = ROOT / 'infra/capture-temp-a2'

if __name__ == '__main__':
    os.umask(0o077)
    if os.getuid() != 0 or os.environ.get('TMPDIR') != str(TEMP) or TEMP.resolve() != TEMP or os.stat(TEMP).st_uid != 0:
        raise ValueError('EXPLICIT_CANONICAL_OWNED_DISK_TEMP_DIRECTORY_REQUIRED')
    if len(sys.argv) != 2:
        raise ValueError('ACTUAL_CONTAINER_ID_REQUIRED')
    raw = (json.dumps({'scope': 'ACTUAL_EFFECTIVE_CAPTURE_ENVIRONMENT_INHERITED_BY_EXEC', 'environment': dict(os.environ), 'TMPDIR': str(TEMP), 'uid': os.getuid(), 'gid': os.getgid(), 'oldFailure': 'CAPTURE_ATTEMPT1_EXIT133_PRESERVED'}, indent=2)+'\n').encode()
    extra = sum((ROOT / p).stat().st_size for p in ('bin/npm', 'bin/npx', 'tools/capture-with-owned-temp.py', 'tools/source-phase-entry.py')) + len(raw)
    if extra > 8192:
        raise ValueError('FINITE_WRAPPER_AND_ENVIRONMENT_INPUT_BOUND_HOLD')
    path = ROOT / 'tools/capture-effective-environment.json'
    with open(path, 'xb') as stream:
        os.chmod(path, 0o600); stream.write(raw); stream.flush(); os.fsync(stream.fileno())
    os.execv('/usr/local/bin/python3.12', ['/usr/local/bin/python3.12', '-B', str(ROOT / 'tools/capture-binding.py'), sys.argv[1]])
