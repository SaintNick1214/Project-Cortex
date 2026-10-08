"""R8 SOURCE/mock bookkeeping faults; no actual handles or Source authority."""
import ast
import hashlib
import stat
import types
from pathlib import Path
from unittest.mock import patch
from contextlib import ExitStack


def run(M, original_registration_raw):
    assert hashlib.sha256(original_registration_raw).hexdigest() == '3cc6a504628e1d26410205ced5ffc89b1c798bd4c568f5c8edc16fb7461f69e7'
    tree = ast.parse(original_registration_raw)
    original_run = next(x for x in tree.body if isinstance(x, ast.FunctionDef) and x.name == 'run')
    original_fs = next(x for x in original_run.body if isinstance(x, ast.ClassDef) and x.name == 'FS')
    env = dict(M=M, Path=Path, hashlib=hashlib, stat=stat, types=types)
    exec(compile(ast.Module(body=[original_fs], type_ignores=[]), 'held_original_R7_FS', 'exec'), env)
    FS = env['FS']; results = []
    receipt = {'counts': dict(M.COUNTS), 'assertions': list(M.ASSERTIONS),
               'originalProgramsUnchanged': True, 'allProgramsIndependentlyApprovedBefore1914': True}

    def one(fault, position, after, exception, approved):
        fs = FS(); ledger = M.Ledger()
        edges = [{'caller': 'c', 'target': M.admission_id(r), 'operation': 'read'} for r in fs.rows]
        broker = M.HeldBroker(fs.root, fs.rows, ledger, edges, 'c', 1)
        machine = M.PhaseMachine(ledger); callbacks = []
        with ExitStack() as stack:
            for ctx in (patch.object(M.os, 'lstat', side_effect=fs.lstat),
                        patch.object(M.os, 'open', side_effect=fs.open),
                        patch.object(M.os, 'fstat', side_effect=fs.fstat),
                        patch.object(M.os, 'pread', return_value=b''),
                        patch.object(M.os, 'close', side_effect=fs.close),
                        patch.object(Path, 'resolve', lambda p: p.absolute())):
                stack.enter_context(ctx)
            broker.open_all()
            if approved:
                machine.advance('SOURCE_APPROVED', receipt, lambda *_: True)
            phase_before = machine.phase; target_fd = 100 + position
            if fault == 'release':
                release = ledger.release_fd
                def fail_release(fd, owner, successful):
                    if fd == target_fd:
                        if after: release(fd, owner, successful)
                        raise exception('modeled_release_bookkeeping_failure')
                    return release(fd, owner, successful)
                ledger.release_fd = fail_release
            else:
                class Recorder(list):
                    def append(self, row):
                        if row['path'] == 'p'+str(position):
                            if after: super().append(row)
                            raise exception('modeled_receipt_bookkeeping_failure')
                        return super().append(row)
                broker.close_attempts = Recorder()
            try: broker.close()
            except M.Denied as cleanup:
                assert exception.__name__ in str(cleanup)
            else: raise AssertionError('bookkeeping failure disappeared')
            assert sorted(fs.closed) == fs.opened and len(fs.closed) == len(set(fs.closed))
            assert not fs.live and ledger.unknown_close
            expected_owners = [target_fd] if fault == 'release' and not after else []
            assert sorted(ledger.owned_fds) == expected_owners
            denied = []
            next_phase = 'ACTUAL1914' if approved else 'SOURCE_APPROVED'
            for name, action in (
                    ('preflight', ledger.preflight), ('binding', ledger.approval_binding),
                    ('new_open', ledger.can_open),
                    ('phase', lambda: machine.advance(next_phase, receipt,
                         lambda *a: callbacks.append(a) or True))):
                try: action()
                except M.Denied as error:
                    assert str(error) == 'sticky_unknown_SOURCE_close'; denied.append(name)
                else: raise AssertionError('broken cleanup reached '+name)
            assert len(denied) == 4 and not callbacks and machine.phase == phase_before
            assert all(x['error'] is None for x in broker.close_attempts)
        return {'fault': fault, 'position': position, 'afterCommit': after,
                'exception': exception.__name__, 'alreadySourceApproved': approved,
                'closeAttempts': fs.closed, 'remainingPhysicalVirtualHandles': 0,
                'retainedLedgerOwners': expected_owners, 'stickyDenials': denied,
                'laterCallbacks': 0, 'knownSuccessfulPhysicalClosesRemainKnown': True}

    for fault in ('release', 'receipt'):
        for position in (0, 1, 2):
            for after in (False, True):
                for exception in (MemoryError, SystemExit):
                    for approved in (False, True):
                        name = '%s_%s_%s_%s_%s' % (fault, position, after, exception.__name__, approved)
                        try: results.append({'name': name, 'status': 'PASS', 'detail': one(fault, position, after, exception, approved)})
                        except BaseException as error: results.append({'name': name, 'status': 'FAIL', 'error': repr(error)})
    return {'scope': 'R8_SOURCE_MOCK_CLEANUP_BOOKKEEPING_ONLY', 'results': results,
            'passed': sum(x['status'] == 'PASS' for x in results),
            'failed': sum(x['status'] == 'FAIL' for x in results),
            'SourceEligibility': False, 'actualEffects': 0}
