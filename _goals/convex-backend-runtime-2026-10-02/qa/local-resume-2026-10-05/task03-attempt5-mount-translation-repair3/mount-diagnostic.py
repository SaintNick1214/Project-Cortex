"""One actual owned public read-only diagnostic. No volume or private effects."""
import hashlib,importlib.util,json,os,sys,uuid
from pathlib import Path
sys.dont_write_bytecode=True
R=Path('/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion');QA=Path(__file__).absolute().parent
Q=R/'_goals/convex-backend-runtime-2026-10-02/qa/task03-local-native-attempt5-2026-10-06';P=Q/'coordinate-source/repair3'
OUT=QA/'raw/mount-diagnostic';OUT.mkdir(mode=0o700)
OP=str(uuid.uuid4());NAME='cortex-task03-repair3-mount-diagnostic-'+OP.split('-')[0]
IMAGE='sha256:9ff43bfe7849197a6dfbaa80f2d11a34db4202d8aaae269ddc8b740f7da75fb3';DOCKER='/usr/local/bin/docker'
COMMON=P/'task03-attempt5-coordinate-common.py';assert hashlib.sha256(COMMON.read_bytes()).hexdigest()=='1f8f6005c668401b63681e28002715d977abcc02312a199a468e32c2505fa0a2'
spec=importlib.util.spec_from_file_location('actual_public_readonly_bounded_common',COMMON);C=importlib.util.module_from_spec(spec);spec.loader.exec_module(C)
files=[('/input','candidate-freeze-attempt5.json',Q/'candidate-freeze-attempt5.json','053e131a8f408031af7ead1e2c8c73f75954ba5acd905eac9e6091a24429e570'),('/helper','task03-attempt5-linux-public-transfer.py',P/'task03-attempt5-linux-public-transfer.py','8faad381879d628e7c2c67cbab25b64b3135e09eb004e903e5b4b42c50dcc13f'),('/helper','task03-attempt5-coordinate-common.py',COMMON,'1f8f6005c668401b63681e28002715d977abcc02312a199a468e32c2505fa0a2')]
expected=[{'root':root,'name':name,'sha256':pin,'bytes':path.lstat().st_size} for root,name,path,pin in files]
script='''import hashlib,json,os,stat
from pathlib import Path
FIELDS=('dev','ino','mode','uid','gid','nlink','size','mtime_ns','ctime_ns')
def identity(s):return {f:str(getattr(s,'st_'+f)) for f in FIELDS}
assert os.getuid()==501 and os.getgid()==20
assert Path('/sys/fs/cgroup/memory.max').read_text().strip()=='536870912'
assert Path('/sys/fs/cgroup/memory.swap.max').read_text().strip()=='0'
EXPECTED=EXPECTED_DATA
roots={};held=[];rows=[];errors=[]
try:
 for root in ('/input','/helper'):
  p=Path(root);before=p.lstat();assert stat.S_ISDIR(before.st_mode) and before.st_uid==501 and before.st_gid==20
  assert not p.is_symlink() and os.access(p,os.R_OK|os.X_OK)
  fd=os.open(p,os.O_RDONLY|os.O_DIRECTORY|os.O_NOFOLLOW);pin=identity(before);assert identity(os.fstat(fd))==identity(p.lstat())==pin
  roots[root]={'fd':fd,'pin':pin,'path':p}
 for spec in EXPECTED:
  root=roots[spec['root']];name=spec['name'];before=os.stat(name,dir_fd=root['fd'],follow_symlinks=False)
  assert stat.S_ISREG(before.st_mode) and before.st_uid==501 and before.st_gid==20 and before.st_nlink==1
  pin=identity(before);fd=os.open(name,os.O_RDONLY|os.O_NOFOLLOW,dir_fd=root['fd']);held.append((fd,root,name,pin))
  opened=identity(os.fstat(fd));assert opened==pin;count=0;h=hashlib.sha256()
  while True:
   block=os.read(fd,65536)
   if not block:break
   count+=len(block);assert count<=spec['bytes'];h.update(block)
  postFD=identity(os.fstat(fd));postPath=identity(os.stat(name,dir_fd=root['fd'],follow_symlinks=False))
  assert postFD==postPath==pin and count==before.st_size==spec['bytes'] and h.hexdigest()==spec['sha256']
  rows.append({**spec,'readBytes':count,'EOF':True,'observedSha256':h.hexdigest(),'before':pin,'opened':opened,'postFD':postFD,'postPath':postPath})
 for row,(fd,root,name,pin) in zip(rows,held):
  row['finalFD']=identity(os.fstat(fd));row['finalPath']=identity(os.stat(name,dir_fd=root['fd'],follow_symlinks=False));assert row['finalFD']==row['finalPath']==pin
 for root in roots.values():assert identity(os.fstat(root['fd']))==identity(root['path'].lstat())==root['pin']
finally:
 for fd,root,name,pin in held:
  try:os.close(fd)
  except BaseException as e:errors.append({'file':name,'class':type(e).__name__})
 for name,root in roots.items():
  try:os.close(root['fd'])
  except BaseException as e:errors.append({'root':name,'class':type(e).__name__})
assert not errors
print(json.dumps({'status':'PASS','scope':'THREE_FINITE_PUBLIC_READONLY_FULL_EOF_ALL9_ONLY','uid':os.getuid(),'gid':os.getgid(),'roots':{k:{'identityDecimal':v['pin'],'traversable':True,'owner50120':True} for k,v in roots.items()},'rows':rows,'closeErrors':errors,'privateReads':0,'privateStats':0,'volumeMounts':0,'candidateCopy':False,'serviceCalls':0}))
'''.replace('EXPECTED_DATA',repr(expected))
records=[];selected=None;initial_id=None;created=False;success=False;failure=None;cleanup=[]
def command(label,argv,timeout=30,required=True):
 row,stdout,stderr=C.run(label,argv,OUT,timeout,{**os.environ,'CORTEX_COORDINATOR_CWD':str(R)},required=False);records.append(row)
 assert row['terminal'] is True and not row['closeErrors'] and row['failureClass'] is None
 assert type(row['exitCode']) is int
 if required:assert row['exitCode']==0
 return row,stdout,stderr
def owned(obj):
 assert obj['Name']=='/'+NAME and obj['Image']==IMAGE and obj['Config']['Image']==IMAGE
 assert obj['Config']['Labels']=={'cortex.operation':OP,'cortex.scope':'task03-repair3-public-readonly-diagnostic'}
 assert type(obj['State']['Running']) is bool
 assert isinstance(obj['Id'],str) and len(obj['Id'])==64 and all(c in '0123456789abcdef' for c in obj['Id'])
def recipe(obj,previous=None,container_id=None):
 owned(obj);assert obj['Platform']=='linux' and obj['Config']['User']=='501:20' and obj['Config']['Entrypoint'] is None
 assert obj['Config']['Cmd']==['/usr/local/bin/python3.12','-B','-c',script]
 assert obj['State']['Running'] is False and obj['State']['OOMKilled'] is False
 if container_id is not None:assert obj['Id']==container_id
 host=obj['HostConfig'];assert host['NetworkMode']=='none' and host['ReadonlyRootfs'] is True
 for field,value in [('Memory',536870912),('MemorySwap',536870912),('PidsLimit',64),('NanoCpus',2000000000)]:assert type(host[field]) is int and host[field]==value
 assert type(host['Mounts']) is list and len(host['Mounts'])==2
 choices=[]
 for name,prefix in [('literal',''),('docker-desktop-host_mnt','/host_mnt')]:
  expected=[{'Type':'bind','Source':prefix+str(source),'Target':target,'ReadOnly':True} for source,target in [(Q,'/input'),(P,'/helper')]]
  if all(m['ReadOnly'] is True for m in host['Mounts']) and host['Mounts']==expected:choices.append(name)
 assert len(choices)==1;selected=choices[0]
 if previous is not None:assert selected==previous
 assert type(obj['Mounts']) is list and len(obj['Mounts'])==2
 actual={m['Destination']:m for m in obj['Mounts']};assert set(actual)=={'/input','/helper'}
 prefix='' if selected=='literal' else '/host_mnt'
 for source,target in [(Q,'/input'),(P,'/helper')]:
  m=actual[target];assert m['Type']=='bind' and m['Source']==prefix+str(source) and m['RW'] is False
 return selected
try:
 _,raw,_=command('daemon-memory',[DOCKER,'info','--format','{{json .MemTotal}}']);assert int(raw)>=2147483648
 _,raw,_=command('running-container-ids',[DOCKER,'ps','--quiet']);assert raw.strip()==b''
 _,raw,_=command('immutable-image',[DOCKER,'image','inspect',IMAGE]);obj=json.loads(raw)[0];assert obj['Id']==IMAGE and obj['Architecture']=='amd64' and obj['Os']=='linux'
 command('create',[DOCKER,'create','--name',NAME,'--label','cortex.operation='+OP,'--label','cortex.scope=task03-repair3-public-readonly-diagnostic','--platform','linux/amd64','--network','none','--memory','512m','--memory-swap','512m','--cpus','2','--pids-limit','64','--read-only','--user','501:20','--mount','type=bind,source='+str(Q)+',target=/input,readonly','--mount','type=bind,source='+str(P)+',target=/helper,readonly',IMAGE,'/usr/local/bin/python3.12','-B','-c',script]);created=True
 _,raw,_=command('initial-inspect',[DOCKER,'inspect',NAME]);obj=json.loads(raw)[0];selected=recipe(obj);initial_id=obj['Id']
 C.durable_json(OUT/'initial-selected-recipe.json',{'containerId':initial_id,'selectedDaemonSourceMapping':selected,'literalRequestedPaths':{'input':str(Q),'helper':str(P)},'HostConfigMounts':obj['HostConfig']['Mounts'],'actualMounts':obj['Mounts']})
 row,raw,_=command('public-readonly-run',[DOCKER,'start','--attach',NAME],60,required=False);result=json.loads(raw)
 assert row['exitCode']==0 and result['status']=='PASS' and len(result['rows'])==3
 _,raw,_=command('terminal-inspect',[DOCKER,'inspect',NAME]);obj=json.loads(raw)[0];assert recipe(obj,selected,initial_id)==selected;assert type(obj['State']['ExitCode']) is int and obj['State']['ExitCode']==0
 success=True
except BaseException as e:failure=type(e).__name__
finally:
 try:
  row,raw,err=command('cleanup-inspect',[DOCKER,'inspect',NAME],required=False)
  if row['exitCode']==0:
   obj=json.loads(raw)[0];owned(obj)
   if obj['State']['Running']:command('cleanup-kill',[DOCKER,'kill',NAME])
   _,raw,_=command('cleanup-terminal',[DOCKER,'inspect',NAME]);terminal=json.loads(raw)[0];owned(terminal);assert terminal['Id']==obj['Id'] and terminal['State']['Running'] is False
   command('cleanup-remove',[DOCKER,'rm',NAME])
   row,raw,err=command('cleanup-absence',[DOCKER,'inspect',NAME],required=False);assert row['exitCode']==1 and json.loads(raw)==[] and err.strip().lower()==('error: no such object: '+NAME).encode()
  else:assert row['exitCode']==1 and json.loads(raw)==[] and err.strip().lower()==('error: no such object: '+NAME).encode()
 except BaseException as e:cleanup.append({'phase':'owned-container','class':type(e).__name__})
 try:
  _,raw,_=command('owned-running-absence',[DOCKER,'ps','--quiet','--filter','label=cortex.operation='+OP]);assert raw.strip()==b''
  until=C.datetime.datetime.now(C.datetime.timezone.utc).isoformat();command('owned-events',[DOCKER,'events','--since',records[0]['observedAtUtc'],'--until',until,'--filter','label=cortex.operation='+OP,'--format','{{json .}}'])
 except BaseException as e:cleanup.append({'phase':'owned-resource-receipts','class':type(e).__name__})
 outcome={'scope':'ACTUAL_PUBLIC_READONLY_MOUNT_DIAGNOSTIC_ONLY','status':'PASS' if success and not cleanup else 'FAIL','operation':OP,'container':NAME,'created':created,'containerId':initial_id,'selectedDaemonSourceMapping':selected,'literalRequestedPaths':{'input':str(Q),'helper':str(P)},'image':IMAGE,'sourceFiles':expected,'failureClass':failure,'cleanupErrors':cleanup,'privateReads':0,'privateStats':0,'serviceCalls':0,'volumesCreatedOrMutated':0,'public1912Acquisition':False,'privateCoordinatorExecuted':False,'sourceAccepted':False,'Task03Accepted':False,'commands':records}
 C.durable_json(OUT/'outcome.json',outcome)
print(json.dumps({k:v for k,v in outcome.items() if k not in ('commands','sourceFiles')}))
raise SystemExit(0 if outcome['status']=='PASS' else 1)
