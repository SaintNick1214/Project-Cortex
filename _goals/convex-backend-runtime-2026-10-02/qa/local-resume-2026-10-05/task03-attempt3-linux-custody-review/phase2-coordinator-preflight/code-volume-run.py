"""Establish a distinct prospective owned public-code baseline, preserving failed runs."""
import datetime
import hashlib
import json
import os
from pathlib import Path
import subprocess
import time

OUT=Path(__file__).resolve().parent
REPO=Path('/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion')
SOURCE=OUT.parent.parent/'task03-attempt3-private-coordinate.py'
IMAGE='sha256:9ff43bfe7849197a6dfbaa80f2d11a34db4202d8aaae269ddc8b740f7da75fb3'
VOLUME='cortex-task03-attempt3-coordinator-code-review-d98bad88'
NAME='cortex-task03-attempt3-coordinator-code-controls-d98bad88'
EXPECTED='03ab5f3689a3ca0c634991d4fcb32e84c3b3b8d89defe4e534804604cff977dc'
FIELDS=('st_dev','st_ino','st_mode','st_nlink','st_uid','st_gid','st_size','st_mtime_ns','st_ctime_ns')
records=[]
def ident(s):return {k:str(getattr(s,k)) for k in FIELDS}
def run(label,argv,input_bytes=None,expected=0):
 label='code-volume-'+label;start=time.monotonic();at=datetime.datetime.now(datetime.timezone.utc).isoformat()
 result=subprocess.run(argv,capture_output=True,input=input_bytes,cwd=REPO,timeout=60)
 assert len(result.stdout)<=4194304 and len(result.stderr)<=262144
 for suffix,data in [('stdout',result.stdout),('stderr',result.stderr)]:
  with (OUT/(label+'.'+suffix)).open('xb') as f:f.write(data);f.flush();os.fsync(f.fileno())
 records.append({'label':label,'argv':argv,'stdinClassification':'exact_public_coordinator_source' if input_bytes else 'none','stdinSha256':hashlib.sha256(input_bytes).hexdigest() if input_bytes else None,'startedAtUtc':at,'elapsedSeconds':time.monotonic()-start,'exitCode':result.returncode,'stdoutSha256':hashlib.sha256(result.stdout).hexdigest(),'stderrSha256':hashlib.sha256(result.stderr).hexdigest(),'timeoutSeconds':60})
 temp=OUT/'code-volume-command-receipts.json.replacement';temp.write_text(json.dumps({'scope':'FRESH_OWNED_PUBLIC_CODE_SOURCE_BASELINE_ONLY','commands':records,'actualPrivateReads':0,'actualServiceRequests':0,'actualCliDispatches':0},indent=2)+'\n');os.replace(temp,OUT/'code-volume-command-receipts.json')
 assert result.returncode==expected,label
 return result
before=SOURCE.lstat();fd=os.open(SOURCE,os.O_RDONLY|os.O_NOFOLLOW)
try:
 assert ident(before)==ident(os.fstat(fd));data=os.read(fd,20000);assert not os.read(fd,1)
 assert len(data)==12333 and hashlib.sha256(data).hexdigest()==EXPECTED
 assert ident(before)==ident(os.fstat(fd))==ident(SOURCE.lstat())
 mem=int(run('memory',['docker','info','--format','{{json .MemTotal}}']).stdout)
 ids=run('running-ids',['docker','ps','-q']).stdout.decode().split();caps=[]
 for i,cid in enumerate(ids):caps.append(json.loads(run('resource-'+str(i),['docker','inspect',cid,'--format','{"id":{{json .Id}},"memory":{{json .HostConfig.Memory}},"memorySwap":{{json .HostConfig.MemorySwap}}}']).stdout))
 assert all(v['memory']>0 for v in caps) and mem-sum(v['memory'] for v in caps)-2147483648>=536870912
 (OUT/'code-volume-resources.json').write_text(json.dumps({'status':'PASS','totalBytes':mem,'runningCaps':caps,'externalSiblingReserveBytes':2147483648,'reviewCeilingBytes':536870912},indent=2)+'\n')
 absent=run('absence',['docker','volume','inspect',VOLUME],expected=1);assert b'no such volume' in absent.stderr.lower()
 run('create',['docker','volume','create','--label','cortex.goal=convex-backend-runtime-2026-10-02','--label','cortex.operation=d98bad88-5157-4816-b458-4160e7945361','--label','cortex.review=coordinator-public-source-only',VOLUME])
 base=['docker','run','--rm','--platform','linux/amd64','--network','none','--memory','512m','--memory-swap','512m']
 init="import os,stat;from pathlib import Path;p=Path('/code');assert p.is_dir() and not p.is_symlink() and not list(p.iterdir());os.chown(p,501,20);os.chmod(p,0o700);s=p.lstat();assert(s.st_uid,s.st_gid,stat.S_IMODE(s.st_mode))==(501,20,0o700);print('PUBLIC_CODE_ROOT_READY_NO_SOURCE_MOUNTS')"
 run('root-init',base+['--user','0:0','--mount','type=volume,source='+VOLUME+',target=/code,volume-nocopy',IMAGE,'/usr/local/bin/python3.12','-B','-c',init])
 writer="""import hashlib,json,os,stat,sys
from pathlib import Path
p=Path('/code');s=p.lstat();assert os.getuid()==501 and os.getgid()==20 and (s.st_uid,s.st_gid,stat.S_IMODE(s.st_mode))==(501,20,0o700) and not list(p.iterdir())
b=sys.stdin.buffer.read(20000);assert len(b)==12333 and hashlib.sha256(b).hexdigest()=='03ab5f3689a3ca0c634991d4fcb32e84c3b3b8d89defe4e534804604cff977dc'
t=p/'task03-attempt3-private-coordinate.py';fd=os.open(t,os.O_WRONLY|os.O_CREAT|os.O_EXCL|os.O_NOFOLLOW,0o600);assert os.write(fd,b)==len(b);os.fsync(fd);s=os.fstat(fd);os.close(fd)
fields=('st_dev','st_ino','st_mode','st_nlink','st_uid','st_gid','st_size','st_mtime_ns','st_ctime_ns');identity=lambda v:{k:str(getattr(v,k)) for k in fields};before=identity(s);fd=os.open(t,os.O_RDONLY|os.O_NOFOLLOW);assert identity(os.fstat(fd))==identity(t.lstat())==before;assert os.read(fd,20000)==b and not os.read(fd,1);assert identity(os.fstat(fd))==identity(t.lstat())==before;os.close(fd)
assert s.st_nlink==1 and(s.st_uid,s.st_gid,stat.S_IMODE(s.st_mode))==(501,20,0o600);print(json.dumps({'status':'PASS','scope':'DISTINCT_PROSPECTIVE_PUBLIC_CODE_BASELINE_ONLY','sha256':hashlib.sha256(b).hexdigest(),'bytes':len(b),'destinationIdentityDecimal':before,'privateReads':0,'serviceRequests':0}))
"""
 copy=json.loads(run('copy',base+['-i','--user','501:20','--mount','type=volume,source='+VOLUME+',target=/code,volume-nocopy',IMAGE,'/usr/local/bin/python3.12','-B','-c',writer],input_bytes=data).stdout)
 assert ident(before)==ident(os.fstat(fd))==ident(SOURCE.lstat())
 args=['docker','create','--platform','linux/amd64','--network','none','--memory','512m','--memory-swap','512m','--cpus','2','--user','501:20','--read-only','--name',NAME,'--label','cortex.operation=d98bad88-5157-4816-b458-4160e7945361','--mount','type=volume,source='+VOLUME+',target=/source,readonly,volume-nocopy','--mount','type=bind,source='+str(OUT)+',target=/review',IMAGE,'/usr/local/bin/python3.12','-B','/review/source-controls.py']
 created=False
 try:
  run('controls-create',args);created=True
  obj=json.loads(run('controls-inspect',['docker','inspect',NAME,'--format','{"image":{{json .Image}},"memory":{{json .HostConfig.Memory}},"memorySwap":{{json .HostConfig.MemorySwap}},"network":{{json .HostConfig.NetworkMode}},"user":{{json .Config.User}},"mounts":{{json .Mounts}}}']).stdout)
  assert obj['image']==IMAGE and obj['memory']==obj['memorySwap']==536870912 and obj['network']=='none' and obj['user']=='501:20'
  assert next(m for m in obj['mounts'] if m['Destination']=='/source')['RW'] is False
  result=json.loads(run('controls',['docker','start','--attach',NAME]).stdout)
  assert result['status']=='PASS' and result['sourceCurrentIdentityDecimal']==copy['destinationIdentityDecimal']
 finally:
  if created:run('controls-remove',['docker','rm',NAME])
 assert ident(before)==ident(os.fstat(fd))==ident(SOURCE.lstat())
 (OUT/'code-volume-host-source-binding.json').write_text(json.dumps({'scope':'FRESH_CURRENT_HOST_SOURCE_TO_DISTINCT_PUBLIC_CODE_BASELINE','source':str(SOURCE),'sha256':EXPECTED,'bytes':12333,'hostHeldPathIdentityDecimal':ident(before),'hostHeldPathAll9':'PASS','ownedCodeVolume':VOLUME,'codeBaselineDestinationIdentityDecimal':copy['destinationIdentityDecimal'],'continuousHistoricalIdentity':'NOT_ESTABLISHED','failedR2Tuple':'UNAVAILABLE_NOT_RECONSTRUCTED_UNKNOWN_CAUSE','actualPrivateReads':0,'actualServiceRequests':0},indent=2)+'\n')
 print(json.dumps({'status':'PASS','scope':'FRESH_OWNED_PUBLIC_CODE_FIRST_USE_SOURCE_REVIEW','diagnosticAndRecipeControls':result['diagnosticControlCount'],'mockedFlowControls':result['flowControlCount'],'actualPrivateReads':0,'actualServiceRequests':0,'actualCliDispatches':0}))
finally:os.close(fd)
