"""Fresh independent source outcomes. Every process/clock/file effect is substituted."""
import ast
import hashlib
import json
import math
from pathlib import Path
import re
import types

HERE = Path(__file__).resolve().parent
SOURCE = HERE / 'first-prospective-current-source1'
FENCE = json.loads((SOURCE / 'fence.json').read_text())
RESULTS = []


def source(name):
    row = next(r for r in FENCE['files'] if r['path'].endswith('/source/' + name))
    raw = (SOURCE / row['backing']).read_bytes()
    assert len(raw) == row['size'] and hashlib.sha256(raw).hexdigest() == row['sha256']
    return raw.decode()


def definitions(name, namespace, selected=None):
    tree = ast.parse(source(name))
    body = [n for n in tree.body if isinstance(n, (ast.FunctionDef, ast.ClassDef))
            and (selected is None or n.name in selected)]
    exec(compile(ast.Module(body=body, type_ignores=[]), 'verified-public-backing:' + name, 'exec'), namespace)
    return namespace


def case(name, f):
    try:
        detail = f()
        RESULTS.append({'name': name, 'status': 'PASS', 'detail': detail})
    except BaseException as error:
        RESULTS.append({'name': name, 'status': 'FAIL', 'error': repr(error)})


class Clock:
    def __init__(self): self.now = 0
    def monotonic(self): return self.now


class Pipe:
    def close(self): return None


class FakeProcess:
    pid = 321
    def __init__(self, clock, late):
        self.clock, self.late = clock, late
        self.returncode = None
        self.stdout, self.stderr = Pipe(), Pipe()
        self.waits = []
    def wait(self, timeout):
        self.waits.append(timeout)
        self.clock.now = self.late
        self.returncode = 0
        return 0
    def poll(self): return self.returncode


def late_terminal(timeout, late, native=True):
    clock = Clock()
    process = FakeProcess(clock, late)
    closed = []
    fake_os = types.SimpleNamespace(getpid=lambda: 99,
                                   pidfd_open=lambda pid, flags: pid + 1000,
                                   close=lambda fd: closed.append(fd),
                                   read=lambda *_: (_ for _ in ()).throw(AssertionError('unexpected file read')))
    class Poll:
        def register(self, fd, event): self.fd = fd
        def poll(self, _): return [(self.fd, 1)] if self.fd == 1321 and process.returncode is not None else []
    fake_select = types.SimpleNamespace(poll=Poll, POLLIN=1)
    class TimeoutExpired(Exception): pass
    fake_subprocess = types.SimpleNamespace(DEVNULL=-3, PIPE=-1, TimeoutExpired=TimeoutExpired,
                                           Popen=lambda *_a, **_kw: process)
    fake_signal = types.SimpleNamespace(SIGTERM=15, SIGKILL=9, pidfd_send_signal=lambda *_: None)
    ns = {'os': fake_os, 'time': clock, 'select': fake_select, 'signal': fake_signal,
          'subprocess': fake_subprocess, 'selectors': types.SimpleNamespace()}
    definitions('bounded_process.py', ns)
    actual_collect = ns['BoundedStreams'].collect
    class Collector:
        def __init__(self, p, out_limit, err_limit, deadline, read):
            self.process, self.deadline = p, deadline
        def pump(self, wait): return True
        def partial(self): return {'stdout': b'', 'stderr': b''}
        def collect(self, progress): return actual_collect(self, progress)
        def close(self): return []
    ns['BoundedStreams'] = Collector
    receipt = ns['bounded_command'](['SUBSTITUTED_CHILD'], timeout=timeout, native_pidfd=native)
    return receipt, process, closed


def witness_late_own20():
    receipt, process, closed = late_terminal(20, 20.125)
    assert receipt['terminal'] is True and receipt['exit'] == 0
    assert receipt['elapsedSeconds'] > receipt['timeoutSeconds']
    assert receipt['actualChildTerminalPoll'] and receipt['closeErrors'] == []
    assert len(closed) == 2 and len(process.waits) == 1
    return {'defectObserved': True, 'requestedSeconds': 20, 'acceptedElapsedSeconds': 20.125,
            'terminalAccepted': True, 'realChildCreated': False,
            'sourceLines': 'bounded_process.py:65-75,216-223,264-269'}


def witness_late_metadata30():
    receipt, process, closed = late_terminal(30, 30.125)
    assert receipt['terminal'] and receipt['elapsedSeconds'] == 30.125
    assert receipt['timeoutSeconds'] == 30
    return {'defectObserved': True, 'requestedSeconds': 30, 'acceptedElapsedSeconds': 30.125,
            'realChildCreated': False}


def nominal_terminal():
    receipt, _, _ = late_terminal(20, 19.875)
    assert receipt['terminal'] and receipt['elapsedSeconds'] < 20
    return {'nominalAccepted': True, 'realChildCreated': False}


def stream_finish_late():
    clock = Clock(); process = FakeProcess(clock, 60.125)
    class TimeoutExpired(Exception): pass
    ns = {'time': clock, 'os': types.SimpleNamespace(read=lambda *_: b''),
          'subprocess': types.SimpleNamespace(TimeoutExpired=TimeoutExpired),
          'selectors': types.SimpleNamespace()}
    definitions('bounded_process.py', ns, {'CollectionFailure', 'BoundedFileStream'})
    fake = types.SimpleNamespace(read=lambda _: b'', deadline=60, process=process,
                                 partial=lambda: {'stdoutPrefix': b'', 'stdoutBytes': 0, 'stderr': b''})
    row = ns['BoundedFileStream'].finish(fake)
    assert row['terminal'] and row['exit'] == 0 and clock.now > fake.deadline
    return {'defectObserved': True, 'requestedSeconds': 60, 'acceptedElapsedSeconds': 60.125,
            'sourceLines': 'bounded_process.py:150-158', 'realChildCreated': False}


def stream_finish_expired_denied():
    clock = Clock(); clock.now = 61; process = FakeProcess(clock, 62)
    class TimeoutExpired(Exception): pass
    ns = {'time': clock, 'os': types.SimpleNamespace(read=lambda *_: b''),
          'subprocess': types.SimpleNamespace(TimeoutExpired=TimeoutExpired),
          'selectors': types.SimpleNamespace()}
    definitions('bounded_process.py', ns, {'CollectionFailure', 'BoundedFileStream'})
    fake = types.SimpleNamespace(read=lambda _: b'', deadline=60, process=process,
                                 partial=lambda: {})
    try: ns['BoundedFileStream'].finish(fake)
    except ns['CollectionFailure'] as error:
        assert str(error) == 'STREAM_DEADLINE_EXCEEDED' and process.waits == []
        return {'preExpiredDenied': True, 'realChildCreated': False}
    raise AssertionError('expired stream unexpectedly accepted')


def unchanged_bootstrap_nested_pid_denied():
    calls = []; writes = []
    class Output:
        def flush(self): pass
        def fileno(self): return 42
        def close(self): pass
    class FakePath:
        def __init__(self, text): self.text = text
        def __truediv__(self, child): return FakePath(self.text + '/' + str(child))
        def write_text(self, text): writes.append((self.text, text))
        def __str__(self): return self.text
    ns = {'ROOT': FakePath('SUBSTITUTED_ROOT'), 'open': lambda *_a, **_kw: Output(),
          'os': types.SimpleNamespace(getpid=lambda: 2, fsync=lambda *_: None),
          'json': json, 'time': Clock(), 'OWNED_PROCESS_EVENTS': [],
          'descendants': lambda: [],
          'subprocess': types.SimpleNamespace(Popen=lambda *_a, **_kw: calls.append('forbidden')),
          'selectors': types.SimpleNamespace(), 'signal': types.SimpleNamespace()}
    definitions('bootstrap.py', ns, {'call'})
    try: ns['call']('node-version', ['SUBSTITUTED_NODE', '--version'], {}, 30, 1024)
    except ValueError as error:
        assert str(error) == 'EXCLUSIVE_OWNED_PID_NAMESPACE_REQUIRED' and calls == []
        assert len(writes) == 1 and json.loads(writes[0][1])['spawned'] is False
        return {'defectObserved': True, 'bootstrapPID': 2, 'requiredPID': 1,
                'originalGuardOutcome': str(error), 'newChildren': 0,
                'sourceLines': 'native-controller.py:139,190;bootstrap.py:169-170'}
    raise AssertionError('nested bootstrap unexpectedly accepted')


def host_bool_alias():
    ns = {'MEMORY': 1073741824}
    definitions('host_contract.py', ns)
    expected = {'id': 'c'*64, 'image': 'sha256:'+'a'*64, 'name': 'fixture',
                'labels': {'owned': 'fixture'}, 'env': [], 'mounts': []}
    state = {'OOMKilled': False, 'Error': '', 'Pid': 0, 'Running': False, 'Status': 'created'}
    hc = {'Memory': 1073741824, 'MemorySwap': 1073741824, 'ReadonlyRootfs': 1,
          'NetworkMode': 'none', 'PidsLimit': 128, 'Privileged': 0, 'AutoRemove': 0,
          'CapDrop': ['ALL'], 'Tmpfs': {'/tmp':'rw,noexec,nosuid,nodev,size=16777216,mode=0700'},
          'Ulimits': [{'Name':'nofile','Hard':8192,'Soft':8192}], 'Mounts': [], 'PidMode': 'host'}
    row = {'Id': expected['id'], 'Image': expected['image'], 'Name': '/fixture',
           'Config': {'Labels': expected['labels'], 'User':'0:0', 'WorkingDir':'/native-source',
                      'Entrypoint':['/usr/local/bin/python3.12'], 'Cmd':['-B','/native-source/native-controller.py'], 'Env': []},
           'HostConfig': hc, 'State': state, 'Mounts': []}
    ns['validate'](row, expected)
    return {'defectObserved': True, 'numericBooleanAliasesAccepted': True,
            'hostPIDModeAccepted': True, 'sourceLines':'host_contract.py:13-20',
            'DockerExecuted': False}


def source_and_map_conservation():
    mf = json.loads(source('source-manifest.json'))
    assert mf['fileCount'] == 111 and len(mf['files']) == 111
    assert len({r['path'] for r in mf['files']}) == 111
    assert [r['path'] for r in mf['files']] == sorted(r['path'] for r in mf['files'])
    assert sum(r['bytes'] for r in mf['files']) == 2118876 == mf['sourceBytes']
    run = source('run_controls.py')
    own = source('c7/controls.mjs')
    assert hashlib.sha256(run.encode()).hexdigest() == '5d27d83c1c28dc4ce475703c366649610b41bb893138be3efd3f9ac5a6d8b885'
    assert hashlib.sha256(own.encode()).hexdigest() == '93522ab6d59ee96a0fb8f24a4f1009bdaa8ad1ff25d4f0e6988dd9fc039b4a16'
    return {'unchanged48Body': True, 'unchanged20Body': True, 'finite111Membership': True,
            'runtimeExecuted': False}


case('unchanged48-and20-body-and111-source-membership', source_and_map_conservation)
case('nominal-in-window-terminal-accepted-substituted', nominal_terminal)
case('OWN20-late-terminal-accepted-defect-witness', witness_late_own20)
case('metadata30-late-terminal-accepted-defect-witness', witness_late_metadata30)
case('stream60-late-terminal-accepted-defect-witness', stream_finish_late)
case('pre-expired-stream-denied-substituted', stream_finish_expired_denied)
case('unchanged-bootstrap-nested-PID-rejected-defect-witness', unchanged_bootstrap_nested_pid_denied)
case('typed-boolean-and-private-PID-binding-defect-witness', host_bool_alias)
out = {'scope': 'FRESH_INDEPENDENT_MOCK_STATIC_SOURCE_OUTCOMES_ONLY',
       'allProcessFileClockEffectsSubstituted': True, 'realChildCreated': False,
       'DockerExecuted': False, 'nativeExecuted': False,
       'testsVerifyDefectsAsWellAsNominalGuards': True, 'results': RESULTS,
       'PASS': sum(r['status'] == 'PASS' for r in RESULTS),
       'FAIL': sum(r['status'] == 'FAIL' for r in RESULTS),
       'task04FunctionalAccepted': False, 'original122Accepted': False, 'ROOT': 'ABSENT'}
with (HERE / 'independent-control-results1.json').open('x') as f:
    json.dump(out, f, indent=2); f.write('\n')
print(json.dumps(out))
raise SystemExit(1 if out['FAIL'] else 0)
