"""Content-only allowlisted acquisition. Never imports or executes a candidate."""
import argparse
import gzip
import hashlib
import io
import json
import os
from pathlib import Path
import re
import stat
import struct
import sys
import tarfile
import time
import zlib

FIELDS = ('dev', 'ino', 'mode', 'uid', 'gid', 'nlink', 'size', 'mtime_ns', 'ctime_ns')
CHUNK = 1024 * 1024

def identity(s):
    return {'schema': 'FS_IDENTITY_DECIMAL_V1', 'fields': {k: str(getattr(s, 'st_' + k)) for k in FIELDS}}

def held(path, consume):
    path = Path(path)
    before = os.lstat(path)
    if not stat.S_ISREG(before.st_mode) or before.st_nlink != 1 or str(path.resolve()) != str(path):
        raise ValueError('SOURCE_BINDING ' + str(path))
    fd = os.open(path, os.O_RDONLY | os.O_NOFOLLOW)
    try:
        if identity(os.fstat(fd)) != identity(before):
            raise ValueError('SOURCE_OPEN_DRIFT')
        digest = hashlib.sha256()
        size = 0
        while block := os.read(fd, CHUNK):
            consume(block)
            digest.update(block)
            size += len(block)
        if identity(os.fstat(fd)) != identity(before) or identity(os.lstat(path)) != identity(before):
            raise ValueError('SOURCE_POST_DRIFT')
        if size != before.st_size:
            raise ValueError('SOURCE_SIZE_DRIFT')
        return {'path': str(path), 'bytes': size, 'sha256': digest.hexdigest(), 'PRE': identity(before), 'POST': identity(os.fstat(fd)), 'pathPOST': identity(os.lstat(path))}
    finally:
        os.close(fd)

def read_json(path, maximum=64 * CHUNK):
    if os.lstat(path).st_size > maximum:
        raise ValueError('METADATA_CAP')
    chunks = []
    receipt = held(path, chunks.append)
    raw = b''.join(chunks)
    if raw.startswith(b'\x1f\x8b'):
        decoder = zlib.decompressobj(31)
        raw = decoder.decompress(raw, maximum + 1)
        if len(raw) > maximum or not decoder.eof or decoder.unused_data or decoder.unconsumed_tail:
            raise ValueError('METADATA_GZIP_BOUNDARY')
        receipt['decodedBytes'] = len(raw)
        receipt['decodedSHA256'] = hashlib.sha256(raw).hexdigest()
        receipt['gzipEOFCRC'] = True
    def unique(pairs):
        out = {}
        for key, value in pairs:
            if key in out:
                raise ValueError('DUPLICATE_METADATA_KEY')
            out[key] = value
        return out
    return json.loads(raw, object_pairs_hook=unique), receipt

def encoded_chunks(repo, parts, proof):
    whole = hashlib.sha256()
    total = 0
    for part in parts:
        path = repo / part['path']
        before = os.lstat(path)
        if not stat.S_ISREG(before.st_mode) or before.st_nlink != 1 or path.resolve() != path:
            raise ValueError('PART_BINDING')
        fd = os.open(path, os.O_RDONLY | os.O_NOFOLLOW)
        digest = hashlib.sha256()
        size = 0
        try:
            if identity(os.fstat(fd)) != identity(before):
                raise ValueError('PART_OPEN_DRIFT')
            while block := os.read(fd, CHUNK):
                digest.update(block)
                whole.update(block)
                size += len(block)
                total += len(block)
                yield block
            if identity(os.fstat(fd)) != identity(before) or identity(os.lstat(path)) != identity(before):
                raise ValueError('PART_POST_DRIFT')
            if size != part['bytes'] or digest.hexdigest() != part['sha256']:
                raise ValueError('PART_HASH_SIZE')
            proof['parts'].append({'path': str(path), 'bytes': size, 'sha256': digest.hexdigest(), 'PRE': identity(before), 'POST': identity(os.fstat(fd)), 'pathPOST': identity(os.lstat(path))})
        finally:
            os.close(fd)
    proof.update(encodedBytes=total, encodedSHA256=whole.hexdigest())

class Decoded(io.RawIOBase):
    def __init__(self, encoded, cap):
        self.encoded = iter(encoded)
        self.decoder = zlib.decompressobj(31)
        self.pending = b''
        self.done = False
        self.total = 0
        self.digest = hashlib.sha256()
        self.cap = cap

    def readable(self):
        return True

    def close(self):
        if not self.closed:
            self.encoded.close()
        super().close()

    def read(self, size=-1):
        if size < 0 or size > CHUNK:
            raise ValueError('READ_CAP')
        if size == 0:
            return b''
        while not self.done:
            if not self.pending:
                try:
                    self.pending = next(self.encoded)
                except StopIteration:
                    self.done = True
                    if not self.decoder.eof:
                        raise ValueError('GZIP_TRUNCATED')
                    return b''
            out = self.decoder.decompress(self.pending, size)
            self.pending = self.decoder.unconsumed_tail
            if self.decoder.unused_data:
                raise ValueError('GZIP_TRAILING_OR_CONCATENATED')
            self.total += len(out)
            self.digest.update(out)
            if self.total > self.cap:
                raise ValueError('DECODE_CAP')
            if out:
                return out
        return b''

def take(reader, size):
    result = bytearray()
    while len(result) < size:
        block = reader.read(min(CHUNK, size - len(result)))
        if not block:
            raise ValueError('OBJECT_TRUNCATED')
        result.extend(block)
    return bytes(result)

def _acquire_archive(repo, route, wanted, destination, reader, proof):
    expected = route['members']
    selected = {h: n for h, n in wanted.items() if h in expected}
    if any(expected[h] != n for h, n in selected.items()):
        raise ValueError('ALLOWLIST_SIZE')
    seen = set()

    def member(digest, size, source):
        if not re.fullmatch('[a-f0-9]{64}', digest) or type(size) is not int or size < 0 or digest in seen or digest not in expected or expected[digest] != size:
            raise ValueError('ARCHIVE_MEMBER_SET_SIZE')
        seen.add(digest)
        output = None
        path = destination / digest
        if digest in selected:
            output = open(path, 'xb')
            os.chmod(path, 0o600)
        h = hashlib.sha256()
        try:
            remaining = size
            while remaining:
                block = source(min(CHUNK, remaining))
                if not block or len(block) > remaining:
                    raise ValueError('MEMBER_TRUNCATED')
                h.update(block)
                remaining -= len(block)
                if output:
                    output.write(block)
            if h.hexdigest() != digest:
                raise ValueError('MEMBER_HASH')
            if output:
                output.flush()
                os.fsync(output.fileno())
        finally:
            if output:
                output.close()
        if digest in selected:
            record = held(path, lambda _: None)
            if record['sha256'] != digest or record['bytes'] != size:
                raise ValueError('OUTPUT_READBACK')
            proof['selected'].append(record)

    if route['format'] == 'raw-sha-be64':
        for _ in range(len(expected)):
            digest = take(reader, 64).decode('ascii')
            size = struct.unpack('>Q', take(reader, 8))[0]
            member(digest, size, lambda n: take(reader, n))
        if reader.read(1):
            raise ValueError('RAW_ARCHIVE_TRAILING')
    else:
        with tarfile.open(fileobj=reader, mode='r|', bufsize=10240) as archive:
            for item in archive:
                if not item.isfile() or not item.name.startswith('objects/') or len(item.name) != 72:
                    raise ValueError('TAR_MEMBER_TYPE_PATH')
                digest = item.name[8:]
                source = archive.extractfile(item)
                if source is None:
                    raise ValueError('TAR_MEMBER_SOURCE')
                with source:
                    member(digest, item.size, source.read)
        # Consume gzip EOF/CRC and all remaining encoded parts after tar terminates.
        while reader.read(CHUNK):
            pass
    if seen != set(expected) or {x['sha256'] for x in proof['selected']} != set(selected):
        raise ValueError('ARCHIVE_MEMBERSHIP')
    if proof['encodedSHA256'] != route['sha256'] or proof['encodedBytes'] != route['bytes']:
        raise ValueError('ARCHIVE_ENCODED_HASH_SIZE')
    proof.update(members=len(seen), decodedBytes=reader.total, decodedSHA256=reader.digest.hexdigest(), gzipEOFCRC=True, completeMemberHashes=True)
    return proof

def acquire_archive(repo, route, wanted, destination):
    proof = {'route': route['name'], 'parts': [], 'members': 0, 'selected': [], 'scope': 'CONTENT_ONLY_FRESH_ACQUISITION_NO_HISTORICAL_CUSTODY'}
    reader = Decoded(encoded_chunks(repo, route['parts'], proof), route['decodedCap'])
    try:
        return _acquire_archive(repo, route, wanted, destination, reader, proof)
    except BaseException as error:
        error.qaAcquisitionProof = proof
        raise
    finally:
        reader.close()
