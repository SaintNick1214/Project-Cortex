"""Finite public-dummy window only; never reads the fresh real key or old private paths."""
import datetime
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import selectors
import signal
import subprocess
import time

Q = Path(__file__).resolve().parents[1]
BASE = Q / 'attempt4'
OUT = BASE / 'dummy4'
S = importlib.util.spec_from_file_location('acquisition', BASE / 'source-acquisition.py')
A = importlib.util.module_from_spec(S)
S.loader.exec_module(A)
T = A.T
B = json.loads((Q / 'transport-prep/transport-binding.json').read_bytes())
OP = B['operation']
IMAGE = 'sha256:9ff43bfe7849197a6dfbaa80f2d11a34db4202d8aaae269ddc8b740f7da75fb3'
DOCKER = '/usr/local/bin/docker'
VOLUME = 'cortex-task03-attempt4-public-dummy4-' + OP
CODE = OUT / 'linux-code'
RECORDS = []
WINDOW_END = (BASE / 'docker-budget.stdout').stat().st_birthtime + 900
START = time.monotonic()
START_UTC = datetime.datetime.now(datetime.timezone.utc).isoformat()
CEILING = 262144

def durable(path, raw):
    fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600)
    try:
        view = memoryview(raw)
        while view:
            n = os.write(fd, view)
            assert n > 0
            view = view[n:]
        os.fsync(fd)
    finally:
        os.close(fd)
    d = os.open(path.parent, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW)
    try:
        os.fsync(d)
    finally:
        os.close(d)

def run(name, argv, timeout=20, input_bytes=None, required=True):
    assert time.time() < WINDOW_END and 0 < timeout <= min(60, WINDOW_END - time.time())
    if input_bytes is not None:
        assert len(input_bytes) <= A.MAX_TOTAL
    proc = subprocess.Popen(argv, stdin=subprocess.PIPE if input_bytes is not None else subprocess.DEVNULL, stdout=subprocess.PIPE, stderr=subprocess.PIPE, start_new_session=True, env={'PATH': '/usr/local/bin:/usr/bin:/bin', 'HOME': '/Users/SaintNick'})
    selector = selectors.DefaultSelector()
    output = {1: bytearray(), 2: bytearray()}
    counts = {1: 0, 2: 0}
    failure = None
    input_offset = 0
    deadline = time.monotonic() + timeout
    input_deadline = time.monotonic() + A.STREAM_SECONDS
    for stream, key in [(proc.stdout, 1), (proc.stderr, 2)]:
        os.set_blocking(stream.fileno(), False)
        selector.register(stream, selectors.EVENT_READ, key)
    if proc.stdin is not None:
        os.set_blocking(proc.stdin.fileno(), False)
        selector.register(proc.stdin, selectors.EVENT_WRITE, 0)
    try:
        while selector.get_map():
            assert time.monotonic() < deadline, 'deadline'
            for key, _ in selector.select(min(0.1, max(0, deadline - time.monotonic()))):
                stream = key.fileobj
                if key.data == 0:
                    assert time.monotonic() < input_deadline, 'stdin deadline'
                    count = os.write(stream.fileno(), input_bytes[input_offset:input_offset + 16384])
                    assert count > 0
                    input_offset += count
                    if input_offset == len(input_bytes):
                        selector.unregister(stream)
                        stream.close()
                    continue
                raw = os.read(stream.fileno(), 16384)
                if not raw:
                    selector.unregister(stream)
                    stream.close()
                    continue
                counts[key.data] += len(raw)
                output[key.data].extend(raw[:max(0, CEILING - len(output[key.data]))])
                assert counts[key.data] <= CEILING, 'stream overflow'
        proc.wait(timeout=max(0.1, deadline - time.monotonic()))
    except BaseException as exc:
        failure = type(exc).__name__
        os.killpg(proc.pid, signal.SIGKILL)
        proc.wait(timeout=5)
    finally:
        selector.close()
        for stream in [proc.stdin, proc.stdout, proc.stderr]:
            if stream is not None and not stream.closed:
                stream.close()
    for n, suffix in [(1, 'stdout'), (2, 'stderr')]:
        durable(OUT / (name + '.' + suffix), bytes(output[n]))
    row = {'name': name, 'argv': argv, 'exitCode': proc.returncode, 'failureClass': failure, 'stdoutBytes': counts[1], 'stderrBytes': counts[2], 'stdinBytes': input_offset, 'stdout': name + '.stdout', 'stderr': name + '.stderr', 'privateContentsPrinted': False, 'serviceCalls': 0}
    RECORDS.append(row)
    if required:
        assert proc.returncode == 0 and failure is None, 'fixed bounded command failure: ' + name
    return row, bytes(output[1]), bytes(output[2])

def inspect(name, phase):
    _, raw, _ = run(phase, [DOCKER, 'inspect', name])
    obj = json.loads(raw)[0]
    assert obj['Config']['Labels']['cortex.operation'] == OP
    assert obj['HostConfig']['Memory'] == 536870912 and obj['HostConfig']['MemorySwap'] == 536870912
    assert obj['HostConfig']['NetworkMode'] == 'none' and obj['HostConfig']['ReadonlyRootfs'] is True
    assert obj['Image'] == IMAGE and obj['Platform'] == 'linux'
    assert len(obj['Mounts']) == 2
    assert any(m['Type'] == 'volume' and m['Name'] == VOLUME and m['Destination'] == '/owned' for m in obj['Mounts'])
    assert any(m['Type'] == 'bind' and m['Source'] == str(CODE) and m['Destination'] == '/prep' and m['RW'] is False for m in obj['Mounts'])
    return obj

def container(label, program, user='501:20', input_bytes=None, timeout=30, extras=None):
    name = 'cortex-task03-attempt4-dummy4-' + label + '-' + OP
    argv = [DOCKER, 'create', '--name', name, '--label', 'cortex.operation=' + OP, '--label', 'cortex.scope=public-dummy-source-only', '--platform', 'linux/amd64', '--network', 'none', '--memory', '512m', '--memory-swap', '512m', '--pids-limit', '64', '--read-only', '--user', user, '--mount', 'type=bind,src=' + str(CODE) + ',target=/prep,readonly', '--mount', 'type=volume,src=' + VOLUME + ',target=/owned,volume-nocopy', '--env', 'PYTHONDONTWRITEBYTECODE=1']
    if extras:
        argv += extras
    if input_bytes is not None:
        argv.append('--interactive')
    argv += [IMAGE, 'python3', program]
    if label == 'receiver':
        argv += ['receive-copy', '/owned/native', 'source-00000000-0000-0000-0000-000000000004', '/owned/destination', '/prep/transport-prep/transport-binding.json', '/owned/receipts']
    run(label + '-create', argv)
    initial = inspect(name, label + '-initial-inspect')
    assert initial['Config']['User'] == user
    attach = [DOCKER, 'start', '--attach']
    if input_bytes is not None:
        attach += ['--interactive']
    attach.append(name)
    row, raw, _ = run(label + '-run', attach, timeout, input_bytes, required=False)
    terminal = inspect(name, label + '-terminal-inspect')
    assert terminal['State']['Running'] is False and terminal['State']['OOMKilled'] is False
    assert row['exitCode'] == 0 and row['failureClass'] is None and terminal['State']['ExitCode'] == 0
    run(label + '-remove', [DOCKER, 'rm', name])
    return raw

if __name__ == '__main__':
    source_held = None
    producer = None
    result = {'status': 'FAIL', 'scope': 'ACTUAL_PUBLIC_DUMMY_LINUX_SOURCE_ONLY', 'realCredentialReads': 0, 'serviceCalls': 0, 'ownedVolume': VOLUME}
    try:
        CODE.mkdir(mode=0o700)
        for directory in ['attempt4', 'transport-prep']:
            (CODE / directory).mkdir()
        for rel in ['attempt4/source-acquisition.py', 'attempt4/source-controls.py', 'attempt4/linux-setup.py', 'attempt4/linux-postcheck.py', 'transport-prep/private-transport.py', 'transport-prep/transport-binding.json']:
            (CODE / rel).write_bytes((Q / rel).read_bytes())
        run('docker-budget', [DOCKER, 'info', '--format', '{{json .MemTotal}}'])
        run('running-container-ids', [DOCKER, 'ps', '--quiet'])
        _, raw, _ = run('image-inspect', [DOCKER, 'image', 'inspect', IMAGE])
        image = json.loads(raw)[0]
        assert image['Id'] == IMAGE and image['Architecture'] == 'amd64' and image['Os'] == 'linux'
        row, _, err = run('volume-before-absence', [DOCKER, 'volume', 'inspect', VOLUME], required=False)
        assert row['exitCode'] == 1 and b'no such volume' in err.lower()
        run('volume-create', [DOCKER, 'volume', 'create', '--label', 'cortex.operation=' + OP, '--label', 'cortex.scope=public-dummy-source-only', VOLUME])
        _, raw, _ = run('volume-inspect', [DOCKER, 'volume', 'inspect', VOLUME])
        assert json.loads(raw)[0]['Labels']['cortex.operation'] == OP
        container('setup', '/prep/attempt4/linux-setup.py', user='0:0', timeout=20)
        dummy = Path('/Users/SaintNick/.codex/tmp/cortex-runtime-task03-attempt4-private-20261006/public-dummy4')
        dummy.mkdir(mode=0o700)
        original = dummy / 'original'
        stage = dummy / 'stage'
        original.mkdir(mode=0o700)
        stage.mkdir(mode=0o700)
        target = {**B, 'deploymentName': 'public-dummy-123', 'kind': 'cloud', 'deploymentType': 'dev', 'active': True, 'isolationVerified': True, 'freshManagedProject': True, 'retired': False, 'deleted': False, 'productionDeployment': False, 'sharedCiTarget': False}
        values = {'jwt-private.pem': b'PUBLIC DUMMY KEY NOT A CREDENTIAL\n', 'deploy.env': b'PUBLIC_DUMMY_ONLY=true\n', 'target.json': (json.dumps(target) + '\n').encode()}
        for name, raw in values.items():
            (original / name).write_bytes(raw)
            (original / name).chmod(0o600)
        source_held = T.open_sources(original, T.NAMES)
        stage_receipt = T.copy_private(original, stage, B, stage=True)
        producer = A.HeldProducer(stage, B)
        frames = b''.join(producer.frames())
        receiver = json.loads(container('receiver', '/prep/attempt4/source-acquisition.py', input_bytes=frames))
        assert receiver['status'] == 'PASS' and receiver['nativeAllNineAndFullContents']
        producer.verify()
        T.verify_sources(*source_held)
        post = json.loads(container('postcheck', '/prep/attempt4/linux-postcheck.py'))
        assert post['status'] == 'PASS' and post['sourceAllNineAndFullContents'] and post['destinationAllNineAndFullContents']
        controls = json.loads(container('controls', '/prep/attempt4/source-controls.py', timeout=45, extras=['--env', 'CORTEX_PUBLIC_DUMMY_TMP=/owned/controls']))
        assert controls['status'] == 'PASS' and controls['count'] == 39
        durable(OUT / 'actual-native-source-custody.json', (json.dumps(post, indent=2) + '\n').encode())
        # Original host and stage descriptors stay open through child terminal and durable saved receipt.
        producer.verify()
        T.verify_sources(*source_held)
        END_UTC = datetime.datetime.now(datetime.timezone.utc).isoformat()
        run('owned-events', [DOCKER, 'events', '--since', START_UTC, '--until', END_UTC, '--filter', 'label=cortex.operation=' + OP, '--format', '{{json .}}'])
        _, raw, _ = run('volume-final-inspect', [DOCKER, 'volume', 'inspect', VOLUME])
        assert json.loads(raw)[0]['Labels']['cortex.operation'] == OP
        run('owned-volume-remove', [DOCKER, 'volume', 'rm', VOLUME])
        row, _, err = run('owned-volume-after-absence', [DOCKER, 'volume', 'inspect', VOLUME], required=False)
        assert row['exitCode'] == 1 and b'no such volume' in err.lower()
        result.update(status='PASS', sourceFiles=4, copiedFiles=3, linuxControls=39, ownedCleanup='PASS', allNineFullContentAndAfterReceipt='PASS', sourceIdentityAuthority='NEW_NATIVE_ONLY', frameLimits={'file': A.MAX_FILE, 'header': A.MAX_HEADER, 'total': A.MAX_TOTAL, 'stdinSeconds': A.STREAM_SECONDS, 'outputPerStream': CEILING}, parentDescriptorsHeldThroughTerminalAndDurableReceipt=True, elapsedSeconds=time.monotonic() - START)
    except BaseException as exc:
        result['failureClass'] = type(exc).__name__
        result['unknownOwnershipCleanup'] = 'RETAIN_NO_FOREIGN_CLEANUP_OR_UNCERTAIN_REPLAY'
    finally:
        if producer:
            producer.close()
        if source_held:
            for row in source_held[3]:
                os.close(row['fd'])
            os.close(source_held[2])
        durable(OUT / 'linux-command-receipts.json', (json.dumps({'commands': RECORDS, 'windowSeconds': 900, 'actualServiceCalls': 0, 'privateReads': 0}, indent=2) + '\n').encode())
        durable(OUT / 'linux-dummy-result.json', (json.dumps(result, indent=2) + '\n').encode())
        print(json.dumps(result))
    sys_exit = 0 if result['status'] == 'PASS' else 1
    raise SystemExit(sys_exit)
