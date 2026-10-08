"""Root G2 Source/mock sticky boundaries. No actual Source or service authority."""
import ast
import copy
import hashlib
import json
from pathlib import Path
from types import SimpleNamespace


def run(A, P, G, prior_control_raw):
    assert hashlib.sha256(prior_control_raw).hexdigest() == 'ef00b01d5c2e4d211a067a5fdb084345a8126f3af8553de094e8893183953bc8'
    tree = ast.parse(prior_control_raw)
    original_run = next(x for x in tree.body if isinstance(x, ast.FunctionDef) and x.name == 'run')
    names = {'deny', 'encode', 'row', 'IO', 'fixture', 'lease'}
    helpers = [copy.deepcopy(x) for x in original_run.body
               if isinstance(x, (ast.FunctionDef, ast.ClassDef)) and x.name in names]
    assert len(helpers) == 6 and {x.name for x in helpers} == names
    env = dict(A=A, P=P, G=G, ast=ast, copy=copy, hashlib=hashlib,
               json=json, Path=Path, SimpleNamespace=SimpleNamespace)
    exec(compile(ast.Module(body=helpers, type_ignores=[]), 'held_exact_old_control_helpers',
                 'exec', dont_inherit=True), env)
    fixture = env['fixture']; lease = env['lease']; deny = env['deny']
    results = []

    def case(name, action):
        try:
            detail = action()
            results.append({'name': name, 'PASS': True, 'detail': detail})
        except BaseException as error:
            results.append({'name': name, 'PASS': False, 'error': repr(error)})

    def metadata(position, boundary, error_type):
        s, b, l, c, io, clean, program, approval = fixture()
        original_fstat = io.fstat
        target = list(b.rows)[position]['path']
        try:
            q = lease(b, l, c)
            def failing(fd):
                if io.fds[fd] == target:
                    raise error_type('modeled_metadata_failure')
                return original_fstat(fd)
            io.fstat = failing
            primary = deny(lambda: getattr(q, boundary)(G.R / target))
            assert isinstance(primary, error_type), repr(primary)
            io.fstat = original_fstat
            assert s.failures and not io.closes
            before = len(io.events)
            denial = deny(lambda: q.read(G.R / program))
            assert len(io.events) == before and not io.closes
            return {'position': position, 'boundary': boundary, 'primary': type(primary).__name__,
                    'laterDenied': type(denial).__name__, 'RootRetainsEveryDescriptor': True}
        finally:
            io.fstat = original_fstat
            clean()

    for position in (0, 3, 5):
        for boundary in ('acquire', 'read'):
            for error_type in (OSError, SystemExit):
                case('metadata_%s_%s_%s_sticky' % (position, boundary, error_type.__name__),
                     lambda p=position, b=boundary, e=error_type: metadata(p, b, e))

    def local_cap():
        s, b, l, c, io, clean, program, approval = fixture()
        try:
            q = lease(b, l, c)
            name, cap = next(iter(G.RELEASE_DATA_NAMES.items()))
            payload = b'x' * (cap + 1)
            acquired = {'member': {'path': 'mock_local_cap_payload'}, 'originalNine': {},
                        'bytes': len(payload), 'sha256': hashlib.sha256(payload).hexdigest()}
            old_acquire, old_read, old_check = q.acquire, b.read, q.check_owner
            try:
                q.acquire = lambda *_: acquired
                b.read = lambda *_: payload
                q.check_owner = lambda: None
                denial = deny(lambda: q.read(G.P / name))
                assert isinstance(denial, AssertionError) and s.failures
            finally:
                q.acquire, b.read, q.check_owner = old_acquire, old_read, old_check
            before = len(io.events)
            deny(lambda: q.read(G.R / program))
            assert len(io.events) == before and not io.closes
            return {'localCap': cap, 'attemptedBytes': cap + 1,
                    'allThreeStubsRestoredBeforeWholeLaterRead': True,
                    'laterBodyIO': 0, 'RootOwnedDescriptorClosesByBorrower': 0}
        finally:
            clean()

    case('local_release_data_cap_is_sticky_before_later_whole_read', local_cap)

    def late_owner_check():
        s, b, l, c, io, clean, program, approval = fixture()
        try:
            q = lease(b, l, c); original = q.check_owner; calls = []
            def check():
                calls.append(1)
                if len(calls) == 2:
                    raise OSError('modeled_post_body_owner_check_failure')
                return original()
            q.check_owner = check
            try:
                primary = deny(lambda: q.read(G.R / program))
                assert isinstance(primary, OSError) and len(calls) == 2 and s.failures
            finally:
                q.check_owner = original
            before = len(io.events); deny(lambda: q.read(G.R / program))
            assert len(io.events) == before and not io.closes
            return {'postBodyFailureSticky': True, 'laterIO': 0, 'RootOwnershipPreserved': True}
        finally:
            clean()

    case('post_body_owner_check_failure_is_sticky', late_owner_check)
    return results
