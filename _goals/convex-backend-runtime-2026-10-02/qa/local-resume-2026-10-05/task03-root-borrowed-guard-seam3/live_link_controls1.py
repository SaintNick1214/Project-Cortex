"""G3 Source/mock live-link binding controls; no Source or service authority."""
import ast
import copy
import hashlib
import json
from pathlib import Path
from types import SimpleNamespace


def run(A, P, G, original_control_raw):
    assert hashlib.sha256(original_control_raw).hexdigest() == 'ef00b01d5c2e4d211a067a5fdb084345a8126f3af8553de094e8893183953bc8'
    tree = ast.parse(original_control_raw)
    outer = next(x for x in tree.body if isinstance(x, ast.FunctionDef) and x.name == 'run')
    names = {'deny', 'encode', 'row', 'IO', 'fixture', 'lease'}
    helpers = [copy.deepcopy(x) for x in outer.body if isinstance(x, (ast.ClassDef, ast.FunctionDef)) and x.name in names]
    assert len(helpers) == 6 and {x.name for x in helpers} == names
    env = dict(A=A, P=P, G=G, ast=ast, copy=copy, hashlib=hashlib, json=json,
               Path=Path, SimpleNamespace=SimpleNamespace)
    exec(compile(ast.Module(body=helpers, type_ignores=[]), 'held_original_G1_fixture', 'exec'), env)
    fixture = env['fixture']; lease = env['lease']; deny = env['deny']; results = []

    def case(name, action):
        try: results.append({'name': name, 'PASS': True, 'detail': action()})
        except BaseException as error: results.append({'name': name, 'PASS': False, 'error': repr(error)})

    def mutate(which, boundary):
        s, b, l, c, io, clean, program, approval = fixture()
        try:
            q = lease(b, l, c)
            links = {
                'borrowed_ledger': (b, 'ledger'), 'owner_ledger': (s, 'ledger'),
                'borrowed_owner': (b, 'ownerToken'), 'borrowed_caller': (b, '_caller'),
                'guard_borrowed': (q, 'borrowed'), 'guard_owner': (q, 'owner'),
                'guard_ledger': (q, 'ledger'), 'guard_adapter': (q, 'adapter_module')}
            obj, key = links[which]; original = getattr(obj, key)
            setattr(obj, key, 'wrong_caller' if key == '_caller' else object())
            try:
                before = len(io.events)
                failure = deny(lambda: getattr(q, boundary)(G.R / program))
                assert isinstance(failure, AssertionError)
                assert len(io.events) == before and s.failures and not io.closes
            finally: setattr(obj, key, original)
            before = len(io.events); later = deny(lambda: q.read(G.R / program))
            assert len(io.events) == before and not io.closes
            return {'changedLink': which, 'boundary': boundary,
                    'primary': type(failure).__name__, 'restoredLinksBeforeLaterWholeRead': True,
                    'laterDenied': type(later).__name__, 'newSourceIO': 0,
                    'RootOwnedDescriptorClosesByBorrower': 0}
        finally: clean()

    for which in ('borrowed_ledger', 'owner_ledger', 'borrowed_owner', 'borrowed_caller',
                  'guard_borrowed', 'guard_owner', 'guard_ledger', 'guard_adapter'):
        for boundary in ('acquire', 'read'):
            case(which+'_'+boundary+'_sticky', lambda w=which, b=boundary: mutate(w, b))

    def constructor(which):
        s, b, l, c, io, clean, program, approval = fixture()
        callbacks = []
        try:
            obj, key = {'borrowed_ledger': (b, 'ledger'), 'owner_ledger': (s, 'ledger'),
                        'borrowed_owner': (b, 'ownerToken')}[which]
            old = getattr(obj, key); setattr(obj, key, object())
            try:
                before = len(io.events)
                failure = deny(lambda: G.RootBorrowedGuardLease(b, A, l, 'guard',
                              lambda *args: callbacks.append(args) or True))
                assert isinstance(failure, AssertionError) and not callbacks
                assert len(io.events) == before and not io.closes
            finally: setattr(obj, key, old)
            return {'constructorDenied': True, 'callbacks': 0, 'SourceIO': 0,
                    'RootDescriptorClosesByBorrower': 0}
        finally: clean()

    for which in ('borrowed_ledger', 'owner_ledger', 'borrowed_owner'):
        case(which+'_fresh_constructor_denies_before_callback_IO', lambda w=which: constructor(w))
    return results
