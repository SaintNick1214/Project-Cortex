"""Run unchanged A and T from original held full-EOF/nine/hash source bytes.

This module has no private access on import. The caller supplies independently
qualified host or actual-public-transfer native source pins. Caches are neither
read nor trusted. A's importlib interface is restricted to its one reviewed T.
"""
from pathlib import Path
import builtins
import hashlib
import importlib.machinery
import importlib.util
import json
import os
import stat
import types

FIELDS = ('dev', 'ino', 'mode', 'uid', 'gid', 'nlink', 'size', 'mtime_ns', 'ctime_ns')

def identity(value):
    return {field: str(getattr(value, 'st_' + field)) for field in FIELDS}

def strict(raw):
    def pairs(items):
        result = {}
        for key, value in items:
            if key in result:
                raise ValueError('duplicate_source_key')
            result[key] = value
        return result
    return json.loads(raw, object_pairs_hook=pairs,
                      parse_constant=lambda value: (_ for _ in ()).throw(ValueError('nonfinite_source')))

class HeldSource:
    def __init__(self, path, expected, root):
        self.path, self.expected, self.fd = Path(path), expected, None
        root = Path(root)
        assert self.path.is_absolute() and root.is_absolute()
        assert self.path.is_relative_to(root) and self.path.resolve() == self.path
        prefix = Path('/')
        for component in self.path.parts[1:-1]:
            prefix /= component
            value = os.lstat(prefix)
            assert stat.S_ISDIR(value.st_mode) and not stat.S_ISLNK(value.st_mode)
        value = os.lstat(self.path)
        assert stat.S_ISREG(value.st_mode) and value.st_nlink == 1
        assert value.st_uid == 501 and value.st_gid == 20 and 0 < value.st_size <= 16777216
        assert type(expected['bytes']) is int and 0 < expected['bytes'] <= 16777216
        assert type(expected['sha256']) is str and len(expected['sha256']) == 64
        assert set(expected['PRE']) == set(FIELDS)
        assert all(type(item) is str and item.isdecimal() for item in expected['PRE'].values())
        assert identity(value) == expected['PRE']
        self.fd = os.open(self.path, os.O_RDONLY | os.O_NOFOLLOW)
        try:
            self.verify()
        except BaseException:
            self.close()
            raise

    def verify(self):
        assert self.fd is not None
        assert identity(os.fstat(self.fd)) == identity(os.lstat(self.path)) == self.expected['PRE']

    def content(self):
        self.verify()
        os.lseek(self.fd, 0, os.SEEK_SET)
        data = bytearray()
        while chunk := os.read(self.fd, 65536):
            data.extend(chunk)
            assert len(data) <= self.expected['bytes'] <= 16777216
        assert len(data) == self.expected['bytes']
        assert hashlib.sha256(data).hexdigest() == self.expected['sha256']
        self.verify()
        return bytes(data)

    def close(self):
        if self.fd is not None:
            fd, self.fd = self.fd, None
            os.close(fd)

class VerifiedDependencyLoader:
    def __init__(self, held):
        self.held = held
        self.executions = 0

    def create_module(self, spec):
        return None

    def exec_module(self, module):
        assert self.executions == 0
        self.held.verify()
        raw = self.held.content()  # Actual first use, original descriptor still held.
        exec(compile(raw, str(self.held.path), 'exec', dont_inherit=True), module.__dict__)
        self.held.verify()
        self.executions += 1

def load_acquisition(a_path, t_path, a_expected, t_expected, root, *, as_main=False, argv=None):
    """No protected operation until both executable sources have been qualified.

    Host import defines A/T only. The Linux main executes the unchanged A CLI;
    its normal T source can access private input only after its verified import.
    A/T original descriptors remain held through execution and final checks.
    """
    held = []
    try:
        # Capture ALL descriptors before first executable byte qualification.
        a = HeldSource(a_path, a_expected, root); held.append(a)
        t = HeldSource(t_path, t_expected, root); held.append(t)
        a_raw, t_raw = a.content(), t.content()
        loader = VerifiedDependencyLoader(t)
        def spec_from_file_location(name, location):
            assert name == 'accepted_private_transport' and Path(location) == t.path
            a.verify(); t.verify()
            spec = importlib.machinery.ModuleSpec(name, loader, origin=str(t.path))
            spec.has_location = True
            return spec
        util = types.SimpleNamespace(spec_from_file_location=spec_from_file_location,
                                     module_from_spec=importlib.util.module_from_spec)
        proxy = types.SimpleNamespace(util=util)
        original_import = builtins.__import__
        def source_import(name, globals=None, locals=None, fromlist=(), level=0):
            if name == 'importlib.util':
                assert level == 0 and not fromlist
                return proxy
            return original_import(name, globals, locals, fromlist, level)
        module = types.ModuleType('__main__' if as_main else 'reviewed_source_acquisition')
        module.__file__, module.__package__ = str(a.path), ''
        module.__dict__['__builtins__'] = {**vars(builtins), '__import__': source_import}
        if argv is not None:
            import sys
            prior_argv = sys.argv
            sys.argv = list(argv)
        try:
            a.verify(); t.verify()
            exec(compile(a_raw, str(a.path), 'exec', dont_inherit=True), module.__dict__)
            assert loader.executions == 1
            a.verify(); t.verify()
            assert module.T.__file__ == str(t.path)
            return module
        finally:
            if argv is not None:
                sys.argv = prior_argv
    finally:
        for source in reversed(held):
            source.close()

def native_main(config):
    """Bound only to the current actual-public-transfer receipt, before stdin/private access."""
    assert set(config) == {'operation', 'candidateSha256', 'publicTransferReceiptSha256', 'sources', 'argv'}
    assert config['operation'] == 'c9fbaa34-8ca8-4153-b8bd-1cfe60a8241f'
    assert config['candidateSha256'] == '115e417419ab7b55e9fdbad97e51513f9f24a8e523c7b344168a63c92d8e968c'
    assert set(config['sources']) == {'attempt5/source-acquisition.py', 'transport-prep/private-transport.py'}
    assert config['argv'] == ['/prep/attempt5/source-acquisition.py', 'receive-copy', '/owned/native',
                              'source-' + config['operation'], '/owned/private',
                              '/prep/transport-prep/transport-binding.json', '/owned/receipts']
    path = Path('/owned/public-transfer-receipt.json')
    value = os.lstat(path)
    expected = {'PRE': identity(value), 'bytes': value.st_size, 'sha256': config['publicTransferReceiptSha256']}
    source = HeldSource(path, expected, Path('/owned'))
    try:
        receipt = strict(source.content())
        assert receipt['scope'] == 'NEW_PROSPECTIVE_LINUX_PUBLIC_CANDIDATE_CUSTODY_ONLY'
        assert receipt['sourceFreezeSha256'] == config['candidateSha256']
        assert len(receipt['files']) == len({row['path'] for row in receipt['files']}) == 1914
        assert type(receipt['actualServiceRequests']) is int and receipt['actualServiceRequests'] == 0
        assert receipt['privateBytesCopied'] is False
        rows = {row['path']: row for row in receipt['files']}
        pins = {}
        for name, bound in config['sources'].items():
            row = rows[name]
            assert type(row['bytes']) is int and type(bound['bytes']) is int
            assert row['sha256'] == bound['sha256'] and row['bytes'] == bound['bytes']
            pin = row['destinationIdentityDecimal']
            assert set(pin) == {'st_' + field for field in FIELDS}
            pins[name] = {**bound, 'PRE': {field: pin['st_' + field] for field in FIELDS}}
        source.verify()
        return load_acquisition(Path('/prep/attempt5/source-acquisition.py'),
                                Path('/prep/transport-prep/private-transport.py'),
                                pins['attempt5/source-acquisition.py'], pins['transport-prep/private-transport.py'],
                                Path('/prep'), as_main=True, argv=config['argv'])
    finally:
        try:
            source.verify()
        finally:
            source.close()
