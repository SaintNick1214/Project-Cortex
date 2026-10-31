"""Finite held-FD stdin acquisition; native identity is a new prospective baseline.

Host tuples are provenance only. The unchanged private helper alone consumes the
new native source. Failures retain their owned staging child and never replay.
"""
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import select
import stat
import struct
import sys
import time

_spec = importlib.util.spec_from_file_location('accepted_private_transport', Path(__file__).resolve().parents[1] / 'transport-prep/private-transport.py')
T = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(T)
NAMES = (*T.NAMES, T.MANIFEST)
MAGIC = b'CRTX03F4'
MAX_FILE = 65536
MAX_HEADER = 65536
MAX_TOTAL = len(MAGIC) + 4 + MAX_HEADER + len(NAMES) * MAX_FILE
STREAM_SECONDS = 12

def strict_object(pairs):
    result = {}
    for key, value in pairs:
        T.require(key not in result)
        result[key] = value
    return result

def strict_json(raw):
    return json.loads(raw, object_pairs_hook=strict_object)

class HeldProducer:
    """Caller must retain this through child terminality, durable receipt and final checks."""
    def __init__(self, source, binding):
        self.root, self.before, self.root_fd, self.rows = T.open_sources(source, NAMES)
        self.closed = False
        try:
            T.require(sorted(os.listdir(self.root_fd)) == sorted(NAMES))
            T.binding_target(self.rows, binding)
            manifest = strict_json(next(r['bytes'] for r in self.rows if r['name'] == T.MANIFEST))
            T.require(manifest['operation'] == binding['operation'] and manifest['requestSha256'] == binding['requestSha256'])
            T.require(len(manifest['files']) == 3 and {r['path'] for r in manifest['files']} == set(T.NAMES))
            for row in self.rows:
                if row['name'] in T.NAMES:
                    T.require(next(r for r in manifest['files'] if r['path'] == row['name'])['sha256'] == row['sha256'])
            self.header = {'version': 1, 'operation': binding['operation'], 'requestSha256': binding['requestSha256'], 'identityAuthority': 'NATIVE_BASELINE_REQUIRED_HOST_TUPLES_PROVENANCE_ONLY', 'files': [{'name': r['name'], 'bytes': len(r['bytes']), 'sha256': r['sha256'], 'hostIdentityDecimal': r['identity']} for r in self.rows]}
            self.header_bytes = json.dumps(self.header, separators=(',', ':'), sort_keys=True).encode()
            T.require(0 < len(self.header_bytes) <= MAX_HEADER)
            self.verify()
        except BaseException:
            self.close()
            raise

    def verify(self):
        T.require(not self.closed)
        T.verify_sources(self.root, self.before, self.root_fd, self.rows)
        T.require(sorted(os.listdir(self.root_fd)) == sorted(NAMES))

    def frames(self):
        self.verify()
        yield MAGIC + struct.pack('!I', len(self.header_bytes)) + self.header_bytes
        total = 12 + len(self.header_bytes)
        for row in self.rows:
            self.verify()
            raw = T.content(row['fd'], len(row['bytes']))
            T.require(raw == row['bytes'])
            total += len(raw)
            T.require(total <= MAX_TOTAL)
            yield raw
        self.verify()

    def close(self):
        if not self.closed:
            for row in self.rows:
                os.close(row['fd'])
            os.close(self.root_fd)
            self.closed = True

class FiniteReader:
    def __init__(self, fd, seconds=STREAM_SECONDS):
        T.require(0 < seconds <= STREAM_SECONDS)
        self.fd = fd
        self.deadline = time.monotonic() + seconds
        self.total = 0

    def read(self, count):
        T.require(type(count) is int and 0 <= count <= MAX_HEADER)
        chunks = []
        remaining = count
        while remaining:
            timeout = self.deadline - time.monotonic()
            T.require(timeout > 0 and select.select([self.fd], [], [], timeout)[0])
            raw = os.read(self.fd, remaining)
            T.require(bool(raw))
            self.total += len(raw)
            T.require(self.total <= MAX_TOTAL)
            chunks.append(raw)
            remaining -= len(raw)
        return b''.join(chunks)

    def eof(self):
        timeout = self.deadline - time.monotonic()
        T.require(timeout > 0 and select.select([self.fd], [], [], timeout)[0])
        T.require(os.read(self.fd, 1) == b'')

def acquire(fd, root, child, binding, receipt_directory, seconds=STREAM_SECONDS):
    T.require(os.getuid() == 501 and os.getgid() == 20)
    T.require(type(child) is str and child.startswith('source-') and len(child) == 43 and all(c in '0123456789abcdef-' for c in child[7:]))
    reader = FiniteReader(fd, seconds)
    T.require(reader.read(8) == MAGIC)
    length = struct.unpack('!I', reader.read(4))[0]
    T.require(0 < length <= MAX_HEADER)
    header = strict_json(reader.read(length))
    T.require(set(header) == {'version', 'operation', 'requestSha256', 'identityAuthority', 'files'})
    T.require(type(header['version']) is int and header['version'] == 1 and header['operation'] == binding['operation'] and header['requestSha256'] == binding['requestSha256'])
    T.require(header['identityAuthority'] == 'NATIVE_BASELINE_REQUIRED_HOST_TUPLES_PROVENANCE_ONLY')
    T.require(type(header['files']) is list and [r.get('name') for r in header['files']] == list(NAMES))
    expected = 12 + length
    for row in header['files']:
        T.require(set(row) == {'name', 'bytes', 'sha256', 'hostIdentityDecimal'})
        T.require(type(row['bytes']) is int and 0 < row['bytes'] <= MAX_FILE)
        T.require(type(row['sha256']) is str and len(row['sha256']) == 64 and all(c in '0123456789abcdef' for c in row['sha256']))
        T.require(set(row['hostIdentityDecimal']) == set(T.FIELDS) and all(type(v) is str and v.isdecimal() for v in row['hostIdentityDecimal'].values()))
        expected += row['bytes']
    T.require(expected <= MAX_TOTAL)
    parent, before = T.owned_directory(root)
    parent_fd = os.open(parent, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW)
    dest_fd = None
    held_fd = None
    held_rows = []
    try:
        T.require(T.identity(before) == T.identity(os.fstat(parent_fd)))
        os.mkdir(child, 0o700, dir_fd=parent_fd)
        source = parent / child
        source, _ = T.owned_directory(source)
        dest_fd = os.open(child, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW, dir_fd=parent_fd)
        records = []
        for row in header['files']:
            raw = reader.read(row['bytes'])
            T.require(hashlib.sha256(raw).hexdigest() == row['sha256'])
            native = T.write_exact(source, dest_fd, row['name'], raw)
            records.append({'path': row['name'], 'bytes': len(raw), 'sha256': row['sha256'], 'nativeIdentityDecimal': native})
        reader.eof()
        T.require(reader.total == expected)
        os.fsync(dest_fd)
        T.require(sorted(os.listdir(dest_fd)) == sorted(NAMES))
        native_root, native_before, held_fd, held_rows = T.open_sources(source, NAMES)
        T.binding_target(held_rows, binding)
        for row in held_rows:
            item = next(r for r in records if r['path'] == row['name'])
            T.require(item['nativeIdentityDecimal'] == row['identity'] and item['sha256'] == row['sha256'])
        receipts, _ = T.owned_directory(receipt_directory)
        receipt_fd = os.open(receipts, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW)
        receipt = {'scope': 'NEW_PROSPECTIVE_NATIVE_SOURCE_ACQUISITION', 'status': 'PASS', 'operation': binding['operation'], 'requestSha256': binding['requestSha256'], 'sourceChild': child, 'nativeDirectoryIdentityDecimal': T.identity(native_before), 'files': records, 'hostTuplesAreNativeAuthority': False, 'exactEOF': True, 'totalBytes': reader.total, 'filesHeldThroughReceipt': True, 'privateContentsPrinted': False, 'serviceCalls': 0}
        try:
            T.write_exact(receipts, receipt_fd, child + '.json', (json.dumps(receipt, indent=2) + '\n').encode())
            os.fsync(receipt_fd)
        finally:
            os.close(receipt_fd)
        T.verify_sources(native_root, native_before, held_fd, held_rows)
        return source, receipt, (native_root, native_before, held_fd, held_rows)
    except BaseException:
        for row in held_rows:
            os.close(row['fd'])
        if held_fd is not None:
            os.close(held_fd)
        raise
    finally:
        if dest_fd is not None:
            os.close(dest_fd)
        os.close(parent_fd)

def close_native(held):
    for row in held[3]:
        os.close(row['fd'])
    os.close(held[2])

def receive_and_copy(root, child, destination, binding, receipt_directory, fd=0):
    held = None
    try:
        source, receipt, held = acquire(fd, root, child, binding, receipt_directory)
        custody = T.copy_private(source, destination, binding, stage=False)
        T.verify_sources(*held)
        return {'status': 'PASS', 'scope': 'PUBLIC_DUMMY_NATIVE_SOURCE_THEN_UNCHANGED_HELPER', 'sourceFiles': len(receipt['files']), 'copiedFiles': len(custody['files']), 'nativeAllNineAndFullContents': True, 'privateContentsPrinted': False, 'serviceCalls': 0}
    finally:
        if held is not None:
            close_native(held)

if __name__ == '__main__':
    try:
        T.require(len(sys.argv) == 7 and sys.argv[1] == 'receive-copy')
        binding = strict_json(T.canonical(sys.argv[5]).read_bytes())
        result = receive_and_copy(sys.argv[2], sys.argv[3], sys.argv[4], binding, sys.argv[6])
        print(json.dumps(result))
    except BaseException:
        print(json.dumps({'status': 'FAIL', 'scope': 'NATIVE_SOURCE_ACQUISITION_ONLY', 'failureClass': 'native_source_fence', 'privateContentsPrinted': False, 'serviceCalls': 0}))
        sys.exit(1)
