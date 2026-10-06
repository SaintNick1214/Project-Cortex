"""Reviewed finite public candidate acquisition; no credentials/services/CLI."""
from pathlib import Path
import hashlib
import importlib.util
import json
import os

R = Path('/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion')
Q = R / '_goals/convex-backend-runtime-2026-10-02/qa/task03-local-native-attempt5-2026-10-06'
P = Q / 'coordinate-source/repair3'
OUT = P / 'task03-attempt5-public-acquisition'
OP = 'ba2253a8-26a7-4db5-b503-9bca6710471c'
VOLUME = 'cortex-task03-attempt5-fixture-20261006-ba2253a8-r3'
IMAGE = 'sha256:9ff43bfe7849197a6dfbaa80f2d11a34db4202d8aaae269ddc8b740f7da75fb3'
FREEZE = '053e131a8f408031af7ead1e2c8c73f75954ba5acd905eac9e6091a24429e570'
HELPER = P / 'task03-attempt5-linux-public-transfer.py'
COMMON = P / 'task03-attempt5-coordinate-common.py'
MANAGEMENT_REVIEW = R / '_goals/convex-backend-runtime-2026-10-02/qa/local-resume-2026-10-05/task03-attempt5-management-review.json'
DOCKER = '/usr/local/bin/docker'
NAMES = {'init': 'cortex-task03-attempt5-public-init-ba2253a8-r3', 'copy': 'cortex-task03-attempt5-public-copy-ba2253a8-r3'}
ENV = {**os.environ, 'CORTEX_COORDINATOR_CWD': str(R)}
records = []

# Only these exact daemon representations are supported. No normalization,
# symlink resolution, suffix test, parent source or arbitrary alias is allowed.
SOURCE_MAPPINGS = {'literal': '', 'docker-desktop-host_mnt': '/host_mnt'}

def command(label, argv, timeout=30, required=True):
    row, stdout, stderr = C.run(label, argv, OUT, timeout, ENV, required=False)
    records.append(row)
    assert row['terminal'] is True and not row['closeErrors'] and row['failureClass'] is None, 'owned coordinator group unknown; custody remains held'
    assert type(row['exitCode']) is int
    if required:
        assert row['exitCode'] == 0, 'bounded public command failed'
    return row, stdout, stderr

def inspect_owned(obj, name):
    assert name in NAMES.values()
    assert obj['Name'] == '/' + name
    assert obj['Config']['Labels'] == {'cortex.operation': OP, 'cortex.scope': 'public-candidate-only'}
    assert obj['Image'] == obj['Config']['Image'] == IMAGE
    assert isinstance(obj['Id'], str) and len(obj['Id']) == 64 and all(c in '0123456789abcdef' for c in obj['Id'])
    assert type(obj['State']['Running']) is bool

def inspect(name, label):
    _, raw, _ = command(label, [DOCKER, 'inspect', name])
    rows = json.loads(raw)
    assert type(rows) is list and len(rows) == 1
    obj = rows[0]
    inspect_owned(obj, name)
    return obj

def assert_recipe(obj, label, user, argv, selected_mapping=None, initial_id=None):
    inspect_owned(obj, NAMES[label])
    assert obj['Platform'] == 'linux' and obj['Config']['User'] == user
    assert obj['Config']['Entrypoint'] is None
    assert obj['Config']['Cmd'] == ['/usr/local/bin/python3.12', '-B', *argv]
    assert obj['State']['Running'] is False
    assert obj['State']['OOMKilled'] is False
    if initial_id is not None:
        assert obj['Id'] == initial_id
    host = obj['HostConfig']
    assert host['NetworkMode'] == 'none' and host['ReadonlyRootfs'] is True
    for field, expected in [('Memory', 536870912), ('MemorySwap', 536870912), ('PidsLimit', 64), ('NanoCpus', 2000000000)]:
        assert type(host[field]) is int and host[field] == expected
    expected_volume = {'Type': 'volume', 'Source': VOLUME, 'Target': '/owned', 'VolumeOptions': {'NoCopy': True}}
    mounts = host['Mounts']
    assert type(mounts) is list and len(mounts) == (1 if label == 'init' else 3)
    assert mounts[0]['VolumeOptions']['NoCopy'] is True
    assert mounts[0] == expected_volume
    if label == 'init':
        mapping = 'volume-only'
    else:
        choices = []
        for mapping_name, prefix in SOURCE_MAPPINGS.items():
            expected_binds = [{'Type': 'bind', 'Source': prefix + str(source), 'Target': target, 'ReadOnly': True}
                              for source, target in [(Q, '/input'), (P, '/helper')]]
            if all(m['ReadOnly'] is True for m in mounts[1:]) and mounts[1:] == expected_binds:
                choices.append(mapping_name)
        assert len(choices) == 1, 'exact consistent daemon source mapping required'
        mapping = choices[0]
    if selected_mapping is not None:
        assert mapping == selected_mapping, 'terminal daemon source mapping changed'
    actual = obj['Mounts']
    assert type(actual) is list and len(actual) == len(mounts)
    assert all(type(m['RW']) is bool for m in actual)
    by_target = {m['Destination']: m for m in actual}
    assert len(by_target) == len(actual)
    assert set(by_target) == ({'/owned'} if label == 'init' else {'/owned', '/input', '/helper'})
    volume = by_target['/owned']
    assert volume['Type'] == 'volume' and volume['Name'] == VOLUME
    assert volume['Source'] == '/var/lib/docker/volumes/' + VOLUME + '/_data'
    assert volume['Driver'] == 'local' and volume['RW'] is True
    if label == 'copy':
        prefix = SOURCE_MAPPINGS[mapping]
        for source, target in [(Q, '/input'), (P, '/helper')]:
            mount = by_target[target]
            assert mount['Type'] == 'bind' and mount['Source'] == prefix + str(source) and mount['RW'] is False
    return mapping

def execute(label, user, mounts, argv, timeout):
    name = NAMES[label]
    command(label + '-create', [DOCKER, 'create', '--name', name, '--label', 'cortex.operation=' + OP,
            '--label', 'cortex.scope=public-candidate-only', '--platform', 'linux/amd64', '--network', 'none',
            '--memory', '512m', '--memory-swap', '512m', '--cpus', '2', '--pids-limit', '64', '--read-only',
            '--user', user, *mounts, IMAGE, '/usr/local/bin/python3.12', '-B', *argv])
    initial = inspect(name, label + '-initial-inspect')
    mapping = assert_recipe(initial, label, user, argv)
    C.durable_json(OUT / (label + '-initial-recipe.json'), {'containerId': initial['Id'], 'selectedDaemonSourceMapping': mapping,
                   'requestedLiteralSources': {} if label == 'init' else {'/input': str(Q), '/helper': str(P)},
                   'HostConfigMounts': initial['HostConfig']['Mounts'], 'actualMounts': initial['Mounts']})
    row, stdout, _ = command(label + '-run', [DOCKER, 'start', '--attach', name], timeout, required=False)
    terminal = inspect(name, label + '-terminal-inspect')
    assert_recipe(terminal, label, user, argv, selected_mapping=mapping, initial_id=initial['Id'])
    assert type(terminal['State']['ExitCode']) is int
    assert row['exitCode'] == terminal['State']['ExitCode'] == 0
    command(label + '-remove', [DOCKER, 'rm', name])
    return stdout

if __name__ == '__main__':
    assert os.getuid() == 501 and os.getgid() == 20
    approval = json.loads((P / 'independent-public-coordinator-source-review.json').read_bytes())
    assert approval['verdict'] == 'PASS' and approval['independent'] is True
    assert approval['scope'] == 'TASK03_PUBLIC_RECIPE_SOURCE_ONLY'
    for path in [Path(__file__), COMMON, HELPER]:
        assert hashlib.sha256(path.read_bytes()).hexdigest() == approval['sources'][path.name]
    for file, scope in [(Q/'independent-preparation-review.json','BOUNDED_03_FOUNDATION_CURRENT_DELTA_PREPARATION'),
                        (MANAGEMENT_REVIEW,'TASK03_DISPOSABLE_TARGET_MANAGEMENT_ONLY')]:
        review = json.loads(file.read_bytes())
        assert review['verdict'] == 'PASS' and review['independent'] is True and review['scope'] == scope
        assert review['candidateSha256'] == FREEZE
        assert hashlib.sha256(file.read_bytes()).hexdigest() == approval['dependencies'][file.name]
    assert hashlib.sha256((Q/'candidate-freeze-attempt5.json').read_bytes()).hexdigest() == FREEZE
    spec = importlib.util.spec_from_file_location('bounded_public_coordinator', COMMON)
    C = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(C)
    OUT.mkdir(mode=0o700)
    success = False
    primary_failure = None
    cleanup_errors = []
    volume_created = False
    try:
        _, raw, _ = command('daemon-memory', [DOCKER, 'info', '--format', '{{json .MemTotal}}'])
        assert int(raw) >= 2147483648
        _, raw, _ = command('running-container-ids', [DOCKER, 'ps', '--quiet'])
        assert raw.strip() == b'', 'other active containers require separate resource admission'
        _, raw, _ = command('immutable-image', [DOCKER, 'image', 'inspect', IMAGE])
        image = json.loads(raw)[0]
        assert image['Id'] == IMAGE and image['Architecture'] == 'amd64' and image['Os'] == 'linux'
        row, _, stderr = command('volume-absence', [DOCKER, 'volume', 'inspect', VOLUME], required=False)
        assert row['exitCode'] == 1 and b'no such volume' in stderr.lower()
        _, raw, _ = command('volume-create', [DOCKER, 'volume', 'create', '--label', 'cortex.goal=convex-backend-runtime-2026-10-02', '--label', 'cortex.operation=' + OP, VOLUME])
        assert raw.strip().decode() == VOLUME
        _, raw, _ = command('volume-initial-inspect', [DOCKER, 'volume', 'inspect', VOLUME])
        assert json.loads(raw)[0]['Labels']['cortex.operation'] == OP
        volume_created = True
        volume_mount = ['--mount', 'type=volume,source=' + VOLUME + ',target=/owned,volume-nocopy']
        init = "import os,json; from pathlib import Path; p=Path('/owned'); assert os.getuid()==0 and os.getgid()==0; assert p.is_dir() and not p.is_symlink() and not list(p.iterdir()); assert Path('/sys/fs/cgroup/memory.max').read_text().strip()=='536870912'; assert Path('/sys/fs/cgroup/memory.swap.max').read_text().strip()=='0'; os.chown(p,501,20); p.chmod(0o700); print(json.dumps({'status':'PASS','sourceMounts':0,'privateReads':0}))"
        execute('init', '0:0', volume_mount, ['-c', init], 30)
        copied = execute('copy', '501:20', [*volume_mount,
                          '--mount', 'type=bind,source=' + str(Q) + ',target=/input,readonly',
                          '--mount', 'type=bind,source=' + str(P) + ',target=/helper,readonly'],
                          ['/helper/' + HELPER.name], 120)
        result = json.loads(copied)
        assert result['files'] == 1912 and result['sourceFreezeSha256'] == FREEZE
        assert result['actualServiceRequests'] == 0 and result['privateBytesCopied'] is False
        success = True
    except BaseException as error:
        primary_failure = type(error).__name__
    finally:
        for label, name in NAMES.items():
            try:
                row, raw, stderr = command('final-inspect-' + label, [DOCKER, 'inspect', name], required=False)
                if row['exitCode'] == 0 and row['failureClass'] is None:
                    obj = json.loads(raw)[0]
                    inspect_owned(obj, name)
                    if obj['State']['Running']:
                        command('final-kill-' + label, [DOCKER, 'kill', name])
                    _, raw, _ = command('final-terminal-' + label, [DOCKER, 'inspect', name])
                    terminal = json.loads(raw)[0]
                    inspect_owned(terminal, name)
                    assert terminal['Id'] == obj['Id'] and terminal['State']['Running'] is False
                    command('final-remove-' + label, [DOCKER, 'rm', name])
                elif row['exitCode'] != 1 or b'no such object' not in stderr.lower() or row['failureClass'] is not None:
                    raise RuntimeError('owned_public_container_state_unknown')
            except BaseException as error:
                cleanup_errors.append({'label': label, 'failureClass': type(error).__name__})
        try:
            _, raw, _ = command('final-owned-running', [DOCKER, 'ps', '--quiet', '--filter', 'label=cortex.operation=' + OP])
            assert raw.strip() == b''
            until = C.datetime.datetime.now(C.datetime.timezone.utc).isoformat()
            command('owned-events', [DOCKER, 'events', '--since', records[0]['observedAtUtc'], '--until', until,
                    '--filter', 'label=cortex.operation=' + OP, '--format', '{{json .}}'])
            if volume_created:
                _, raw, _ = command('retained-public-volume-inspect', [DOCKER, 'volume', 'inspect', VOLUME])
                assert json.loads(raw)[0]['Labels']['cortex.operation'] == OP
        except BaseException as error:
            cleanup_errors.append({'label': 'final-resources', 'failureClass': type(error).__name__})
        C.durable_json(OUT / 'commands.json', {'operation': OP, 'volume': VOLUME, 'commands': records,
                        'status': 'PASS' if success and not cleanup_errors else 'FAIL', 'custodyReview': 'REQUIRED',
                        'failureClass': primary_failure, 'cleanupErrors': cleanup_errors,
                        'credentialReads': 0, 'serviceCalls': 0, 'CLI': False, 'nativeFoundationAccepted': False})
    if not success or cleanup_errors:
        raise SystemExit(1)
    print(json.dumps({'status': 'PASS', 'scope': 'ACTUAL_PUBLIC_CONTENT_ACQUISITION_ONLY',
                      'volume': VOLUME, 'files': 1912, 'custodyReview': 'REQUIRED'}))
