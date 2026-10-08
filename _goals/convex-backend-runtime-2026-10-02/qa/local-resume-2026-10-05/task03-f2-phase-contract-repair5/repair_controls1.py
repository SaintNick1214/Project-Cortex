"""Additional source/mock controls; no physical readiness or effect authority."""
import copy
import hashlib
import stat
import types
from pathlib import Path
from unittest.mock import patch


def run(M, F):
    results = []

    def case(name, action):
        try:
            detail = action()
            results.append({'name': name, 'status': 'PASS', 'detail': detail})
        except BaseException as error:
            results.append({'name': name, 'status': 'FAIL', 'error': repr(error)})

    def deny(action, fragment):
        try:
            action()
        except BaseException as error:
            assert fragment in str(error), (fragment, str(error))
            return str(error)
        raise AssertionError('required denial missing: ' + fragment)

    def immutable_admission():
        row = F.row('one')
        ledger = M.Ledger()
        key = ledger.admit(row, debt=True)
        row['nine']['ino'] = '999'
        row['roles'].append('control')
        assert ledger.rows[key]['nine']['ino'] == '1'
        assert ledger.rows[key]['roles'] == []
        assert M.admission_id(ledger.rows[key]) == key
        assert ledger.byte_count == 1
        return {'callerMutationChangedAdmission': False}

    case('caller_nine_and_roles_mutation_isolated', immutable_admission)

    def stored_mutation():
        ledger = M.Ledger()
        key = ledger.admit(F.row('one'))
        ledger.rows[key]['nine']['ino'] = '2'
        return deny(ledger.approval_binding, 'stored_SOURCE_tuple_changed')

    case('direct_stored_tuple_corruption_denied', stored_mutation)

    receipt = {'counts': dict(M.COUNTS), 'assertions': list(M.ASSERTIONS),
               'originalProgramsUnchanged': True,
               'allProgramsIndependentlyApprovedBefore1914': True}

    def phase_case(over=False):
        ledger = M.Ledger()
        machine = M.PhaseMachine(ledger)
        machine.advance('SOURCE_APPROVED', receipt, lambda *_: True)
        if over:
            for i in range(4):
                ledger.admit(F.row('late' + str(i), M.CAPS['file']))
            reason = deny(lambda: machine.advance('ACTUAL1914', receipt, lambda *_: True),
                          'over64M')
        else:
            ledger.admit(F.row('late'))
            reason = deny(lambda: machine.advance('ACTUAL1914', receipt, lambda *_: True),
                          'late_SOURCE_admission_invalidates')
        assert machine.phase == 'SOURCE_APPROVED'
        return {'denial': reason, 'actualPhaseAdvanced': False}

    case('late_over_budget_union_denied_before_actual1914', lambda: phase_case(True))
    case('late_small_corpus_change_invalidates_approval', phase_case)

    def valid_phase():
        ledger = M.Ledger()
        ledger.admit(F.row('one'))
        machine = M.PhaseMachine(ledger)
        for phase in M.PhaseMachine.ORDER[1:]:
            machine.advance(phase, receipt, lambda *_: True)
        assert machine.phase == 'ACTUAL_READY'
        return {'phase': machine.phase, 'effectDenied':
                deny(lambda: machine.protected_action('key'), 'never_releases')}

    case('unchanged_corpus_preserves_all_original_readiness_stages', valid_phase)

    def nonuse_changed_tuple(role):
        recipe = F.fixture_recipe()
        old = copy.deepcopy(recipe['members'][0])
        changed = copy.deepcopy(old)
        changed['nine']['ctime_ns'] = '2'
        changed['roles'] = [role] if role else []
        recipe['members'].append(changed)
        key = M.admission_id(changed)
        if not role:
            recipe['actualReadDebts'].append(key)
        return deny(lambda: M.proof_of_nonuse(recipe, F.proof(recipe), F.mock_review),
                    'same_path_current_control_or_read_debt')

    for role in ('control', 'header', ''):
        case('same_path_changed_tuple_' + (role or 'read_debt') + '_cannot_defer',
             lambda role=role: nonuse_changed_tuple(role))

    class MockFS:
        def __init__(self, rows, fail_open=None, fail_close=()):
            self.rows = {row['path']: row for row in rows}
            self.fail_open = fail_open
            self.fail_close = set(fail_close)
            self.opens = []
            self.closes = []
            self.live = {}
            self.next_fd = 10000

        def lstat(self, path):
            name = Path(path).name
            if name not in self.rows:
                return types.SimpleNamespace(st_mode=stat.S_IFDIR | 0o700)
            return types.SimpleNamespace(**{'st_' + k: int(v)
                                            for k, v in self.rows[name]['nine'].items()})

        def open(self, path, flags):
            if len(self.opens) + 1 == self.fail_open:
                raise OSError('mock_partial_open_failure')
            self.next_fd += 1
            self.opens.append(self.next_fd)
            self.live[self.next_fd] = str(path)
            return self.next_fd

        def fstat(self, fd):
            return self.lstat(self.live[fd])

        def close(self, fd):
            assert fd in self.live, 'foreign or duplicate mock close'
            self.closes.append(fd)
            del self.live[fd]
            if len(self.closes) in self.fail_close:
                raise OSError('mock_close_after_detach')

        def contexts(self):
            return (patch.object(M.os, 'lstat', side_effect=self.lstat),
                    patch.object(M.os, 'open', side_effect=self.open),
                    patch.object(M.os, 'fstat', side_effect=self.fstat),
                    patch.object(M.os, 'close', side_effect=self.close),
                    patch.object(M.time, 'time_ns', return_value=1000000000000),
                    patch.object(Path, 'resolve', lambda path: path.absolute()))

    def mock_rows(count):
        rows = [F.row('file' + str(i), 0, b'') for i in range(count)]
        for row in rows:
            row['nine'].update(mode=str(stat.S_IFREG | 0o600), nlink='1')
        return rows

    def broker(rows, ledger):
        edges = [{'caller': 'REPAIR5', 'target': M.admission_id(row), 'operation': 'read'}
                 for row in rows]
        return M.HeldBroker('/owned-mock-source', rows, ledger, edges, 'REPAIR5', 1)

    def with_fs(fs, action):
        from contextlib import ExitStack
        with ExitStack() as stack:
            for context in fs.contexts():
                stack.enter_context(context)
            return action()

    def shared_limit():
        rows = mock_rows(4096)
        ledger = M.Ledger()
        first, second = broker(rows, ledger), broker(rows, ledger)
        fs = MockFS(rows)

        def action():
            try:
                first.open_all()
                assert len(fs.live) == 4096
                reason = deny(second.open_all, 'shared_simultaneous_SOURCE_FD_cap_before_open')
                assert len(fs.opens) == 4096
            finally:
                second.close()
                first.close()
            assert fs.live == {} and len(fs.closes) == 4096
            assert ledger.owned_fds == {} and ledger.peak_owned_fds == 4096
            return {'denial': reason, 'mockFDPeak': 4096, 'secondBrokerOpens': 0,
                    'onceCloses': 4096}

        return with_fs(fs, action)

    case('two_brokers_share_4096_simultaneous_cap_before_second_open', shared_limit)

    def closure(fail_open=None, fail_close=()):
        rows = mock_rows(3)
        ledger = M.Ledger()
        owned = broker(rows, ledger)
        fs = MockFS(rows, fail_open, fail_close)

        def action():
            if fail_open:
                deny(owned.open_all, 'mock_partial_open_failure')
            else:
                owned.open_all()
            if fail_close:
                deny(owned.close, 'all_close_attempted_errors')
            else:
                owned.close()
            assert fs.live == {} and len(fs.opens) == len(fs.closes)
            assert len(set(fs.closes)) == len(fs.closes)
            assert ledger.owned_fds == {}
            if fail_close:
                deny(lambda: ledger.admit(F.row('future')), 'sticky_unknown_SOURCE_close')
            return {'opened': len(fs.opens), 'onceCloses': len(fs.closes),
                    'stickyUnknownClose': ledger.unknown_close}

        return with_fs(fs, action)

    case('partial_open_all_owned_handles_close_once', lambda: closure(3))
    for name, failed in (('first', (1,)), ('last', (3,)), ('all', (1, 2, 3))):
        case(name + '_close_failure_all_handles_attempted_once_sticky',
             lambda failed=failed: closure(fail_close=failed))
    case('normal_shared_ownership_releases_without_sticky', closure)
    return {'scope': 'REPAIR5_AUTHOR_ADDITIONAL_SOURCE_MOCK_ONLY', 'conditions': results,
            'passed': sum(row['status'] == 'PASS' for row in results),
            'failed': sum(row['status'] == 'FAIL' for row in results),
            'sourceEligibility': False, 'operativeAdaptersAdopted': False,
            'actualEffects': 0, 'fullTask03': False, 'fullGoal': False}
