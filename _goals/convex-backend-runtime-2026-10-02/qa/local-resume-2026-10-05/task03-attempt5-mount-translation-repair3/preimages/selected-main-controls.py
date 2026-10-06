"""Selected original harness definitions plus focused new controls.
Every effect is explicitly mocked in a new public dummy namespace.
No original cohort is regenerated, no real approval is written.
"""
import sys
sys.dont_write_bytecode = True
from pathlib import Path
B = Path(__file__).resolve().parent
SOURCE = Path('/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion') / '_goals/convex-backend-runtime-2026-10-02/qa/local-resume-2026-10-05/task03-attempt5-private-source-repair3/task03-attempt5-private-coordinate.py'
RESULTS = []
RUN_ID = 'selected-source-mocks'
RAW = B / 'raw' / RUN_ID
RAW.mkdir(parents=True)
from pathlib import Path
import copy
import hashlib
import importlib.util
import json
import os
import sys
import types

def load_candidate():
    spec = importlib.util.spec_from_file_location('private_candidate_mock', SOURCE)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module

def dump(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, indent=2) + '\n')

def scenario(name, mutation=None, fault=None, expected='FAIL', no_provision=False, recipe_mutation=None):
    m = load_candidate()
    root = B / 'fixtures' / RUN_ID / name
    root.mkdir(mode=448, parents=True)
    events = []
    commands = []
    containers = {}
    statuses = []
    calls = {'clock': 0}
    m.R = root
    m.P = root / 'public'
    m.Q = root / 'preparation'
    m.B = root / 'source-bundle'
    m.RECIPE = m.Q / 'coordinate-source/repair3'
    m.COMMON = m.RECIPE / 'task03-attempt5-coordinate-common.py'
    m.SELECTOR = m.B / 'selector.py'
    m.APPROVAL = m.B / 'independent-source-review.json'
    m.S = root / 'PUBLIC_DUMMY_PRIVATE_SHAPE'
    m.S.mkdir(mode=448)
    m.EXPORT = m.S / ('export-' + m.OP)
    m.LOG = m.S / 'coordination'
    m.PUBLIC = m.B / 'status.json'
    m.MGMT = m.P / 'management.mjs'
    m.RETIREMENT = m.P / 'retirement.json'
    m.RECORDS = []
    m.os = types.SimpleNamespace(**{key: getattr(os, key) for key in dir(os) if not key.startswith('__')})
    m.os.getuid = lambda: 501
    m.os.getgid = lambda: 20
    m.os.close = lambda fd: (events.append('fake-source-close:' + str(fd)), (_ for _ in ()).throw(OSError('MOCK_CLOSE_FAILURE')) if fault == 'descriptor-close' and fd == 9001 or (fault == 'producer-close' and fd == 9101) else None)[1]
    m.signal = types.SimpleNamespace(SIGTERM=15, SIGINT=2, SIG_IGN=1, signal=lambda *args: (events.append('fake-signal:' + str(args[0])), (_ for _ in ()).throw(OSError('MOCK_SIGNAL_FAILURE')) if fault == 'signal-cleanup' and args[1] == 1 else None)[1])

    def clock():
        calls['clock'] += 1
        return calls['clock'] * (2500 if fault == 'wait-deadline' else 0.1)
    m.time = types.SimpleNamespace(monotonic=clock, sleep=lambda seconds: events.append('fake-wait'))

    def status(phase, result, **fields):
        events.append('fake-status:' + phase)
        statuses.append({'phase': phase, 'status': result, **fields})
        if fault == 'failure-status' and phase == 'COORDINATOR_FAILURE_RETIREMENT_REQUIRED':
            raise OSError('MOCK_STATUS_FAILURE')
    m.status = status
    binding = {'operation': m.OP, 'privateEnvironmentFile': str(m.S / 'deploy.env'), 'requestSha256': 'd' * 64}
    prep = {'verdict': 'PASS', 'independent': True, 'scope': 'BOUNDED_03_FOUNDATION_CURRENT_DELTA_PREPARATION', 'candidateSha256': m.FREEZE, 'candidateMembers': 1905}
    management = {'verdict': 'PASS', 'independent': True, 'scope': 'TASK03_DISPOSABLE_TARGET_MANAGEMENT_ONLY', 'managementSourceSha256': m.MANAGEMENT_SHA, 'requestSha256': binding['requestSha256']}
    public = {'scope': 'PUBLIC_RECIPE_BINDING_ONLY_NOT_ACCEPTANCE', 'preparationFreezeSha256': m.FREEZE, 'preparationMembers': 1905, 'publicCopiedFiles': 1912, 'sourceBundleExcludedFromPreparationMembership': True, 'recipeNamespace': str(m.RECIPE.relative_to(m.R)), 'ownedSourceMounts': {'candidate': str(m.Q), 'helper': str(m.RECIPE)}}
    documents = {m.Q / 'independent-preparation-review.json': prep, m.P / 'task03-attempt5-management-review.json': management, m.RECIPE / 'public-recipe-binding.json': public, m.Q / 'transport-prep/transport-binding.json': binding}
    for path in m.dependencies():
        dump(path, documents.get(path, {'mockedPublicSource': str(path.relative_to(root))}))
    original_digest = m.digest
    hard = {m.Q / 'candidate-freeze-attempt5.json': m.FREEZE, m.MGMT: m.MANAGEMENT_SHA, m.Q / 'transport-prep/private-transport.py': m.PRIVATE_HELPER_SHA, m.SELECTOR: m.SELECTOR_SHA}

    def digest(path):
        events.append('mock-source-hash:' + str(path.relative_to(root)) if path.is_relative_to(root) else 'actual-candidate-hash')
        return hard.get(path, original_digest(path))
    m.digest = digest
    custody = {'verdict': 'PASS', 'independent': True, 'scope': 'TASK03_ACTUAL_PUBLIC_LINUX_CUSTODY_ONLY', 'candidateSha256': m.FREEZE, 'operation': m.OP, 'volume': m.VOLUME, 'publicFiles': 1912, 'publicSourceManifestSha256': digest(m.RECIPE / 'source-receipt-manifest.json'), 'publicRecipeBindingSha256': digest(m.RECIPE / 'public-recipe-binding.json'), 'allCurrentDestinationIdentities': 'PASS_ALL9', 'currentSourceDestinationFullContent': 'PASS'}
    dump(m.P / 'task03-attempt5-linux-public-custody-review.json', custody)
    approval = {'verdict': 'PASS', 'independent': True, 'scope': 'TASK03_FIXED_RECIPE_COORDINATOR_SOURCE_ONLY', 'coordinatorSha256': original_digest(SOURCE), 'freezeSha256': m.FREEZE, 'dependencies': {str(path.relative_to(root)): digest(path) for path in m.dependencies()}}
    if mutation:
        mutation(m, approval, prep, management, custody, public, binding)
        for path, value in [(m.Q / 'independent-preparation-review.json', prep), (m.P / 'task03-attempt5-management-review.json', management), (m.P / 'task03-attempt5-linux-public-custody-review.json', custody), (m.RECIPE / 'public-recipe-binding.json', public), (m.Q / 'transport-prep/transport-binding.json', binding)]:
            dump(path, value)
        if name != 'dependency-hash-drift':
            for path in m.dependencies():
                key = str(path.relative_to(root))
                if key in approval['dependencies']:
                    approval['dependencies'][key] = digest(path)
    dump(m.APPROVAL, approval)
    if fault == 'approval-absent':
        m.APPROVAL.unlink()
    if fault == 'target-exists':
        dump(m.S / 'target.json', {'publicDummy': True})
    if fault == 'retirement-exists':
        dump(m.RETIREMENT, {'publicDummy': True})
    events.clear()

    def object_for(container_name, selector=False):
        mounts = [{'Type': 'volume', 'Source': m.VOLUME, 'Target': '/owned', 'VolumeOptions': {'NoCopy': True}}]
        view = [{'Type': 'volume', 'Name': m.VOLUME, 'Destination': '/owned', 'RW': True}]
        if not selector:
            mounts.append({'Type': 'volume', 'Source': m.VOLUME, 'Target': '/prep', 'ReadOnly': True, 'VolumeOptions': {'NoCopy': True, 'Subpath': 'candidate'}})
            view.append({'Type': 'volume', 'Name': m.VOLUME, 'Destination': '/prep', 'RW': False})
        return {'Name': '/' + container_name, 'Image': m.IMAGE, 'Config': {'Labels': {'cortex.operation': m.OP}, 'User': '501:20'}, 'HostConfig': {'NetworkMode': 'none', 'ReadonlyRootfs': True, 'Memory': 536870912, 'MemorySwap': 536870912, 'PidsLimit': 64, 'NanoCpus': 2000000000, 'Mounts': mounts}, 'Mounts': view, 'State': {'Running': False, 'ExitCode': 0, 'OOMKilled': False}}

    class FakeCommon:

        @staticmethod
        def durable_json(path, value):
            events.append('fake-durable:' + path.name)
            if fault == 'terminal-receipt' and path.name == 'coordinator-terminal.json':
                raise OSError('MOCK_DURABLE_FAILURE')
            if fault == 'stage-receipt' and path.name == 'host-stage-custody.json':
                raise OSError('MOCK_DURABLE_FAILURE')
            if fault == 'custody-receipt' and path.name == 'host-source-custody.json':
                raise OSError('MOCK_DURABLE_FAILURE')
            dump(path, value)

        @staticmethod
        def run(label, argv, directory, timeout, env, input_bytes=None, required=None, progress=None):
            events.append('fake-command:' + label)
            commands.append({'label': label, 'argv': argv, 'timeout': timeout, 'required': required, 'stdinBytes': len(input_bytes) if input_bytes is not None else None, 'mocked': True})
            assert required is False and timeout <= 190
            out = b''
            err = b''
            code = 0
            terminal = True
            close = []
            failure = None
            if argv[:3] == ['docker', 'ps', '--quiet']:
                if fault == 'foreign-running':
                    out = b'FOREIGN_DUMMY_ID\n'
            elif argv[:3] == ['docker', 'volume', 'inspect']:
                volume = {'Name': m.VOLUME, 'Labels': {'cortex.operation': m.OP, 'cortex.goal': 'convex-backend-runtime-2026-10-02'}, 'Driver': 'local', 'Scope': 'local', 'Options': None}
                if fault == 'volume-foreign-operation':
                    volume['Labels']['cortex.operation'] = 'FOREIGN'
                if fault == 'volume-foreign-goal':
                    volume['Labels']['cortex.goal'] = 'FOREIGN'
                if fault == 'volume-driver':
                    volume['Driver'] = 'REMOTE'
                if fault == 'volume-name':
                    volume['Name'] = 'FOREIGN'
                if fault == 'volume-options':
                    volume['Options'] = {'public': 'drift'}
                out = json.dumps([volume]).encode()
            elif argv[:2] == ['docker', 'create']:
                container_name = argv[argv.index('--name') + 1]
                assert '--label' in argv and argv[argv.index('--label') + 1] == 'cortex.operation=' + m.OP
                assert '--network' in argv and argv[argv.index('--network') + 1] == 'none'
                assert m.IMAGE in argv and all(('/Users/' not in item for item in argv))
                containers[container_name] = object_for(container_name, container_name == m.SELECTOR_NAME)
                if fault == 'create-failure' and container_name == m.NAME:
                    code = 1
                out = b'MOCK_OWNED_CONTAINER\n'
            elif argv[:2] == ['docker', 'inspect']:
                container_name = argv[2]
                obj = copy.deepcopy(containers.get(container_name))
                if obj is None:
                    code = 1
                    err = ('Error: No such object: ' + container_name + '\n').encode()
                else:
                    if recipe_mutation is not None and label in ('private-receiver-initial-inspect', 'linux-selector-initial-inspect'):
                        recipe_mutation(label, obj)
                        events.append('fake-inspection-recipe-mutation:' + label)
                    if label == 'private-receiver-initial-inspect' and fault and fault.startswith('recipe-'):
                        if fault == 'recipe-label':
                            obj['Config']['Labels']['cortex.operation'] = 'FOREIGN'
                        if fault == 'recipe-image':
                            obj['Image'] = 'FOREIGN'
                        if fault == 'recipe-running':
                            obj['State']['Running'] = True
                        if fault == 'recipe-mount':
                            obj['Mounts'][0]['Name'] = 'FOREIGN'
                        if fault == 'recipe-subpath':
                            obj['HostConfig']['Mounts'][1]['VolumeOptions']['Subpath'] = 'other'
                        if fault == 'recipe-memory':
                            obj['HostConfig']['MemorySwap'] = 1073741824
                        if fault == 'recipe-cpu':
                            obj['HostConfig']['NanoCpus'] = 4000000000
                        if fault == 'recipe-user':
                            obj['Config']['User'] = '0:0'
                    if label.startswith('final-inspect-') and container_name == m.NAME:
                        if fault == 'cleanup-foreign':
                            obj['Config']['Labels']['cortex.operation'] = 'FOREIGN'
                        if fault == 'cleanup-foreign-image':
                            obj['Image'] = 'FOREIGN'
                        if fault == 'cleanup-running':
                            obj['State']['Running'] = True
                    if label.startswith('final-inspect-') and container_name == m.NAME and (fault == 'cleanup-unknown'):
                        terminal = False
                    if label == 'private-receiver-terminal-inspect':
                        if fault == 'receiver-oom':
                            obj['State']['OOMKilled'] = True
                        if fault == 'receiver-still-running':
                            obj['State']['Running'] = True
                        if fault == 'receiver-exit':
                            obj['State']['ExitCode'] = 1
                    out = json.dumps([obj]).encode()
                if label.startswith('final-inspect-') and container_name == m.NAME and (fault == 'cleanup-false-absence'):
                    code = 2
                    out = b''
                    err = ('Error: No such object: ' + container_name + '\n').encode()
            elif argv[:2] == ['docker', 'start']:
                if progress:
                    progress()
                obj = containers[argv[-1]]
                obj['State']['Running'] = False
                if label == 'private-receiver':
                    result = {'status': 'PASS', 'sourceFiles': 4, 'copiedFiles': 3, 'nativeAllNineAndFullContents': True, 'scope': 'PUBLIC_DUMMY_NATIVE_SOURCE_THEN_UNCHANGED_HELPER'}
                    if fault == 'transport-failure':
                        code = 1
                    if fault == 'transport-unknown':
                        terminal = False
                    if fault == 'transport-close-error':
                        close = ['MOCK_CLOSE']
                    if fault == 'transport-failure-class':
                        failure = 'MOCK_TIMEOUT'
                    if fault == 'receiver-count':
                        result['copiedFiles'] = 2
                    out = json.dumps(result).encode()
                else:
                    out = json.dumps({'status': 'PASS', 'historicalCustodyRepaired': False, 'targetAbsent': False, 'retiredSelectorInvalidated': True}).encode()
                    if fault == 'selector-command-failure':
                        code = 1
                    if fault == 'selector-terminal-unknown':
                        terminal = False
            elif argv[:2] == ['docker', 'kill']:
                assert containers[argv[2]]['Config']['Labels']['cortex.operation'] == m.OP
                assert containers[argv[2]]['Image'] == m.IMAGE
                containers[argv[2]]['State']['Running'] = False
            elif argv[:2] == ['docker', 'rm']:
                assert containers[argv[2]]['Config']['Labels']['cortex.operation'] == m.OP
                assert containers[argv[2]]['State']['Running'] is False
                del containers[argv[2]]
            elif argv[-1] == 'provision':
                events.append('fake-api:provision')
                if fault != 'provision-no-ownership':
                    dump(m.S / 'created-project.json', {'publicDummyExclusiveOwner': True})
                before = {'operation': m.OP, 'active': True, 'retired': False, 'deleted': False, 'publicDummyProject': 1}
                if fault not in ('provision-no-ownership', 'provision-partial'):
                    dump(m.S / 'target.json', before)
                if fault in ('provision-failure', 'provision-partial', 'provision-no-ownership'):
                    code = 1
                if fault == 'provision-unknown':
                    terminal = False
                if fault in ('cleanup-unknown', 'cleanup-multiple'):
                    for extra in m.OWNED_NAMES[1:3]:
                        containers[extra] = object_for(extra)
                        containers[extra]['State']['Running'] = True
            elif argv[-1] == 'retire':
                events.append('fake-retire-attempt')
                if not (m.S / 'created-project.json').exists():
                    code = 1
                    events.append('fake-ownership-rejected-before-api')
                elif fault == 'retirement-command-failure':
                    code = 1
                else:
                    events.append('fake-api:exclusive-retirement')
                    receipt = {'operation': m.OP, 'requestSha256': binding['requestSha256'], 'retired': True, 'deleted': True, 'deletionHttpStatus': 200, 'verificationHttpStatus': 404, 'productionMutations': 0}
                    if fault == 'retirement-invalid-receipt':
                        receipt['verificationHttpStatus'] = 200
                    dump(m.RETIREMENT, receipt)
                    if (m.S / 'target.json').exists():
                        before = json.loads((m.S / 'target.json').read_bytes())
                        dump(m.S / 'target-pre-retirement.json', before)
                        dump(m.S / 'target.json', {**before, 'active': False, 'retired': True, 'deleted': True})
            else:
                raise AssertionError('unmodeled effect ' + repr(argv))
            if fault == 'failure-status' and label == 'private-receiver':
                code = 1
            row = {'label': label, 'exitCode': code, 'terminal': terminal, 'closeErrors': close, 'failureClass': failure}
            directory.mkdir(exist_ok=True)
            (directory / (label + '.stdout')).write_bytes(out)
            (directory / (label + '.stderr')).write_bytes(err)
            dump(directory / (label + '.receipt.json'), row)
            return (row, out, err)
    rows = [{'name': 'public-dummy-' + str(i), 'fd': 9000 + i, 'bytes': b'PUBLIC DUMMY', 'identity': {key: '0' for key in ('dev', 'ino', 'mode', 'uid', 'gid', 'nlink', 'size', 'mtime_ns', 'ctime_ns')}, 'sha256': '0' * 64} for i in range(3)]

    class FakeTransport:
        NAMES = tuple((row['name'] for row in rows))

        @staticmethod
        def open_sources(root, names):
            assert root == m.S
            events.append('fake-secret-read:open-sources')
            if fault == 'open-sources':
                raise ValueError('MOCK_CUSTODY_FAIL')
            return (root, 'fake-all-nine-directory', 9099, rows)

        @staticmethod
        def copy_private(root, destination, binding, stage):
            events.append('fake-secret-read:stage-copy')
            assert stage is True
            if fault == 'stage-copy' or (fault and fault.startswith('cleanup-')):
                raise ValueError('MOCK_CUSTODY_FAIL')
            return {'status': 'PASS', 'mocked': True}

        @staticmethod
        def verify_sources(*args):
            events.append('fake-all-nine-source-verify')
            if fault == 'source-drift':
                raise ValueError('MOCK_CUSTODY_DRIFT')

        @staticmethod
        def identity(value):
            return {key: '0' for key in ('dev', 'ino', 'mode', 'uid', 'gid', 'nlink', 'size', 'mtime_ns', 'ctime_ns')}

    class FakeProducer:

        def __init__(self, path, binding):
            self.before = 'mock'
            self.rows = [{**row, 'fd': 9100 + index} for index, row in enumerate(rows)] + [{**rows[0], 'fd': 9103, 'name': 'public-dummy-manifest'}]
            self.root_fd = 9199
            self.closed = False
            events.append('fake-producer-open')

        def frames(self):
            events.append('fake-producer-frames')
            yield (b'' if fault == 'empty-frames' else b'x' * 327693 if fault == 'oversize-frames' else b'PUBLIC DUMMY FRAMES')

        def verify(self):
            events.append('fake-all-nine-stage-verify')
            if fault == 'stage-drift':
                raise ValueError('MOCK_CUSTODY_DRIFT')

        def close(self):
            events.append('fake-producer-close')
            if fault == 'producer-close':
                raise OSError('MOCK_CLOSE_FAIL')
    acquisition = types.SimpleNamespace(T=FakeTransport, HeldProducer=FakeProducer, MAX_TOTAL=327692, strict_json=m.strict_json)

    def fake_load(name, path):
        events.append('fake-import:' + name)
        return FakeCommon if path == m.COMMON else acquisition
    m.load_module = fake_load
    real_durable = FakeCommon.durable_json

    def durable(path, value):
        real_durable(path, value)
        if path.name == 'host-source-custody.json' and fault not in ('wait-deadline', 'wrong-completion'):
            dump(m.LOG / 'coordinator-finish.json', {'operation': m.OP, 'finish': True})
        if path.name == 'host-source-custody.json' and fault == 'wrong-completion':
            dump(m.LOG / 'coordinator-finish.json', {'operation': 'FOREIGN', 'finish': True})
    FakeCommon.durable_json = staticmethod(durable)
    failure = None
    try:
        m.main()
        actual = 'PASS'
    except BaseException as error:
        actual = 'FAIL'
        failure = type(error).__name__
    assert actual == expected, (name, actual, expected, events)
    provision = any((event == 'fake-api:provision' for event in events))
    reads = [index for index, event in enumerate(events) if event.startswith('fake-secret-read')]
    if no_provision:
        assert not provision and (not reads) and (not any((event.startswith('fake-api:') for event in events)))
    if provision:
        assert 'fake-retire-attempt' in events
        assert events.index('fake-retire-attempt') > events.index('fake-api:provision')
        for owned in m.OWNED_NAMES:
            assert any((command['label'] == 'final-inspect-' + owned for command in commands))
    for index in reads:
        assert events.index('fake-api:provision') < index
        assert events.index('fake-command:private-receiver-initial-inspect') < index
    if commands:
        first = next((index for index, event in enumerate(events) if event.startswith('fake-command:')))
        assert all((index < first for index, event in enumerate(events) if event.startswith('mock-source-hash:') or event == 'actual-candidate-hash'))
    if expected == 'FAIL' and statuses:
        assert statuses[-1]['status'] == 'FAIL'
    if fault in ('cleanup-foreign', 'cleanup-foreign-image'):
        assert not any((command['argv'][:2] in (['docker', 'kill'], ['docker', 'rm']) and command['argv'][2] == m.NAME for command in commands if command['label'].startswith('final-')))
    if fault == 'provision-no-ownership':
        assert 'fake-api:exclusive-retirement' not in events
    if fault in ('descriptor-close', 'producer-close'):
        assert all((events.count('fake-source-close:' + str(fd)) == 1 for fd in [9100, 9101, 9102, 9103, 9199, 9000, 9001, 9002, 9099]))
        assert not any((status['phase'] == 'ACTUAL_PRIVATE_TRANSFER_AWAITING_INDEPENDENT_REVIEW' for status in statuses))
        assert 'fake-retire-attempt' in events
    if fault in ('cleanup-unknown', 'cleanup-multiple'):
        assert all((extra not in containers for extra in m.OWNED_NAMES[1:3]))
        assert all((any((command['label'] == 'final-kill-' + extra for command in commands)) for extra in m.OWNED_NAMES[1:3]))
    if fault in ('provision-unknown', 'transport-unknown', 'selector-terminal-unknown'):
        assert any((row['terminal'] is False for row in m.RECORDS))
    if expected == 'PASS':
        assert not containers and statuses[-1]['status'] == 'PASS'
        assert len([event for event in events if event == 'fake-api:exclusive-retirement']) == 1
        custody_receipt = json.loads((m.LOG / 'host-source-custody.json').read_bytes())
        assert custody_receipt['hostDescriptorsHeldThroughTerminalAndDurableReceipt'] is True
        assert custody_receipt['actualPrivateCryptographicAcceptance'] is False
        window = events.index('fake-status:ACTUAL_PRIVATE_TRANSFER_AWAITING_INDEPENDENT_REVIEW')
        durable_index = events.index('fake-durable:host-source-custody.json')
        final_verify = max((index for index, event in enumerate(events) if event == 'fake-all-nine-source-verify'))
        assert durable_index < final_verify < window
        for fd in [9100, 9101, 9102, 9103, 9199, 9000, 9001, 9002, 9099]:
            closed = events.index('fake-source-close:' + str(fd))
            assert events.count('fake-source-close:' + str(fd)) == 1 and final_verify < closed < window
        assert not any((event.startswith('fake-source-close:') for event in events[window:]))
    assert not any(('convex' in str(command['argv'][0]).lower() or command['argv'][-1] in ('deploy', 'driver') for command in commands))
    result = {'name': name, 'status': 'PASS', 'expectedCandidateOutcome': expected, 'observedCandidateOutcome': actual, 'candidateException': failure, 'allExternalEffectsMocked': True, 'actualDockerCalls': 0, 'actualAPICalls': 0, 'realPrivateReads': 0, 'events': events, 'commands': commands, 'statuses': statuses, 'remainingMockOwnedNames': sorted(containers)}
    dump(RAW / (name + '.json'), result)
    RESULTS.append(result)

# Narrow selected actual-main controls; every effect uses public dummy bytes.
execute_options = [
 ('happy-flow', {'expected':'PASS'}),
 ('approval-absent', {'fault':'approval-absent','no_provision':True}),
 ('recipe-subpath', {'fault':'recipe-subpath','no_provision':True}),
 ('recipe-network', {'recipe_mutation':lambda label,obj:obj['HostConfig'].update(NetworkMode='host') if label=='private-receiver-initial-inspect' else None,'no_provision':True}),
 ('receiver-NoCopy-one', {'recipe_mutation':lambda label,obj:obj['HostConfig']['Mounts'][0]['VolumeOptions'].update(NoCopy=1) if label=='private-receiver-initial-inspect' else None,'no_provision':True}),
 ('receiver-RW-zero', {'recipe_mutation':lambda label,obj:obj['Mounts'][1].update(RW=0) if label=='private-receiver-initial-inspect' else None,'no_provision':True}),
 ('provision-unknown', {'fault':'provision-unknown'}),
 ('transport-unknown', {'fault':'transport-unknown'}),
 ('transport-close-error', {'fault':'transport-close-error'}),
 ('descriptor-close', {'fault':'descriptor-close'}),
 ('producer-close', {'fault':'producer-close'}),
 ('source-drift', {'fault':'source-drift'}),
 ('retirement-command-failure', {'fault':'retirement-command-failure'}),
 ('approval-scope-invalid', {'mutation':lambda m,a,*rest:a.update(scope='SOURCE_INVALID'),'no_provision':True}),
 ('approval-dependency-missing', {'mutation':lambda m,a,*rest:a['dependencies'].pop(next(iter(a['dependencies']))),'no_provision':True}),
 ('approval-dependency-extra', {'mutation':lambda m,a,*rest:a['dependencies'].update(EXTRA='0'*64),'no_provision':True}),
 ('custody-volume-invalid', {'mutation':lambda m,a,p,g,c,*rest:c.update(volume=m.VOLUME.removesuffix('-r3')),'no_provision':True}),
 ('custody-count-invalid', {'mutation':lambda m,a,p,g,c,*rest:c.update(publicFiles=1911),'no_provision':True}),
 ('custody-all9-invalid', {'mutation':lambda m,a,p,g,c,*rest:c.update(allCurrentDestinationIdentities='FAIL'),'no_provision':True}),
 ('custody-content-invalid', {'mutation':lambda m,a,p,g,c,*rest:c.update(currentSourceDestinationFullContent='FAIL'),'no_provision':True}),
 ('custody-manifest-invalid', {'mutation':lambda m,a,p,g,c,*rest:c.update(publicSourceManifestSha256='0'*64),'no_provision':True}),
 ('custody-scope-invalid', {'mutation':lambda m,a,p,g,c,*rest:c.update(scope='SOURCE_ONLY'),'no_provision':True}),
]
import contextlib,io
for name,options in execute_options:
 stdout,stderr=io.StringIO(),io.StringIO()
 with contextlib.redirect_stdout(stdout),contextlib.redirect_stderr(stderr):scenario(name,**options)
 (RAW/(name+'.stdout')).write_text(stdout.getvalue());(RAW/(name+'.stderr')).write_text(stderr.getvalue())
result={'scope':'SELECTED_ACTUAL_REPAIR3_PRIVATE_MAIN_SOURCE_ONLY_MOCKS','status':'PASS','controls':len(RESULTS),'cases':[{k:r[k] for k in ('name','status','expectedCandidateOutcome','observedCandidateOutcome')} for r in RESULTS],'allExternalEffectsMocked':True,'actualDockerCalls':0,'actualAPICalls':0,'realPrivateReads':0,'sourceApproved':False,'independentJudgment':False,'originalBroadFixtureCohortsRerun':False}
dump(B/'selected-main-controls.json',result)
print(json.dumps({k:v for k,v in result.items() if k!='cases'}))
