"""Initialize only this exclusive acquisition volume with finalized helpers."""
import hashlib
import json
import os
from pathlib import Path
import platform
import sys
from acquire_lib import held

def main():
    source = Path('/tool-source')
    target = Path('/repair')
    if len(sys.argv) != 1 or platform.system() != 'Linux' or platform.machine() != 'x86_64' or list(target.iterdir()):
        raise ValueError('EXCLUSIVE_EMPTY_X64_VOLUME_REQUIRED')
    resource = {name: Path('/sys/fs/cgroup', name).read_text() for name in ('memory.max', 'memory.current', 'memory.stat', 'memory.events')}
    maximum, current = resource['memory.max'].strip(), resource['memory.current'].strip()
    disk = os.statvfs(target)
    mounts = Path('/proc/self/mountinfo').read_text()
    mount_rows = [line for line in mounts.splitlines() if line.split()[4] == '/repair']
    if len(mount_rows) != 1 or mount_rows[0].split(' - ', 1)[1].split()[0] in ('tmpfs', 'ramfs'):
        raise ValueError('OWNED_DISK_BACKED_VOLUME_REQUIRED')
    if not maximum.isdecimal() or not current.isdecimal() or int(maximum) - int(current) < 134217728 or disk.f_bavail * disk.f_frsize < 256 * 1048576:
        raise ValueError('FRESH_RESOURCE_PREFLIGHT_HOLD')
    os.chmod(target, 0o700)
    (target / 'tools').mkdir(mode=0o700)
    (target / 'report').mkdir(mode=0o700)
    rows = []
    for path in sorted(source.glob('*.py')):
        chunks = []
        before = held(path, chunks.append)
        raw = b''.join(chunks)
        destination = target / 'tools' / path.name
        with open(destination, 'xb') as stream:
            os.chmod(destination, 0o600)
            stream.write(raw)
            stream.flush()
            os.fsync(stream.fileno())
        after = held(destination, lambda _: None)
        if after['bytes'] != before['bytes'] or after['sha256'] != before['sha256']:
            raise ValueError('FRESH_LINUX_HELPER_CONTENT_COPY')
        rows.append({'hostReadonlySourceRead': before, 'ownedLinuxSource': after})
    receipt = {'scope': 'NEW_OWNED_LINUX_SOURCE_BASELINE_NOT_FAILED_C8_PIN_REFRESH', 'resourcePRE': resource, 'diskAvailableBytes': disk.f_bavail * disk.f_frsize, 'volumeMount': mount_rows[0], 'helpers': rows, 'allPermissionsFinalizedBeforeOwnedBaseline': True, 'candidateImported': False}
    raw = (json.dumps(receipt, indent=2) + '\n').encode()
    path = target / 'report/volume-initialization.json'
    with open(path, 'xb') as stream:
        os.chmod(path, 0o600)
        stream.write(raw)
        stream.flush()
        os.fsync(stream.fileno())
    print(json.dumps({'status': 'INITIALIZED_ACQUISITION_VOLUME_ONLY', 'helperFiles': len(rows), 'receiptSHA256': hashlib.sha256(raw).hexdigest(), 'receiptBytes': len(raw)}))

if __name__ == '__main__':
    main()
