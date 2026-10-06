"""Fixed prospective recipe coordinator; private approval never dispatches CLI here.

The separately reviewed helpers own provisioning and custody assertions. This
coordinator retains private bounded diagnostics and always attempts physical
retirement of its exclusive project after failure, completion, or a finite wait.
"""
from pathlib import Path
import datetime
import hashlib
import json
import os
import selectors
import signal
import subprocess
import time

R = Path('/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion')
P = R / '_goals/convex-backend-runtime-2026-10-02/qa/local-resume-2026-10-05'
Q = P.parent / 'task03-local-native-attempt3-2026-10-05'
S = Path('/Users/SaintNick/.codex/tmp/cortex-runtime-task03-attempt3-private-20261005')
TOOL = Path('/Users/SaintNick/.codex/tmp/cortex-runtime-toolchain-20261005/node_modules/.bin')
OP = 'd98bad88-5157-4816-b458-4160e7945361'
VOLUME = 'cortex-task03-attempt3-fixture-20261005-d98bad88'
IMAGE = 'sha256:9ff43bfe7849197a6dfbaa80f2d11a34db4202d8aaae269ddc8b740f7da75fb3'
EXPORT = Q / 'tmp' / ('actual-private-export-' + OP)
LOG = S / 'coordination'
NAME = 'cortex-task03-attempt3-private-d98bad88'
MGMT = P / 'task03-attempt3-target-management.mjs'
PUBLIC = P / 'task03-attempt3-private-coordinate-status.json'
RECORDS = []

def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def exclusive_json(path, data):
    fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600)
    try:
        with os.fdopen(fd, 'w') as f:
            json.dump(data, f, indent=2); f.write('\n'); f.flush(); os.fsync(f.fileno())
    except BaseException:
        raise
    d = os.open(path.parent, os.O_RDONLY | os.O_DIRECTORY)
    try:
        os.fsync(d)
    finally:
        os.close(d)

def status(phase, result, **fields):
    value = {'operation': OP, 'phase': phase, 'status': result,
             'observedAtUtc': datetime.datetime.now(datetime.timezone.utc).isoformat(),
             'volume': VOLUME, 'privateContentsPrinted': False,
             'nativeFoundationAccepted': False, 'fullTask03FunctionalAccepted': False,
             **fields}
    temporary = PUBLIC.with_name(PUBLIC.name + '.' + str(os.getpid()))
    exclusive_json(temporary, value)
    os.replace(temporary, PUBLIC)
    print(json.dumps(value), flush=True)

def run(label, argv, timeout, input_bytes=None, required=True):
    start = time.monotonic()
    paths = {n: LOG / (label + '.' + n) for n in ('stdout', 'stderr')}
    handles = {n: os.fdopen(os.open(p, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600), 'wb') for n, p in paths.items()}
    proc = None; failed = None; counts = {'stdout': 0, 'stderr': 0}
    try:
        proc = subprocess.Popen(argv, stdin=subprocess.PIPE if input_bytes is not None else subprocess.DEVNULL,
                                stdout=subprocess.PIPE, stderr=subprocess.PIPE, cwd=R,
                                env={**os.environ, 'PATH': str(TOOL) + ':' + os.environ.get('PATH', '')},
                                start_new_session=True)
        if input_bytes is not None:
            proc.stdin.write(input_bytes); proc.stdin.close()
        select = selectors.DefaultSelector()
        for n in handles:
            os.set_blocking(getattr(proc, n).fileno(), False)
            select.register(getattr(proc, n), selectors.EVENT_READ, n)
        while select.get_map():
            if time.monotonic() - start > timeout:
                raise TimeoutError('fixed_operation_deadline')
            for key, _ in select.select(0.2):
                chunk = os.read(key.fileobj.fileno(), 65536)
                if not chunk:
                    select.unregister(key.fileobj); key.fileobj.close(); continue
                n = key.data
                keep = chunk[:max(0, 262144 - counts[n])]
                handles[n].write(keep); counts[n] += len(chunk)
                if counts[n] > 262144:
                    raise ValueError('fixed_stream_ceiling')
        code = proc.wait(timeout=max(0.1, timeout - (time.monotonic() - start)))
    except BaseException as exc:
        failed = type(exc).__name__
        if proc is not None and proc.poll() is None:
            os.killpg(proc.pid, signal.SIGKILL); proc.wait(timeout=10)
        code = proc.returncode if proc is not None else None
    finally:
        for f in handles.values():
            f.flush(); os.fsync(f.fileno()); f.close()
        row = {'label': label, 'argv': argv, 'exitCode': code,
               'elapsedSeconds': time.monotonic() - start, 'failureClass': failed,
               'streamByteCounts': counts, 'rawDiagnosticsPrivate': True,
               'stdoutSha256': digest(paths['stdout']), 'stderrSha256': digest(paths['stderr'])}
        RECORDS.append(row)
        exclusive_json(LOG / (label + '.receipt.json'), row)
    if required and (failed is not None or code != 0):
        raise RuntimeError('fixed_' + label + '_failed')
    return code, paths

def abort(signum, frame):
    raise RuntimeError('coordinator_interrupted')

def retire_linux_selector():
    retired = json.loads((S / 'target.json').read_bytes())
    before = json.loads((S / 'target-pre-retirement.json').read_bytes())
    assert retired['operation'] == OP and retired['retired'] is True and retired['deleted'] is True and retired['active'] is False
    program = """import hashlib,json,os,stat,sys
from pathlib import Path
p=Path('/owned/private'); s=p.lstat(); assert s.st_uid==501 and s.st_gid==20 and stat.S_IMODE(s.st_mode)==0o700 and p.is_dir() and not p.is_symlink()
v=json.loads(sys.stdin.buffer.read()); t=p/'target.json'; s=t.lstat(); assert stat.S_ISREG(s.st_mode) and s.st_nlink==1 and s.st_uid==501 and s.st_gid==20 and stat.S_IMODE(s.st_mode)==0o600
b=t.read_bytes(); assert json.loads(b)==v['before']; assert v['after']['operation']==v['before']['operation'] and v['after']['active'] is False and v['after']['retired'] is True and v['after']['deleted'] is True
fd=os.open(p/'target-before-physical-retirement.json',os.O_WRONLY|os.O_CREAT|os.O_EXCL|os.O_NOFOLLOW,0o600); assert os.write(fd,b)==len(b); os.fsync(fd); os.close(fd)
new=p/'target-retired-replacement.json'; fd=os.open(new,os.O_WRONLY|os.O_CREAT|os.O_EXCL|os.O_NOFOLLOW,0o600); payload=(json.dumps(v['after'],indent=2)+'\\n').encode(); assert os.write(fd,payload)==len(payload); os.fsync(fd); os.close(fd)
fields=('st_dev','st_ino','st_mode','st_nlink','st_uid','st_gid','st_size','st_mtime_ns','st_ctime_ns'); assert all(getattr(t.lstat(),f)==getattr(s,f) for f in fields); os.replace(new,t); fd=os.open(p,os.O_RDONLY|os.O_DIRECTORY); os.fsync(fd); os.close(fd); assert json.loads(t.read_bytes())==v['after']; print('{"status":"PASS","retiredSelectorInvalidated":true,"historicalCustodyRepaired":false}')
"""
    argv = ['docker','run','--rm','-i','--platform','linux/amd64','--network','none','--memory','512m','--memory-swap','512m','--user','501:20',
            '--mount','type=volume,source='+VOLUME+',target=/owned,volume-nocopy',IMAGE,'/usr/local/bin/python3.12','-B','-c',program]
    run('linux-selector-retirement', argv, 60, json.dumps({'before': before, 'after': retired}).encode())

assert os.getuid() == 501 and os.getgid() == 20
for path, expected in [(MGMT, 'a1b39e13afeccd3f81fb91fed9eef1228dc8e0d8886cb0bb4ba6f42ea871cd77'),
                       (Q/'transport-prep/private-transport.py', 'ecb1eff9a9edf025e2b7eb9108580857ff41da8bb54e8956251b219a5bebc23e'),
                       (Q/'candidate-freeze-attempt3.json', '2fb8d11a7e6c0bcaf92b2fe8d7ff228a6e554f9241c07c22079e6be8bcc870ef'),
                       (P/'task03-attempt3-management-review.json', 'e20c0367848052d3ae0e9f4d30844374d030c1a039ff8f0a5d97d64addfee10b'),
                       (Q/'independent-preparation-review.json', 'b452d7a77591651bb71c9e768db3ff3e3367654a79ecbbf3f07ad850cf6bdef6'),
                       (P/'task03-attempt3-linux-public-custody-review.json', '3caf086d07b969f40077d1d013e5518a8d7eb31c389035a19857ed52904f6fe2')]:
    assert digest(path) == expected
for name in ('target.json','deploy.env','created-project.json','provision-attempt.json'):
    assert not (S/name).exists()
assert not EXPORT.exists() and not LOG.exists() and not PUBLIC.exists()
LOG.mkdir(mode=0o700)
signal.signal(signal.SIGTERM, abort); signal.signal(signal.SIGINT, abort)
received = False; completed = False; retired = False; failure = None
try:
    run('provision', [str(TOOL/'node'), str(MGMT), 'provision'], 190)
    EXPORT.mkdir(mode=0o700); (EXPORT/'selected').mkdir(mode=0o700)
    run('host-stage', ['/usr/bin/python3','-B',str(Q/'transport-prep/private-transport.py'),'stage',str(S),str(EXPORT/'selected'),str(Q/'transport-prep/transport-binding.json')], 60)
    argv = ['docker','run','--platform','linux/amd64','--network','none','--memory','512m','--memory-swap','512m','--cpus','2',
            '--name',NAME,'--label','cortex.operation='+OP,'--user','501:20',
            '--mount','type=bind,source='+str(EXPORT)+',target=/export,readonly',
            '--mount','type=bind,source='+str(Q/'transport-prep')+',target=/prep,readonly',
            '--mount','type=volume,source='+VOLUME+',target=/owned,volume-nocopy',IMAGE,
            '/usr/local/bin/python3.12','-B','/prep/private-transport.py','receive','/export/selected','/owned/private','/prep/transport-binding.json']
    run('private-receiver', argv, 60)
    run('private-receiver-terminal-inspect',['docker','inspect',NAME],30)
    observed = json.loads((LOG/'private-receiver-terminal-inspect.stdout').read_bytes())[0]
    assert observed['Config']['Labels']['cortex.operation']==OP and observed['State']['Running'] is False and observed['State']['ExitCode']==0
    assert observed['HostConfig']['Memory']==observed['HostConfig']['MemorySwap']==536870912 and observed['State']['OOMKilled'] is False
    run('private-receiver-remove',['docker','rm',NAME],30)
    received = True
    status('ACTUAL_PRIVATE_TRANSFER_AWAITING_INDEPENDENT_REVIEW','HELD', privateFilesTransferred=3, cliDispatched=False)
    deadline = time.monotonic() + 2400
    while time.monotonic() < deadline:
        end = LOG/'coordinator-finish.json'
        if end.exists():
            value = json.loads(end.read_bytes())
            assert value['operation']==OP and value['finish'] is True
            completed = True
            break
        time.sleep(0.5)
    if not completed:
        raise TimeoutError('forty_minute_coordinator_wait_expired')
except BaseException as exc:
    failure = type(exc).__name__
    status('COORDINATOR_FAILURE_RETIREMENT_REQUIRED','FAIL', failureClass=failure)
finally:
    signal.signal(signal.SIGTERM, signal.SIG_IGN); signal.signal(signal.SIGINT, signal.SIG_IGN)
    # Stop only named containers carrying our exact label before retirement.
    try:
        for name in (NAME,'cortex-task03-attempt3-deploy-d98bad88','cortex-task03-attempt3-driver-d98bad88'):
            code, paths = run('final-inspect-'+name,['docker','inspect',name],30,required=False)
            if code == 0:
                obj=json.loads(paths['stdout'].read_bytes())[0]
                assert obj['Config']['Labels']['cortex.operation']==OP
                if obj['State']['Running']:
                    run('final-kill-'+name,['docker','kill',name],30)
                run('final-remove-'+name,['docker','rm',name],30)
            elif b'no such object' not in paths['stderr'].read_bytes().lower():
                raise RuntimeError('owned_container_state_unknown')
    except BaseException as exc:
        failure = 'terminal_container_' + type(exc).__name__
    if (S/'created-project.json').exists():
        try:
            run('retire',[str(TOOL/'node'),str(MGMT),'retire'],190)
            retired=True
            if received:
                retire_linux_selector()
        except BaseException as exc:
            failure = 'retirement_' + type(exc).__name__
    exclusive_json(LOG/'coordinator-terminal.json',{'operation':OP,'retired':retired,'failureClass':failure,'completedSignal':completed,'records':RECORDS,'privateContentsPrinted':False})
    status('COORDINATOR_TERMINAL','PASS' if completed and retired and failure is None else 'FAIL',physicalProjectRetired=retired,completionSignal=completed,failureClass=failure)
if not completed or not retired or failure is not None:
    raise SystemExit(1)
