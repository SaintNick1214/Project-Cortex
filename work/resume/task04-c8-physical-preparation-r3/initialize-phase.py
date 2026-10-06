"""Exclusive source-helper transfer only; no cohort or subject import/evaluation."""
import hashlib
import json
import os
from pathlib import Path
import stat
import sys

from acquire_lib import held, identity, read_json
from phase_resource import admission

ROOT = Path('/var/tmp/cortex-task04-c8-r3-phase')
SOURCE = Path('/tool-source')
FILES = ('acquire_lib.py', 'capture-binding.py', 'held_runtime.py', 'materialize-cohort.py',
         'phase-holder.py', 'phase_resource.py', 'initialize-phase.py', 'plan.json')


def main():
    os.umask(0o077)
    if os.getuid() != 0 or os.getgid() != 0 or any(ROOT.iterdir()):
        raise ValueError('DISTINCT_EMPTY_UID0_SOURCE_VOLUME_REQUIRED')
    plan, source_plan = read_json(SOURCE / 'plan.json')
    before = admission(ROOT, plan['physicalAdmissionMaxBytes'])
    disk = os.statvfs(ROOT)
    if disk.f_favail < plan['filesystemAdditionalInodeMax']:
        raise ValueError('SOURCE_PHASE_INODE_ADMISSION_HOLD')
    os.chmod(ROOT, 0o700)
    for directory in ('tools', 'bin', 'bindings', 'home', 'infra', 'physical-receipts'):
        (ROOT / directory).mkdir(mode=0o700)
    transfers = []
    for name in FILES:
        target = ROOT / 'tools' / name
        with open(target, 'xb') as output:
            os.chmod(target, 0o600)
            source = held(SOURCE / name, output.write)
            output.flush(); os.fsync(output.fileno())
        current = held(target, lambda _: None)
        if source['sha256'] != current['sha256'] or source['bytes'] != current['bytes']:
            raise ValueError('FINITE_HELPER_TRANSFER_EOF_HASH_SIZE')
        transfers.append({'source': source, 'freshOwned': current, 'pastPhysicalAuthorityAdopted': False})
    # PATH entries are exact literal aliases or finite infrastructure wrappers.
    os.symlink('/usr/local/bin/node', ROOT / 'bin/node')
    os.symlink('/usr/local/bin/python3.12', ROOT / 'bin/python3.12')
    wrappers = []
    for name, cli in [('npm', 'npm-cli.js'), ('npx', 'npx-cli.js')]:
        actual_cli = Path('/usr/local/bin', name).resolve(strict=True)
        if actual_cli.name != cli or not actual_cli.is_file():
            raise ValueError('ACTUAL_CANONICAL_NPM_ALIAS_REQUIRED')
        raw = ('#!/bin/sh\nexec /usr/local/bin/node ' + str(actual_cli) + ' "$@"\n').encode()
        path = ROOT / 'bin' / name
        with open(path, 'xb') as output:
            os.chmod(path, 0o700); output.write(raw); output.flush(); os.fsync(output.fileno())
        wrappers.append(held(path, lambda _: None))
    after = admission(ROOT, plan['physicalAdmissionMaxBytes'])
    result = {'scope': 'NEW_VOLUME_FINITE_HELPER_TRANSFER_ONLY_NOT_RUNTIME_AUTHORITY',
              'uid': os.getuid(), 'gid': os.getgid(), 'root': identity(os.lstat(ROOT)),
              'resourcePRE': before, 'resourcePOST': after, 'sourcePlan': source_plan,
              'transfers': transfers, 'literalWrapperSources': wrappers,
              'physicalCohortsMaterialized': False, 'subjectImportedOrEvaluated': False,
              'imageOverlayRuntimePins': 'NOT_CAPTURED_HERE; RETAINED_PHASE_CONTAINER_REQUIRED', 'ROOT': 'ABSENT'}
    path = ROOT / 'bindings/initialization.json'
    with open(path, 'xb') as output:
        os.chmod(path, 0o600); output.write((json.dumps(result, indent=2)+'\n').encode()); output.flush(); os.fsync(output.fileno())
    pin = held(path, lambda _: None)
    print(json.dumps({'status': 'FINITE_INFRASTRUCTURE_HELPER_TRANSFER_COMPLETE', **pin}))


if __name__ == '__main__':
    main()
