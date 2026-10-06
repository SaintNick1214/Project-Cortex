"""Measured source-phase admission; no subject or cohort effects."""
import json
import os
from pathlib import Path
import sys


def admission(root, required_disk, required_reserve=134217728, include_mount=True):
    values = {
        name: Path('/sys/fs/cgroup', name).read_text()
        for name in ('memory.max', 'memory.current', 'memory.stat', 'memory.events')
    }
    maximum = values['memory.max'].strip()
    current = values['memory.current'].strip()
    if not maximum.isdecimal() or not current.isdecimal():
        raise ValueError('FINITE_MEASURED_CGROUP_REQUIRED')
    disk = os.statvfs(root)
    result = {
        'memory': values,
        'reserveBytes': int(maximum) - int(current),
        'requiredReserveBytes': required_reserve,
        'diskAvailableBytes': disk.f_bavail * disk.f_frsize,
        'requiredDiskBytes': required_disk,
        'phaseRoot': str(root),
        'uid': os.getuid(),
        'gid': os.getgid(),
        'mountinfo': Path('/proc/self/mountinfo').read_text(),
    }
    if result['reserveBytes'] < required_reserve:
        raise ValueError('MEASURED_LITERAL_RESERVE_HOLD')
    if result['diskAvailableBytes'] < required_disk:
        raise ValueError('EXACT_PHASE_DISK_ADMISSION_HOLD')
    mount = [line for line in result['mountinfo'].splitlines()
             if line.split()[4] == str(root)]
    if len(mount) != 1 or mount[0].split(' - ')[1].split()[0] in ('tmpfs', 'ramfs'):
        raise ValueError('EXCLUSIVE_DISK_BACKED_PHASE_MOUNT_REQUIRED')
    if not include_mount:
        result.pop('mountinfo')
    return result


if __name__ == '__main__':
    root = Path('/var/tmp/cortex-task04-c8-r3-phase')
    plan = json.loads((root / 'tools/plan.json').read_text())
    print(json.dumps(admission(root, plan['physicalAdmissionMaxBytes'])))
