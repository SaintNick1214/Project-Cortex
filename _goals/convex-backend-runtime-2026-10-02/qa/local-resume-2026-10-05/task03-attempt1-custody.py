"""Preserve failed native attempt one and invalidate its retired private selector.

No service request, credential output, subject import, or qualification is performed.
The new private preimage is kept in the original disposable Linux volume.
"""
import base64
import hashlib
import json
import os
from pathlib import Path
import stat
import subprocess
import sys

IMAGE = 'sha256:9ff43bfe7849197a6dfbaa80f2d11a34db4202d8aaae269ddc8b740f7da75fb3'
VOLUME = 'cortex-task03-current-fixture-20261005-98d651af'
ROOT = Path('/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion')
QA = ROOT / '_goals/convex-backend-runtime-2026-10-02/qa/local-resume-2026-10-05'
PRIVATE = Path('/Users/SaintNick/.codex/tmp/cortex-runtime-task03-private-20261005')
INFRA = Path('/Users/SaintNick/.codex/tmp/cortex-runtime-task03-linux-deps-20261005')

target_path = PRIVATE / 'target.json'
before = target_path.lstat()
assert stat.S_ISREG(before.st_mode) and before.st_nlink == 1 and before.st_uid == os.getuid()
assert stat.S_IMODE(before.st_mode) == 0o600
target_bytes = target_path.read_bytes()
after = target_path.lstat()
assert before == after
target = json.loads(target_bytes)
assert target['projectId'] == 3155546 and target['operation'] == '3b3d1dc7-5c2b-4fb5-b13a-82460fcd3652'
assert target['active'] is False and target['retired'] is True and target['deleted'] is True
retirement = json.loads((QA / 'task03-target-retirement.json').read_bytes())
assert retirement['projectId'] == target['projectId'] and retirement['operation'] == target['operation']
assert retirement['deletionHttpStatus'] == 200 and retirement['verificationHttpStatus'] == 404
transfer = json.loads((INFRA / 'linux-fixture-transfer-receipt.json').read_bytes())
payload = {'retiredTarget': base64.b64encode(target_bytes).decode(), 'baseline': transfer['files']}

program = r'''
import base64, hashlib, json, os, stat, sys, time
from pathlib import Path
p = json.loads(sys.stdin.readline())
fields = ['st_dev','st_ino','st_mode','st_nlink','st_uid','st_gid','st_size','st_mtime_ns','st_ctime_ns']
def pins(s): return {k:str(getattr(s,k)) for k in fields}
def read_owned(path):
    s=path.lstat(); assert stat.S_ISREG(s.st_mode) and s.st_nlink==1 and s.st_uid==501
    fd=os.open(path,os.O_RDONLY|os.O_NOFOLLOW)
    try:
        pre=os.fstat(fd); assert pins(pre)==pins(s)
        out=b''
        while True:
            b=os.read(fd,1024*1024)
            if not b: break
            out+=b
        post=os.fstat(fd); assert pins(pre)==pins(post)==pins(path.lstat())
        return out,pins(post)
    finally: os.close(fd)
def digest(b): return hashlib.sha256(b).hexdigest()
root=Path('/evidence'); private=root/'private'; candidate=root/'candidate'
assert private.lstat().st_uid==501 and stat.S_IMODE(private.lstat().st_mode)==0o700
old,oldpins=read_owned(private/'target.json'); obj=json.loads(old)
new=base64.b64decode(p['retiredTarget']); retired=json.loads(new)
assert obj['projectId']==retired['projectId']==3155546 and obj['operation']==retired['operation']
assert obj['active'] is True and obj['retired'] is False
assert retired['active'] is False and retired['retired'] is True and retired['deleted'] is True
custody=private/'failed-attempt1-custody'; custody.mkdir(mode=0o700)
def private_copy(name,data):
    dest=custody/name
    fd=os.open(dest,os.O_WRONLY|os.O_CREAT|os.O_EXCL|os.O_NOFOLLOW,0o600)
    try:
        with os.fdopen(fd,'wb',closefd=False) as f: f.write(data);f.flush();os.fsync(f.fileno())
    finally: os.close(fd)
    actual,pin=read_owned(dest);assert actual==data
    return {'name':name,'sha256':digest(actual),'bytes':len(actual),'identity':pin}
preimage=private_copy('target-active-preimage.json',old)
changes=[]; exact=0
for row in p['baseline']:
    path=candidate/row['path']; data,identity=read_owned(path)
    observed={'path':row['path'],'sha256':digest(data),'bytes':len(data),'identity':identity}
    if observed['sha256']==row['sha256'] and observed['bytes']==row['bytes']: exact+=1
    else:
        observed['baselineSha256']=row['sha256']; observed['baselineBytes']=row['bytes']
        observed['privateCustody']=private_copy('changed-'+str(len(changes))+'.bin',data)
        changes.append(observed)
incidental=candidate/'managed-fixture/fixture/.env.local'
assert all(row['path']!='managed-fixture/fixture/.env.local' for row in p['baseline'])
env,envpins=read_owned(incidental)
envcustody=private_copy('cli-created.env.local',env)
diags=[]
for path in sorted(private.glob('private-cli-diagnostics-*.json')):
    raw,identity=read_owned(path); diag=json.loads(raw)
    assert diag['phase']=='deploy' and diag['exitCode']==1
    assert 'No `tsc` binary found' in diag['stderr']
    diags.append({'name':path.name,'sha256':digest(raw),'bytes':len(raw),'identity':identity})
assert len(diags)==1
deploy=[]
for path in sorted(private.glob('deploy-*.json')):
    raw,identity=read_owned(path); receipt=json.loads(raw)
    assert receipt['status']=='FAIL' and receipt['exitCode']==1
    assert receipt['counts']['ownedGroupsRemaining']==0 and receipt['counts']['verifiedTerminalGroups']==1
    deploy.append({'name':path.name,'sha256':digest(raw),'bytes':len(raw),'identity':identity,'publicReceipt':receipt})
assert len(deploy)==1
# This selector invalidation follows independently verified physical retirement.
# Preserve the exact old bytes before the atomic replacement; do not alter the fixture.
tmp=private/'target-retired-prospective.tmp'
fd=os.open(tmp,os.O_WRONLY|os.O_CREAT|os.O_EXCL|os.O_NOFOLLOW,0o600)
try:
    with os.fdopen(fd,'wb',closefd=False) as f:f.write(new);f.flush();os.fsync(f.fileno())
finally:os.close(fd)
assert pins((private/'target.json').lstat())==oldpins
os.replace(tmp,private/'target.json')
fd=os.open(private,os.O_RDONLY|os.O_DIRECTORY);os.fsync(fd);os.close(fd)
actual,newpins=read_owned(private/'target.json');assert actual==new
report={'scope':'FAILED_TASK03_NATIVE_ATTEMPT1_CUSTODY_AND_RETIRED_SELECTOR_INVALIDATION_ONLY',
 'projectId':3155546,'operation':obj['operation'],'observedAtEpochNs':str(time.time_ns()),
 'baselineFiles':len(p['baseline']),'unchangedContentFiles':exact,'changedFiles':changes,
 'createdIncidental':{'path':'managed-fixture/fixture/.env.local','sha256':digest(env),'bytes':len(env),'identity':envpins,'privateCustody':envcustody,'removed':False},
 'privateDiagnostics':diags,'deployReceipts':deploy,'targetPreimage':preimage,
 'oldSelectorIdentity':oldpins,'newSelector':{'sha256':digest(new),'bytes':len(new),'identity':newpins,'active':False,'retired':True,'deleted':True},
 'actualNativeCases':0,'qualificationAccepted':False,'productWrites':0,'networkRequests':0}
private_copy('custody-report.json',json.dumps(report,indent=2).encode()+b'\n')
print(json.dumps(report))
'''
script = 'import sys\n' + 'exec(' + repr(program) + ')\n'
# A newline-framed JSON payload precedes executable Python. The -c argument is
# constant source; private values travel only through stdin, never argv/logs.
command = ['docker','run','--rm','-i','--platform','linux/amd64','--network','none',
           '--memory','512m','--cpus','2','--user','501:20','--mount',
           'type=volume,source='+VOLUME+',target=/evidence,volume-nocopy',
           IMAGE,'python3','-c',script]
result = subprocess.run(command,input=json.dumps(payload).encode()+b'\n',capture_output=True,timeout=60)
if result.returncode:
    # The subprocess does not intentionally print secrets, but preserve private
    # failure diagnostics without echoing arbitrary tracebacks to the UI.
    dest=PRIVATE/'failed-attempt1-custody-host-error.json'
    fd=os.open(dest,os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600)
    with os.fdopen(fd,'wb') as f:f.write(result.stderr);f.flush();os.fsync(f.fileno())
    raise SystemExit('Failed custody transfer; private diagnostic retained')
report=json.loads(result.stdout)
assert not result.stderr
report['imageId']=IMAGE;report['volume']=VOLUME;report['retirementReceipt']=retirement
out=QA/'task03-attempt1-native-failure-custody.json'
with out.open('x') as f:json.dump(report,f,indent=2);f.write('\n')
print(json.dumps({'status':'PRESERVED_FAILED_ATTEMPT','baselineFiles':report['baselineFiles'],
 'unchangedContentFiles':report['unchangedContentFiles'],'changedFiles':[x['path'] for x in report['changedFiles']],
 'retiredSelectorInvalidated':True,'actualNativeCases':0,'qualificationAccepted':False}))
