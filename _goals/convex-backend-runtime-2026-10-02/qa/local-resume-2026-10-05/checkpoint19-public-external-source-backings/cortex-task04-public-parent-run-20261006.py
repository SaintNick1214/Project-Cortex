"""One parent-owned public r3 attempt. No foreign effects or native claims."""
import datetime
import hashlib
import json
import os
from pathlib import Path
import stat
import subprocess
import sys
import time

R = Path('/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion')
P = R / '_goals/convex-backend-runtime-2026-10-02/qa/local-resume-2026-10-05'
OUT = P / 'task04-current-producer-linux-public-run-r3'
D = P / 'task04-current-canonical-input-source-review'
L = R / 'work/resume/task04-c8-current-canonical-input-producers/linux-public-control-proposal'
ADAPTER = Path('/Users/SaintNick/.codex/tmp/cortex-task04-public-cli-20261006.py')
CID = '1044af770dbcb88c25b73d2821440075f5024db16f975b07ed3e8b7f64abf56f'
OP = '9655f70c-0ac7-4d89-9135-3da95e3c6662'
NAME = 'cortex-task04-current-producer-public-controls-r3'
FIELDS = ('dev', 'ino', 'mode', 'uid', 'gid', 'nlink', 'size', 'mtime_ns', 'ctime_ns')
ident = lambda s: {k: str(getattr(s, 'st_' + k)) for k in FIELDS}
canonical = lambda x: json.dumps(x, sort_keys=True, separators=(',', ':'))
def require(ok, message):
    if not ok:
        raise RuntimeError(message)
def read(path, maximum=65536):
    pre = os.lstat(path)
    require(stat.S_ISREG(pre.st_mode) and pre.st_nlink == 1 and pre.st_size <= maximum, 'finite regular single-link: ' + str(path))
    fd = os.open(path, os.O_RDONLY | os.O_NOFOLLOW)
    try:
        opened = os.fstat(fd)
        raw = bytearray()
        while block := os.read(fd, 65536):
            raw.extend(block)
            require(len(raw) <= maximum, 'finite read bound')
        require(ident(pre) == ident(opened) == ident(os.fstat(fd)) == ident(os.lstat(path)) and len(raw) == pre.st_size, 'current full EOF/all-nine drift')
        return bytes(raw), ident(pre)
    finally:
        os.close(fd)
def data(path, maximum=65536):
    return json.loads(read(path, maximum)[0])
def put(name, value):
    raw = (json.dumps(value, indent=2) + '\n').encode()
    fd = os.open(OUT / name, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    try:
        with os.fdopen(fd, 'wb', closefd=False) as f:
            f.write(raw); f.flush(); os.fsync(fd)
    finally:
        os.close(fd)
def capture(label, argv, maximum=65536):
    completed = subprocess.run([sys.executable, '-B', str(ADAPTER), label, '30', '--', *argv], capture_output=True, timeout=45)
    require(completed.returncode == 0, 'qualified capture failed: ' + label)
    receipt = data(OUT / 'raw' / (label + '.receipt.json'))
    stdout = read(OUT / 'raw' / (label + '.stdout'), maximum)[0]
    stderr = read(OUT / 'raw' / (label + '.stderr'), 262144)[0]
    require(receipt['argv'] == argv and receipt['terminal'] is True and receipt['failureClass'] is None and receipt['closeErrors'] == [] and receipt['ownedGroup']['absenceObserved'] is True and receipt['stdinBytes'] == 0, 'exact known terminal capture')
    require(receipt['streamByteCounts'] == {'stdout': len(stdout), 'stderr': len(stderr)} and receipt['stdoutSha256'] == hashlib.sha256(stdout).hexdigest() and receipt['stderrSha256'] == hashlib.sha256(stderr).hexdigest(), 'captured full byte hashes')
    require(type(receipt['exitCode']) is int and receipt['elapsedSeconds'] <= 30, 'exact command bounds')
    return receipt, stdout, stderr
def inspect(label):
    receipt, raw, err = capture(label, ['docker', 'container', 'inspect', CID])
    require(receipt['exitCode'] == 0 and err == b'', 'inspect actual exit/stderr')
    parsed = json.loads(raw)
    require(type(parsed) is list and len(parsed) == 1, 'one own container')
    c = parsed[0]
    require(c['Id'] == CID and c['Name'] == '/' + NAME and c['Config']['Labels'] == expected_labels, 'exact own container/UUID before action')
    for key in ('Image', 'Config', 'HostConfig', 'Mounts', 'Path', 'Args', 'ImageManifestDescriptor'):
        require(canonical(c[key]) == canonical(baseline[key]), 'immutable own metadata drift: ' + key)
    state = c['State']
    require(type(state['Running']) is bool and type(state['Pid']) is int and type(state['ExitCode']) is int and type(state['OOMKilled']) is bool and type(state['Error']) is str, 'state exact types')
    return c, len(raw)

recipe_raw = read(L / 'recipe-r3.json')[0]
require(hashlib.sha256(recipe_raw).hexdigest() == 'b12735095142488744780fa50ef05c8735cca6d941edb593883f36cdd1a801b2', 'unchanged reviewed r3 recipe')
recipe = json.loads(recipe_raw)
expected_labels = recipe['ownershipBeforeEffects']['containerInspectBeforeStart']['Config.Labels']
require(expected_labels['com.cortex.operation'] == OP, 'exact reviewed operation')
for file, digest in [(D / 'source-eligibility-verdict.json', '82d2fc3dd2b4d6075ca6e30a36cf6622e560aa91e085e6173a9c2b82d0407264'), (D / 'operational-supplement1/verdict.json', '7ef4b5d9b640d5571a842a349fb47089e385cdd1565da735829c1a16f4f81c67')]:
    raw = read(file)[0]; require(hashlib.sha256(raw).hexdigest() == digest and json.loads(raw)['verdict'] == 'PASS', 'sealed independent eligibility')
mf_raw = read(P / 'task04-current-canonical-input-producers/closed-source-manifest.json', 262144)[0]
require(hashlib.sha256(mf_raw).hexdigest() == 'afc703999f7779d0621f6a3aedd8ac0792abe633e0b0f0690929c6e069a327ae', 'unchanged closed source manifest')
source_observations = []
for pin in json.loads(mf_raw)['files']:
    raw, pre = read(R / pin['path'], 16777216)
    require(len(raw) == pin['bytes'] and hashlib.sha256(raw).hexdigest() == pin['sha256'] and pre == pin['PRE']['fields'], 'original closed source current pin drift')
    source_observations.append({'path': pin['path'], 'bytes': len(raw), 'sha256': pin['sha256'], 'currentNine': pre, 'EOF': True})
baseline = data(OUT / 'raw/created-container-inspect1.stdout') [0]
before, _ = inspect('before-start-inspect2')
require(before['State']['Status'] == 'created' and before['State']['Running'] is False and before['State']['Pid'] == 0 and before['State']['OOMKilled'] is False and before['State']['Error'] == '' and before['State']['StartedAt'] == before['State']['FinishedAt'] == '0001-01-01T00:00:00Z' and before['RestartCount'] == 0, 'fresh never-started own state')
rv, volraw, err = capture('before-start-volume-inspect2', ['docker', 'volume', 'inspect', NAME])
require(rv['exitCode'] == 0 and err == b'' and canonical(json.loads(volraw)) == canonical(data(OUT / 'raw/owned-volume-inspect1.stdout')), 'fresh same exclusive labelled volume')
put('before-start-proof.json', {'status': 'PASS', 'operationUUID': OP, 'containerId': CID, 'sourceObservations': source_observations, 'immutableMetadata': 'MATCHES_INDEPENDENTLY_REVIEWED_CREATED_INSPECT', 'coordinateSupplement': 'SIX_EXACT_LITERAL_PAIRS_ONLY', 'private': False, 'native': False, 'foreign': 'UNTOUCHED'})
start_monotonic = time.monotonic()
deadline = start_monotonic + 480
put('start-attempt.json', {'operationUUID': OP, 'containerId': CID, 'utc': datetime.datetime.now(datetime.timezone.utc).isoformat(), 'monotonicStart': start_monotonic, 'overallDeadlineMonotonic': deadline, 'overallSecondsMax': 480, 'startArgv': ['docker', 'start', CID], 'native': False, 'private': False})
errors = []; terminal = None; poll_bytes = 0; polls = 0
try:
    rs, out, err = capture('container-start1', ['docker', 'start', CID])
    require(rs['exitCode'] == 0 and out == (CID + '\n').encode() and err == b'', 'detached start exact actual outcome')
    while time.monotonic() + 31 < deadline:
        polls += 1
        c, count = inspect('owned-poll-' + str(polls).zfill(4))
        poll_bytes += count; require(poll_bytes <= 33554432, 'combined raw polling bound')
        s = c['State']
        if s['Running'] is False:
            terminal = c
            require(s['Status'] == 'exited' and s['Pid'] == 0 and s['ExitCode'] == 0 and s['OOMKilled'] is False and s['Error'] == '', 'actual public run terminal failure')
            break
        require(s['Status'] == 'running' and s['Pid'] > 0 and s['OOMKilled'] is False and s['Error'] == '', 'current own running state')
        time.sleep(1)
    require(terminal is not None, 'bounded public run deadline reached')
except BaseException as e:
    errors.append(repr(e))
    try:
        c, count = inspect('failure-owned-inspect1')
        if c['State']['Running'] is True:
            stop, _, stoperr = capture('failure-owned-stop1', ['docker', 'stop', '--time', '10', CID])
            require(stop['exitCode'] == 0 and stoperr == b'', 'bounded exact owned stop')
            c, count = inspect('failure-terminal-inspect1')
        require(c['State']['Running'] is False and c['State']['Pid'] == 0, 'owned terminal after failure')
        terminal = c
    except BaseException as close_error:
        errors.append('cleanup:' + repr(close_error))
finally:
    if terminal is not None:
        try:
            rl, out, err = capture('terminal-container-logs1', ['docker', 'logs', CID], 262144)
            require(rl['exitCode'] == 0, 'terminal own logs capture')
        except BaseException as log_error:
            errors.append('logs:' + repr(log_error))
    result = {'scope': 'ACTUAL_PUBLIC_SOURCE_CONTROLS_ONLY', 'status': 'TERMINAL_RUN_PASS_PENDING_EXPORT_AND_INDEPENDENT_REVIEW' if not errors else 'FAIL', 'operationUUID': OP, 'containerId': CID, 'terminalState': terminal['State'] if terminal is not None else None, 'elapsedSeconds': time.monotonic() - start_monotonic, 'polls': polls, 'combinedRawPollBytes': poll_bytes, 'errors': errors, 'private': False, 'native': False, 'foreign': 'UNTOUCHED', 'Task03': 'HELD', 'Task04': 'OPEN', 'wholeGoal': 'OPEN', 'ownedVolume': 'RETAINED', 'ownedContainer': 'RETAINED'}
    put('terminal-run-result.json', result)
    print(json.dumps(result))
raise SystemExit(bool(errors))
