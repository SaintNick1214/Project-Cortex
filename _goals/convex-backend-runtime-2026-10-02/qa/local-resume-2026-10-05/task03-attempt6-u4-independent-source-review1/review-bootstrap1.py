#!/usr/bin/env python3
"""Fixed trusted review bootstrap, with one still-held owner transferred to loader.

This source, the reader source, and their writer STOP are the first cohort. All
are genuinely mature, opened before their source bodies, and remain held until
the review's final all-nine/hash/EOF fence and all-attempted close.
"""
import hashlib
import json
import os
import stat
import time

J = os.path.dirname(os.path.abspath(__file__))
F = ('dev', 'ino', 'mode', 'nlink', 'uid', 'gid', 'size', 'mtime_ns', 'ctime_ns')


def n(s):
    return dict(zip(F, (s.st_dev, s.st_ino, s.st_mode, s.st_nlink, s.st_uid,
                       s.st_gid, s.st_size, s.st_mtime_ns, s.st_ctime_ns)))


def main():
    paths = [os.path.join(J, name) for name in
             ('review-bootstrap1.py', 'held-review-loader1.py', 'reader-source-writer-stop1.json')]
    rows, errors, handed = [], [], False
    try:
        first = []
        for path in paths:
            observed = os.lstat(path)
            age = time.time_ns() - max(observed.st_mtime_ns, observed.st_ctime_ns)
            if age < 60000000000:
                raise ValueError('own reader source immature before first capture: ' + path)
            before = n(os.lstat(path))
            if not stat.S_ISREG(before['mode']) or before['nlink'] != 1:
                raise ValueError('own bootstrap requires regular single-link source')
            if time.time_ns() - max(before['mtime_ns'], before['ctime_ns']) < 60000000000:
                raise ValueError('own reader source immature at capture')
            first.append((path, before, age))
        for path, before, age in first:
            fd = os.open(path, os.O_RDONLY | getattr(os, 'O_NOFOLLOW', 0))
            row = {'path': path, 'fd': fd, 'original9': before,
                   'expected_sha256': None, 'expected_size': before['size'],
                   'age_before_capture_ns': age, 'closed': False,
                   'close_attempted': False, 'content': None}
            rows.append(row)
            if n(os.fstat(fd)) != before or n(os.lstat(path)) != before:
                raise ValueError('own source open nine mismatch')
        # The entire initial cohort is owned before its first source byte.
        for row in rows:
            parts = []
            while True:
                part = os.read(row['fd'], 65536)
                if not part:
                    break
                parts.append(part)
            body = b''.join(parts)
            row.update(content=body, sha256=hashlib.sha256(body).hexdigest(),
                       eof=True, bytes_read=len(body))
            if len(body) != row['original9']['size'] or n(os.fstat(row['fd'])) != row['original9'] or n(os.lstat(row['path'])) != row['original9']:
                raise ValueError('own reader source EOF/nine mismatch')
        stop = json.loads(rows[2]['content'])
        for row in rows[:2]:
            pin = stop['sources'][os.path.basename(row['path'])]
            if pin['sha256'] != row['sha256'] or pin['size'] != row['bytes_read']:
                raise ValueError('own writer STOP source pin mismatch')
            row['expected_sha256'] = pin['sha256']
        env = {'__name__': '__main__', '__file__': paths[1], 'BOOT_ROWS': rows}
        code = compile(rows[1]['content'], paths[1], 'exec')
        # main() in the loader immediately adopts this same still-owned list;
        # after transfer only it closes the descriptors, including this source.
        handed = True
        exec(code, env, env)
    except BaseException as exc:
        errors.append({'type': type(exc).__name__, 'message': str(exc)})
        print(json.dumps({'bootstrap_failure': errors, 'handed_to_owner': handed}), flush=True)
    finally:
        if not handed:
            for row in rows:
                row['close_attempted'] = True
                try:
                    os.close(row['fd'])
                    row['closed'] = True
                except BaseException as exc:
                    errors.append({'close_type': type(exc).__name__, 'close_message': str(exc), 'path': row['path']})
            print(json.dumps({'bootstrap_closed': len(rows), 'errors': errors}), flush=True)


if __name__ == '__main__':
    main()
