"""Finite public SOURCE contracts. No service, Docker or runtime admission here."""
import hashlib
import json
import math
import os
import stat
import time
from pathlib import Path

FIELDS = ('dev', 'ino', 'mode', 'uid', 'gid', 'nlink', 'size', 'mtime_ns', 'ctime_ns')
MAX_FILES = 4096
MAX_BYTES = 67108864
MAX_FILE = 16777216
MAX_COMMANDS = 48
BODY_SECONDS = 48
COMMON_SECONDS = 190
STDIN_SECONDS = 12
STDIN_BYTES = 327692
STREAM_BYTES = 262144
IMAGE = 'sha256:9ff43bfe7849197a6dfbaa80f2d11a34db4202d8aaae269ddc8b740f7da75fb3'
OPERATION = '9cef9576-a3c1-4818-b847-ccd59a12a7fc'


def strict(raw):
    def pairs(items):
        result = {}
        for key, value in items:
            if key in result:
                raise ValueError('DUPLICATE_SOURCE_KEY')
            result[key] = value
        return result
    def bad(value):
        raise ValueError('NONFINITE_SOURCE_JSON')
    def floating(value):
        result = float(value)
        if not math.isfinite(result):
            bad(value)
        return result
    return json.loads(raw, object_pairs_hook=pairs, parse_constant=bad, parse_float=floating)


def encoded(value):
    return (json.dumps(value, separators=(',', ':'), allow_nan=False) + '\n').encode()


def digest(raw):
    return hashlib.sha256(raw).hexdigest()


def nine(value):
    return {key: str(getattr(value, 'st_' + key)) for key in FIELDS}


def valid_nine(value):
    if type(value) is not dict or set(value) != set(FIELDS):
        raise ValueError('EXACT_NINE_FIELDS')
    for field in FIELDS:
        item = value[field]
        if type(item) is not str or not item.isdecimal() or str(int(item)) != item:
            raise ValueError('CANONICAL_NINE_STRING')
    return value


def integer(value, lower, upper, reason):
    if type(value) is not int or not lower <= value <= upper:
        raise ValueError(reason)
    return value


class SourceFailure(RuntimeError):
    def __init__(self, errors):
        self.errors = list(errors)
        super().__init__('; '.join(str(item) for item in self.errors))


class Ledger:
    """One nonresetting admission ledger; changed physical tuples charge again."""
    def __init__(self):
        self.paths = set()
        self.admissions = {}
        self.bytes = 0
        self.live = {}
        self.peak = 0
        self.failed_close = False

    def admit(self, path, pin, sha256, size, kind):
        if self.failed_close:
            raise ValueError('STICKY_UNKNOWN_SOURCE_CLOSE')
        if type(path) is not str or not path or type(kind) is not str:
            raise ValueError('SOURCE_PATH_KIND')
        valid_nine(pin)
        integer(size, 0, MAX_FILE, 'SOURCE_FILE_CAP')
        if int(pin['size']) != size or type(sha256) is not str or len(sha256) != 64 or sha256.lower() != sha256:
            raise ValueError('SOURCE_SIZE_HASH')
        int(sha256, 16)
        key = (path, tuple(pin[x] for x in FIELDS), sha256, size)
        if key in self.admissions:
            return False
        if path not in self.paths and len(self.paths) >= MAX_FILES:
            raise ValueError('SOURCE_UNIQUE_PATH_CAP')
        if self.bytes + size > MAX_BYTES:
            raise ValueError('SOURCE_CUMULATIVE_BYTE_CAP')
        self.paths.add(path)
        self.admissions[key] = kind
        self.bytes += size
        return True

    def own(self, fd, key):
        integer(fd, 0, 2**63 - 1, 'SOURCE_FD_TYPE')
        if self.failed_close or fd in self.live or len(self.live) + getattr(self, 'inherited_live', 0) >= MAX_FILES:
            raise ValueError('SOURCE_LIVE_FD_CAP_OR_STICKY_CLOSE')
        self.live[fd] = key
        self.peak = max(self.peak, len(self.live) + getattr(self, 'inherited_live', 0))

    def can_open(self):
        if self.failed_close or len(self.live) + getattr(self, 'inherited_live', 0) >= MAX_FILES:
            raise ValueError('SOURCE_LIVE_FD_PREDISPATCH_CAP')

    def export(self):
        rows = []
        for (path, values, sha256, size), kind in self.admissions.items():
            rows.append({'path': path, 'PRE9': dict(zip(FIELDS, values)),
                         'sha256': sha256, 'bytes': size, 'kind': kind})
        result = {'scope': 'ONE_ROOT_OWNED_CUMULATIVE_SOURCE_LEDGER', 'members': rows,
                  'summary': self.snapshot()}
        return {'body': result, 'sha256': digest(encoded(result))}

    @classmethod
    def inherit(cls, exported, expected_sha256):
        if type(exported) is not dict or exported['scope'] != 'ONE_ROOT_OWNED_CUMULATIVE_SOURCE_LEDGER':
            raise ValueError('INHERITED_COMPLETE_LEDGER_SCOPE')
        if digest(encoded(exported)) != expected_sha256:
            raise ValueError('INHERITED_LEDGER_DIGEST')
        ledger = cls()
        for row in exported['members']:
            if not ledger.admit(row['path'], row['PRE9'], row['sha256'], row['bytes'], row['kind']):
                raise ValueError('INHERITED_DUPLICATE_ADMISSION')
        summary = exported['summary']
        if (ledger.bytes, len(ledger.paths), len(ledger.admissions)) != (summary['bytes'], summary['uniquePaths'], summary['admissions']):
            raise ValueError('INHERITED_LEDGER_FABRICATED_TOTALS')
        if summary['noReset'] is not True or summary['metadataExemption'] is not False or summary['stickyUnknownClose'] is not False:
            raise ValueError('INHERITED_LEDGER_UNSAFE')
        # Root-owned source descriptors remain in the parent. Count their exact
        # declared live census without pretending that their integer handles
        # are child-owned FDs or closing them in the child.
        ledger.inherited_live = integer(summary['liveOwnedSourceFDs'], 0, MAX_FILES, 'INHERITED_LIVE_SOURCE_FDS')
        ledger.peak = integer(summary['peakOwnedSourceFDs'], 0, MAX_FILES, 'INHERITED_PEAK_SOURCE_FDS')
        return ledger

    def detach(self, fd):
        if fd not in self.live:
            raise ValueError('FOREIGN_SOURCE_FD')
        return self.live.pop(fd)

    def snapshot(self):
        return {'uniquePaths': len(self.paths), 'admissions': len(self.admissions),
                'bytes': self.bytes, 'peakOwnedSourceFDs': self.peak,
                'liveOwnedSourceFDs': len(self.live) + getattr(self, 'inherited_live', 0), 'stickyUnknownClose': self.failed_close,
                'noReset': True, 'metadataExemption': False}


class NativeFS:
    def validate_path(self, path):
        candidate = Path(path)
        if not candidate.is_absolute() or candidate.resolve() != candidate:
            raise ValueError('ABSOLUTE_UNALIASED_SOURCE_PATH')
        for parent in candidate.parents:
            if stat.S_ISLNK(parent.lstat().st_mode):
                raise ValueError('NO_SOURCE_PARENT_SYMLINK')
    def lstat(self, path): return os.lstat(path)
    def fstat(self, fd): return os.fstat(fd)
    def open(self, path): return os.open(path, os.O_RDONLY | os.O_NOFOLLOW)
    def read(self, fd, size): return os.read(fd, size)
    def close(self, fd): return os.close(fd)
    def now_ns(self): return time.time_ns()
    def register(self, owner, fd): owner['fd'] = fd


class Cohort:
    """All FD acquisition precedes member bodies; one owned close attempt per FD."""
    def __init__(self, rows, ledger, fs=None, owner=(0, 0), maturity_ns=60000000000):
        self.rows = rows
        self.ledger = ledger
        self.fs = fs or NativeFS()
        self.owner = owner
        self.maturity_ns = maturity_ns
        self.owned = []
        # Allocate error slots before acquisition. Recording a cleanup failure must
        # not require list growth while later handles still need a close attempt.
        self.error_slots = [None] * (4 * len(rows) + 16)
        self.error_count = 0
        self.observations = []
        self.close_attempts = []

    def error(self, value):
        self.error_slots[self.error_count] = value
        self.error_count += 1

    def open_all(self):
        if len({r['path'] for r in self.rows}) != len(self.rows):
            raise ValueError('DUPLICATE_COHORT_PATH')
        for row in self.rows:
            path = row['path']
            self.fs.validate_path(path)
            pin = nine(self.fs.lstat(path))
            valid_nine(pin)
            if not stat.S_ISREG(int(pin['mode'])) or pin['nlink'] != '1':
                raise ValueError('REGULAR_SINGLE_LINK_SOURCE')
            if (int(pin['uid']), int(pin['gid'])) != self.owner:
                raise ValueError('EXACT_SOURCE_OWNER')
            if self.fs.now_ns() - max(int(pin['mtime_ns']), int(pin['ctime_ns'])) < self.maturity_ns:
                raise ValueError('SOURCE_MATURITY')
            if 'expectedNine' in row and pin != row['expectedNine']:
                raise ValueError('ORIGINAL_SOURCE_NINE_CHANGED')
            integer(row['bytes'], 0, MAX_FILE, 'DECLARED_SOURCE_SIZE_CAP')
            self.ledger.admit(row.get('ledgerPath', path), pin, row['sha256'], row['bytes'], row.get('kind', 'SOURCE'))
            entry = {'row': row, 'pin': pin, 'fd': None, 'closeAttempted': False}
            # Fallible allocation/append occurs before acquisition.
            self.owned.append(entry)
            self.ledger.can_open()
            fd = self.fs.open(path)
            try:
                self.fs.register(entry, fd)
                self.ledger.own(fd, path)
            except BaseException as primary:
                entry['fd'] = None
                detach_error=None
                if fd in self.ledger.live:
                    try:self.ledger.detach(fd)
                    except BaseException as error:detach_error=error;self.ledger.failed_close=True
                entry['closeAttempted'] = True
                try:
                    self.fs.close(fd)
                except BaseException as close:
                    self.ledger.failed_close = True
                    raise SourceFailure([primary,detach_error,close]) from primary
                if detach_error is not None:raise SourceFailure([primary,detach_error]) from primary
                raise
            if nine(self.fs.fstat(fd)) != pin:
                raise ValueError('SOURCE_OPEN_NINE')

    def read_all(self):
        bodies = {}
        for entry in self.owned:
            row, fd, pin = entry['row'], entry['fd'], entry['pin']
            if fd is None or nine(self.fs.fstat(fd)) != pin:
                raise ValueError('SOURCE_PRE_BODY_NINE')
            parts = []; total = 0; h = hashlib.sha256()
            while True:
                block = self.fs.read(fd, 65536)
                if not block:
                    break
                total += len(block)
                if total > MAX_FILE or total > int(pin['size']):
                    raise ValueError('SOURCE_READ_SIZE_CAP')
                h.update(block); parts.append(block)
            if total != int(pin['size']):
                raise ValueError('SOURCE_FULL_EOF_SIZE')
            if 'bytes' in row and total != row['bytes']:
                raise ValueError('DECLARED_SOURCE_SIZE')
            if 'sha256' in row and h.hexdigest() != row['sha256']:
                raise ValueError('DECLARED_SOURCE_HASH')
            if nine(self.fs.fstat(fd)) != pin or nine(self.fs.lstat(row['path'])) != pin:
                raise ValueError('SOURCE_POST_NINE')
            self.ledger.admit(row.get('ledgerPath', row['path']), pin, h.hexdigest(), total, row.get('kind', 'SOURCE'))
            bodies[row['path']] = b''.join(parts)
            self.observations.append({'path': row['path'], 'bytes': total, 'sha256': h.hexdigest(),
                'PRE9': pin, 'OPEN9': pin, 'POST9': pin, 'fullEOF': True})
        return bodies

    def final_and_close(self, primary=None):
        if primary is not None:
            self.error(primary)
        # One failure must not abandon the remaining checks or owned handles.
        for entry in self.owned:
            fd = entry.get('fd')
            if fd is None:
                continue
            try:
                if nine(self.fs.fstat(fd)) != entry['pin'] or nine(self.fs.lstat(entry['row']['path'])) != entry['pin']:
                    raise ValueError('SOURCE_FINAL_NINE')
                for observation in self.observations:
                    if observation['path'] == entry['row']['path']:
                        observation['FINAL9'] = entry['pin']
            except BaseException as error:
                self.error(error)
        for entry in self.owned:
            fd = entry.get('fd')
            if fd is None:
                continue
            entry['fd'] = None  # detach before ambiguous close; never retry
            try:
                self.ledger.detach(fd)
            except BaseException as error:
                self.error(error)
            entry['closeAttempted'] = True
            try:
                self.fs.close(fd)
            except BaseException as error:
                self.ledger.failed_close = True
                self.error(error)
        self.close_attempts = [entry['row']['path'] for entry in self.owned if entry['closeAttempted']]
        return {'members': self.observations, 'closeAttempts': self.close_attempts,
                'closeErrors': [repr(x) for x in self.error_slots[:self.error_count]], 'allFDsBeforeBodies': True,
                'sourceEligibility': False, 'runtimeAuthority': False, 'ledger': self.ledger.snapshot()}


def durable_new(path, raw, limit=MAX_FILE, ledger=None):
    integer(len(raw), 0, limit, 'OUTPUT_FILE_CAP')
    if ledger is not None: ledger.can_open()
    fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600)
    primary = None; registered=False
    try:
        if ledger is not None: ledger.own(fd,str(path));registered=True
        remaining = memoryview(raw)
        while remaining:
            count = os.write(fd, remaining)
            if count <= 0:
                raise OSError('SOURCE_OUTPUT_SHORT_WRITE')
            remaining = remaining[count:]
        os.fsync(fd)
    except BaseException as error:
        primary = error
    detach_error=None
    if ledger is not None and fd in ledger.live:
        try:ledger.detach(fd)
        except BaseException as error:detach_error=error;ledger.failed_close=True
    try:
        os.close(fd)
    except BaseException as close:
        if ledger is not None: ledger.failed_close=True
        raise SourceFailure(([primary] if primary else []) + ([detach_error] if detach_error else [])+[close]) from primary
    if detach_error is not None:raise SourceFailure(([primary] if primary else [])+[detach_error]) from primary
    if primary:
        raise primary


class CommandBudget:
    """48 COMMANDS, not a replacement for the separate 48 second body limit."""
    def __init__(self): self.used = 0; self.failed = False
    def admit(self, cleanup_reserve, timeout=COMMON_SECONDS, stdin_bytes=0):
        integer(cleanup_reserve, 0, MAX_COMMANDS, 'CLEANUP_RESERVE_TYPE')
        integer(timeout, 1, COMMON_SECONDS, 'COMMON_COMMAND_TIMEOUT')
        integer(stdin_bytes, 0, STDIN_BYTES, 'TRANSPORT_STDIN_CAP')
        if self.used + 1 + cleanup_reserve > MAX_COMMANDS:
            self.failed = True
            raise ValueError('WHOLE_COMMAND_COUNT_CLEANUP_ADMISSION')
        self.used += 1
        return self.used
