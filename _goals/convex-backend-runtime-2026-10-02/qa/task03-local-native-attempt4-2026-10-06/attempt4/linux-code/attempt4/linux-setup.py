"""Owned public dummy volume initialization. Code-only mount; no host input mount."""
import os
from pathlib import Path
import json

root = Path('/owned')
assert os.getuid() == 0 and os.getgid() == 0
assert list(root.iterdir()) == []
assert Path('/sys/fs/cgroup/memory.max').read_text().strip() == '536870912'
assert Path('/sys/fs/cgroup/memory.swap.max').read_text().strip() == '0'
os.chown(root, 501, 20)
root.chmod(0o700)
for name in ['native', 'receipts', 'destination', 'controls']:
    path = root / name
    path.mkdir(mode=0o700)
    os.chown(path, 501, 20)
foreign = root / 'foreign-owner'
foreign.mkdir(mode=0o700)
(foreign / 'foreign-baseline').write_text('PUBLIC FOREIGN DUMMY RETAINED\n')
(foreign / 'foreign-baseline').chmod(0o600)
print(json.dumps({'status': 'PASS', 'scope': 'OWNED_PUBLIC_DUMMY_VOLUME_ROOT_INITIALIZATION', 'rootUid': root.stat().st_uid, 'rootGid': root.stat().st_gid, 'exportMounted': False, 'privateReads': 0, 'serviceCalls': 0}))
