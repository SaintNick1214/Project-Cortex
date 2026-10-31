"""Capture the failed CLI's newly created gitignore without changing its fixture."""
import json
from pathlib import Path
import subprocess

program = r'''
import hashlib,json,os,stat
from pathlib import Path
fields=['st_dev','st_ino','st_mode','st_nlink','st_uid','st_gid','st_size','st_mtime_ns','st_ctime_ns']
def pins(s):return {k:str(getattr(s,k)) for k in fields}
root=Path('/evidence');src=root/'candidate/managed-fixture/fixture/.gitignore'
baseline=json.loads((root/'transfer-receipt.json').read_bytes())
assert all(x['path']!='managed-fixture/fixture/.gitignore' for x in baseline['files'])
s=src.lstat();assert stat.S_ISREG(s.st_mode) and s.st_nlink==1 and s.st_uid==501
fd=os.open(src,os.O_RDONLY|os.O_NOFOLLOW)
try:
    pre=os.fstat(fd);assert pins(pre)==pins(s)
    data=os.read(fd,65536);assert not os.read(fd,1)
    assert pins(pre)==pins(os.fstat(fd))==pins(src.lstat())
finally:os.close(fd)
assert data==b'.env.local\n'
dest=root/'private/failed-attempt1-custody/cli-created.gitignore'
fd=os.open(dest,os.O_WRONLY|os.O_CREAT|os.O_EXCL|os.O_NOFOLLOW,0o600)
with os.fdopen(fd,'wb') as f:f.write(data);f.flush();os.fsync(f.fileno())
assert dest.read_bytes()==data
print(json.dumps({'scope':'FAILED_CLI_CREATED_INCIDENTAL_CUSTODY_ONLY','path':'managed-fixture/fixture/.gitignore','bytes':len(data),'sha256':hashlib.sha256(data).hexdigest(),'sourceIdentity':pins(pre),'privateCustodyIdentity':pins(dest.lstat()),'baselineAbsenceVerified':True,'sourceRemoved':False,'nativeCases':0,'qualificationAccepted':False}))
'''
command=['docker','run','--rm','--platform','linux/amd64','--network','none','--memory','512m','--user','501:20','--mount','type=volume,source=cortex-task03-current-fixture-20261005-98d651af,target=/evidence,volume-nocopy','sha256:9ff43bfe7849197a6dfbaa80f2d11a34db4202d8aaae269ddc8b740f7da75fb3','python3','-c',program]
r=subprocess.run(command,capture_output=True,timeout=60)
assert r.returncode==0 and not r.stderr, 'Incidental custody capture failed'
report=json.loads(r.stdout)
qa=Path(__file__).parent
with (qa/'task03-attempt1-incidental-custody.json').open('x') as f:json.dump(report,f,indent=2);f.write('\n')
print(json.dumps({'status':'PRESERVED','bytes':report['bytes'],'sourceRemoved':False}))
