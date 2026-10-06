"""Use the qualified host command capture for parent-owned public Docker checks."""
import hashlib
import json
import os
from pathlib import Path
import sys
import types

R = Path('/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion')
COMMON = R / '_goals/convex-backend-runtime-2026-10-02/qa/task03-local-native-attempt5-2026-10-06/coordinate-source/repair3/task03-attempt5-coordinate-common.py'
EXPECTED = '1f8f6005c668401b63681e28002715d977abcc02312a199a468e32c2505fa0a2'
OUT = R / '_goals/convex-backend-runtime-2026-10-02/qa/local-resume-2026-10-05/task04-current-producer-linux-public-repair1/raw'
FIELDS = ('dev','ino','mode','uid','gid','nlink','size','mtime_ns','ctime_ns')
ident = lambda s: tuple(getattr(s, 'st_'+k) for k in FIELDS)
if len(sys.argv) < 5 or sys.argv[3] != '--' or sys.argv[4] != 'docker':
    raise SystemExit('fixed public Docker invocation required')
label, timeout = sys.argv[1], int(sys.argv[2])
before = os.lstat(COMMON)
fd = os.open(COMMON, os.O_RDONLY | os.O_NOFOLLOW)
try:
    opened = os.fstat(fd)
    raw = bytearray()
    while part := os.read(fd, 65536):
        raw.extend(part)
        if len(raw) > 65536:
            raise SystemExit('qualified common byte bound')
    post = os.fstat(fd)
finally:
    os.close(fd)
if not (ident(before) == ident(opened) == ident(post) == ident(os.lstat(COMMON))):
    raise SystemExit('qualified common current all-nine drift')
if hashlib.sha256(raw).hexdigest() != EXPECTED:
    raise SystemExit('qualified common exact content mismatch')
module = types.ModuleType('qualified_public_capture')
module.__file__ = str(COMMON)
exec(compile(bytes(raw), str(COMMON), 'exec'), module.__dict__)
OUT.mkdir(parents=True, exist_ok=True, mode=0o700)
env = {'PATH':'/usr/local/bin:/usr/bin:/bin:/Applications/Docker.app/Contents/Resources/bin',
       'HOME':'/Users/SaintNick', 'PYTHONDONTWRITEBYTECODE':'1',
       'CORTEX_COORDINATOR_CWD':str(R)}
row, stdout, stderr = module.run(label, sys.argv[4:], OUT, timeout, env, required=False)
print(json.dumps({'label':label, 'exitCode':row['exitCode'], 'failureClass':row['failureClass'],
                  'terminal':row['terminal'], 'closeErrors':row['closeErrors'],
                  'stdoutBytes':len(stdout), 'stderrBytes':len(stderr),
                  'receipt':str(OUT/(label+'.receipt.json'))}))
if not row['terminal'] or row['failureClass'] is not None or row['closeErrors']:
    raise SystemExit(1)
