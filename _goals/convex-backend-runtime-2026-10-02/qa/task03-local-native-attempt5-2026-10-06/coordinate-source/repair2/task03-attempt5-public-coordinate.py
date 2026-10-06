"""Reviewed finite public candidate acquisition; no credentials/services/CLI."""
from pathlib import Path
import hashlib
import importlib.util
import json
import os

R = Path('/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion')
Q = R / '_goals/convex-backend-runtime-2026-10-02/qa/task03-local-native-attempt5-2026-10-06'
P = Q / 'coordinate-source/repair2'
OUT = P / 'task03-attempt5-public-acquisition'
OP = 'ba2253a8-26a7-4db5-b503-9bca6710471c'
VOLUME = 'cortex-task03-attempt5-fixture-20261006-ba2253a8'
IMAGE = 'sha256:9ff43bfe7849197a6dfbaa80f2d11a34db4202d8aaae269ddc8b740f7da75fb3'
FREEZE = '053e131a8f408031af7ead1e2c8c73f75954ba5acd905eac9e6091a24429e570'
HELPER = P / 'task03-attempt5-linux-public-transfer.py'
COMMON = P / 'task03-attempt5-coordinate-common.py'
MANAGEMENT_REVIEW = R / '_goals/convex-backend-runtime-2026-10-02/qa/local-resume-2026-10-05/task03-attempt5-management-review.json'
DOCKER = '/usr/local/bin/docker'
NAMES = {'init': 'cortex-task03-attempt5-public-init-ba2253a8', 'copy': 'cortex-task03-attempt5-public-copy-ba2253a8'}
ENV = {**os.environ, 'CORTEX_COORDINATOR_CWD': str(R)}
records = []

def command(label, argv, timeout=30, required=True):
    row, stdout, stderr = C.run(label, argv, OUT, timeout, ENV, required=required)
    records.append(row)
    assert row['terminal'] and not row['closeErrors'], 'owned coordinator group unknown; custody remains held'
    return row, stdout, stderr

def inspect(name, label):
    _, raw, _ = command(label, [DOCKER, 'inspect', name])
    obj = json.loads(raw)[0]
    assert obj['Config']['Labels']['cortex.operation'] == OP
    assert obj['Image'] == IMAGE and obj['HostConfig']['NetworkMode'] == 'none'
    assert obj['HostConfig']['Memory'] == obj['HostConfig']['MemorySwap'] == 536870912
    assert obj['HostConfig']['ReadonlyRootfs'] is True
    return obj

def execute(label, user, mounts, argv, timeout):
    name = NAMES[label]
    command(label + '-create', [DOCKER, 'create', '--name', name, '--label', 'cortex.operation=' + OP,
            '--label', 'cortex.scope=public-candidate-only', '--platform', 'linux/amd64', '--network', 'none',
            '--memory', '512m', '--memory-swap', '512m', '--cpus', '2', '--pids-limit', '64', '--read-only',
            '--user', user, *mounts, IMAGE, '/usr/local/bin/python3.12', '-B', *argv])
    initial = inspect(name, label + '-initial-inspect')
    assert initial['Config']['User'] == user
    expected_mounts = 1 if label == 'init' else 3
    assert len(initial['Mounts']) == expected_mounts
    assert any(m['Type'] == 'volume' and m['Name'] == VOLUME and m['Destination'] == '/owned' and m['RW'] is True for m in initial['Mounts'])
    if label == 'copy':
        for source, target in [(Q, '/input'), (P, '/helper')]:
            assert any(m['Type'] == 'bind' and m['Source'] == str(source) and m['Destination'] == target and m['RW'] is False for m in initial['Mounts'])
    row, stdout, _ = command(label + '-run', [DOCKER, 'start', '--attach', name], timeout, required=False)
    terminal = inspect(name, label + '-terminal-inspect')
    assert terminal['State']['Running'] is False and terminal['State']['OOMKilled'] is False
    assert row['exitCode'] == terminal['State']['ExitCode'] == 0 and row['failureClass'] is None
    assert not row['closeErrors']
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
                    assert obj['Config']['Labels']['cortex.operation'] == OP and obj['Image'] == IMAGE
                    if obj['State']['Running']:
                        command('final-kill-' + label, [DOCKER, 'kill', name])
                    _, raw, _ = command('final-terminal-' + label, [DOCKER, 'inspect', name])
                    assert json.loads(raw)[0]['State']['Running'] is False
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
