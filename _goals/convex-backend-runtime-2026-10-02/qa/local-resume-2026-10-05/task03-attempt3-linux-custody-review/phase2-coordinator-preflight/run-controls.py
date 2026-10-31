"""Finite reviewer Docker window; source only plus owned public dummy controls."""
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
NAME='cortex-task03-attempt3-coordinator-source-review-d98bad88'
FIELDS=('st_dev','st_ino','st_mode','st_nlink','st_uid','st_gid','st_size','st_mtime_ns','st_ctime_ns')
records=[]
def ident(s):return {k:str(getattr(s,k)) for k in FIELDS}
def run(label,argv,expected=0):
 label='r2-'+label
 start=time.monotonic();at=datetime.datetime.now(datetime.timezone.utc).isoformat();result=subprocess.run(argv,cwd=REPO,capture_output=True,timeout=60)
 assert len(result.stdout)<=4194304 and len(result.stderr)<=262144
 for suffix,data in [('stdout',result.stdout),('stderr',result.stderr)]:
  with (OUT/(label+'.'+suffix)).open('xb') as f:f.write(data);f.flush();os.fsync(f.fileno())
 records.append({'label':label,'argv':argv,'startedAtUtc':at,'elapsedSeconds':time.monotonic()-start,'exitCode':result.returncode,'stdoutSha256':hashlib.sha256(result.stdout).hexdigest(),'stderrSha256':hashlib.sha256(result.stderr).hexdigest(),'timeoutSeconds':60,'sourceOnlyPublicDummy':True})
 temp=OUT/'r2-command-receipts.json.replacement';temp.write_text(json.dumps({'scope':'COORDINATOR_FIRST_USE_SOURCE_ONLY_PUBLIC_DUMMY','commands':records,'actualPrivateReads':0,'actualServiceRequests':0,'actualCliDispatches':0},indent=2)+'\n');os.replace(temp,OUT/'r2-command-receipts.json')
 assert result.returncode==expected,label
 return result
before=SOURCE.lstat();fd=os.open(SOURCE,os.O_RDONLY|os.O_NOFOLLOW)
try:
 assert ident(before)==ident(os.fstat(fd))
 data=os.read(fd,20000);assert not os.read(fd,1)
 assert len(data)==12333 and hashlib.sha256(data).hexdigest()=='03ab5f3689a3ca0c634991d4fcb32e84c3b3b8d89defe4e534804604cff977dc'
 assert ident(before)==ident(os.fstat(fd))==ident(SOURCE.lstat())
 mem=int(run('docker-memory',['docker','info','--format','{{json .MemTotal}}']).stdout)
 ids=run('running-container-ids',['docker','ps','-q']).stdout.decode().split();caps=[]
 for i,cid in enumerate(ids):caps.append(json.loads(run('running-resource-'+str(i),['docker','inspect',cid,'--format','{"id":{{json .Id}},"memory":{{json .HostConfig.Memory}},"memorySwap":{{json .HostConfig.MemorySwap}}}']).stdout))
 assert all(x['memory']>0 for x in caps) and mem-sum(x['memory'] for x in caps)-2147483648>=536870912
 args=['docker','create','--platform','linux/amd64','--network','none','--memory','512m','--memory-swap','512m','--cpus','2','--user','501:20','--read-only','--name',NAME,'--label','cortex.operation=d98bad88-5157-4816-b458-4160e7945361','--mount','type=bind,source='+str(SOURCE)+',target=/source/task03-attempt3-private-coordinate.py,readonly','--mount','type=bind,source='+str(OUT)+',target=/review',IMAGE,'/usr/local/bin/python3.12','-B','/review/source-controls.py']
 created=False
 try:
  run('controls-create',args);created=True
  obj=json.loads(run('controls-inspect',['docker','inspect',NAME,'--format','{"image":{{json .Image}},"memory":{{json .HostConfig.Memory}},"memorySwap":{{json .HostConfig.MemorySwap}},"network":{{json .HostConfig.NetworkMode}},"user":{{json .Config.User}},"mounts":{{json .Mounts}}}']).stdout)
  assert obj['image']==IMAGE and obj['memory']==obj['memorySwap']==536870912 and obj['network']=='none' and obj['user']=='501:20'
  assert len(obj['mounts'])==2 and next(m for m in obj['mounts'] if m['Destination'].startswith('/source/'))['RW'] is False
  result=json.loads(run('source-controls',['docker','start','--attach',NAME]).stdout)
  assert result['status']=='PASS' and result['flowControlCount']==7
 finally:
  if created:run('controls-remove',['docker','rm',NAME])
 assert ident(before)==ident(os.fstat(fd))==ident(SOURCE.lstat())
 (OUT/'r2-source-host-binding.json').write_text(json.dumps({'scope':'COORDINATOR_CURRENT_HELD_SOURCE_ONLY','source':str(SOURCE),'sha256':hashlib.sha256(data).hexdigest(),'bytes':len(data),'currentIdentityDecimal':ident(before),'heldPathAll9':'PASS','actualPrivateReads':0,'actualServiceRequests':0},indent=2)+'\n')
 print(json.dumps({'status':'PASS','scope':'COORDINATOR_FIRST_USE_SOURCE_ONLY','diagnosticAndRecipeControls':result['diagnosticControlCount'],'mockedFlowControls':result['flowControlCount'],'actualPrivateReads':0,'actualServiceRequests':0,'actualCliDispatches':0}))
finally:os.close(fd)
