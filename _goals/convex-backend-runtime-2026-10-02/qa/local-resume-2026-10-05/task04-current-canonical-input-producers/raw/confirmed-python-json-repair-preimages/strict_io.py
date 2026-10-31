"""Current held-FD observations. This module never adopts historical identities."""
import gzip
import hashlib
import json
import os
from pathlib import Path
import re
import stat
import time

FIELDS = ('dev', 'ino', 'mode', 'uid', 'gid', 'nlink', 'size', 'mtime_ns', 'ctime_ns')
SHA = re.compile(r'^[0-9a-f]{64}$')


class Hold(ValueError):
    def __init__(self, message, evidence=None):
        super().__init__(message)
        self.evidence = evidence


def stable(actual, expected, reason, path):
    if actual != expected:
        raise Hold(reason, {"path": str(path), "expected": expected, "actual": actual,
                           "changedFields": [k for k in FIELDS if actual["fields"][k] != expected["fields"][k]]})


def require(condition, reason):
    if not condition:
        raise Hold(reason)


def shape(value, required, optional=()):
    require(type(value) is dict and set(required) <= set(value) and
            set(value) <= set(required) | set(optional), 'STRICT_SCHEMA_UNKNOWN_OR_MISSING_FIELD')
    return value


def integer(value, maximum=2**53-1):
    require(type(value) is int and 0 <= value <= maximum, 'EXACT_BOUNDED_INTEGER')
    return value


def digest(value):
    require(type(value) is str and SHA.fullmatch(value), 'SHA256_SCHEMA')
    return value


def literal(value, absolute=True):
    require(type(value) is str and value and '\x00' not in value and
            os.path.isabs(value) == absolute and os.path.normpath(value) == value and
            '..' not in value.split('/') and len(os.fsencode(value)) <= 4096 and
            len(Path(value).parts) <= 64, 'LITERAL_CANONICAL_PATH')
    return value


def ident(s):
    return {'schema': 'FS_IDENTITY_DECIMAL_V1',
            'fields': {k: str(getattr(s, 'st_' + k)) for k in FIELDS}}


def identity(value):
    shape(value, ('schema', 'fields'))
    require(value['schema'] == 'FS_IDENTITY_DECIMAL_V1', 'CURRENT_DECIMAL_IDENTITY_REQUIRED')
    shape(value['fields'], FIELDS)
    for key, token in value['fields'].items():
        pattern = r'-?(0|[1-9][0-9]*)' if key in ('mtime_ns', 'ctime_ns') else r'(0|[1-9][0-9]*)'
        require(type(token) is str and re.fullmatch(pattern, token) and token != '-0',
                'CANONICAL_IDENTITY_TOKEN')
        require(-(2**63) <= int(token) < 2**64, 'ACTUAL_STAT_64BIT_TOKEN_BOUND')
    return value


def strict_json(raw):
    def pairs(items):
        result = {}
        for key, value in items:
            require(key not in result, 'DUPLICATE_JSON_KEY')
            result[key] = value
        return result
    try:
        return json.loads(raw, object_pairs_hook=pairs,
                          parse_constant=lambda _: (_ for _ in ()).throw(Hold('NONFINITE_JSON')))
    except (UnicodeDecodeError, json.JSONDecodeError) as error:
        raise Hold('STRICT_JSON_PARSE') from error


def encoded(value):
    return (json.dumps(value, sort_keys=True, separators=(',', ':'), ensure_ascii=False) + '\n').encode()


def pin(value, observed=False):
    keys = ('path', 'bytes', 'sha256', 'PRE', 'POST', 'pathPOST', 'EOF') if observed else ('path', 'bytes', 'sha256', 'identity')
    shape(value, keys)
    literal(value['path']); integer(value['bytes']); digest(value['sha256'])
    if observed:
        for key in ('PRE', 'POST', 'pathPOST'):
            identity(value[key])
        require(value['EOF'] is True and value['PRE'] == value['POST'] == value['pathPOST'],
                'FULL_EOF_CURRENT_NINE_REQUIRED')
        authority = value['PRE']
    else:
        authority = identity(value['identity'])
    require(int(authority['fields']['size']) == value['bytes'], 'IDENTITY_CONTENT_SIZE')
    return value


def consumer_pin(observed):
    pin(observed, True)
    return {k: observed[k] for k in ('path', 'bytes', 'sha256')} | {'identity': observed['PRE']}


def materializer_pin(value):
    """Read the literal R3 held() format, which has no serialized EOF member.

    A missing old EOF token is never promoted to evidence. Reader.read performs
    a new physical EOF read and returns its own EOF=True observation.
    """
    shape(value, ('path', 'bytes', 'sha256', 'PRE', 'POST', 'pathPOST'), ('ownedReadAdvice',))
    literal(value['path']); integer(value['bytes']); digest(value['sha256'])
    for key in ('PRE', 'POST', 'pathPOST'):
        identity(value[key])
    require(value['PRE'] == value['POST'] == value['pathPOST'] and
            int(value['PRE']['fields']['size']) == value['bytes'], 'MATERIALIZER_CURRENT_NINE')
    if 'ownedReadAdvice' in value:
        advice = shape(value['ownedReadAdvice'], ('operation', 'calls', 'actualReturnEach', 'allNineUnchanged'))
        require(advice['operation'] == 'POSIX_FADV_DONTNEED_READ_RANGES_OWNED_FD_ONLY' and
                advice['actualReturnEach'] is None and advice['allNineUnchanged'] is True,
                'MATERIALIZER_ADVICE_SCHEMA')
        integer(advice['calls'])
    return value


def read_materializer(reader, value, maximum, collect=False, line_consumer=None):
    materializer_pin(value)
    observed, raw = reader.read(value['path'], maximum, collect=collect, line_consumer=line_consumer)
    require(all(observed[k] == value[k] for k in ('path', 'bytes', 'sha256', 'PRE', 'POST', 'pathPOST')),
            'MATERIALIZER_PIN_DRIFT')
    return observed, raw


class Reader:
    def __init__(self, boundary=lambda: None, deadline_seconds=120, read_seam=None):
        self.boundary = boundary
        self.deadline = time.monotonic() + deadline_seconds
        self.observations = {}
        self.read_seam = read_seam

    def check(self):
        require(time.monotonic() < self.deadline, 'PRODUCER_ABSOLUTE_DEADLINE')
        self.boundary()

    def ancestors(self, path):
        for parent in reversed(Path(path).parents):
            s = os.lstat(parent)
            require(stat.S_ISDIR(s.st_mode) and not stat.S_ISLNK(s.st_mode) and
                    str(parent.resolve()) == str(parent), 'SOURCE_ANCESTOR_ALIAS')

    def read(self, path, maximum, expected=None, collect=True, line_consumer=None):
        literal(str(path)); integer(maximum); self.check(); self.ancestors(path)
        pre = os.lstat(path)
        require(stat.S_ISREG(pre.st_mode) and pre.st_nlink == 1 and
                str(Path(path).resolve()) == str(path), 'REGULAR_SINGLE_LINK_SOURCE')
        require(pre.st_size <= maximum, 'INPUT_BYTE_BOUND_BEFORE_READ')
        fd = os.open(path, os.O_RDONLY | os.O_NOFOLLOW)
        data, pending, total, h = bytearray(), bytearray(), 0, hashlib.sha256()
        try:
            opened = os.fstat(fd)
            require(ident(pre) == ident(opened), 'SOURCE_OPEN_DRIFT')
            while True:
                self.check()
                block = os.read(fd, min(1048576, maximum-total+1))
                if not block:
                    break
                total += len(block); h.update(block)
                require(total <= maximum, 'INPUT_BYTE_BOUND_DURING_READ')
                if collect:
                    data.extend(block)
                if line_consumer:
                    pending.extend(block)
                    while b'\n' in pending:
                        line, _, rest = pending.partition(b'\n'); pending = bytearray(rest)
                        require(len(line) + 1 <= 16384, 'LEDGER_RECORD_BYTE_BOUND')
                        require(line, 'EMPTY_LEDGER_ROW'); line_consumer(strict_json(line))
                    require(len(pending) <= 16384, 'LEDGER_RECORD_BYTE_BOUND')
                if self.read_seam:
                    self.read_seam(str(path), total)
            require(not pending, 'PARTIAL_LEDGER_EOF')
            post, final = os.fstat(fd), os.lstat(path)
            require(ident(pre) == ident(opened) == ident(post) == ident(final) and
                    total == pre.st_size, 'SOURCE_FULL_EOF_NINE_DRIFT')
            row = {'path': str(path), 'bytes': total, 'sha256': h.hexdigest(),
                   'PRE': ident(pre), 'POST': ident(post), 'pathPOST': ident(final), 'EOF': True}
            pin(row, True)
            if expected is not None:
                pin(expected, True)
                require(row == expected, 'CURRENT_SOURCE_PIN_DRIFT')
            previous = self.observations.get(str(path))
            if previous is not None and previous != row:
                raise Hold('INPUT_REOBSERVATION_DRIFT', {'path': str(path), 'expected': previous, 'actual': row})
            self.observations[str(path)] = row
        finally:
            os.close(fd)
        self.check()
        return row, bytes(data)

    def final(self):
        self.check()
        for path, row in self.observations.items():
            self.ancestors(path)
            stable(ident(os.lstat(path)), row['PRE'], 'FINAL_INPUT_PATH_IDENTITY_DRIFT', path)


def verify_backing(reader, row, source, maximum):
    shape(row, ('path', 'bytes', 'sha256', 'PRE', 'POST', 'pathPOST', 'EOF', 'encoding'))
    bare = {k: v for k, v in row.items() if k != 'encoding'}
    require(row['encoding'] in ('RAW_EXACT_PREIMAGE', 'GZIP_EXACT_PREIMAGE'), 'EXACT_BACKING_ENCODING')
    observed, raw = reader.read(row['path'], maximum, bare)
    if row['encoding'] == 'RAW_EXACT_PREIMAGE':
        decoded = raw
    else:
        import zlib
        d = zlib.decompressobj(31)
        decoded = d.decompress(raw, source['bytes'] + 1)
        require(d.eof and not d.unused_data and not d.unconsumed_tail,
                'GZIP_BACKING_EXACT_EOF_NO_TRAILER')
    require(len(decoded) == source['bytes'] and hashlib.sha256(decoded).hexdigest() == source['sha256'],
            'BEFORE_BYTE_BACKING_CONTENT')
    return consumer_pin(observed) | {'encoding': row['encoding']}


def symlink(reader, path, target, expected, synthetic=False):
    literal(path); literal(target); identity(expected); reader.check(); reader.ancestors(path)
    pre = os.lstat(path)
    require(stat.S_ISLNK(pre.st_mode) and pre.st_nlink == 1 and pre.st_uid == os.getuid(),
            'LITERAL_OWNED_SINGLE_LINK_ALIAS')
    require(ident(pre) == expected, 'ALIAS_CURRENT_PIN_DRIFT')
    if synthetic:
        require(not hasattr(os, 'O_PATH') or os.name == 'posix', 'SYNTHETIC_ALIAS_SCOPE')
        raw = os.fsencode(os.readlink(path)); post = os.lstat(path)
    else:
        require(hasattr(os, 'O_PATH'), 'NATIVE_O_PATH_REQUIRED')
        fd = os.open(path, os.O_PATH | os.O_NOFOLLOW)
        try:
            require(ident(os.fstat(fd)) == expected, 'ALIAS_OPEN_DRIFT')
            raw = os.fsencode(os.readlink('', dir_fd=fd)); post = os.fstat(fd)
        finally:
            os.close(fd)
    require(raw == os.fsencode(target) and ident(post) == ident(os.lstat(path)) == expected,
            'LITERAL_ALIAS_TARGET_OR_NINE_DRIFT')
    reader.check()
    return {'path': path, 'target': target, 'identity': expected,
            'literalTargetBytes': len(raw), 'literalTargetSHA256': hashlib.sha256(raw).hexdigest()}
