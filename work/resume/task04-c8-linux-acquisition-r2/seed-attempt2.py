"""Copy finalized attempt2 helper sources into a separate exclusive namespace."""
import json
import os
from pathlib import Path
from acquire_lib import held

target = Path('/repair/attempt2')
if target.exists():
    raise ValueError('EXCLUSIVE_NEW_ATTEMPT_NAMESPACE_REQUIRED')
maximum = Path('/sys/fs/cgroup/memory.max').read_text().strip()
current = Path('/sys/fs/cgroup/memory.current').read_text().strip()
if not maximum.isdecimal() or not current.isdecimal() or int(maximum) - int(current) < 134217728:
    raise ValueError('MEASURED_PYTHON_RESERVE_HOLD')
target.mkdir(mode=0o700)
(target / 'tools').mkdir(mode=0o700)
(target / 'report').mkdir(mode=0o700)
rows = []
for source in sorted(Path('/tool-source').glob('*.py')):
    chunks = []
    before = held(source, chunks.append)
    path = target / 'tools' / source.name
    with open(path, 'xb') as stream:
        os.chmod(path, 0o600)
        stream.write(b''.join(chunks))
        stream.flush()
        os.fsync(stream.fileno())
    after = held(path, lambda _: None)
    if before['sha256'] != after['sha256'] or before['bytes'] != after['bytes']:
        raise ValueError('SOURCE_CONTENT_COPY')
    rows.append({'readOnlyHostSource': before, 'ownedLinuxSource': after})
raw = (json.dumps({'freshAttempt2Only': True, 'failedAttempt1Preserved': True, 'volumeRootUID': os.stat('/repair').st_uid, 'volumeRootGID': os.stat('/repair').st_gid, 'volumeRootMode': oct(os.stat('/repair').st_mode & 0o777), 'sourceBaselines': rows}, indent=2) + '\n').encode()
with open(target / 'report/source-initialization.json', 'xb') as stream:
    os.chmod(stream.name, 0o600)
    stream.write(raw)
    stream.flush()
    os.fsync(stream.fileno())
print(json.dumps({'status': 'ATTEMPT2_SOURCE_ONLY_INITIALIZED', 'files': len(rows)}))
