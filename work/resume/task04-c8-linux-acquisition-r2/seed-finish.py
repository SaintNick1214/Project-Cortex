"""Transfer only three new finalized completion/seal helpers into owned Linux."""
import json
import os
from pathlib import Path
from acquire_lib import held

target = Path('/repair/finish-tools')
if target.exists():
    raise ValueError('EXCLUSIVE_FINAL_HELPER_NAMESPACE_REQUIRED')
maximum = Path('/sys/fs/cgroup/memory.max').read_text().strip()
current = Path('/sys/fs/cgroup/memory.current').read_text().strip()
if not maximum.isdecimal() or not current.isdecimal() or int(maximum) - int(current) < 134217728:
    raise ValueError('MEASURED_LITERAL_RESERVE_HOLD')
target.mkdir(mode=0o700)
rows = []
for name in ('acquire_lib.py', 'finish-source-baseline.py', 'seal-final-linux.py'):
    source = Path('/tool-source') / name
    chunks = []
    before = held(source, chunks.append)
    path = target / name
    with open(path, 'xb') as stream:
        os.chmod(path, 0o600)
        stream.write(b''.join(chunks))
        stream.flush()
        os.fsync(stream.fileno())
    after = held(path, lambda _: None)
    if before['sha256'] != after['sha256'] or before['bytes'] != after['bytes']:
        raise ValueError('SOURCE_CONTENT_COPY')
    rows.append({'readOnlyHostSource': before, 'freshOwnedLinuxBaseline': after})
raw = (json.dumps({'helpersAndPermissionsFinalizedBeforeOwnedBaseline': True, 'sources': rows, 'previousOwnedHelpersChanged': False}, indent=2) + '\n').encode()
with open(target / 'source-initialization.json', 'xb') as stream:
    os.chmod(stream.name, 0o600)
    stream.write(raw)
    stream.flush()
    os.fsync(stream.fileno())
print(json.dumps({'status': 'FINAL_THREE_HELPERS_COPIED_FRESH_LINUX_BASELINE', 'files': len(rows)}))
