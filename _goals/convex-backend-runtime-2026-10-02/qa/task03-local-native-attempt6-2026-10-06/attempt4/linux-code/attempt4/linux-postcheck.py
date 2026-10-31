"""Public dummy held all-nine/full-content/ownership and retained failure observations."""
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import stat

spec = importlib.util.spec_from_file_location('acquisition', Path('/prep/attempt4/source-acquisition.py'))
A = importlib.util.module_from_spec(spec)
spec.loader.exec_module(A)
T = A.T
assert os.getuid() == 501 and os.getgid() == 20
assert Path('/sys/fs/cgroup/memory.max').read_text().strip() == '536870912'
assert Path('/sys/fs/cgroup/memory.swap.max').read_text().strip() == '0'
base = Path('/owned')
assert sorted(p.name for p in (base / 'native').iterdir()) == ['source-00000000-0000-0000-0000-000000000004']
source = base / 'native/source-00000000-0000-0000-0000-000000000004'
root, before, fd, held = T.open_sources(source, A.NAMES)
try:
    receipt = json.loads((base / 'receipts' / (source.name + '.json')).read_bytes())
    custody = json.loads((base / 'destination/private-receive-custody.json').read_bytes())
    assert receipt['nativeDirectoryIdentityDecimal'] == T.identity(before)
    assert receipt['hostTuplesAreNativeAuthority'] is False
    assert sorted(p.name for p in source.iterdir()) == sorted(A.NAMES)
    assert sorted(p.name for p in (base / 'destination').iterdir()) == sorted([*T.NAMES, 'private-receive-custody.json'])
    for row in held:
        saved = next(r for r in receipt['files'] if r['path'] == row['name'])
        assert saved['nativeIdentityDecimal'] == row['identity'] and saved['sha256'] == row['sha256']
        if row['name'] in T.NAMES:
            destination = base / 'destination' / row['name']
            saved_copy = next(r for r in custody['files'] if r['path'] == row['name'])
            assert saved_copy['sourceIdentityDecimal'] == row['identity']
            assert saved_copy['destinationIdentityDecimal'] == T.identity(destination.lstat())
            assert destination.read_bytes() == row['bytes']
    T.verify_sources(root, before, fd, held)
    print(json.dumps({'status': 'PASS', 'scope': 'ACTUAL_PUBLIC_DUMMY_LINUX_NATIVE_SOURCE_AND_UNCHANGED_HELPER_POSTCHECK', 'sourceFiles': 4, 'copiedFiles': 3, 'sourceAllNineAndFullContents': True, 'destinationAllNineAndFullContents': True, 'hostAuthorityTransplanted': False, 'nativeSourceIdentity': T.identity(before), 'sourceManifest': receipt, 'privateReads': 0, 'serviceCalls': 0}))
finally:
    for row in held:
        os.close(row['fd'])
    os.close(fd)
