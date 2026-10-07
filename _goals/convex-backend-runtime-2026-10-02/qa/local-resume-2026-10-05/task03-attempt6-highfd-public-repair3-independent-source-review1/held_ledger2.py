"""Prepared reviewer custody library. Performs I/O only when explicitly called.

No U3 path is captured by importing this module. The future reviewer must supply
an author-declared stopped finite graph and preserve every supplied original pin.
"""
import hashlib
import json
import math
import os
from pathlib import Path
import stat
import time

FIELDS = ('dev', 'ino', 'mode', 'nlink', 'uid', 'gid', 'size', 'mtime_ns', 'ctime_ns')
MAX_FILES = 4096
MAX_BYTES = 67108864
MAX_FILE_BYTES = 16777216
MIN_AGE_NS = 60000000000


def nine(value):
    return {key: str(getattr(value, 'st_' + key)) for key in FIELDS}


def strict_json(raw):
    def pairs(items):
        result = {}
        for key, value in items:
            assert key not in result, 'duplicate_key'
            result[key] = value
        return result

    def finite(number):
        value = float(number)
        assert math.isfinite(value), 'nonfinite_float'
        return value

    return json.loads(raw, object_pairs_hook=pairs, parse_float=finite,
                      parse_constant=lambda _: (_ for _ in ()).throw(ValueError('nonfinite')))


class HeldLedger:
    def __init__(self, root, *, prior_owners=()):
        self.root = Path(root)
        self.owners = [dict(row) for row in prior_owners]
        self.by_path = {row['path']: row for row in self.owners}
        assert len(self.by_path) == len(self.owners)
        assert all(type(row['fd']) is int and row['fd'] >= 0 for row in self.owners)
        assert len({row['fd'] for row in self.owners}) == len(self.owners)
        self.bytes = sum(int(row['PRE9']['size']) for row in self.owners)
        assert len(self.owners) <= MAX_FILES and self.bytes <= MAX_BYTES
        assert all(0 <= int(row['PRE9']['size']) <= MAX_FILE_BYTES for row in self.owners)
        self.close_attempts = []
        self.close_errors = []
        self.closed = False

    def capture_many(self, inputs):
        """Open the whole declared batch before reading any batch content."""
        assert not self.closed, 'ledger_already_closed'
        captured = []
        for path, expected in inputs:
            path = Path(path)
            assert path.is_absolute() and path.is_relative_to(self.root)
            assert path.resolve() == path
            current = self.root
            for part in ('.', *path.relative_to(self.root).parts):
                if part != '.':
                    current /= part
                value = current.lstat()
                assert not stat.S_ISLNK(value.st_mode) and current.resolve() == current
                if current != path:
                    assert stat.S_ISDIR(value.st_mode)
            before = nine(path.lstat())
            assert stat.S_ISREG(int(before['mode'])) and before['nlink'] == '1'
            assert before['uid'] == '501' and before['gid'] == '20'
            size = int(before['size'])
            assert 0 <= size <= MAX_FILE_BYTES
            age = time.time_ns() - max(int(before['mtime_ns']), int(before['ctime_ns']))
            assert age >= MIN_AGE_NS, 'immature_before_first_capture:' + str(path)
            key = str(path)
            if expected and 'PRE9' in expected:
                assert before == expected['PRE9'], 'original_nine_not_refreshable:' + key
            if key in self.by_path:
                owner = self.by_path[key]
                assert before == owner['PRE9'] == nine(os.fstat(owner['fd']))
                if expected:
                    assert type(expected['bytes']) is int
                    prior = owner.get('expected')
                    if prior:
                        assert prior['bytes'] == expected['bytes'] and prior['sha256'] == expected['sha256']
                    if 'PRE9' in expected:
                        assert expected['PRE9'] == owner['PRE9']
                captured.append(owner)
                continue
            assert len(self.owners) + 1 <= MAX_FILES
            assert self.bytes + size <= MAX_BYTES
            fd = os.open(path, os.O_RDONLY | os.O_NOFOLLOW)
            owner = {'path': key, 'fd': fd, 'PRE9': before, 'expected': expected,
                     'maturityAgeNs': str(age)}
            # Registration precedes every throwing operation after successful open.
            self.owners.append(owner)
            self.by_path[key] = owner
            self.bytes += size
            assert nine(os.fstat(fd)) == before
            captured.append(owner)
        return captured

    def read(self, owner):
        assert not self.closed
        fd = owner['fd']
        original = owner['PRE9']
        assert nine(os.fstat(fd)) == original
        os.lseek(fd, 0, os.SEEK_SET)
        result = bytearray()
        while block := os.read(fd, 65536):
            result.extend(block)
            assert len(result) <= int(original['size']) <= MAX_FILE_BYTES
        assert len(result) == int(original['size'])
        assert nine(os.fstat(fd)) == nine(Path(owner['path']).lstat()) == original
        raw = bytes(result)
        digest = hashlib.sha256(raw).hexdigest()
        expected = owner.get('expected')
        if expected:
            assert type(expected['bytes']) is int
            assert expected['bytes'] == len(raw) and expected['sha256'] == digest
        if 'sha256' in owner:
            assert owner['sha256'] == digest, 'original_hash_not_refreshable'
        owner.update(bytes=len(raw), sha256=digest, fullEOF=True,
                     finalDescriptorAndPathNineEqual=True)
        return raw

    def final_qualify_all(self):
        for owner in self.owners:
            expected = owner.get('sha256')
            raw = self.read(owner)
            if expected is not None:
                assert hashlib.sha256(raw).hexdigest() == expected

    def close_all_once(self):
        """Try every owned close exactly once; errors are sticky, never retried."""
        assert not self.closed, 'ledger_close_retry_denied'
        self.closed = True
        for owner in self.owners:
            fd = owner.pop('fd', None)
            if type(fd) is not int or fd < 0:
                self.close_errors.append({'path': owner['path'], 'class': 'UnknownOwnedFD',
                                          'reason': 'owner_handle_unavailable_no_retry'})
                continue
            self.close_attempts.append({'path': owner['path'], 'fd': fd})
            try:
                os.close(fd)
            except BaseException as error:
                self.close_errors.append({'path': owner['path'], 'fd': fd,
                                          'class': type(error).__name__, 'reason': str(error)})
        return list(self.close_errors)
