"""One eligible repair1 public attempt; source guard refuses absent approval."""
import datetime
import hashlib
import json
import os
from pathlib import Path
import stat
import subprocess
import sys
import time
import types

R = Path('/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion')
P = R / '_goals/convex-backend-runtime-2026-10-02/qa/local-resume-2026-10-05'
OUT = P / 'task04-current-producer-linux-public-repair1'
SOURCE_Q = P / 'task04-current-canonical-input-producers/repair1'
L = R / 'work/resume/task04-c8-current-canonical-input-producers/repair1/proposal'
ADAPTER = Path('/Users/SaintNick/.codex/tmp/cortex-task04-repair1-public-cli-20261006.py')
NAME = 'cortex-task04-current-producer-public-repair1'
OP = 'f83336fb-794a-4878-87ec-f85612ade6a6'
FIELDS = ('dev','ino','mode','uid','gid','nlink','size','mtime_ns','ctime_ns')
identity = lambda s: {k: str(getattr(s,'st_' + k)) for k in FIELDS}
def require(ok, message):
    if not ok: raise RuntimeError(message)
def read(path, maximum=65536):
    pre = os.lstat(path); require(stat.S_ISREG(pre.st_mode) and pre.st_nlink == 1 and pre.st_size <= maximum, 'finite regular input')
    fd = os.open(path,os.O_RDONLY | os.O_NOFOLLOW)
    try:
        opened = os.fstat(fd); raw = bytearray()
        while block := os.read(fd,65536):
            raw.extend(block); require(len(raw) <= maximum, 'bounded full input')
        require(identity(pre) == identity(opened) == identity(os.fstat(fd)) == identity(os.lstat(path)) and len(raw) == pre.st_size, 'current input full EOF/all-nine')
        return bytes(raw),identity(pre)
    finally: os.close(fd)
def data(path, maximum=65536): return json.loads(read(path,maximum)[0])
def put(name,value):
    raw = (json.dumps(value,indent=2) + '\n').encode(); fd = os.open(OUT / name,os.O_WRONLY | os.O_CREAT | os.O_EXCL,0o600)
    try:
        with os.fdopen(fd,'wb',closefd=False) as f: f.write(raw); f.flush(); os.fsync(fd)
    finally: os.close(fd)
def capture(label,argv,maximum=65536):
    result = subprocess.run([sys.executable,'-B',str(ADAPTER),label,'30','--',*argv],capture_output=True,timeout=45)
    require(result.returncode == 0, 'qualified exact command capture:' + label)
    row = data(OUT / 'raw' / (label + '.receipt.json'))
    stdout = read(OUT / 'raw' / (label + '.stdout'),maximum)[0]; stderr = read(OUT / 'raw' / (label + '.stderr'),262144)[0]
    require(row['argv'] == argv and row['terminal'] is True and row['failureClass'] is None and row['closeErrors'] == [] and row['ownedGroup']['absenceObserved'] is True and row['stdinBytes'] == 0 and row['elapsedSeconds'] <= 30, 'known bounded terminal CLI')
    require(type(row['exitCode']) is int and row['streamByteCounts'] == {'stdout':len(stdout),'stderr':len(stderr)} and row['stdoutSha256'] == hashlib.sha256(stdout).hexdigest() and row['stderrSha256'] == hashlib.sha256(stderr).hexdigest(), 'actual CLI byte proof')
    return row,stdout,stderr
def inspect(label,full=True,created=False):
    global poll_bytes
    row,raw,err = capture(label,['docker','container','inspect',CID]); poll_bytes += len(raw)
    require(poll_bytes <= 33554432, 'combined owned-inspect bytes')
    require(row['exitCode'] == 0 and err == b'', 'own inspect actual outcome')
    parsed = json.loads(raw); require(type(parsed) is list and len(parsed) == 1, 'one own metadata row')
    c = parsed[0]; metadata.own(c,recipe,CID)
    if full: metadata.validate(c,recipe,CID,created=created)
    return c

# Parent writes this finite release only after independently closed source review.
# No CLI, source acquisition, create or START occurs when it is absent/rejected.
release = data(OUT / 'independent-source-release.json')
require(release['scope'] == 'PUBLIC_REPAIR1_SOURCE_ELIGIBILITY_ONLY' and release['verdict'] == 'PASS' and release['operationUUID'] == OP, 'exact independent source release')
review_path = Path(release['reviewPath'])
require(review_path.parent == P / 'task04-current-canonical-input-source-review/repair1-source-review', 'finite expected independent review path')
review_raw = read(review_path,262144)[0]
require(hashlib.sha256(review_raw).hexdigest() == release['reviewSHA256'] and json.loads(review_raw)['verdict'] == 'PASS', 'independent sealed PASS bytes')
recipe_raw = read(L / 'recipe.json')[0]
require(hashlib.sha256(recipe_raw).hexdigest() == '22b9daa94d050a24fcc14a3c5df0e214b8ff3f6e98d4742b653710e05c7366dc', 'exact closed repair recipe')
recipe = json.loads(recipe_raw); require(recipe['operationUUID'] == OP and recipe['containerName'] == recipe['exclusiveNewVolume'] == NAME, 'exact new operation')
module_path = P / 'task04-current-producer-repair1-parent-preparation/metadata-module.py'
module_raw = read(module_path)[0]
require(hashlib.sha256(module_raw).hexdigest() == 'd757f1524ae22d7f4f40da8fef509e5b080413c769a12e68ad7baab7ee528661', 'closed metadata helper')
metadata = types.ModuleType('qualified_parent_metadata'); exec(compile(module_raw,str(module_path),'exec'),metadata.__dict__)
mf_raw = read(SOURCE_Q / 'manifest.json',262144)[0]
require(hashlib.sha256(mf_raw).hexdigest() == 'fc967b7ddb5550668a4f61282513bad7604547e8cb08077d9ebc72d7ecb03e33', 'original57 source manifest')
observations = []
for pin in json.loads(mf_raw)['files']:
    raw,nine = read(R / pin['path'],16777216)
    require(len(raw) == pin['bytes'] and hashlib.sha256(raw).hexdigest() == pin['sha256'] and nine == pin['PRE']['fields'], 'original current repair source pin')
    observations.append({'path':pin['path'],'bytes':len(raw),'sha256':pin['sha256'],'currentNine':nine,'EOF':True})
id_record = data(OUT / 'created-container-id.json'); CID = id_record['containerId']
require(id_record['operationUUID'] == OP and type(CID) is str and len(CID) == 64, 'exact absent/create provenance record')
poll_bytes = 0
before = inspect('before-start-inspect1',created=True)
row,volraw,err = capture('before-start-volume-inspect1',['docker','volume','inspect',NAME])
volumes = json.loads(volraw); require(row['exitCode'] == 0 and err == b'' and len(volumes) == 1, 'one actual labelled volume')
volume = volumes[0]; declared = recipe['ownershipBeforeEffects']['volumeInspectRequired']
require(volume['Name'] == NAME and volume['Labels'] == declared['Labels'] and volume['Driver'] == 'local' and volume['Scope'] == 'local' and volume['Options'] is None and volume['Mountpoint'] == '/var/lib/docker/volumes/' + NAME + '/_data', 'fresh own volume metadata')
put('before-start-proof.json',{'status':'PASS','operationUUID':OP,'containerId':CID,'sourceObservations':observations,'currentMetadata':metadata.validate(before,recipe,CID,created=True),'private':False,'native':False,'foreign':'UNTOUCHED'})
started = time.monotonic(); deadline = started + 480
put('start-attempt.json',{'operationUUID':OP,'containerId':CID,'utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'monotonicStart':started,'overallDeadlineMonotonic':deadline,'overallSecondsMax':480,'startArgv':['docker','start',CID],'private':False,'native':False})
errors = []; terminal = None; polls = 0
try:
    row,raw,err = capture('container-start1',['docker','start',CID])
    require(row['exitCode'] == 0 and raw == (CID + '\n').encode() and err == b'', 'detached actual own START')
    while time.monotonic() + 31 < deadline:
        polls += 1; current = inspect('owned-poll-' + str(polls).zfill(4)); state = current['State']
        if state['Running'] is False:
            terminal = current
            require(state['Status'] == 'exited' and state['Pid'] == 0 and state['ExitCode'] == 0 and state['OOMKilled'] is False and state['Error'] == '', 'actual public run terminal failure')
            break
        require(state['Status'] == 'running' and state['Pid'] > 0 and state['OOMKilled'] is False and state['Error'] == '', 'current own running state')
        time.sleep(1)
    require(terminal is not None, 'bounded public run deadline')
except BaseException as error:
    errors.append(repr(error))
    try:
        current = inspect('failure-owned-inspect1',full=False); state = current['State']
        require(type(state['Running']) is bool and type(state['Pid']) is int, 'exact own cleanup state')
        if state['Running'] is True:
            row,raw,err = capture('failure-owned-stop1',['docker','stop','--time','10',CID])
            require(row['exitCode'] == 0 and err == b'', 'bounded stop after exact ownership recheck')
            current = inspect('failure-owned-terminal-inspect1',full=False); state = current['State']
        require(state['Running'] is False and state['Pid'] == 0, 'known own terminal after failure'); terminal = current
    except BaseException as close_error: errors.append('cleanup:' + repr(close_error))
finally:
    if terminal is not None:
        try:
            row,raw,err = capture('terminal-container-logs1',['docker','logs',CID],262144)
            require(row['exitCode'] == 0, 'terminal own logs')
        except BaseException as log_error: errors.append('logs:' + repr(log_error))
    result = {'scope':'ACTUAL_PUBLIC_REPAIR1_SOURCE_CONTROLS_ONLY','status':'TERMINAL_RUN_PASS_PENDING_EXPORT_AND_INDEPENDENT_REVIEW' if not errors else 'FAIL','operationUUID':OP,'containerId':CID,'terminalState':terminal['State'] if terminal is not None else None,'elapsedSeconds':time.monotonic()-started,'polls':polls,'combinedRawInspectBytes':poll_bytes,'errors':errors,'private':False,'native':False,'foreign':'UNTOUCHED','Task03':'HELD','Task04':'OPEN','wholeGoal':'OPEN','ownedVolume':'RETAINED','ownedContainer':'RETAINED'}
    put('terminal-run-result.json',result); print(json.dumps(result))
raise SystemExit(bool(errors))
