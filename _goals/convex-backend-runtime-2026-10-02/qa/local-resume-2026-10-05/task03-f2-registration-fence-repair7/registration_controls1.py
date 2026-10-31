"""Source/mock ownership-acquisition faults. Virtual handles have no service authority."""
import hashlib
import stat
import types
from pathlib import Path
from unittest.mock import patch
from contextlib import ExitStack


def run(M):
    results = []
    receipt = {'counts': dict(M.COUNTS), 'assertions': list(M.ASSERTIONS),
               'originalProgramsUnchanged': True,
               'allProgramsIndependentlyApprovedBefore1914': True}

    class FS:
        def __init__(self):
            self.root = Path('/SOURCE-MOCK-ONLY-registration7')
            self.live = {}; self.opened = []; self.closed = []; self.bad_close = None
            self.rows = []
            for i in range(3):
                pin = dict(dev=1, ino=i+1, mode=33188, uid=1, gid=1, nlink=1,
                           size=0, mtime_ns=1, ctime_ns=1)
                self.rows.append({'path': 'p'+str(i), 'bytes': 0,
                                  'sha256': hashlib.sha256(b'').hexdigest(),
                                  'roles': ['control'],
                                  'nine': {k: str(pin[k]) for k in M.FIELDS}})

        def lstat(self, path):
            for row in self.rows:
                if str(path) == str(self.root / row['path']):
                    return types.SimpleNamespace(**{'st_'+k: int(v)
                                                    for k, v in row['nine'].items()})
            return types.SimpleNamespace(st_mode=stat.S_IFDIR | 0o700)

        def open(self, path, *_args):
            fd = 100 + len(self.opened)
            self.live[fd] = str(path); self.opened.append(fd)
            return fd

        def close(self, fd):
            self.closed.append(fd)
            if fd == self.bad_close:
                raise OSError('virtual_unknown_close')
            assert fd in self.live, 'double virtual close'
            del self.live[fd]

        def fstat(self, fd):
            return self.lstat(self.live[fd])

    def case(index, fault, after, exception, close_fault):
        fs = FS(); ledger = M.Ledger()
        edges = [{'caller': 'c', 'target': M.admission_id(r), 'operation': 'read'}
                 for r in fs.rows]
        broker = M.HeldBroker(fs.root, fs.rows, ledger, edges, 'c', 1)
        target_fd = 100 + index
        if close_fault:
            fs.bad_close = target_fd
        if fault == 'held':
            class FailingMap(dict):
                def __setitem__(self, key, value):
                    if value[0] == target_fd:
                        if after:
                            super().__setitem__(key, value)
                        raise exception('virtual_owner_insert_fault')
                    return super().__setitem__(key, value)
            broker.held = FailingMap()
        else:
            original = ledger.own_fd
            def failing_own(fd, owner):
                if fd == target_fd:
                    if after:
                        original(fd, owner)
                    raise exception('virtual_ledger_insert_fault')
                return original(fd, owner)
            ledger.own_fd = failing_own
        primary = cleanup = None; callbacks = []
        with ExitStack() as stack:
            for ctx in (patch.object(M.os, 'lstat', side_effect=fs.lstat),
                        patch.object(M.os, 'open', side_effect=fs.open),
                        patch.object(M.os, 'fstat', side_effect=fs.fstat),
                        patch.object(M.os, 'pread', return_value=b''),
                        patch.object(M.os, 'close', side_effect=fs.close),
                        patch.object(Path, 'resolve', lambda p: p.absolute())):
                stack.enter_context(ctx)
            try:
                broker.open_all()
            except BaseException as error:
                primary = error
            try:
                broker.close()
            except BaseException as error:
                cleanup = error
            assert primary is not None
            if fault == 'held' and close_fault:
                assert isinstance(primary, M.Denied) and isinstance(primary.__cause__, exception)
            else:
                assert isinstance(primary, exception), repr(primary)
            assert fs.opened == list(range(100, target_fd+1))
            assert sorted(fs.closed) == fs.opened and len(fs.closed) == len(set(fs.closed))
            assert sorted(fs.live) == ([target_fd] if close_fault else [])
            assert ledger.unknown_close and not ledger.owned_fds
            machine = M.PhaseMachine(ledger)
            denied = []
            for name, action in (
                    ('preflight', ledger.preflight),
                    ('binding', ledger.approval_binding),
                    ('new_open', ledger.can_open),
                    ('phase', lambda: machine.advance('SOURCE_APPROVED', receipt,
                         lambda *args: callbacks.append(args) or True))):
                try:
                    action()
                except M.Denied as error:
                    assert str(error) == 'sticky_unknown_SOURCE_close'
                    denied.append(name)
                else:
                    raise AssertionError('failed acquisition reached '+name)
            assert len(denied) == 4 and machine.phase == 'SOURCE' and not callbacks
        return {'fault': fault, 'position': index, 'insertBeforeRaise': after,
                'faultType': exception.__name__, 'fallbackOrOwnedCloseFails': close_fault,
                'primary': type(primary).__name__,
                'cleanup': type(cleanup).__name__ if cleanup else None,
                'openedVirtual': fs.opened, 'onceCloseAttempts': fs.closed,
                'remainingVirtual': sorted(fs.live), 'stickyDenials': denied,
                'unknownAcquisition': ledger.unknown_close, 'callbacks': 0,
                'knownSuccessfulFallbackIsNotReportedAsCloseError':
                    all(x['error'] is None for x in broker.close_attempts) if not close_fault else None}

    for fault in ('held', 'ledger'):
        for index in (0, 1, 2):
            for after in (False, True):
                for exception in (MemoryError, SystemExit):
                    for close_fault in (False, True):
                        name = '%s_%s_%s_%s_%s' % (fault, index, after,
                                                  exception.__name__, close_fault)
                        try:
                            detail = case(index, fault, after, exception, close_fault)
                            results.append({'name': name, 'status': 'PASS', 'detail': detail})
                        except BaseException as error:
                            results.append({'name': name, 'status': 'FAIL', 'error': repr(error)})
    return {'scope': 'REPAIR7_SOURCE_MOCK_REGISTRATION_ONLY', 'results': results,
            'passed': sum(x['status'] == 'PASS' for x in results),
            'failed': sum(x['status'] == 'FAIL' for x in results),
            'virtualHandlesOnly': True, 'sourceEligibility': False, 'actualEffects': 0}
