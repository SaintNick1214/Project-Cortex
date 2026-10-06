"""Reviewer-owned finite public source reader; never imports candidate programs."""
import hashlib
import json
import os
from pathlib import Path
import stat
import sys

FIELDS = ('dev', 'ino', 'mode', 'uid', 'gid', 'nlink', 'size', 'mtime_ns', 'ctime_ns')


def identity(s):
    return {k: str(getattr(s, 'st_' + k)) for k in FIELDS}


def pairs(rows):
    out = {}
    for k, v in rows:
        if k in out:
            raise ValueError('duplicate JSON key: ' + k)
        out[k] = v
    return out


def load_json(p):
    return json.loads(Path(p).read_text(), object_pairs_hook=pairs,
                      parse_constant=lambda v: (_ for _ in ()).throw(ValueError(v)))


def main():
    root = Path(sys.argv[1]).resolve(strict=True)
    spec = load_json(sys.argv[2])
    target = Path(sys.argv[3])
    target.mkdir(mode=0o700, exist_ok=False)
    backing = target / 'backings'
    backing.mkdir(mode=0o700)
    rows = []
    held = []
    errors = []
    seen = set()
    # Establish every prospective PRE before any subject byte read/assertion.
    try:
        for index, entry in enumerate(spec['files']):
            rel = entry['path']
            if not isinstance(rel, str) or rel in seen or Path(rel).is_absolute() or '..' in Path(rel).parts:
                raise ValueError('invalid/duplicate relative public path')
            seen.add(rel)
            p = root / rel
            fd = os.open(p, os.O_RDONLY | os.O_NOFOLLOW)
            held.append((fd, p))
            pre = identity(os.fstat(fd))
            row = {'path': rel, 'PRE': pre, 'expected': entry,
                   'backing': 'backings/' + str(index).zfill(4) + '.raw'}
            rows.append(row)
            row['OPEN_PATH'] = identity(os.stat(p, follow_symlinks=False))
        for (fd, p), row in zip(held, rows):
            if not stat.S_ISREG(int(row['PRE']['mode'])) or row['PRE']['nlink'] != '1':
                errors.append({'path': row['path'], 'kind': 'not-single-link-regular'})
            if row['OPEN_PATH'] != row['PRE']:
                errors.append({'path': row['path'], 'kind': 'open-path-identity-difference'})
            exp = row['expected']
            if 'identity' in exp and exp['identity'] != row['PRE']:
                errors.append({'path': row['path'], 'kind': 'original-pin-difference'})
            h = hashlib.sha256()
            size = 0
            dst = os.open(target / row['backing'], os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
            try:
                while True:
                    b = os.read(fd, 65536)
                    if not b:
                        break
                    h.update(b)
                    size += len(b)
                    view = memoryview(b)
                    while view:
                        n = os.write(dst, view)
                        if n <= 0:
                            raise OSError('nonpositive write')
                        view = view[n:]
                os.fsync(dst)
            finally:
                os.close(dst)
            row.update(sha256=h.hexdigest(), size=size, fullEOF=True,
                       POST=identity(os.fstat(fd)), PATH_POST=identity(os.stat(p, follow_symlinks=False)))
            if row['POST'] != row['PRE'] or row['PATH_POST'] != row['PRE']:
                errors.append({'path': row['path'], 'kind': 'during-read-identity-difference'})
            if size != int(row['PRE']['size']) or size != exp['size'] or h.hexdigest() != exp['sha256']:
                errors.append({'path': row['path'], 'kind': 'byte-size-hash-difference'})
    except BaseException as e:
        errors.append({'kind': 'reader-error', 'type': type(e).__name__, 'message': str(e)})
    finally:
        for index, (fd, p) in enumerate(held):
            row = rows[index] if index < len(rows) else {'path': str(p)}
            try:
                row['FINAL_HELD'] = identity(os.fstat(fd))
                row['FINAL_PATH'] = identity(os.stat(p, follow_symlinks=False))
                if row.get('PRE') != row['FINAL_HELD'] or row.get('PRE') != row['FINAL_PATH']:
                    errors.append({'path': row['path'], 'kind': 'final-held-path-identity-difference'})
            except BaseException as e:
                errors.append({'path': row['path'], 'kind': 'final-reader-error', 'type': type(e).__name__, 'message': str(e)})
            finally:
                os.close(fd)
    result = {'scope': 'STATIC_CURRENT_PUBLIC_SOURCE_BYTES_AND_NINE_IDENTITIES_ONLY',
              'firstProspectiveBaseline': True, 'allPREBeforeSubjectByteRead': True,
              'historicalPinsRepaired': False, 'runtimeQualified': False,
              'status': 'PASS' if not errors and len(rows) == len(spec['files']) else 'FAIL',
              'files': rows, 'errors': errors}
    with (target / 'fence.json').open('x') as f:
        json.dump(result, f, sort_keys=True, indent=2)
        f.write('\n')
    print(json.dumps({'status': result['status'], 'files': len(rows), 'errors': errors}))
    return 0 if result['status'] == 'PASS' else 1


if __name__ == '__main__':
    raise SystemExit(main())
