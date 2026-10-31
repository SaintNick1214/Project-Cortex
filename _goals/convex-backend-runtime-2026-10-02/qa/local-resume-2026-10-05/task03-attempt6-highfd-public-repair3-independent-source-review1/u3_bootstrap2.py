"""Finite U3 held bootstrap, loaded via -c so protocol stdin stays available."""
import hashlib
import json
import math
import os
from pathlib import Path
import stat
import time

R = Path('/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion')
P = R / '_goals/convex-backend-runtime-2026-10-02/qa/local-resume-2026-10-05'
U = P / 'task03-attempt6-actual-public-custody-readiness-repair3'
J = P / 'task03-attempt6-highfd-public-repair3-independent-source-review1'
ROOT = P / 'root-task03-attempt6-highfd-public-repair2-closed-mature-readback1.json'
F = ('dev', 'ino', 'mode', 'nlink', 'uid', 'gid', 'size', 'mtime_ns', 'ctime_ns')
held = list(BOOTSTRAP_OWNERS)
data = dict(BOOTSTRAP_DATA)
by = {row['path']: row for row in held}
total = sum(int(row['PRE9']['size']) for row in held)
handed = False


def nine(s):
    return {key: str(getattr(s, 'st_' + key)) for key in F}


def strict(raw):
    def pairs(items):
        out = {}
        for key, value in items:
            assert key not in out
            out[key] = value
        return out
    def finite(s):
        value = float(s)
        assert math.isfinite(value)
        return value
    return json.loads(raw, object_pairs_hook=pairs, parse_float=finite,
                      parse_constant=lambda _: (_ for _ in ()).throw(ValueError('nonfinite')))


def op(path, expected=None):
    global total
    if str(path) in by:
        row = by[str(path)]
        if expected:
            if 'PRE9' in expected:
                assert row['PRE9'] == expected['PRE9']
            prior = row.get('expected')
            if prior:
                assert prior['bytes'] == expected['bytes'] and prior['sha256'] == expected['sha256']
        return row
    assert path.is_absolute() and path.is_relative_to(R) and path.resolve() == path
    current = R
    for part in ('.', *path.relative_to(R).parts):
        if part != '.':
            current /= part
        s = current.lstat()
        assert not stat.S_ISLNK(s.st_mode) and current.resolve() == current
        if current != path:
            assert stat.S_ISDIR(s.st_mode)
    before = nine(path.lstat())
    age = time.time_ns() - max(int(before['mtime_ns']), int(before['ctime_ns']))
    size = int(before['size'])
    assert age >= 60000000000
    assert stat.S_ISREG(int(before['mode'])) and before['nlink'] == '1'
    assert before['uid'] == '501' and before['gid'] == '20'
    assert 0 <= size <= 16777216 and len(held) + 1 <= 4096 and total + size <= 67108864
    if expected and 'PRE9' in expected:
        assert before == expected['PRE9'], 'immutable_original_nine_mismatch'
    fd = os.open(path, os.O_RDONLY | os.O_NOFOLLOW)
    row = {'path': str(path), 'fd': fd, 'PRE9': before, 'expected': expected,
           'maturityAgeNs': str(age)}
    held.append(row)
    by[str(path)] = row
    total += size
    assert nine(os.fstat(fd)) == before
    return row


def read(row):
    os.lseek(row['fd'], 0, 0)
    raw = bytearray()
    while block := os.read(row['fd'], 65536):
        raw.extend(block)
        assert len(raw) <= int(row['PRE9']['size'])
    raw = bytes(raw)
    assert len(raw) == int(row['PRE9']['size'])
    assert nine(os.fstat(row['fd'])) == nine(Path(row['path']).lstat()) == row['PRE9']
    expected = row.get('expected')
    digest = hashlib.sha256(raw).hexdigest()
    if expected:
        assert type(expected['bytes']) is int
        assert len(raw) == expected['bytes'] and digest == expected['sha256']
    if 'sha256' in row:
        assert row['sha256'] == digest
    row.update(bytes=len(raw), sha256=digest, fullEOF=True,
               finalDescriptorAndPathNineEqual=True)
    data[row['path']] = raw
    return raw


publishers = [
    (U / 'closed-source-manifest.json', 73411, '16e009fb9bee0eea993ce02c4cd32ed47e4ffd807cdb3837ca720d9b295daca6'),
    (U / 'preparation-report.json', 6351, 'bc8ef6dcc577bbd966074871424fe336f9c49896c2c5b3db96488c1560704aad'),
    (U / 'final-writer-stop.json', 1219, '84485ff8d73f956161e7b726e55de7a52d847450278c46eb88172320049b26b5'),
]

try:
    own = sorted(path for path in J.iterdir() if path.is_file())
    while True:
        ages = [time.time_ns() - max(path.lstat().st_mtime_ns, path.lstat().st_ctime_ns)
                for path in [p for p, _, _ in publishers] + own]
        minimum = min(ages)
        if minimum >= 60000000000:
            break
        print(json.dumps({'phase': 'own-and-U3-publisher-nonqualifying-maturity-check',
                          'minimumAgeNs': str(minimum), 'FDsOpened': 0,
                          'contentRead': False}), flush=True)
        time.sleep(min(30, (60000000000 - minimum) / 1e9 + .2))
    for path, size, digest in publishers:
        op(path, {'bytes': size, 'sha256': digest})
    op(ROOT, {'bytes': 47005, 'sha256': '0df4f88dc6e5e7de755d2dc6a0969e8626e0eb5178e8301fa60b15d1354ed31f'})
    for path in own:
        expected = ({'bytes': 6641, 'sha256': 'a9156092d65320e21c09a025fa7d06606dc449e088eb3065bb099442ab2b6ea1'}
                    if path.name == 'held_ledger2.py' else None)
        op(path, expected)
    # Only explicit source-graph control bootstraps are read before the full cohort.
    mf = strict(read(by[str(U / 'closed-source-manifest.json')]))
    root = strict(read(by[str(ROOT)]))
    members = mf['members']
    assert len(members) == 85 and len({row['path'] for row in members}) == 85
    assert sum(row['bytes'] for row in members) == 1782199
    rootpins = {row['path']: row for row in root['files']}
    assert len(rootpins) == 68
    for member in members:
        assert type(member['bytes']) is int and 0 <= member['bytes'] <= 16777216
        assert set(member['PRE9']) == set(F)
        assert all(isinstance(value, str) and value.isdecimal()
                   for value in member['PRE9'].values())
        path = Path(member['path'])
        assert path.is_absolute()
        expected = {'bytes': member['bytes'], 'sha256': member['sha256'], 'PRE9': member['PRE9']}
        if str(path) in rootpins:
            original = rootpins[str(path)]
            assert original['bytes'] == expected['bytes'] and original['sha256'] == expected['sha256']
            assert original['PRE9'] == expected['PRE9'], 'Root_original_nine_never_refreshed'
        op(path, expected)
    assert len({str(path) for path, _, _ in publishers} | {row['path'] for row in members}) == 88
    # All declared source/control/data descriptors precede target source content.
    for row in held:
        read(row)
    code = compile(data[str(J / 'u3_review_reader.py')], str(J / 'u3_review_reader.py'),
                   'exec', dont_inherit=True)
    print(json.dumps({'phase': 'U3-first-complete-union-qualified', 'U3files': 88,
                      'U3bytes': 1863180, 'totalInputs': len(held), 'totalBytes': total,
                      'allTargetFDsBeforeTargetContent': True,
                      'allAuthor85OriginalNinesPreserved': True,
                      'allReferencedRootOriginalPinsPreserved': True,
                      'candidateControlsExecuted': 0}), flush=True)
    handed = True
    exec(code, {'__name__': '__main__', '__file__': str(J / 'u3_review_reader.py'),
                'BOOTSTRAP': held, 'INITIAL_DATA': data})
finally:
    if not handed:
        errors = []
        for row in held:
            fd = row.pop('fd')
            try:
                os.close(fd)
            except BaseException as error:
                errors.append({'path': row['path'], 'class': type(error).__name__})
        print(json.dumps({'bootstrapClosed': True, 'closeAttempts': len(held),
                          'closeErrors': errors, 'readerNotStarted': True}), flush=True)
    else:
        print(json.dumps({'ownershipHandedOnce': True, 'outerNoCloseOrUnknownFDRetry': True}),
              flush=True)
