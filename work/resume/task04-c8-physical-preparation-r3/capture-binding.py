"""Capture only current retained-container infrastructure/source authority."""
import gzip
import hashlib
import json
import os
from pathlib import Path
import platform
import re
import resource
import select
import traceback
import sqlite3
import ssl
import stat
import subprocess
import sys
import tarfile
import time
import urllib.request
import zlib

from acquire_lib import held, identity, read_json
from phase_resource import admission

ROOT = Path('/var/tmp/cortex-task04-c8-r3-phase')
IMAGE = 'sha256:9ff43bfe7849197a6dfbaa80f2d11a34db4202d8aaae269ddc8b740f7da75fb3'


def literal_alias(path):
    """Hold an actual Linux O_PATH FD for a literal symlink."""
    before = os.lstat(path)
    fd = os.open(path, os.O_PATH | os.O_NOFOLLOW)
    try:
        pre = os.fstat(fd)
        target = os.fsencode(os.readlink('', dir_fd=fd))
        post = os.fstat(fd)
        path_post = os.lstat(path)
    finally:
        os.close(fd)
    if not stat.S_ISLNK(pre.st_mode) or identity(before) != identity(pre):
        raise ValueError('LITERAL_LINK_FD_BINDING')
    if identity(pre) != identity(post) or identity(post) != identity(path_post):
        raise ValueError('LITERAL_LINK_FD_DRIFT')
    return {'path': str(path), 'targetHex': target.hex(), 'targetBytes': len(target),
            'targetSHA256': hashlib.sha256(target).hexdigest(),
            'PRE': identity(pre), 'POST': identity(post),
            'pathPOST': identity(path_post), 'heldO_PATH': True}


def process(pid):
    text = Path('/proc', str(pid), 'stat').read_text()
    fields = text[text.rfind(')') + 2:].split()
    argv = Path('/proc', str(pid), 'cmdline').read_bytes()
    return {'pid': pid, 'stat': text, 'startTime': fields[19],
            'ppid': fields[1], 'pgid': fields[2], 'sid': fields[3],
            'rawArgvHex': argv.hex(), 'rawArgvSHA256': hashlib.sha256(argv).hexdigest()}


def main():
    if len(sys.argv) != 2 or not re.fullmatch('[a-f0-9]{64}', sys.argv[1]):
        raise ValueError('ACTUAL_RETAINED_CONTAINER_ID_REQUIRED')
    if os.getuid() != 0 or platform.machine() != 'x86_64':
        raise ValueError('OWNED_LINUX_X64_BINDING_ONLY')
    output = ROOT / 'bindings/runtime-binding.json'
    if output.exists():
        raise ValueError('DISTINCT_NEW_BINDING_NO_REFRESH')
    plan, plan_proof = read_json(ROOT / 'tools/plan.json')
    resources_pre = admission(ROOT, plan['physicalAdmissionMaxBytes'])
    if os.environ.get('HOME') != str(ROOT / 'home') or os.stat(ROOT / 'home').st_uid != 0:
        raise ValueError('LEGITIMATE_OWNED_CONTAINER_HOME_REQUIRED')
    owner_pre = process(1)
    expected = ['/usr/local/bin/python3.12', '-B', str(ROOT / 'tools/phase-holder.py')]
    if bytes.fromhex(owner_pre['rawArgvHex']).split(b'\0')[:-1] != [s.encode() for s in expected]:
        raise ValueError('RETAINED_OWNER_RAW_ARGV')
    owner_pidfd = os.pidfd_open(1)
    started = time.monotonic()
    versions = {}
    for name, argv in [
        ('node', ['/usr/local/bin/node', '--version']),
        ('npm', ['/usr/local/bin/node', str(Path('/usr/local/bin/npm').resolve()), '--version']),
    ]:
        admission(ROOT, plan['physicalAdmissionMaxBytes'], plan['nodeReserveBytes'])
        run = subprocess.run(argv, capture_output=True, timeout=30,
                             env={**os.environ, 'npm_config_update_notifier': 'false',
                                  'npm_config_cache': str(ROOT / 'infra/npm-cache')})
        if run.returncode or len(run.stdout) + len(run.stderr) > 256000:
            raise ValueError('INFRASTRUCTURE_VERSION_OBSERVATION_FAILED')
        versions[name] = {'argv': argv, 'exitCode': run.returncode,
                          'stdout': run.stdout.decode(), 'stderr': run.stderr.decode()}
        versions[name]['resourcePOST'] = admission(ROOT, plan['physicalAdmissionMaxBytes'], plan['nodeReserveBytes'])
    if versions['node']['stdout'].strip() != 'v24.15.0' or versions['npm']['stdout'].strip() != '12.2.0':
        raise ValueError('AUTHORIZED_PROSPECTIVE_INFRASTRUCTURE_VERSION')
    files, aliases, origins, directories = {}, {}, [], []

    def capture(path):
        path = Path(path)
        if not path.is_absolute():
            raise ValueError('ABSOLUTE_RUNTIME_SOURCE_ORIGIN_REQUIRED')
        cursor = Path('/')
        for component in path.parts[1:]:
            cursor /= component
            if cursor.is_symlink():
                aliases.setdefault(str(cursor), literal_alias(cursor))
        actual = path.resolve(strict=True)
        if str(actual) not in files:
            files[str(actual)] = held(actual, lambda _: None)
        return str(actual)

    for path in ['/usr/local/bin/node', '/usr/local/bin/python3.12', '/bin/sh',
                 '/usr/local/bin/npm', '/usr/local/bin/npx']:
        capture(path)
    for path in sorted((ROOT / 'tools').iterdir()):
        capture(path)
    for path in sorted((ROOT / 'bin').iterdir()):
        capture(path)
    seal, seal_proof = read_json(Path('/r2/final-linux-packet-manifest.json'))
    if any(seal_proof[key] != plan['r2SealPin'][key] for key in ('bytes', 'sha256', 'PRE', 'POST', 'pathPOST')):
        raise ValueError('SEALED_R2_ACTUAL_SOURCE_PIN_DRIFT_NOT_REPINNED')
    capture('/r2/final-linux-packet-manifest.json')
    r2_by_path = {row['path']: row for row in seal['files']}
    r2_metadata_observations = []
    for relative in plan['r2MetadataPaths']:
        path = Path('/r2') / relative
        actual = capture(path)
        current = files[actual]
        old = r2_by_path['/repair/' + relative]
        if any(current[key] != old[key] for key in ('bytes', 'sha256', 'PRE', 'POST', 'pathPOST')):
            raise ValueError('SEALED_R2_NEEDED_METADATA_PIN_DRIFT_NOT_REPINNED')
        r2_metadata_observations.append({'oldLiteralPath': old['path'], 'currentLiteralPath': actual, 'allNineHashSizeEqual': True})
        admission(ROOT, plan['physicalAdmissionMaxBytes'])
    for relative in plan['c4MetadataPaths']:
        capture(Path('/source-repo') / relative)
    for name, module in sorted(sys.modules.items()):
        paths = []
        for origin in [getattr(module, '__file__', None),
                       getattr(getattr(module, '__spec__', None), 'origin', None),
                       getattr(module, '__cached__', None)]:
            if origin and Path(origin).is_absolute() and Path(origin).exists():
                paths.append(capture(origin))
        origins.append({'module': name, 'canonicalSourceAndCachedOrigins': sorted(set(paths)),
                        'builtinOrFrozen': not paths})
    maps = Path('/proc/self/maps').read_text()
    unresolved = []
    for line in maps.splitlines():
        values = line.split(maxsplit=5)
        if len(values) == 6 and values[5].startswith('/'):
            path = values[5]
            if Path(path).is_file():
                capture(path)
            else:
                unresolved.append({'mapLine': line, 'literalPath': path})
    npm_root = Path('/usr/local/bin/npm').resolve().parents[1]
    for directory, children, names in os.walk(npm_root, followlinks=False):
        parent = Path(directory)
        before = identity(os.lstat(parent))
        members = sorted(children + names)
        for name in names:
            capture(parent / name)
        for name in list(children):
            child = parent / name
            if child.is_symlink():
                capture(child)
                children.remove(name)
        directories.append({'path': str(parent), 'PRE': before, 'members': members})
    for directory in [ROOT / 'tools', ROOT / 'bin']:
        directories.append({'path': str(directory), 'PRE': identity(os.lstat(directory)),
                            'members': sorted(os.listdir(directory))})
    for row in files.values():
        if held(Path(row['path']), lambda _: None) != row:
            raise ValueError('ACTUAL_CURRENT_RUNTIME_OR_HELPER_DRIFT')
    for row in aliases.values():
        if literal_alias(Path(row['path'])) != row:
            raise ValueError('ACTUAL_LITERAL_ALIAS_DRIFT')
    for row in directories:
        row['POST'] = identity(os.lstat(row['path']))
        if row['PRE'] != row['POST'] or sorted(os.listdir(row['path'])) != row['members']:
            raise ValueError('FINITE_RUNTIME_DIRECTORY_DRIFT')
    owner_post = process(1)
    owner_stable = all(owner_pre[k] == owner_post[k]
                       for k in ('pid', 'startTime', 'ppid', 'pgid', 'sid', 'rawArgvHex'))
    if not owner_stable:
        raise ValueError('RETAINED_PHASE_OWNER_CHANGED')
    pidfd_info = Path('/proc/self/fdinfo', str(owner_pidfd)).read_text()
    os.close(owner_pidfd)
    result = {
        'status': 'CURRENT_RETAINED_CONTAINER_BINDING_READY_FOR_INDEPENDENT_REVIEW' if not unresolved else 'SOURCE_BINDING_HOLD_UNRESOLVED_LITERAL_MAPS',
        'containerID': sys.argv[1], 'immutableImageID': IMAGE,
        'platform': platform.platform(), 'machine': platform.machine(),
        'uid': os.getuid(), 'gid': os.getgid(), 'RLIMIT_NOFILE': resource.getrlimit(resource.RLIMIT_NOFILE),
        'versions': versions, 'pythonVersion': sys.version, 'sqliteVersion': sqlite3.sqlite_version,
        'PATH': os.environ['PATH'], 'HOME': os.environ.get('HOME'),
        'legitimateOwnedContainerHome': str(ROOT / 'home'),
        'homeDirectoryIdentity': identity(os.lstat(ROOT / 'home')),
        'npmExplicitInfrastructureEnvironment': {'npm_config_update_notifier': 'false', 'npm_config_cache': str(ROOT / 'infra/npm-cache')},
        'NODE_PATHAbsent': 'NODE_PATH' not in os.environ,
        'plan': plan_proof, 'resourcesPRE': resources_pre,
        'resourcesPOST': admission(ROOT, plan['physicalAdmissionMaxBytes']),
        'ownerPRE': owner_pre, 'ownerPOST': owner_post, 'ownerPidfdHeldDuringCapture': pidfd_info,
        'files': list(files.values()), 'literalAliases': list(aliases.values()),
        'sealedR2MetadataMountPathMapping': r2_metadata_observations,
        'literalDirectories': directories, 'pythonImports': origins, 'mappedRuntimeSources': maps,
        'unresolvedMappedPaths': unresolved, 'elapsedSeconds': time.monotonic() - started,
        'pastContainerPinsAdopted': False, 'imageHashSubstitutedForAllNine': False,
        'npmInventoryScope': 'FINITE_CURRENT_IMAGE_NPM_RUNTIME_ONLY_NOT_SUBJECT_PACKAGES',
        'bindingRelease': 'HELD_PENDING_FRESH_INDEPENDENT_REVIEW',
        'physicalCohortsMaterialized': False, 'candidateImportedOrEvaluated': False,
        'original122': 'HELD', 'native20': 'HELD', 'whole120': 'HELD', 'ROOT': 'ABSENT',
    }
    raw = (json.dumps(result, indent=2) + '\n').encode()
    if len(raw) > plan['bindingMetadataMaxBytes']:
        raise ValueError('BINDING_METADATA_CAPACITY_HOLD')
    with open(output, 'xb') as stream:
        os.chmod(output, 0o600)
        stream.write(raw)
        stream.flush()
        os.fsync(stream.fileno())
    proof = held(output, lambda _: None)
    print(json.dumps({'path': str(output), 'bytes': proof['bytes'], 'sha256': proof['sha256'],
                      'files': len(files), 'aliases': len(aliases),
                      'imports': len(origins), 'unresolvedMappedPaths': unresolved,
                      'owner': owner_post, 'physicalEffects': False}))


if __name__ == '__main__':
    os.umask(0o077)
    try:
        main()
    except BaseException as error:
        failure = {'status': 'FAILED_FRESH_INFRASTRUCTURE_BINDING_PRESERVED', 'type': type(error).__name__, 'message': str(error), 'traceback': traceback.format_exc(), 'subjectEffects': False, 'physicalMaterialization': False}
        try:
            failure['resource'] = admission(ROOT, 0)
        except BaseException as resource_error:
            failure['secondaryResourceError'] = str(resource_error)
        try:
            with open(ROOT / 'bindings/capture-failure.json', 'xb') as stream:
                os.chmod(stream.name, 0o600); stream.write((json.dumps(failure, indent=2) + '\n').encode()); stream.flush(); os.fsync(stream.fileno())
        except BaseException as receipt_error:
            error.add_note('SECONDARY_BINDING_FAILURE_RECEIPT:' + str(receipt_error))
        raise
