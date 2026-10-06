"""Fixed prospective recipe coordinator; private approval never dispatches CLI here.

The separately reviewed helpers own provisioning and custody assertions. This
coordinator retains private bounded diagnostics and always attempts physical
retirement of its exclusive project after failure, completion, or a finite wait.
"""
from pathlib import Path
import datetime
import importlib.util
import hashlib
import json
import os
import selectors
import signal
import subprocess
import time

R = Path('/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion')
P = R / '_goals/convex-backend-runtime-2026-10-02/qa/local-resume-2026-10-05'
Q = P.parent / 'task03-local-native-attempt5-2026-10-06'
S = Path('/Users/SaintNick/.codex/tmp/cortex-runtime-task03-attempt5-private-20261006')
TOOL = Path('/Users/SaintNick/.codex/tmp/cortex-runtime-toolchain-20261005/node_modules/.bin')
OP = 'ba2253a8-26a7-4db5-b503-9bca6710471c'
VOLUME = 'cortex-task03-attempt5-fixture-20261006-ba2253a8'
IMAGE = 'sha256:9ff43bfe7849197a6dfbaa80f2d11a34db4202d8aaae269ddc8b740f7da75fb3'
EXPORT = S / ('actual-private-export-' + OP)
LOG = S / 'coordination'
NAME = 'cortex-task03-attempt5-private-ba2253a8'
MGMT = P / 'task03-attempt5-target-management.mjs'
PUBLIC = P / 'task03-attempt5-private-coordinate-status.json'
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

def run(label, argv, timeout, input_bytes=None, required=True, progress=None):
    row, stdout, stderr = C.run(label, argv, LOG, timeout,
        {**os.environ, 'PATH': str(TOOL) + ':' + os.environ.get('PATH', ''), 'CORTEX_COORDINATOR_CWD': str(R)},
        input_bytes=input_bytes, required=required, progress=progress)
    RECORDS.append(row)
    return row['exitCode'], {n: LOG / (label + '.' + n) for n in ('stdout', 'stderr')}

def abort(signum, frame):
    raise RuntimeError('coordinator_interrupted')

def retire_linux_selector():
    retired = json.loads((S / 'target.json').read_bytes())
    before = json.loads((S / 'target-pre-retirement.json').read_bytes())
    assert retired['operation'] == OP and retired['retired'] is True and retired['deleted'] is True and retired['active'] is False
    selector_helper = P / 'task03-attempt5-retire-selector.py'
    program = selector_helper.read_text()
    argv = ['docker','run','--rm','-i','--platform','linux/amd64','--network','none','--memory','512m','--memory-swap','512m','--user','501:20',
            '--mount','type=volume,source='+VOLUME+',target=/owned,volume-nocopy',IMAGE,'/usr/local/bin/python3.12','-B','-c',program]
    run('linux-selector-retirement', argv, 60, json.dumps({'before': before, 'after': retired}).encode())

def main():
    global C
    assert os.getuid() == 501 and os.getgid() == 20
    common = Q / 'coordinate-source/task03-attempt5-coordinate-common.py'
    approval = json.loads((P / 'task03-attempt5-private-coordinator-source-review.json').read_bytes())
    assert approval['verdict'] == 'PASS' and approval['independent'] is True
    assert approval['scope'] == 'TASK03_FIXED_RECIPE_COORDINATOR_SOURCE_ONLY'
    assert approval['coordinatorSha256'] == digest(Path(__file__))
    dependencies = [common, MGMT, Q/'candidate-freeze-attempt5.json',
        Q/'independent-preparation-review.json', P/'task03-attempt5-management-review.json',
        P/'task03-attempt5-linux-public-custody-review.json', Q/'attempt5/source-acquisition.py',
        Q/'transport-prep/private-transport.py', Q/'transport-prep/transport-binding.json',
        P/'task03-attempt5-retire-selector.py']
    assert set(approval['dependencies']) == {str(path.relative_to(R)) for path in dependencies}
    for path in dependencies:
        assert digest(path) == approval['dependencies'][str(path.relative_to(R))]
    assert approval['freezeSha256'] == digest(Q/'candidate-freeze-attempt5.json')
    assert digest(MGMT) == '3b52d3f99eb66294a0ffc1ed11c43cabe7062400da53b978db8878b6389a6216'
    assert digest(Q/'transport-prep/private-transport.py') == 'ecb1eff9a9edf025e2b7eb9108580857ff41da8bb54e8956251b219a5bebc23e'
    for path, scope in [(Q/'independent-preparation-review.json','BOUNDED_03_FOUNDATION_CURRENT_DELTA_PREPARATION'),
                        (P/'task03-attempt5-management-review.json','TASK03_DISPOSABLE_TARGET_MANAGEMENT_ONLY'),
                        (P/'task03-attempt5-linux-public-custody-review.json','TASK03_ACTUAL_PUBLIC_LINUX_CUSTODY_ONLY')]:
        review = json.loads(path.read_bytes())
        assert review['verdict'] == 'PASS' and review['independent'] is True and review['scope'] == scope
    for name in ('target.json', 'deploy.env', 'created-project.json', 'provision-attempt.json'):
        assert not (S/name).exists()
    assert not EXPORT.exists() and not LOG.exists() and not PUBLIC.exists()
    spec = importlib.util.spec_from_file_location('bounded_actual_private_coordinator', common)
    C = importlib.util.module_from_spec(spec); spec.loader.exec_module(C)
    spec = importlib.util.spec_from_file_location('prospective_native_source_acquisition', Q/'attempt5/source-acquisition.py')
    A = importlib.util.module_from_spec(spec); spec.loader.exec_module(A)
    T = A.T
    binding = A.strict_json((Q/'transport-prep/transport-binding.json').read_bytes())
    LOG.mkdir(mode=0o700)
    EXPORT.mkdir(mode=0o700); (EXPORT/'selected').mkdir(mode=0o700)
    signal.signal(signal.SIGTERM, abort); signal.signal(signal.SIGINT, abort)
    received = False; completed = False; retired = False; failure = None
    source_held = producer = None
    receiver_attempted = False
    try:
        # Candidate code and the three empty private/native/receipts children were
        # acquired and independently accepted before this operation. Only volumes
        # are mounted; there is no host source/export/ancestor bind.
        argv = ['docker','create','--interactive','--platform','linux/amd64','--network','none',
            '--memory','512m','--memory-swap','512m','--cpus','2','--pids-limit','64','--read-only',
            '--name',NAME,'--label','cortex.operation='+OP,'--user','501:20',
            '--mount','type=volume,source='+VOLUME+',target=/owned,volume-nocopy',
            '--mount','type=volume,source='+VOLUME+',target=/prep,volume-subpath=candidate,readonly,volume-nocopy',
            IMAGE,'/usr/local/bin/python3.12','-B','/prep/attempt5/source-acquisition.py','receive-copy',
            '/owned/native','source-'+OP,'/owned/private','/prep/transport-prep/transport-binding.json','/owned/receipts']
        run('private-receiver-create', argv, 30)
        run('private-receiver-initial-inspect', ['docker','inspect',NAME], 30)
        initial = json.loads((LOG/'private-receiver-initial-inspect.stdout').read_bytes())[0]
        assert initial['Config']['Labels']['cortex.operation']==OP and initial['Config']['User']=='501:20'
        assert initial['Image']==IMAGE and initial['HostConfig']['NetworkMode']=='none' and initial['HostConfig']['ReadonlyRootfs'] is True
        assert initial['HostConfig']['Memory']==initial['HostConfig']['MemorySwap']==536870912
        assert len(initial['Mounts'])==2 and all(m['Type']=='volume' and m['Name']==VOLUME for m in initial['Mounts'])
        assert any(m['Destination']=='/owned' and m['RW'] is True for m in initial['Mounts'])
        assert any(m['Destination']=='/prep' and m['RW'] is False for m in initial['Mounts'])
        run('provision', [str(TOOL/'node'), str(MGMT), 'provision'], 190)
        source_held = T.open_sources(S, T.NAMES)
        stage = T.copy_private(S, EXPORT/'selected', binding, stage=True)
        C.durable_json(LOG/'host-stage-custody.json', stage)
        producer = A.HeldProducer(EXPORT/'selected', binding)
        frames = b''.join(producer.frames())
        assert 0 < len(frames) <= A.MAX_TOTAL
        def verify_held():
            producer.verify(); T.verify_sources(*source_held)
        receiver_attempted = True
        run('private-receiver', ['docker','start','--attach','--interactive',NAME], 60,
            input_bytes=frames, progress=verify_held)
        run('private-receiver-terminal-inspect',['docker','inspect',NAME],30)
        terminal = json.loads((LOG/'private-receiver-terminal-inspect.stdout').read_bytes())[0]
        assert terminal['Config']['Labels']['cortex.operation']==OP and terminal['Image']==IMAGE
        assert terminal['State']['Running'] is False and terminal['State']['ExitCode']==0 and terminal['State']['OOMKilled'] is False
        result = A.strict_json((LOG/'private-receiver.stdout').read_bytes())
        assert result['status']=='PASS' and result['sourceFiles']==4 and result['copiedFiles']==3
        assert result['nativeAllNineAndFullContents'] is True
        assert result['scope']=='PUBLIC_DUMMY_NATIVE_SOURCE_THEN_UNCHANGED_HELPER'
        # That literal public-dummy helper label is retained, and is no actual
        # key/JWKS/env/target or current native private custody acceptance.
        verify_held()
        C.durable_json(LOG/'host-source-custody.json', {'operation':OP,'status':'PASS',
            'originalDirectoryIdentityDecimal':T.identity(source_held[1]),
            'originalFiles':[{'name':r['name'],'identityDecimal':r['identity'],'sha256':r['sha256'],'bytes':len(r['bytes'])} for r in source_held[3]],
            'stageDirectoryIdentityDecimal':T.identity(producer.before),
            'stageFiles':[{'name':r['name'],'identityDecimal':r['identity'],'sha256':r['sha256'],'bytes':len(r['bytes'])} for r in producer.rows],
            'hostDescriptorsHeldThroughTerminalAndDurableReceipt':True,'actualPrivateCryptographicAcceptance':False})
        verify_held()
        producer.close(); producer=None
        for row in source_held[3]: os.close(row['fd'])
        os.close(source_held[2]); source_held=None
        run('private-receiver-remove',['docker','rm',NAME],30)
        received = True
        status('ACTUAL_PRIVATE_TRANSFER_AWAITING_INDEPENDENT_REVIEW','HELD', privateFilesTransferred=3,
               nativeSourceFiles=4, cliDispatched=False, actualPrivateCryptographicAcceptance=False)
        deadline = time.monotonic() + 2400
        while time.monotonic() < deadline:
            end = LOG/'coordinator-finish.json'
            if end.exists():
                value = json.loads(end.read_bytes())
                assert value['operation']==OP and value['finish'] is True
                completed = True; break
            time.sleep(0.5)
        if not completed: raise TimeoutError('forty_minute_coordinator_wait_expired')
    except BaseException as exc:
        failure = type(exc).__name__
        status('COORDINATOR_FAILURE_RETIREMENT_REQUIRED','FAIL', failureClass=failure)
    finally:
        if producer is not None: producer.close()
        if source_held is not None:
            for row in source_held[3]: os.close(row['fd'])
            os.close(source_held[2])
        signal.signal(signal.SIGTERM, signal.SIG_IGN); signal.signal(signal.SIGINT, signal.SIG_IGN)
        try:
            for name in (NAME,'cortex-task03-attempt5-deploy-ba2253a8','cortex-task03-attempt5-driver-ba2253a8'):
                code, paths = run('final-inspect-'+name,['docker','inspect',name],30,required=False)
                if code==0:
                    obj=json.loads(paths['stdout'].read_bytes())[0]
                    assert obj['Config']['Labels']['cortex.operation']==OP
                    if obj['State']['Running']: run('final-kill-'+name,['docker','kill',name],30)
                    run('final-terminal-'+name,['docker','inspect',name],30)
                    assert json.loads((LOG/('final-terminal-'+name+'.stdout')).read_bytes())[0]['State']['Running'] is False
                    run('final-remove-'+name,['docker','rm',name],30)
                elif b'no such object' not in paths['stderr'].read_bytes().lower():
                    raise RuntimeError('owned_container_state_unknown')
        except BaseException as exc:
            failure='terminal_container_'+type(exc).__name__
        if (S/'created-project.json').exists():
            try:
                run('retire',[str(TOOL/'node'),str(MGMT),'retire'],190)
                retired=True
                if receiver_attempted: retire_linux_selector()
            except BaseException as exc:
                failure='retirement_'+type(exc).__name__
        C.durable_json(LOG/'coordinator-terminal.json',{'operation':OP,'retired':retired,'failureClass':failure,
            'completedSignal':completed,'received':received,'records':RECORDS,'privateContentsPrinted':False})
        status('COORDINATOR_TERMINAL','PASS' if completed and retired and failure is None else 'FAIL',
               physicalProjectRetired=retired,completionSignal=completed,failureClass=failure)
    if not completed or not retired or failure is not None: raise SystemExit(1)

if __name__=='__main__':
    main()
