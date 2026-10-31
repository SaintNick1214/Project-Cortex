"""Checkpoint closed public bytes only; not runtime source or custody authority."""
from pathlib import Path
import datetime, hashlib, json, os, re, stat, subprocess

R = Path('/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion')
QA = R / '_goals/convex-backend-runtime-2026-10-02/qa'
P = QA / 'local-resume-2026-10-05'
FIELDS = ('dev', 'ino', 'mode', 'uid', 'gid', 'nlink', 'size', 'mtime_ns', 'ctime_ns')
def nine(s):
    return {k: str(getattr(s, 'st_' + k)) for k in FIELDS}

closed = [P / 'task04-current-producer-native-public-repair3',
          P / 'task04-current-producer-native-public-consumer-repair3',
          P / 'task03-attempt6-actual-private-native-review-repair2']
selected = set()
counts = {}
for base in closed:
    paths = []
    for root, dirs, files in os.walk(base, followlinks=False):
        for name in dirs:
            assert not (Path(root) / name).is_symlink()
        paths.extend(Path(root) / name for name in files)
    counts[str(base.relative_to(R))] = len(paths)
    selected.update(paths)
assert list(counts.values()) == [133, 64, 74]
tracked = set(subprocess.run(['git', 'ls-files', '-z'], cwd=R, capture_output=True,
                             check=True).stdout.decode().split('\0'))
selected.update(p for p in P.glob('root-*.json') if str(p.relative_to(R)) not in tracked)
selected.update([QA / 'execution-progress.md', QA / 'outcome-matrix.md',
                 P / 'current-state.md', Path(__file__).resolve()])
expected = {}
for name in ['root-task04-r3-c5-mature-readback2.json',
             'root-task03-a2-epoch2-closed-publisher31-mature-readback1.json',
             'root-task03-a2-bounded2-closed-publisher15-mature-readback1.json']:
    data = json.loads((P / name).read_bytes())
    for row in data['files']:
        p = Path(row['path'])
        assert p in selected
        expected[p] = (row['sha256'], row['bytes'])
    selected.add(P / name)
assert len(expected) == 243
secrets = [json.loads(Path('/Users/SaintNick/.convex/config.json').read_bytes())['accessToken'].encode(),
           subprocess.run(['gh', 'auth', 'token'], capture_output=True, check=True).stdout.strip()]
assert all(secrets)
carry_size = max(128, *map(len, secrets))
held = []
rows = {}
try:
    for p in sorted(selected):
        assert p.is_absolute() and p.is_relative_to(QA)
        s = p.lstat()
        assert stat.S_ISREG(s.st_mode) and s.st_nlink == 1 and s.st_size <= 16777216
        fd = os.open(p, os.O_RDONLY | os.O_NOFOLLOW)
        held.append((p, fd, nine(s)))
        assert nine(os.fstat(fd)) == nine(s)
    for p, fd, pin in held:
        h = hashlib.sha256(); size = 0; carry = b''
        while data := os.read(fd, 65536):
            size += len(data); h.update(data)
            scan = carry + data
            assert not any(secret in scan for secret in secrets), 'PRIVATE_TOKEN_MATCH'
            assert not re.search(rb'(?m)^-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----$', scan), 'PRIVATE_PEM_MATCH'
            carry = scan[-carry_size:]
        pair = (h.hexdigest(), size)
        assert size == int(pin['size'])
        assert p not in expected or expected[p] == pair
        assert nine(os.fstat(fd)) == nine(p.lstat()) == pin
        rows[str(p.relative_to(R))] = {'sha256': pair[0], 'bytes': size,
                                      'currentNine': pin, 'fullEOF': True}
    for p, fd, pin in held:
        assert nine(os.fstat(fd)) == nine(p.lstat()) == pin
finally:
    for p, fd, pin in held:
        os.close(fd)
receipt = {'scope': 'PUBLIC_GIT_BYTES_ONLY_NOT_RUNTIME_SOURCE_ADMISSION',
           'utc': datetime.datetime.now(datetime.timezone.utc).isoformat(),
           'closedNamespaces': counts, 'files': rows, 'selectedFiles': len(rows),
           'selectedBytes': sum(row['bytes'] for row in rows.values()),
           'knownByteRowsConserved': len(expected),
           'allFDsBeforeContentHeldThroughFinalAndExplicitlyClosed': True,
           'configuredConvexAndGitHubTokenPatternsChecked': len(secrets),
           'privateMatches': 0,
           'excludedActive': ['F2 coordinator/automatic driver', 'U3 public cleanup repair',
                              'U2 independent reviewer'],
           'excludedOther': ['private scratch', 'node_modules', 'sole ZIPs', 'Docker volumes'],
           'sourceAcquisitionBudget': 'Separate Git backing checkpoint, not qualification',
           'historicalCustodyRepaired': False, 'historicalIdentitiesRestored': False,
           'allHistoricalSourcesRecoverableFromGit': False,
           'Task03': 'FOUNDATION_AND_FULL_OPEN', 'Task04': 'FULL_OPEN',
           'fullGoalComplete': False}
outpath = P / 'checkpoint21-public-byte-verification.json'
with outpath.open('x') as out:
    json.dump(receipt, out, indent=2); out.write('\n'); out.flush(); os.fsync(out.fileno())
selected.add(outpath)
prefix = Path('/Users/SaintNick/.codex/tmp/cortex-runtime-checkpoint21')
prefix.with_name(prefix.name + '-pins.json').write_text(json.dumps(rows, indent=2) + '\n')
prefix.with_name(prefix.name + '-pathspec.nul').write_bytes(
    b'\0'.join(os.fsencode(str(p.relative_to(R))) for p in sorted(selected)) + b'\0')
print(json.dumps({'status': 'PASS_PUBLIC_BYTE_CHECKPOINT_ONLY',
                  'files': len(selected), 'bytesBeforeReceipt': receipt['selectedBytes'],
                  'knownRowsConserved': len(expected), 'privateMatches': 0,
                  'fullGoalComplete': False}))
