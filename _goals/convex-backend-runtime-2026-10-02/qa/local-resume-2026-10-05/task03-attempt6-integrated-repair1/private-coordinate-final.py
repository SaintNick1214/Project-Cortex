"""Prospective first-use coordinator. Independent approval is required before effects.

Public source controls replace every external effect explicitly. They are not
production attestations. Every source is reviewed before provisioning. Actual crypto is independently
released as data before the unchanged official CLI and native programs dispatch.
"""
from pathlib import Path
import datetime
import hashlib
import importlib.util
import json
import os
import signal
import sys
import stat
import types
import time

R = Path('/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion')
P = R / '_goals/convex-backend-runtime-2026-10-02/qa/local-resume-2026-10-05/task03-attempt6-integrated-repair1'
Q = P.parent.parent / 'task03-local-native-attempt6-2026-10-06'
B = P
RECIPE = Q / 'coordinate-source'
COMMON = Q / 'integrated/coordinate-common.py'
SELECTOR = Q / 'integrated/retire-selector.py'
APPROVAL = P / 'integrated-source-review.json'
S = Path('/Users/SaintNick/.codex/tmp/cortex-runtime-task03-attempt6-private-20261006')
TOOL = Path('/Users/SaintNick/.codex/tmp/cortex-runtime-toolchain-20261005/node_modules/.bin')
OP = 'c9fbaa34-8ca8-4153-b8bd-1cfe60a8241f'
VOLUME = 'cortex-task03-attempt6-fixture-20261006-c9fbaa34'
IMAGE = 'sha256:9ff43bfe7849197a6dfbaa80f2d11a34db4202d8aaae269ddc8b740f7da75fb3'
FREEZE = '115e417419ab7b55e9fdbad97e51513f9f24a8e523c7b344168a63c92d8e968c'
MANAGEMENT_SHA = '2cc7f60a65263461196ab56cefc48117b7222dd3d99c0e885b8dbdb7158c38be'
PRIVATE_HELPER_SHA = 'ecb1eff9a9edf025e2b7eb9108580857ff41da8bb54e8956251b219a5bebc23e'
SELECTOR_SHA = '6ed06bdfb8a5499bdc2fabeda7ef2e3f4aa23a881011172ed810dd969818550a'
EXPORT = S / ('actual-private-export-' + OP)
LOG = S / 'coordination'
NAME = 'cortex-task03-attempt6-private-c9fbaa34'
SELECTOR_NAME = 'cortex-task03-attempt6-selector-c9fbaa34'
OWNED_NAMES = (NAME, SELECTOR_NAME)
MGMT = P / 'target-management.mjs'
RETIREMENT = P / 'task03-attempt6-target-retirement.json'
PUBLIC = P / 'runtime/coordinator-status.json'
RECORDS = []
OWNED_IDS = {}
OWNED_COMMANDS = {}


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def strict_json(raw):
    def pairs(items):
        result = {}
        for key, value in items:
            if key in result:
                raise ValueError('duplicate_json_key')
            result[key] = value
        return result
    return json.loads(raw, object_pairs_hook=pairs,
                      parse_constant=lambda value: (_ for _ in ()).throw(ValueError('nonfinite_json')))


def load_module(name, path):
    fields = ('dev','ino','mode','uid','gid','nlink','size','mtime_ns','ctime_ns')
    identify = lambda value: {key: str(getattr(value, 'st_'+key)) for key in fields}
    def held_read(source, pin=None):
        assert source.is_absolute() and source.is_relative_to(R) and source.resolve() == source
        before = os.lstat(source)
        assert stat.S_ISREG(before.st_mode) and before.st_nlink == 1 and before.st_uid == 501 and before.st_gid == 20 and 0 <= before.st_size <= 16777216
        fd = os.open(source, os.O_RDONLY | os.O_NOFOLLOW)
        try:
            current = identify(before)
            assert current == identify(os.fstat(fd))
            if pin is not None: assert current == pin
            data = bytearray()
            while chunk := os.read(fd, 65536):
                data.extend(chunk); assert len(data) <= before.st_size
            assert len(data) == before.st_size
            assert current == identify(os.fstat(fd)) == identify(os.lstat(source))
            return bytes(data)
        finally: os.close(fd)
    approval = strict_json(held_read(APPROVAL))
    assert approval['scope'] == 'TASK03_ATTEMPT6_INTEGRATED_REPAIR1_SOURCE_ONLY' and approval['verdict'] == 'PASS' and approval['independent'] is True
    mfraw = held_read(P/'prospective-source-manifest-final.json', approval['sourceManifestOriginalNine'])
    assert hashlib.sha256(mfraw).hexdigest() == approval['sourceManifestSha256']
    manifest = strict_json(mfraw)
    assert manifest['scope'] == 'TASK03_ATTEMPT6_REPAIR1_NEW_PROSPECTIVE_SOURCE_CLOSURE_ONLY' and manifest['sourceWriters'] == 'STOPPED'
    assert manifest['historicalD101OriginalCustody'] == 'FAILED_UNKNOWN_ONE_CTIME_NOT_REPAIRED'
    assert len(manifest['files']) == len({row['path'] for row in manifest['files']})
    assert set(approval['sources']) == {row['path'] for row in manifest['files']}
    plan_path = P/'prospective-source-plan-final.json';stop_path=P/'source-writers-stopped-final.json'
    by_path={row['path']:row for row in manifest['files']}
    planraw=held_read(plan_path,by_path[str(plan_path.relative_to(R))]['PRE'])
    assert hashlib.sha256(planraw).hexdigest()==manifest['sourcePlanSha256']==approval['sourcePlanSha256']
    plan=strict_json(planraw)
    expected={row['path']for row in plan['members']}|{str(plan_path.relative_to(R)),str(stop_path.relative_to(R))}
    assert set(by_path)==expected and len(plan['members'])==len({row['path']for row in plan['members']})
    stopraw=held_read(stop_path,by_path[str(stop_path.relative_to(R))]['PRE']);stop=strict_json(stopraw)
    assert hashlib.sha256(stopraw).hexdigest()==manifest['sourceWritersStoppedSha256']
    assert stop['sourceWriters']=='STOPPED' and stop['remainingSourceWrites']==[]
    assert int(manifest['capturedUnixNs'])>=int(stop['stoppedUnixNs'])+60000000000
    assert all(int(row['PRE']['ctime_ns'])+60000000000<=int(manifest['capturedUnixNs'])for row in manifest['files'])
    assert all(int(row['PRE']['ctime_ns'])<=int(stop['stoppedUnixNs']) for row in manifest['files'] if row['path']!=str(stop_path.relative_to(R)))
    freeze_rows=[item for item in manifest['files'] if item['path']==str((Q/'candidate-freeze-attempt6.json').relative_to(R))]
    assert len(freeze_rows)==1 and approval['candidateSha256']==freeze_rows[0]['sha256']==FREEZE
    row=by_path[str(path.relative_to(R))]
    before=os.lstat(path);fd=os.open(path,os.O_RDONLY|os.O_NOFOLLOW)
    try:
        assert identify(before)==identify(os.fstat(fd))==row['PRE']
        assert stat.S_ISREG(before.st_mode) and before.st_nlink==1 and before.st_uid==501 and before.st_gid==20
        raw=bytearray()
        while block:=os.read(fd,65536):raw.extend(block);assert len(raw)<=row['bytes']<=16777216
        assert len(raw)==row['bytes'] and hashlib.sha256(raw).hexdigest()==row['sha256']==approval['sources'][row['path']]
        assert identify(os.fstat(fd))==identify(os.lstat(path))==row['PRE']
        module=types.ModuleType(name);module.__file__=str(path);module.__package__=''
        exec(compile(raw,str(path),'exec',dont_inherit=True),module.__dict__)
        assert identify(os.fstat(fd))==identify(os.lstat(path))==row['PRE']
        return module
    finally:os.close(fd)


def preflight():
    # PUBLIC ONLY: complete source/recipe chain qualifies before S is even statted.
    assert os.getuid() == 501 and os.getgid() == 20
    assert sys.dont_write_bytecode is True, 'launch_with_python_B_required'
    assert not (Q/'transport-prep/__pycache__').exists()
    assert not (Q/'attempt5/__pycache__').exists()
    G = load_module('attempt6_public_source_gates', P/'source-gates-final.py')
    release = G.qualify_public_release()
    assert release['binding']['operation'] == OP
    assert release['binding']['volume'] == VOLUME
    assert release['binding']['freezeSha256'] == FREEZE
    assert digest(MGMT) == MANAGEMENT_SHA
    assert digest(Q/'transport-prep/private-transport.py') == PRIVATE_HELPER_SHA
    assert digest(SELECTOR) == SELECTOR_SHA
    binding = strict_json((Q/'transport-prep/transport-binding.json').read_bytes())
    assert binding['operation'] == OP and binding['privateEnvironmentFile'] == str(S/'deploy.env')
    return binding


def exclusive_json(path, data):
    fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600)
    with os.fdopen(fd, 'w') as file:
        json.dump(data, file, indent=2)
        file.write('\n'); file.flush(); os.fsync(file.fileno())
    directory = os.open(path.parent, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW)
    try:
        os.fsync(directory)
    finally:
        os.close(directory)


def status(phase, result, **fields):
    value = {'operation': OP, 'phase': phase, 'status': result,
             'observedAtUtc': datetime.datetime.now(datetime.timezone.utc).isoformat(),
             'volume': VOLUME, 'candidateSha256': FREEZE, 'privateContentsPrinted': False,
             'nativeFoundationAccepted': False, 'fullTask03FunctionalAccepted': False, **fields}
    temporary = PUBLIC.with_name(PUBLIC.name + '.' + str(os.getpid()))
    exclusive_json(temporary, value)
    os.replace(temporary, PUBLIC)
    print(json.dumps(value), flush=True)


def run(label, argv, timeout, input_bytes=None, required=True, progress=None):
    # Always retain the common supervisor row, including unsuccessful commands.
    # Optional exit codes never make unknown ownership/terminality acceptable.
    row, _, _ = C.run(label, argv, LOG, timeout,
        {**os.environ, 'PATH': str(TOOL) + ':' + os.environ.get('PATH', ''),
         'CORTEX_COORDINATOR_CWD': str(R)}, input_bytes=input_bytes,
        required=False, progress=progress)
    RECORDS.append(row)
    if row['terminal'] is not True or row['closeErrors'] or row['failureClass'] is not None:
        raise RuntimeError('command_terminal_or_custody_unknown')
    if required and (type(row['exitCode']) is not int or row['exitCode'] != 0):
        raise RuntimeError('bounded_coordinator_command_failed')
    return row['exitCode'], {name: LOG/(label+'.'+name) for name in ('stdout', 'stderr')}


def abort(signum, frame):
    raise RuntimeError('coordinator_interrupted')


def inspect_owned(obj, name):
    assert name in OWNED_NAMES
    assert obj['Name'] == '/'+name and obj['Config']['Labels']['cortex.operation'] == OP
    assert obj['Image'] == obj['Config']['Image'] == IMAGE
    assert obj['Config']['Labels'] == {'cortex.operation': OP}
    assert obj['Id'] == OWNED_IDS[name]
    assert type(obj['State']['Running']) is bool
    assert type(obj['State']['Pid']) is int and obj['State']['Pid'] >= 0


def assert_recipe(obj, name, selector=False, *, initial=True, stopped=True):
    inspect_owned(obj, name)
    assert selector is (name == SELECTOR_NAME)
    assert obj['Platform'] == 'linux'
    assert obj['Config']['User'] == '501:20' and obj['Config']['WorkingDir'] == '/tmp'
    assert obj['Config']['Entrypoint'] is None
    assert type(obj['Config']['Cmd']) is list and obj['Config']['Cmd'] == OWNED_COMMANDS[name]
    assert all(type(value) is str for value in obj['Config']['Cmd'])
    for field, value in [('Tty',False),('OpenStdin',True),('StdinOnce',False)]:
        assert type(obj['Config'][field]) is bool and obj['Config'][field] is value
    assert type(obj['State']['OOMKilled']) is bool and obj['State']['OOMKilled'] is False
    assert type(obj['State']['ExitCode']) is int and type(obj['State']['Error']) is str
    if stopped: assert obj['State']['Running'] is False and obj['State']['Pid'] == 0
    if initial: assert obj['State']['Status'] == 'created' and obj['State']['ExitCode'] == 0 and obj['State']['Error'] == ''
    host = obj['HostConfig']
    assert host['NetworkMode'] == 'none'
    for field,value in [('ReadonlyRootfs',True),('Privileged',False),('AutoRemove',False),('PublishAllPorts',False)]:
        assert type(host[field]) is bool and host[field] is value
    for field,value in [('Memory',536870912),('MemorySwap',536870912),('PidsLimit',64),('NanoCpus',2000000000)]:
        assert type(host[field]) is int and host[field] == value
    assert host['Binds'] is None and host['PortBindings'] == {}
    assert host['CapAdd'] in (None,[]) and host['CapDrop'] in (None,[]) and host['Devices'] == [] and host['SecurityOpt'] is None
    assert host['VolumesFrom'] is None
    assert host['Tmpfs'] == {'/tmp':'rw,noexec,nosuid,size=67108864,mode=0700,uid=501,gid=20'}
    expected=[{'Type':'volume','Source':VOLUME,'Target':'/owned','VolumeOptions':{'NoCopy':True}}]
    if not selector: expected.append({'Type':'volume','Source':VOLUME,'Target':'/prep','ReadOnly':True,'VolumeOptions':{'NoCopy':True,'Subpath':'candidate'}})
    assert type(host['Mounts']) is list and len(host['Mounts']) == len(expected)
    for mount in host['Mounts']:
        assert type(mount['VolumeOptions']['NoCopy']) is bool and mount['VolumeOptions']['NoCopy'] is True
        if 'ReadOnly' in mount: assert type(mount['ReadOnly']) is bool
    assert host['Mounts'] == expected
    mounts=obj['Mounts'];assert type(mounts) is list and len(mounts) == len(expected)
    by_target={mount['Destination']:mount for mount in mounts};assert len(by_target)==len(mounts)
    assert set(by_target)==set(mount['Target']for mount in expected)
    for mount in expected:
        actual=by_target[mount['Target']]
        assert actual['Type']=='volume' and actual['Name']==VOLUME and actual['Driver']=='local'
        assert actual['Source']=='/var/lib/docker/volumes/'+VOLUME+'/_data'
        assert type(actual['RW']) is bool and actual['RW'] is (not mount.get('ReadOnly',False))


def receiver_command():
    G=load_module('receiver_current_source_gate',P/'source-gates-final.py')
    released=G.qualify_public_release()
    _,body=G.reviewed_source(P/'held-acquisition.py')
    bound={}
    for name in ('attempt5/source-acquisition.py','transport-prep/private-transport.py'):
        row,_=G.reviewed_source(Q/name);bound[name]={'sha256':row['sha256'],'bytes':row['bytes']}
    argv=['/prep/attempt5/source-acquisition.py','receive-copy','/owned/native','source-'+OP,'/owned/private','/prep/transport-prep/transport-binding.json','/owned/receipts']
    config={'operation':OP,'candidateSha256':FREEZE,'publicTransferReceiptSha256':released['publicTransferReceiptSha256'],'sources':bound,'argv':argv}
    code="exec(compile("+repr(body.decode('utf8'))+",'reviewed-held-acquisition.py','exec',dont_inherit=True));native_main("+repr(config)+")"
    return ['/usr/local/bin/python3.12','-B','-c',code]


def docker_create(name, command, selector=False):
    assert name in OWNED_NAMES and name not in OWNED_COMMANDS
    assert type(command) is list and all(type(value) is str for value in command)
    OWNED_COMMANDS[name] = list(command)
    argv = ['docker', 'create', '--interactive', '--platform', 'linux/amd64', '--network', 'none',
            '--memory', '512m', '--memory-swap', '512m', '--cpus', '2', '--pids-limit', '64',
            '--read-only', '--name', name, '--label', 'cortex.operation='+OP, '--user', '501:20',
            '--workdir', '/tmp', '--tmpfs', '/tmp:rw,noexec,nosuid,size=67108864,mode=0700,uid=501,gid=20',
            '--mount', 'type=volume,source='+VOLUME+',target=/owned,volume-nocopy']
    if not selector:
        argv += ['--mount', 'type=volume,source='+VOLUME+',target=/prep,volume-subpath=candidate,readonly,volume-nocopy']
    return argv+[IMAGE]+command


def cleanup_owned(name, prefix):
    code, paths = run(prefix+'-inspect-'+name, ['docker', 'inspect', name], 30, required=False)
    if code != 0:
        assert type(code) is int and code == 1
        assert paths['stdout'].read_bytes() == b'[]\n'
        assert paths['stderr'].read_bytes().strip().lower() == ('error: no such object: '+name).encode()
        return
    obj = strict_json(paths['stdout'].read_bytes())[0]
    assert_recipe(obj, name, selector=name==SELECTOR_NAME, initial=False, stopped=False)
    if obj['State']['Running']:
        run(prefix+'-kill-'+name, ['docker', 'kill', name], 30)
    _, terminal_paths = run(prefix+'-terminal-'+name, ['docker', 'inspect', name], 30)
    terminal = strict_json(terminal_paths['stdout'].read_bytes())[0]
    assert_recipe(terminal, name, selector=name==SELECTOR_NAME, initial=False)
    assert terminal['State']['Running'] is False
    run(prefix+'-remove-'+name, ['docker', 'rm', name], 30)
    code, paths = run(prefix+'-absence-'+name, ['docker', 'inspect', name], 30, required=False)
    assert type(code) is int and code == 1 and paths['stdout'].read_bytes() == b'[]\n'
    assert paths['stderr'].read_bytes().strip().lower() == ('error: no such object: '+name).encode()


def prepare_linux_selector():
    G=load_module('selector_pre_provision_source_gate',P/'source-gates-final.py')
    _,selector_source=G.reviewed_source(SELECTOR)
    argv=docker_create(SELECTOR_NAME,['/usr/local/bin/python3.12','-B','-c',selector_source.decode('utf8')],selector=True)
    _,paths=run('linux-selector-create',argv,30)
    cid=paths['stdout'].read_text().strip()
    assert len(cid)==64 and all(c in '0123456789abcdef'for c in cid)
    OWNED_IDS[SELECTOR_NAME]=cid
    _,paths=run('linux-selector-pre-provision-inspect',['docker','inspect',SELECTOR_NAME],30)
    assert_recipe(strict_json(paths['stdout'].read_bytes())[0],SELECTOR_NAME,selector=True)


def retire_linux_selector():
    retired = strict_json((S/'target.json').read_bytes())
    before = strict_json((S/'target-pre-retirement.json').read_bytes())
    assert retired['operation'] == OP and retired['retired'] is True
    assert retired['deleted'] is True and retired['active'] is False
    data = json.dumps({'before': before, 'after': retired}).encode()
    assert 0 < len(data) <= 65536
    G=load_module('selector_current_source_gate',P/'source-gates-final.py')
    _,selector_source=G.reviewed_source(SELECTOR)
    assert OWNED_COMMANDS[SELECTOR_NAME] == ['/usr/local/bin/python3.12','-B','-c',selector_source.decode('utf8')]
    assert SELECTOR_NAME in OWNED_IDS
    try:
        _, paths = run('linux-selector-initial-inspect', ['docker', 'inspect', SELECTOR_NAME], 30)
        assert_recipe(strict_json(paths['stdout'].read_bytes())[0], SELECTOR_NAME, selector=True)
        _, paths = run('linux-selector-retirement', ['docker', 'start', '--attach', '--interactive', SELECTOR_NAME], 60, input_bytes=data)
        result = strict_json(paths['stdout'].read_bytes())
        assert result['status'] == 'PASS' and result['historicalCustodyRepaired'] is False
        assert result['targetAbsent'] is True or result['retiredSelectorInvalidated'] is True
        _, paths = run('linux-selector-terminal-inspect', ['docker', 'inspect', SELECTOR_NAME], 30)
        obj = strict_json(paths['stdout'].read_bytes())[0]
        assert_recipe(obj, SELECTOR_NAME, selector=True, initial=False)
        assert obj['State']['Running'] is False and type(obj['State']['ExitCode']) is int and obj['State']['ExitCode'] == 0 and obj['State']['OOMKilled'] is False
    finally:
        cleanup_owned(SELECTOR_NAME, 'selector-final')


def main():
    global C
    binding = preflight()
    for name in ('target.json', 'deploy.env', 'created-project.json', 'provision-attempt.json'):
        assert not (S/name).exists()
    assert not EXPORT.exists() and not LOG.exists() and not (P/'runtime').exists() and not RETIREMENT.exists()
    C = load_module('bounded_actual_private_coordinator', COMMON)
    G = load_module('repair1_source_gate', P/'source-gates-final.py')
    H = load_module('repair1_held_acquisition', P/'held-acquisition.py')
    a_pin, _ = G.reviewed_source(Q/'attempt5/source-acquisition.py')
    t_pin, _ = G.reviewed_source(Q/'transport-prep/private-transport.py')
    A = H.load_acquisition(Q/'attempt5/source-acquisition.py', Q/'transport-prep/private-transport.py', a_pin, t_pin, R)
    T = A.T
    LOG.mkdir(mode=0o700)
    (P/'runtime').mkdir(mode=0o700)
    D = load_module('attempt6_immutable_official_dispatcher', P/'official-dispatcher-final.py')
    D.MODULE_LOADER = load_module
    received = completed = retired = provision_attempted = receiver_attempted = False
    source_held = producer = None
    failures = []
    def failed(phase, error):
        failures.append({'phase': phase, 'failureClass': type(error).__name__})
    def close_holds():
        nonlocal producer, source_held
        fds = []
        if producer is not None:
            # These are the immutable HeldProducer's explicitly owned fields.
            # Detach first: a failed close must never retry a possibly reused FD.
            held_producer, producer = producer, None
            if not held_producer.closed:
                fds += [('producer-close', row['fd']) for row in held_producer.rows]
                fds.append(('producer-close', held_producer.root_fd))
                held_producer.closed = True
        if source_held is not None:
            held_source, source_held = source_held, None
            fds += [('source-close', row['fd']) for row in held_source[3]]
            fds.append(('source-close', held_source[2]))
        for phase, fd in fds:
            try:
                os.close(fd)
            except BaseException as error:
                failed(phase, error)
    try:
        EXPORT.mkdir(mode=0o700); (EXPORT/'selected').mkdir(mode=0o700)
        signal.signal(signal.SIGTERM, abort); signal.signal(signal.SIGINT, abort)
        _, paths = run('resource-preflight-running', ['docker', 'ps', '--quiet'], 30)
        assert paths['stdout'].read_bytes().strip() == b''
        _, paths = run('resource-preflight-owned-volume', ['docker', 'volume', 'inspect', VOLUME], 30)
        volume = strict_json(paths['stdout'].read_bytes())[0]
        assert volume['Name'] == VOLUME and volume['Labels']['cortex.operation'] == OP
        assert volume['Labels']['cortex.goal'] == 'convex-backend-runtime-2026-10-02'
        assert volume['Driver'] == 'local' and volume['Scope'] == 'local' and not volume['Options']
        # Every exact crypto/deploy/native container is created and qualified before provisioning.
        D.prepare(C)
        command = receiver_command()
        _, created_paths = run('private-receiver-create', docker_create(NAME, command), 30)
        cid = created_paths['stdout'].read_text().strip()
        assert len(cid) == 64 and all(c in '0123456789abcdef' for c in cid)
        OWNED_IDS[NAME] = cid
        _, paths = run('private-receiver-initial-inspect', ['docker', 'inspect', NAME], 30)
        assert_recipe(strict_json(paths['stdout'].read_bytes())[0], NAME)
        prepare_linux_selector()
        G.qualify_sources()
        provision_attempted = True
        run('provision', [str(TOOL/'node'), str(MGMT), 'provision'], 190)
        source_held = T.open_sources(S, T.NAMES)
        stage = T.copy_private(S, EXPORT/'selected', binding, stage=True)
        C.durable_json(LOG/'host-stage-custody.json', stage)
        producer = A.HeldProducer(EXPORT/'selected', binding)
        frames = b''.join(producer.frames())
        assert 0 < len(frames) <= A.MAX_TOTAL
        def verify_held():
            producer.verify(); T.verify_sources(*source_held)
        _, paths = run('private-receiver-current-inspect', ['docker','inspect',NAME],30)
        assert_recipe(strict_json(paths['stdout'].read_bytes())[0],NAME)
        G.qualify_sources()
        receiver_attempted = True
        _, paths = run('private-receiver', ['docker', 'start', '--attach', '--interactive', NAME], 60,
                       input_bytes=frames, progress=verify_held)
        result = A.strict_json(paths['stdout'].read_bytes())
        assert result['status'] == 'PASS' and result['sourceFiles'] == 4 and result['copiedFiles'] == 3
        assert result['nativeAllNineAndFullContents'] is True
        assert result['scope'] == 'PUBLIC_DUMMY_NATIVE_SOURCE_THEN_UNCHANGED_HELPER'
        _, paths = run('private-receiver-terminal-inspect', ['docker', 'inspect', NAME], 30)
        terminal = strict_json(paths['stdout'].read_bytes())[0]
        assert_recipe(terminal, NAME, initial=False)
        assert terminal['State']['Running'] is False and type(terminal['State']['ExitCode']) is int and terminal['State']['ExitCode'] == 0 and terminal['State']['OOMKilled'] is False
        verify_held()
        C.durable_json(LOG/'host-source-custody.json', {'operation': OP, 'status': 'PASS',
            'originalDirectoryIdentityDecimal': T.identity(source_held[1]),
            'originalFiles': [{'name': row['name'], 'identityDecimal': row['identity'], 'sha256': row['sha256'], 'bytes': len(row['bytes'])} for row in source_held[3]],
            'stageDirectoryIdentityDecimal': T.identity(producer.before),
            'stageFiles': [{'name': row['name'], 'identityDecimal': row['identity'], 'sha256': row['sha256'], 'bytes': len(row['bytes'])} for row in producer.rows],
            'hostDescriptorsHeldThroughTerminalAndDurableReceipt': True, 'actualPrivateCryptographicAcceptance': False})
        verify_held()
        close_holds()
        if failures:
            raise RuntimeError('held_descriptor_release_failed')
        cleanup_owned(NAME, 'received')
        received = True
        status('ACTUAL_PRIVATE_TRANSFER_AWAITING_INDEPENDENT_REVIEW', 'HELD', privateFilesTransferred=3,
               nativeSourceFiles=4, cliDispatched=False, actualPrivateCryptographicAcceptance=False)
        deadline = time.monotonic()+2400
        observer_sha = D.observe_crypto(deadline)
        actual = D.execute(deadline, observer_sha)
        if actual['status'] != 'PASS':
            raise RuntimeError('official_or_native_outcome_failed')
        status('NATIVE_OUTCOME_AWAITING_INDEPENDENT_REVIEW', 'HELD', cliDispatched=True, nativeOutcomeObserved=True, independentFoundationAcceptance=False)
        while time.monotonic() < deadline:
            end = LOG/'coordinator-finish.json'
            if end.exists():
                value = strict_json(end.read_bytes())
                assert time.monotonic() < deadline, 'finish_read_completed_after_original_deadline'
                assert value['operation'] == OP and value['finish'] is True
                assert value['candidateSha256'] == FREEZE
                assert value['actualNativeOutcomeIndependentlyReviewed'] is True
                assert time.monotonic() < deadline, 'finish_validation_completed_after_original_deadline'
                completed = True; break
            time.sleep(0.5)
        if not completed:
            raise TimeoutError('forty_minute_coordinator_wait_expired')
    except BaseException as error:
        failed('main', error)
        try:
            status('COORDINATOR_FAILURE_RETIREMENT_REQUIRED', 'FAIL', failureClass=type(error).__name__)
        except BaseException as status_error:
            failed('failure-status', status_error)
    finally:
        close_holds()
        for sig in (signal.SIGTERM, signal.SIGINT):
            try:
                signal.signal(sig, signal.SIG_IGN)
            except BaseException as error:
                failed('signal-cleanup', error)
        try:
            for item in D.cleanup():
                failures.append({'phase': 'official-container-cleanup', **item})
        except BaseException as error:
            failed('official-container-cleanup', error)
        # The prepared selector remains owned until physical retirement has
        # supplied its data; it cannot be removed before that invalidation.
        for name in (NAME,):
            try:
                cleanup_owned(name, 'final')
            except BaseException as error:
                failed('container-cleanup-'+name, error)
        # Even an uncertain provision result attempts the reviewed management
        # retire path. That helper rejects before API if exclusive ownership is
        # absent/mismatched; a missing ownership receipt is never guessed.
        if provision_attempted:
            try:
                run('retire', [str(TOOL/'node'), str(MGMT), 'retire'], 190)
                receipt = strict_json(RETIREMENT.read_bytes())
                assert receipt['operation'] == OP and receipt['requestSha256'] == binding['requestSha256']
                assert receipt['retired'] is True and receipt['deleted'] is True
                assert receipt['deletionHttpStatus'] == 200 and receipt['verificationHttpStatus'] == 404
                assert receipt['productionMutations'] == 0
                retired = True
                if receiver_attempted:
                    retire_linux_selector()
            except BaseException as error:
                failed('retirement', error)
        try:
            cleanup_owned(SELECTOR_NAME,'final-selector')
        except BaseException as error:
            failed('container-cleanup-'+SELECTOR_NAME,error)
        terminal = {'operation': OP, 'retired': retired, 'failures': failures,
                    'completedSignal': completed, 'received': received, 'records': RECORDS,
                    'provisionAttempted': provision_attempted, 'privateContentsPrinted': False}
        # Retirement precedes reporting; a failed public/durable receipt cannot
        # suppress the physical-retirement attempt or become a success.
        try:
            C.durable_json(LOG/'coordinator-terminal.json', terminal)
        except BaseException as error:
            failed('terminal-receipt', error)
        status('COORDINATOR_TERMINAL', 'PASS' if completed and retired and not failures else 'FAIL',
               physicalProjectRetired=retired, completionSignal=completed, failures=failures)
    if not completed or not retired or failures:
        raise SystemExit(1)


if __name__ == '__main__':
    main()
