#!/usr/bin/env python3
"""Independent SOURCE-only owner; bootstrap discovery remains explicitly staged.

Every added cohort is opened completely before any member body is read. Previously
opened cohorts remain owned. The graph never resets its path, byte or FD counters.
Commands are bounded JSON lines on stdin. No candidate entry is executed here.
"""
import base64
import hashlib
import json
import math
import os
import stat
import sys
import time
import traceback

MAX_PATHS = 4096
MAX_BYTES = 64 * 1024 * 1024
MAX_FILE = 16 * 1024 * 1024
AGE_NS = 60 * 1000000000
J = os.path.dirname(os.path.abspath(__file__))
FIELDS = ('dev', 'ino', 'mode', 'nlink', 'uid', 'gid', 'size', 'mtime_ns', 'ctime_ns')


def nine(s):
    return dict(zip(FIELDS, (s.st_dev, s.st_ino, s.st_mode, s.st_nlink,
                            s.st_uid, s.st_gid, s.st_size,
                            s.st_mtime_ns, s.st_ctime_ns)))


def describe(exc):
    return {'type': type(exc).__name__, 'message': str(exc),
            'traceback': ''.join(traceback.format_exception(type(exc), exc, exc.__traceback__))}


def finite(token):
    value = float(token)
    if not math.isfinite(value):
        raise ValueError('non-finite JSON float')
    return value


def unique(pairs):
    obj = {}
    for key, value in pairs:
        if key in obj:
            raise ValueError('duplicate JSON key: ' + key)
        obj[key] = value
    return obj


def decode(data):
    return json.loads(data, object_pairs_hook=unique, parse_float=finite,
                      parse_constant=lambda value: (_ for _ in ()).throw(ValueError(value)))


class Owner:
    def __init__(self):
        # The fixed bootstrap transfers its still-owned source/STOP descriptors.
        # It does not close them and does not create a second ownership ledger.
        self.rows = globals().get('BOOT_ROWS', [])
        self.by_path = {row['path']: row for row in self.rows}
        self.bytes = sum(row['original9']['size'] for row in self.rows)
        self.events = []
        self.errors = []
        self.close_errors = []
        self.finished = False
        self.started_ns = time.time_ns()
        if self.rows:
            self.events.append({'event': 'bootstrap-owned-fd-transfer',
                                'owned_paths': len(self.rows), 'bytes': self.bytes,
                                'at_ns': self.started_ns})

    def open_rows(self, requests):
        pending = []
        pending_paths = set()
        for req in requests:
            path = os.path.abspath(req['path'])
            if path in pending_paths:
                raise ValueError('duplicate path in new cohort: ' + path)
            pending_paths.add(path)
            if path in self.by_path:
                row = self.by_path[path]
                self.assert_expected(row['original9'], row, req)
                if req.get('sha256'):
                    if row.get('sha256') is not None and row['sha256'] != req['sha256']:
                        raise ValueError('held original hash mismatch: ' + path)
                    row['expected_sha256'] = req['sha256']
                continue
            # This is only a maturity observation; eligibility capture follows it.
            age_meta = os.lstat(path)
            current_age = time.time_ns() - max(age_meta.st_mtime_ns, age_meta.st_ctime_ns)
            if current_age < AGE_NS:
                raise ValueError('IMMATURE before qualifying capture: ' + path + ': ' + str(current_age))
            first = nine(os.lstat(path))
            if not stat.S_ISREG(first['mode']) or first['nlink'] != 1:
                raise ValueError('not regular single-link input: ' + path)
            if first['size'] > MAX_FILE or first['size'] < 0:
                raise ValueError('per-file cap: ' + path)
            if time.time_ns() - max(first['mtime_ns'], first['ctime_ns']) < AGE_NS:
                raise ValueError('IMMATURE at qualifying capture: ' + path)
            self.assert_expected(first, None, req)
            pending.append((req, path, first, current_age))
        added_bytes = sum(item[2]['size'] for item in pending)
        if len(self.rows) + len(pending) > MAX_PATHS or self.bytes + added_bytes > MAX_BYTES:
            raise ValueError('one SOURCE ledger cap exceeded')
        # Register ownership immediately after each successful open. A failure in
        # any later open/fstat leaves all preceding descriptors in the same owner.
        for req, path, first, age in pending:
            fd = os.open(path, os.O_RDONLY | getattr(os, 'O_NOFOLLOW', 0))
            row = {'path': path, 'fd': fd, 'original9': first,
                   'expected_sha256': req.get('sha256'),
                   'expected_size': req.get('size', req.get('bytes')),
                   'age_before_capture_ns': age, 'closed': False,
                   'close_attempted': False, 'content': None}
            self.rows.append(row)
            self.by_path[path] = row
            self.bytes += first['size']
            if nine(os.fstat(fd)) != first or nine(os.lstat(path)) != first:
                raise ValueError('open identity/nine mismatch: ' + path)
        self.events.append({'event': 'cohort-all-open-before-body', 'new': len(pending),
                            'owned_paths': len(self.rows), 'bytes': self.bytes,
                            'at_ns': time.time_ns()})
        return {'new': len(pending), 'owned_paths': len(self.rows), 'bytes': self.bytes}

    @staticmethod
    def assert_expected(actual, row, req):
        expected = req.get('nine') or req.get('original9') or req.get('pre9')
        if expected is not None:
            if isinstance(expected, list):
                expected = dict(zip(FIELDS, expected))
            if actual != expected:
                raise ValueError('original-nine mismatch: ' + req['path'])
        size = req.get('size', req.get('bytes'))
        if size is not None and actual['size'] != size:
            raise ValueError('original-size mismatch: ' + req['path'])
        if row is not None and req.get('sha256') and row.get('expected_sha256') not in (None, req['sha256']):
            raise ValueError('contradictory original hash: ' + req['path'])

    def read_rows(self, paths):
        out = []
        for path in paths:
            row = self.by_path[os.path.abspath(path)]
            if row['content'] is None:
                if nine(os.fstat(row['fd'])) != row['original9'] or nine(os.lstat(row['path'])) != row['original9']:
                    raise ValueError('pre-body nine mismatch: ' + row['path'])
                os.lseek(row['fd'], 0, os.SEEK_SET)
                pieces, total = [], 0
                while True:
                    part = os.read(row['fd'], 65536)
                    if not part:
                        break
                    total += len(part)
                    if total > MAX_FILE:
                        raise ValueError('actual per-file overflow')
                    pieces.append(part)
                data = b''.join(pieces)
                digest = hashlib.sha256(data).hexdigest()
                if total != row['original9']['size'] or (row['expected_sha256'] and digest != row['expected_sha256']):
                    raise ValueError('EOF/size/hash mismatch: ' + row['path'])
                if nine(os.fstat(row['fd'])) != row['original9'] or nine(os.lstat(row['path'])) != row['original9']:
                    raise ValueError('post-EOF nine mismatch: ' + row['path'])
                row.update(content=data, sha256=digest, eof=True, bytes_read=total)
            out.append({'path': row['path'], 'size': row['bytes_read'], 'sha256': row['sha256']})
        return out

    def get(self, path):
        row = self.by_path[os.path.abspath(path)]
        if row['content'] is None:
            raise ValueError('source was not read to EOF: ' + path)
        return row['content']

    def final(self):
        failures = []
        for row in self.rows:
            try:
                current_fd, current_path = nine(os.fstat(row['fd'])), nine(os.lstat(row['path']))
                row.update(final_fd9=current_fd, final_path9=current_path)
                if current_fd != row['original9'] or current_path != row['original9']:
                    raise ValueError('held final original-nine mismatch: ' + row['path'])
                if row['content'] is None:
                    raise ValueError('owned input never read to EOF: ' + row['path'])
                os.lseek(row['fd'], 0, os.SEEK_SET)
                digest, count = hashlib.sha256(), 0
                while True:
                    data = os.read(row['fd'], 65536)
                    if not data:
                        break
                    digest.update(data)
                    count += len(data)
                row['final_eof'] = True
                row['final_hash'] = digest.hexdigest()
                if count != row['original9']['size'] or digest.hexdigest() != row['sha256']:
                    raise ValueError('held final EOF/hash/size mismatch: ' + row['path'])
                if nine(os.fstat(row['fd'])) != row['original9'] or nine(os.lstat(row['path'])) != row['original9']:
                    raise ValueError('held final post-EOF nine mismatch: ' + row['path'])
            except BaseException as exc:
                failures.append({'path': row['path'], 'error': describe(exc)})
        self.errors.extend(failures)
        return failures

    def close(self):
        for row in self.rows:
            if row['close_attempted']:
                continue
            row['close_attempted'] = True
            try:
                os.close(row['fd'])
                row['closed'] = True
            except BaseException as exc:
                self.close_errors.append({'path': row['path'], 'fd': row['fd'], 'error': describe(exc)})
        self.finished = True

    def receipt(self):
        rows = [{k: v for k, v in row.items() if k not in ('fd', 'content')} for row in self.rows]
        return {'scope': 'INDEPENDENT_SOURCE_ONLY', 'started_ns': self.started_ns,
                'ended_ns': time.time_ns(), 'unique_paths': len(rows), 'bytes': self.bytes,
                'source_limits': [MAX_PATHS, MAX_BYTES, MAX_FILE], 'events': self.events,
                'rows': rows, 'errors': self.errors, 'close_errors': self.close_errors,
                'close_attempts': sum(row['close_attempted'] for row in self.rows),
                'successful_closes': sum(row['closed'] for row in self.rows),
                'published_source_eligibility': False}


def main():
    owner = Owner()
    print(json.dumps({'ready': True, 'scope': 'SOURCE_ONLY', 'pid': os.getpid()}), flush=True)
    seal_path = None
    primary = None
    try:
        for line in sys.stdin:
            req = decode(line)
            op = req['op']
            if op == 'open':
                result = owner.open_rows(req['rows'])
            elif op == 'read':
                result = owner.read_rows(req['paths'])
            elif op == 'show':
                result = owner.get(req['path']).decode('utf-8')
            elif op == 'json':
                result = decode(owner.get(req['path']))
            elif op == 'exec':
                code_path = req['path']
                env = {'__name__': '__review_control__', '__file__': code_path,
                       'OWNER': owner, 'REQUEST': req, 'J': J}
                exec(compile(owner.get(code_path), code_path, 'exec'), env, env)
                result = env.get('RESULT')
            elif op == 'check':
                result = owner.final()
            elif op == 'seal':
                seal_path = os.path.abspath(req['path'])
                if os.path.dirname(seal_path) != J:
                    raise ValueError('receipt output outside sole reviewer namespace')
                owner.final()
                result = {'sealing': True}
                print(json.dumps({'op': op, 'result': result}), flush=True)
                break
            else:
                raise ValueError('unknown review operation')
            print(json.dumps({'op': op, 'result': result}), flush=True)
    except BaseException as exc:
        primary = describe(exc)
        owner.errors.append({'primary': primary})
        print(json.dumps({'error': primary}), flush=True)
    finally:
        owner.close()
        receipt = owner.receipt()
        if seal_path:
            try:
                with open(seal_path, 'x', encoding='utf-8') as output:
                    json.dump(receipt, output, sort_keys=True, indent=2)
                    output.write('\n')
            except BaseException as exc:
                print(json.dumps({'report_error': describe(exc), 'receipt': receipt}), flush=True)
        else:
            print(json.dumps({'unsealed_receipt': receipt}), flush=True)
        print(json.dumps({'finished': True, 'primary': primary,
                          'owned': len(owner.rows), 'close_attempts': receipt['close_attempts'],
                          'close_errors': owner.close_errors}), flush=True)


if __name__ == '__main__':
    main()
