"""Finite public Git checkpoint; never runtime or historical custody authority."""
from pathlib import Path
import datetime, hashlib, json, os, re, stat, subprocess

R = Path('/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion')
QA = R / '_goals/convex-backend-runtime-2026-10-02/qa'
P = QA / 'local-resume-2026-10-05'
Q = QA / 'task03-local-native-attempt6-2026-10-06'
FIELDS = ('dev', 'ino', 'mode', 'uid', 'gid', 'nlink', 'size', 'mtime_ns', 'ctime_ns')
def nine(s):
    return {k: str(getattr(s, 'st_' + k)) for k in FIELDS}

closed = [
    'task03-attempt6-integrated-preparation',
    'task03-attempt6-integrated-source-review1',
    'task03-attempt6-integrated-repair1',
    'task03-attempt6-integrated-repair1-source-review2',
    'task03-attempt6-actual-public-custody-readiness-review1',
    'task03-attempt6-actual-public-custody-readiness-repair2',
    'task03-attempt6-actual-private-native-review1',
    'task04-current-producer-native-public-preparation1',
    'task04-current-producer-native-public-preparation-source-review1',
    'task04-current-producer-native-public-repair1',
    'task04-current-producer-native-public-repair1-source-review2',
    'task04-current-producer-native-public-consumer-repair2',
    'task04-current-producer-native-public-consumer-repair2-source-review3',
]
paths = set()
namespace_counts = {}
for base in [Q] + [P / name for name in closed]:
    current = []
    for root, dirs, files in os.walk(base, followlinks=False):
        for d in dirs:
            assert not (Path(root) / d).is_symlink()
        current.extend(Path(root) / name for name in files)
    assert current and len(current) < 2500
    namespace_counts[str(base.relative_to(R))] = len(current)
    paths.update(current)

tracked = set(subprocess.run(['git', 'ls-files', '-z'], cwd=R, capture_output=True,
                             check=True).stdout.decode().split('\0'))
paths.update(p for p in P.glob('root-*.json') if str(p.relative_to(R)) not in tracked)
paths.update([QA / 'execution-progress.md', QA / 'outcome-matrix.md',
              P / 'current-state.md', Path(__file__).resolve()])

# This records native-tool failures already returned in this continuation.
capacity = P / 'checkpoint20-native-review-capacity.json'
capacity_data = {
    'scope': 'RECORDED_NATIVE_TOOL_CAPACITY_FAILURE_AND_SEPARATE_OWNERSHIP_PLAN',
    'recordedAtUtc': datetime.datetime.now(datetime.timezone.utc).isoformat(),
    'priorToolFailures': [
        {'action': 'spawn fresh Task03 high-FD independent source judge',
         'returnedError': 'agent thread limit reached'},
        {'action': 'restore completed, purged Task04 source judge for Task03 review',
         'returnedError': 'agent thread limit reached'}],
    'proposedCurrentAgentReuse': [
        {'implementationOwner': 'task04_public_acceptance_repair3',
         'laterIndependentScope': 'Task03 U2/F2/A2, none authored by this agent'},
        {'implementationOwner': 'task03_attempt6_integrated_preparation',
         'laterIndependentScope': 'Task04 R3/C5, none authored by this agent'}],
    'reviewsAlreadyPerformedUnderThisPlan': False,
    'acceptanceAssertionsWaived': False,
    'earlierInspectionSetup': {'guessedFile': 'receipt-manifest-attempt6.json',
                              'result': 'FileNotFoundError before dependent inspection',
                              'runtimeEffects': False},
    'fullGoalComplete': False,
}
with capacity.open('x') as out:
    json.dump(capacity_data, out, indent=2); out.write('\n'); out.flush(); os.fsync(out.fileno())
paths.add(capacity)
assert len(paths) < 5000

expected = {}
freeze = json.loads((Q / 'candidate-freeze-attempt6.json').read_bytes())
assert len(freeze['files']) == 1907
for row in freeze['files']:
    expected[Q / row['path']] = (row['sha256'], row['bytes'])
readbacks = [
    'root-task03-attempt6-source-review2-raw46-readback1.json',
    'root-task03-attempt6-public-review-source-acquisition-mature-readback1.json',
    'root-task03-attempt6-highfd-public-repair2-closed-mature-readback1.json',
    'root-task03-attempt6-private-audit-preparation-mature-readback1.json',
    'root-task04-native-consumer-repair2-source-review3-mature-readback1.json',
]
for name in readbacks:
    packet = json.loads((P / name).read_bytes())
    for row in packet['files']:
        p = Path(row['path'])
        if not p.is_absolute():
            p = R / p
        pair = (row['sha256'], row['bytes'])
        assert p not in expected or expected[p] == pair
        expected[p] = pair
    paths.add(P / name)
assert set(expected).issubset(paths), 'Expected backing outside declared closed namespaces'

secrets = [json.loads(Path('/Users/SaintNick/.convex/config.json').read_bytes())['accessToken'].encode(),
           subprocess.run(['gh', 'auth', 'token'], capture_output=True, check=True).stdout.strip()]
assert all(secrets)
carry_size = max(128, *map(len, secrets))
held = []
rows = {}
try:
    for p in sorted(paths):
        assert p.is_absolute() and p.is_relative_to(QA)
        s = p.lstat()
        assert stat.S_ISREG(s.st_mode) and s.st_nlink == 1 and s.st_size <= 16 * 1024 * 1024
        fd = os.open(p, os.O_RDONLY | os.O_NOFOLLOW)
        held.append((p, fd, nine(s)))
        assert nine(os.fstat(fd)) == nine(s)
    for p, fd, original in held:
        h = hashlib.sha256(); size = 0; carry = b''
        while data := os.read(fd, 65536):
            size += len(data); h.update(data)
            scan = carry + data
            assert not any(secret in scan for secret in secrets), 'PRIVATE_TOKEN_MATCH'
            assert not re.search(rb'(?m)^-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----$', scan), 'PRIVATE_PEM_MATCH'
            carry = scan[-carry_size:]
        pair = (h.hexdigest(), size)
        assert size == int(original['size'])
        assert p not in expected or expected[p] == pair, 'KNOWN_PUBLIC_BYTES_CHANGED:' + str(p)
        assert nine(os.fstat(fd)) == nine(p.lstat()) == original
        rows[str(p.relative_to(R))] = {'sha256': pair[0], 'bytes': size,
                                      'currentNine': original, 'fullEOF': True}
    for p, fd, original in held:
        assert nine(os.fstat(fd)) == nine(p.lstat()) == original
finally:
    for p, fd, original in held:
        os.close(fd)

receipt = {
    'scope': 'PUBLIC_GIT_BYTE_CHECKPOINT_ONLY_NO_RUNTIME_SOURCE_ACTIVATION',
    'utc': datetime.datetime.now(datetime.timezone.utc).isoformat(),
    'closedNamespaces': namespace_counts,
    'files': rows,
    'selectedFiles': len(rows), 'selectedBytes': sum(r['bytes'] for r in rows.values()),
    'conservedKnownByteRows': len(expected),
    'allFdsBeforeContentHeldThroughFinal': True, 'privateMatches': 0,
    'privateTokenPatternsChecked': len(secrets),
    'excludedActivePackets': ['Task03 F2', 'Task03 A2', 'Task04 R3', 'Task04 C5'],
    'excludedInputs': ['private scratch', 'node_modules', 'sole-copy ZIPs',
                       'retained Docker volumes', 'foreign processes'],
    'sourceAcquisitionBudgetAssertion': 'Not a runtime source graph or qualification',
    'historicalFilesystemIdentityRestored': False, 'historicalCustodyRepaired': False,
    'allHistoricalSourcesRecoverableFromGit': False,
    'Task03': 'FOUNDATION_OPEN_FULL_OPEN', 'Task04': 'FULL_OPEN',
    'fullGoalComplete': False,
}
outpath = P / 'checkpoint20-public-byte-verification.json'
with outpath.open('x') as out:
    json.dump(receipt, out, indent=2); out.write('\n'); out.flush(); os.fsync(out.fileno())
paths.add(outpath)
prefix = Path('/Users/SaintNick/.codex/tmp/cortex-runtime-checkpoint20')
prefix.with_name(prefix.name + '-pathspec.nul').write_bytes(
    b'\0'.join(os.fsencode(str(p.relative_to(R))) for p in sorted(paths)) + b'\0')
prefix.with_name(prefix.name + '-pins.json').write_text(json.dumps(rows, indent=2) + '\n')
print(json.dumps({'status': 'PASS_PUBLIC_GIT_BYTE_VERIFICATION_ONLY',
                  'files': len(paths), 'bytesBeforeReceipt': receipt['selectedBytes'],
                  'knownBytesConserved': len(expected), 'privateMatches': 0,
                  'fullGoalComplete': False}))
