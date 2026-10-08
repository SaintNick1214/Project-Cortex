"""Bounded repair controls: pure dispatch spies, no external effects."""
import copy
import types


def run(sources, carry, wire, proof):
    def load(name, dependencies):
        module = types.ModuleType('repair2_' + name)
        module.__dict__.update(dependencies)
        exec(compile(sources[name], name, 'exec', dont_inherit=True), module.__dict__)
        return module

    C = load('C', {})
    T = load('T', {'C': C})
    Q = load('Q', {'C': C})
    D = load('D', {'C': C, 'T': T, 'S': None, 'L': None, 'M': None})
    sender = {'scope': 'NEW_ROOT_PROSPECTIVE_FIVE_SENDER_PINS_ONLY',
              'oldCustodyRepaired': False, 'members': []}
    for row in carry['members']:
        if row['original130']:
            continue
        pin = {'dev': '1', 'ino': str(row['index'] + 1), 'mode': '33152',
               'uid': '501', 'gid': '20', 'nlink': '1',
               'size': str(row['bytes']), 'mtime_ns': '1', 'ctime_ns': '1'}
        sender['members'].append({'path': row['actualMacPath'], 'bytes': row['bytes'],
                                  'sha256': row['sha256'], 'PRE9': pin})
    results = []

    def case(name, body):
        try:
            detail = body()
            results.append({'name': name, 'status': 'PASS', 'detail': detail})
        except BaseException as error:
            results.append({'name': name, 'status': 'FAIL', 'error': repr(error)})

    def sender_case(mode):
        changed = copy.deepcopy(sender)
        expected = None
        if mode == 'scope':
            changed['scope'] = 'WRONG'
            expected = 'NEW_SENDER_PINS_CANNOT_REPAIR_OLD_CUSTODY'
        elif mode in ('custody_true', 'custody_zero'):
            changed['oldCustodyRepaired'] = True if mode == 'custody_true' else 0
            expected = 'NEW_SENDER_PINS_CANNOT_REPAIR_OLD_CUSTODY'
        elif mode == 'duplicate':
            changed['members'][1] = copy.deepcopy(changed['members'][0])
            expected = 'EXACT_FIVE_PROSPECTIVE_SENDER_PINS'
        elif mode == 'missing':
            changed['members'].pop()
            expected = 'EXACT_FIVE_PROSPECTIVE_SENDER_PINS'
        elif mode == 'hash':
            changed['members'][0]['sha256'] = '0' * 64
            expected = 'PROSPECTIVE_SENDER_IMMUTABLE_BYTES'
        elif mode == 'bytes':
            changed['members'][0]['bytes'] += 1
            expected = 'PROSPECTIVE_SENDER_IMMUTABLE_BYTES'
        elif mode == 'extra_field':
            changed['unexpected'] = 1
            expected = 'EXACT_PROSPECTIVE_SENDER_FIELDS'
        elif mode == 'members_not_list':
            changed['members'] = {}
            expected = 'EXACT_FIVE_PROSPECTIVE_SENDER_PINS'
        elif mode == 'extra_row_field':
            changed['members'][0]['extra'] = 1
            expected = 'EXACT_PROSPECTIVE_SENDER_MEMBER_FIELDS'
        elif mode == 'boolean_bytes':
            changed['members'][0]['bytes'] = True
            expected = 'PROSPECTIVE_SENDER_BYTES_EXACT_INT'
        elif mode in ('pin_size', 'pin_owner', 'pin_group', 'pin_link', 'pin_mode'):
            key, value = {'pin_size': ('size', '0'), 'pin_owner': ('uid', '0'),
                          'pin_group': ('gid', '0'), 'pin_link': ('nlink', '2'),
                          'pin_mode': ('mode', '4480')}[mode]
            changed['members'][0]['PRE9'][key] = value
            expected = 'PROSPECTIVE_SENDER_TYPED_NINE_SIZE_OWNER'
        release = {'senderProspectiveNineSha256': C.digest(C.encoded(changed))}
        if mode == 'binding':
            release['senderProspectiveNineSha256'] = '0' * 64
            expected = 'EXACT_ROOT_PROSPECTIVE_SENDER_NINE_DATA'
        calls = []

        class Services:
            def runner(self, *args):
                calls.append('runner')
                raise RuntimeError('VALID_ADMISSION_REACHED_DISPATCH_BOUNDARY')

        class Lease:
            def check(self):
                return None

        try:
            D.execute(release, Lease(), C.Ledger(), carry, wire, proof,
                      {'C': sources['C'], 'Q': sources['Q'], 'B': sources['B'],
                       'carry': sources['carry'], 'wire': sources['wire']},
                      '/pure-repair2-no-files', changed, source_services=Services())
        except BaseException as error:
            reason = str(error)
        else:
            raise AssertionError('expected explicit boundary or denial')
        if mode == 'positive':
            assert reason == 'VALID_ADMISSION_REACHED_DISPATCH_BOUNDARY', reason
            assert calls == ['runner'], calls
            rows = D.admit_sender(release, carry, changed)
            assert len(rows) == 135
            assert [r['path'] for r in rows] == [r['actualMacPath'] for r in carry['members']]
        else:
            assert expected in reason, (mode, expected, reason)
            assert calls == [], calls
        return {'denial': reason, 'runnerCreations': len(calls),
                'commands': 0, 'fixtureMutations': 0, 'actualEffects': 0}

    for mode in ('positive', 'scope', 'custody_true', 'custody_zero', 'binding',
                 'duplicate', 'missing', 'hash', 'bytes', 'extra_field', 'members_not_list',
                 'extra_row_field', 'boolean_bytes', 'pin_size', 'pin_owner', 'pin_group',
                 'pin_link', 'pin_mode'):
        case('sender_' + mode, lambda m=mode: sender_case(m))

    def index_case(value):
        changed = copy.deepcopy(wire)
        changed['members'][1]['index'] = value
        try:
            Q.validate_wire(changed)
        except ValueError as error:
            assert 'WIRE_MEMBER_INDEX_EXACT_INT' in str(error), str(error)
            return {'denial': str(error), 'actualEffects': 0}
        raise AssertionError('non-integer wire index accepted')

    for name, value in (('true', True), ('false', False), ('float', 1.0), ('string', '1'),
                        ('none', None), ('negative', -1), ('above', 135)):
        case('wire_index_' + name, lambda v=value: index_case(v))

    def wire_positive():
        assert Q.validate_wire(wire) is wire
        return {'members': 135, 'actualEffects': 0}

    case('wire_integer_positive_135', wire_positive)
    return {'scope': 'REPAIR2_AUTHOR_SOURCE_MOCK_ONLY', 'conditions': results,
            'passed': sum(r['status'] == 'PASS' for r in results),
            'failed': sum(r['status'] == 'FAIL' for r in results),
            'actualEffects': 0, 'sourceEligibility': False,
            'runtimeAuthority': False, 'fullTask03': False, 'fullGoal': False}
