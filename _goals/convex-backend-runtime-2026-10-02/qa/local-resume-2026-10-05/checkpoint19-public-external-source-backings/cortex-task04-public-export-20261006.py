"""Copy only the stopped owned container's exact finite public export members."""
import hashlib
import json
import os
from pathlib import Path
import re
import stat
import subprocess
import sys

P = Path('/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion/_goals/convex-backend-runtime-2026-10-02/qa/local-resume-2026-10-05/task04-current-producer-linux-public-run-r3')
DEST = P / 'exports'
CID = '1044af770dbcb88c25b73d2821440075f5024db16f975b07ed3e8b7f64abf56f'
ROOT = '/var/tmp/task04-c8-current-canonical-input-producers/'
ALLOW = ['public-control-receipt.json', 'bootstrap-failure.json', 'input-observations.json', 'runtime-observations.json', 'control-run.stdout', 'control-run.stderr', 'control-run.terminal.json', 'node-version.stdout', 'node-version.stderr', 'node-version.terminal.json', 'npm-version.stdout', 'npm-version.stderr', 'npm-version.terminal.json', 'python-version.stdout', 'python-version.stderr', 'python-version.terminal.json', 'controls/linux-public-run3/results.json', 'controls/linux-public-run3/partial-results.json', 'controls/linux-public-run3/healthy/wiring-actual.stdout', 'controls/linux-public-run3/healthy/wiring-actual.stdout.stderr', 'controls/linux-public-run3/healthy/consumer-adverse.stdout', 'controls/linux-public-run3/healthy/consumer-adverse.stdout.stderr']
FIELDS = ('dev','ino','mode','uid','gid','nlink','size','mtime_ns','ctime_ns')
identity = lambda s: {k: str(getattr(s, 'st_' + k)) for k in FIELDS}
held = []; observations = []
def require(ok, message):
    if not ok: raise RuntimeError(message)
def pairs(rows):
    result = {}
    for k, v in rows:
        require(k not in result, 'duplicate JSON key'); result[k] = v
    return result
def parse(raw):
    return json.loads(raw, object_pairs_hook=pairs, parse_constant=lambda x: (_ for _ in ()).throw(ValueError('nonfinite')))
def read(path, maximum):
    pre = os.lstat(path); require(stat.S_ISREG(pre.st_mode) and pre.st_nlink == 1 and pre.st_size <= maximum, 'finite ordinary single-link')
    fd = os.open(path, os.O_RDONLY | os.O_NOFOLLOW); held.append((path, fd, identity(pre)))
    opened = os.fstat(fd); raw = bytearray()
    while block := os.read(fd, 65536):
        raw.extend(block); require(len(raw) <= maximum, 'finite stream')
    require(identity(pre) == identity(opened) == identity(os.fstat(fd)) == identity(os.lstat(path)) and len(raw) == pre.st_size, 'actual EOF/all-nine')
    row = {'path': str(path), 'bytes': len(raw), 'sha256': hashlib.sha256(raw).hexdigest(), 'currentNine': identity(pre), 'EOF': True}
    observations.append(row); return bytes(raw), row
def receipt(label, argv):
    raw = read(P / 'raw' / (label + '.receipt.json'), 65536)[0]; row = parse(raw)
    out = read(P / 'raw' / (label + '.stdout'), 65536)[0]; err = read(P / 'raw' / (label + '.stderr'), 65536)[0]
    require(row['argv'] == argv and row['exitCode'] == 0 and row['terminal'] is True and row['failureClass'] is None and row['closeErrors'] == [] and row['ownedGroup']['absenceObserved'] is True and row['elapsedSeconds'] <= 30 and row['stdinBytes'] == 0, 'known exact terminal copy CLI')
    require(row['stdoutSha256'] == hashlib.sha256(out).hexdigest() and row['stderrSha256'] == hashlib.sha256(err).hexdigest() and row['streamByteCounts'] == {'stdout': len(out), 'stderr': len(err)} and out == err == b'', 'exact empty copy outputs')
    return row
errors = []; copied = []; absent = []
try:
    raw, manifest_host = read(DEST / 'public-export-manifest.json', 65536)
    require(len(raw) == 18430 and manifest_host['sha256'] == '6bd5b7a4b511694f08a85e7de4c93540a441722989f622a5c08e78f542171878', 'exact bootstrap printed manifest bytes/hash')
    manifest = parse(raw)
    require(set(manifest) == {'ROOT','allDescendantsTerminal','combinedExportBytesMaxIncludingThisManifest','existingBytes','fileCount','files','nativeClaims','original122','primaryFailure','scope'}, 'exact manifest schema')
    require(manifest['ROOT'] == 'ABSENT' and manifest['original122'] == 'HELD' and manifest['nativeClaims'] is False and manifest['allDescendantsTerminal'] is True, 'bounded source scope and descendants terminal')
    require(type(manifest['fileCount']) is int and manifest['fileCount'] == 22 and type(manifest['existingBytes']) is int and manifest['combinedExportBytesMaxIncludingThisManifest'] == 1048576, 'exact finite limits')
    require(type(manifest['files']) is list and [r['relativePath'] for r in manifest['files']] == ALLOW, 'exact ordered 22-member allowlist')
    total = 0
    for row in manifest['files']:
        path = row['relativePath']
        if row['status'] == 'ABSENT':
            require(set(row) == {'relativePath','status'}, 'exact absent row'); absent.append(path); continue
        require(row['status'] == 'EXISTS' and set(row) == {'relativePath','status','current'}, 'exact existing row')
        current = row['current']; require(set(current) == {'path','bytes','sha256','PRE','OPEN','POST','pathPOST','EOF'}, 'exact current observation schema')
        require(current['path'] == ROOT + path and type(current['bytes']) is int and 0 <= current['bytes'] <= 1048576 and re.fullmatch('[0-9a-f]{64}', current['sha256']) and current['EOF'] is True, 'exact public path/size/hash/EOF')
        previous = None
        for stage in ('PRE','OPEN','POST','pathPOST'):
            pin = current[stage]; require(set(pin) == {'schema','fields'} and pin['schema'] == 'FS_IDENTITY_DECIMAL_V1' and set(pin['fields']) == set(FIELDS) and all(type(v) is str and re.fullmatch('0|[1-9][0-9]*', v) for v in pin['fields'].values()), 'canonical nine decimal fields')
            fields = pin['fields']; require(fields['mode'] == '33152' and fields['uid'] == fields['gid'] == '0' and fields['nlink'] == '1' and fields['size'] == str(current['bytes']), 'owned Linux ordinary 0600 file')
            require(previous is None or fields == previous, 'Linux current observation drift'); previous = fields
        total += current['bytes']
    require(total == manifest['existingBytes'] and total + len(raw) <= 1048576, 'finite combined export bytes including manifest')
    for index, row in enumerate(manifest['files']):
        if row['status'] != 'EXISTS': continue
        path = row['relativePath']; dest = DEST / path
        dest.parent.mkdir(parents=True, exist_ok=True, mode=0o700); require(not os.path.lexists(dest), 'fresh exact destination')
        argv = ['docker','cp',CID + ':' + ROOT + path,str(dest)]; label = 'export-file-copy-' + str(index + 1).zfill(2)
        cp = subprocess.run([sys.executable,'-B','/Users/SaintNick/.codex/tmp/cortex-task04-public-cli-20261006.py',label,'30','--',*argv], capture_output=True, timeout=45)
        require(cp.returncode == 0, 'qualified copy CLI'); receipt(label, argv)
        content, observed = read(dest, 1048576)
        require(observed['bytes'] == row['current']['bytes'] and observed['sha256'] == row['current']['sha256'], 'export exact current bytes/hash; no inode adoption')
        copied.append({'relativePath':path,'bytes':observed['bytes'],'sha256':observed['sha256'],'hostNine':observed['currentNine'],'LinuxHistoricalIdentityAdopted':False})
    for path, fd, pre in held:
        require(pre == identity(os.fstat(fd)) == identity(os.lstat(path)), 'final held-FD/path nine fields')
except BaseException as e:
    errors.append(repr(e))
finally:
    for _, fd, _ in held: os.close(fd)
    result = {'scope':'FINITE_ACTUAL_FAILED_PUBLIC_RUN_EXPORT_ONLY','status':'PASS' if not errors else 'FAIL','containerId':CID,'copied':copied,'absent':absent,'observations':observations,'errors':errors,'pipelineFailure':'PRESERVED','parentMonitorFailure':'PRESERVED','native':False,'foreign':'UNTOUCHED','wholeGoal':'OPEN'}
    with (P / 'export-validation-result.json').open('x') as f:
        json.dump(result,f,indent=2); f.write('\n'); f.flush(); os.fsync(f.fileno())
    print(json.dumps({'status':result['status'],'copied':len(copied),'absent':len(absent),'errors':errors}))
raise SystemExit(bool(errors))
