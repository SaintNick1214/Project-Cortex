"""Prospective first-use coordinator. Independent approval is required before effects.

Public source controls replace every external effect explicitly. They are not
production attestations. This recipe never dispatches the official CLI; private
cryptographic/native custody requires its own subsequent independent judgment.
"""
from pathlib import Path
import datetime
import hashlib
import importlib.util
import json
import os
import signal
import time

R = Path('/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion')
P = R / '_goals/convex-backend-runtime-2026-10-02/qa/local-resume-2026-10-05'
Q = P.parent / 'task03-local-native-attempt5-2026-10-06'
B = P / 'task03-attempt5-private-source-repair1'
RECIPE = Q / 'coordinate-source/repair2'
COMMON = RECIPE / 'task03-attempt5-coordinate-common.py'
SELECTOR = B / 'task03-attempt5-retire-selector.py'
APPROVAL = B / 'independent-private-coordinator-source-review.json'
S = Path('/Users/SaintNick/.codex/tmp/cortex-runtime-task03-attempt5-private-20261006')
TOOL = Path('/Users/SaintNick/.codex/tmp/cortex-runtime-toolchain-20261005/node_modules/.bin')
OP = 'ba2253a8-26a7-4db5-b503-9bca6710471c'
VOLUME = 'cortex-task03-attempt5-fixture-20261006-ba2253a8'
IMAGE = 'sha256:9ff43bfe7849197a6dfbaa80f2d11a34db4202d8aaae269ddc8b740f7da75fb3'
FREEZE = '053e131a8f408031af7ead1e2c8c73f75954ba5acd905eac9e6091a24429e570'
MANAGEMENT_SHA = '3b52d3f99eb66294a0ffc1ed11c43cabe7062400da53b978db8878b6389a6216'
PRIVATE_HELPER_SHA = 'ecb1eff9a9edf025e2b7eb9108580857ff41da8bb54e8956251b219a5bebc23e'
SELECTOR_SHA = '6ed06bdfb8a5499bdc2fabeda7ef2e3f4aa23a881011172ed810dd969818550a'
EXPORT = S / ('actual-private-export-' + OP)
LOG = S / 'coordination'
NAME = 'cortex-task03-attempt5-private-ba2253a8'
SELECTOR_NAME = 'cortex-task03-attempt5-selector-ba2253a8'
OWNED_NAMES = (NAME, 'cortex-task03-attempt5-deploy-ba2253a8',
               'cortex-task03-attempt5-driver-ba2253a8', SELECTOR_NAME)
MGMT = P / 'task03-attempt5-target-management.mjs'
RETIREMENT = P / 'task03-attempt5-target-retirement.json'
PUBLIC = B / 'task03-attempt5-private-coordinate-status.json'
RECORDS = []


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
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def dependencies():
    return [COMMON, MGMT, Q/'candidate-freeze-attempt5.json',
            Q/'independent-preparation-review.json', P/'task03-attempt5-management-review.json',
            P/'task03-attempt5-linux-public-custody-review.json', Q/'attempt5/source-acquisition.py',
            Q/'transport-prep/private-transport.py', Q/'transport-prep/transport-binding.json',
            SELECTOR, RECIPE/'source-receipt-manifest.json', RECIPE/'public-recipe-binding.json']


def preflight():
    # All reads here are public. Do not touch S or import an effectful helper
    # until source approval, every dependency, and all enabling scopes agree.
    assert os.getuid() == 501 and os.getgid() == 20
    approval = strict_json(APPROVAL.read_bytes())
    assert approval['verdict'] == 'PASS' and approval['independent'] is True
    assert approval['scope'] == 'TASK03_FIXED_RECIPE_COORDINATOR_SOURCE_ONLY'
    assert approval['coordinatorSha256'] == digest(Path(__file__))
    paths = dependencies()
    assert set(approval['dependencies']) == {str(path.relative_to(R)) for path in paths}
    for path in paths:
        assert digest(path) == approval['dependencies'][str(path.relative_to(R))]
    assert approval['freezeSha256'] == digest(Q/'candidate-freeze-attempt5.json') == FREEZE
    assert digest(MGMT) == MANAGEMENT_SHA
    assert digest(Q/'transport-prep/private-transport.py') == PRIVATE_HELPER_SHA
    assert digest(SELECTOR) == SELECTOR_SHA
    prep = strict_json((Q/'independent-preparation-review.json').read_bytes())
    management = strict_json((P/'task03-attempt5-management-review.json').read_bytes())
    custody = strict_json((P/'task03-attempt5-linux-public-custody-review.json').read_bytes())
    for review, scope in [(prep, 'BOUNDED_03_FOUNDATION_CURRENT_DELTA_PREPARATION'),
                          (management, 'TASK03_DISPOSABLE_TARGET_MANAGEMENT_ONLY'),
                          (custody, 'TASK03_ACTUAL_PUBLIC_LINUX_CUSTODY_ONLY')]:
        assert review['verdict'] == 'PASS' and review['independent'] is True and review['scope'] == scope
    assert prep['candidateSha256'] == FREEZE and prep['candidateMembers'] == 1905
    public = strict_json((RECIPE/'public-recipe-binding.json').read_bytes())
    assert public['scope'] == 'PUBLIC_RECIPE_BINDING_ONLY_NOT_ACCEPTANCE'
    assert public['preparationFreezeSha256'] == FREEZE and public['preparationMembers'] == 1905
    assert public['publicCopiedFiles'] == 1912 and public['sourceBundleExcludedFromPreparationMembership'] is True
    assert public['recipeNamespace'] == str(RECIPE.relative_to(R))
    assert public['ownedSourceMounts'] == {'candidate': str(Q), 'helper': str(RECIPE)}
    binding = strict_json((Q/'transport-prep/transport-binding.json').read_bytes())
    assert binding['operation'] == OP and binding['privateEnvironmentFile'] == str(S/'deploy.env')
    assert management['managementSourceSha256'] == MANAGEMENT_SHA
    assert management['requestSha256'] == binding['requestSha256']
    # Future actual custody attestation must bind the current recipe and exact
    # complete public transfer. A source-only verdict cannot satisfy this gate.
    assert custody['candidateSha256'] == FREEZE and custody['operation'] == OP
    assert custody['volume'] == VOLUME and custody['publicFiles'] == 1912
    assert custody['publicSourceManifestSha256'] == digest(RECIPE/'source-receipt-manifest.json')
    assert custody['publicRecipeBindingSha256'] == digest(RECIPE/'public-recipe-binding.json')
    assert custody['allCurrentDestinationIdentities'] == 'PASS_ALL9'
    assert custody['currentSourceDestinationFullContent'] == 'PASS'
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
             'volume': VOLUME, 'privateContentsPrinted': False,
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
    assert obj['Image'] == IMAGE
    assert type(obj['State']['Running']) is bool


def assert_recipe(obj, name, selector=False):
    inspect_owned(obj, name)
    host = obj['HostConfig']
    assert obj['Config']['User'] == '501:20' and obj['State']['Running'] is False
    assert host['NetworkMode'] == 'none' and host['ReadonlyRootfs'] is True
    assert host['Memory'] == host['MemorySwap'] == 536870912
    assert host['PidsLimit'] == 64 and host['NanoCpus'] == 2000000000
    expected = [{'Type': 'volume', 'Source': VOLUME, 'Target': '/owned', 'VolumeOptions': {'NoCopy': True}}]
    if not selector:
        expected.append({'Type': 'volume', 'Source': VOLUME, 'Target': '/prep', 'ReadOnly': True,
                         'VolumeOptions': {'NoCopy': True, 'Subpath': 'candidate'}})
    assert host['Mounts'] == expected
    mounts = obj['Mounts']
    assert len(mounts) == len(expected)
    assert all(m['Type'] == 'volume' and m['Name'] == VOLUME for m in mounts)
    assert {m['Destination']: m['RW'] for m in mounts} == ({'/owned': True} if selector else {'/owned': True, '/prep': False})


def docker_create(name, command, selector=False):
    argv = ['docker', 'create', '--interactive', '--platform', 'linux/amd64', '--network', 'none',
            '--memory', '512m', '--memory-swap', '512m', '--cpus', '2', '--pids-limit', '64',
            '--read-only', '--name', name, '--label', 'cortex.operation='+OP, '--user', '501:20',
            '--mount', 'type=volume,source='+VOLUME+',target=/owned,volume-nocopy']
    if not selector:
        argv += ['--mount', 'type=volume,source='+VOLUME+',target=/prep,volume-subpath=candidate,readonly,volume-nocopy']
    return argv+[IMAGE]+command


def cleanup_owned(name, prefix):
    code, paths = run(prefix+'-inspect-'+name, ['docker', 'inspect', name], 30, required=False)
    if code != 0:
        assert type(code) is int and code == 1
        assert paths['stdout'].read_bytes() == b''
        assert paths['stderr'].read_bytes().strip().lower() == ('error: no such object: '+name).encode()
        return
    obj = strict_json(paths['stdout'].read_bytes())[0]
    inspect_owned(obj, name)
    if obj['State']['Running']:
        run(prefix+'-kill-'+name, ['docker', 'kill', name], 30)
    _, terminal_paths = run(prefix+'-terminal-'+name, ['docker', 'inspect', name], 30)
    terminal = strict_json(terminal_paths['stdout'].read_bytes())[0]
    inspect_owned(terminal, name)
    assert terminal['State']['Running'] is False
    run(prefix+'-remove-'+name, ['docker', 'rm', name], 30)
    code, paths = run(prefix+'-absence-'+name, ['docker', 'inspect', name], 30, required=False)
    assert type(code) is int and code == 1 and paths['stdout'].read_bytes() == b''
    assert paths['stderr'].read_bytes().strip().lower() == ('error: no such object: '+name).encode()


def retire_linux_selector():
    retired = strict_json((S/'target.json').read_bytes())
    before = strict_json((S/'target-pre-retirement.json').read_bytes())
    assert retired['operation'] == OP and retired['retired'] is True
    assert retired['deleted'] is True and retired['active'] is False
    data = json.dumps({'before': before, 'after': retired}).encode()
    assert 0 < len(data) <= 65536
    argv = docker_create(SELECTOR_NAME, ['/usr/local/bin/python3.12', '-B', '-c', SELECTOR.read_text()], selector=True)
    try:
        run('linux-selector-create', argv, 30)
        _, paths = run('linux-selector-initial-inspect', ['docker', 'inspect', SELECTOR_NAME], 30)
        assert_recipe(strict_json(paths['stdout'].read_bytes())[0], SELECTOR_NAME, selector=True)
        _, paths = run('linux-selector-retirement', ['docker', 'start', '--attach', '--interactive', SELECTOR_NAME], 60, input_bytes=data)
        result = strict_json(paths['stdout'].read_bytes())
        assert result['status'] == 'PASS' and result['historicalCustodyRepaired'] is False
        assert result['targetAbsent'] is True or result['retiredSelectorInvalidated'] is True
        _, paths = run('linux-selector-terminal-inspect', ['docker', 'inspect', SELECTOR_NAME], 30)
        obj = strict_json(paths['stdout'].read_bytes())[0]
        inspect_owned(obj, SELECTOR_NAME)
        assert obj['State']['Running'] is False and obj['State']['ExitCode'] == 0 and obj['State']['OOMKilled'] is False
    finally:
        cleanup_owned(SELECTOR_NAME, 'selector-final')


def main():
    global C
    binding = preflight()
    for name in ('target.json', 'deploy.env', 'created-project.json', 'provision-attempt.json'):
        assert not (S/name).exists()
    assert not EXPORT.exists() and not LOG.exists() and not PUBLIC.exists() and not RETIREMENT.exists()
    C = load_module('bounded_actual_private_coordinator', COMMON)
    A = load_module('prospective_native_source_acquisition', Q/'attempt5/source-acquisition.py')
    T = A.T
    LOG.mkdir(mode=0o700)
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
        command = ['/usr/local/bin/python3.12', '-B', '/prep/attempt5/source-acquisition.py', 'receive-copy',
                   '/owned/native', 'source-'+OP, '/owned/private', '/prep/transport-prep/transport-binding.json', '/owned/receipts']
        run('private-receiver-create', docker_create(NAME, command), 30)
        _, paths = run('private-receiver-initial-inspect', ['docker', 'inspect', NAME], 30)
        assert_recipe(strict_json(paths['stdout'].read_bytes())[0], NAME)
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
        receiver_attempted = True
        _, paths = run('private-receiver', ['docker', 'start', '--attach', '--interactive', NAME], 60,
                       input_bytes=frames, progress=verify_held)
        result = A.strict_json(paths['stdout'].read_bytes())
        assert result['status'] == 'PASS' and result['sourceFiles'] == 4 and result['copiedFiles'] == 3
        assert result['nativeAllNineAndFullContents'] is True
        assert result['scope'] == 'PUBLIC_DUMMY_NATIVE_SOURCE_THEN_UNCHANGED_HELPER'
        _, paths = run('private-receiver-terminal-inspect', ['docker', 'inspect', NAME], 30)
        terminal = strict_json(paths['stdout'].read_bytes())[0]
        inspect_owned(terminal, NAME)
        assert terminal['State']['Running'] is False and terminal['State']['ExitCode'] == 0 and terminal['State']['OOMKilled'] is False
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
        while time.monotonic() < deadline:
            end = LOG/'coordinator-finish.json'
            if end.exists():
                value = strict_json(end.read_bytes())
                assert value['operation'] == OP and value['finish'] is True
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
        for name in OWNED_NAMES:
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
