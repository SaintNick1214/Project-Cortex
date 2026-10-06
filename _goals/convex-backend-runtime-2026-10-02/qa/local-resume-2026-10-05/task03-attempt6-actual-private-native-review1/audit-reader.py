"""Prepared independent audit. Import is effect-free; every actual phase needs Root handoff.

No current target/tuple/time is borrowed from attempt5. Only exact reviewed source is reused.
No RPC, service, CLI, provisioning or target deletion is performed by this reader.
"""
import argparse, base64, datetime, hashlib, json, os, stat, sys, time, types, zlib
from pathlib import Path

R=Path('/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion')
P=R/'_goals/convex-backend-runtime-2026-10-02/qa/local-resume-2026-10-05'
F=P/'task03-attempt6-integrated-repair1';A=P/'task03-attempt6-actual-private-native-review1'
Q=P.parent/'task03-local-native-attempt6-2026-10-06'
S=Path('/Users/SaintNick/.codex/tmp/cortex-runtime-task03-attempt6-private-20261006')
OP='c9fbaa34-8ca8-4153-b8bd-1cfe60a8241f';V='cortex-task03-attempt6-fixture-20261006-c9fbaa34'
REVIEW_OP='85471870-09f4-4e9b-8b31-bc08ee00bc30'
IMAGE='sha256:9ff43bfe7849197a6dfbaa80f2d11a34db4202d8aaae269ddc8b740f7da75fb3'
FREEZE='115e417419ab7b55e9fdbad97e51513f9f24a8e523c7b344168a63c92d8e968c'
MF_SHA='d9e5929e79d682ae2f4e3dfaad4e2fce01e81f09746a8e3f38b094ebaaf330fc'
MF_NINE={'dev':'16777234','ino':'92485029','mode':'33188','uid':'501','gid':'20','nlink':'1','size':'3600048','mtime_ns':'1791315825141739630','ctime_ns':'1791315831198051729'}
OBSERVER_SHA='757a33939f1df48ba0105e6ef74ccfb882910dc661487ac8c9f18419d636ca4f'
REQUEST_SHA='9cc20b8a5e00cd65985cfed8c4049273e6c0bc689b29a5b5aa521702fc949200'
FIELDS=('dev','ino','mode','uid','gid','nlink','size','mtime_ns','ctime_ns')
ST_FIELDS={'st_'+f:f for f in FIELDS};PRIVATE_NAMES=['jwt-private.pem','target.json','deploy.env']
PASS_FIELDS=('nativeSourceOriginalNineFullEOFHashSize','destinationOriginalNineFullEOFHashSize','hostOriginalStageOriginalNineFullEOFHashSize','rsa2048','privateKeyMatchesFrozenSingleJWK','RS256SignVerify','changedMessageNegativeControl','environmentMatchesOwnedDevTarget','requestAndProvisionOwnership','freshIsolatedCloudDevelopmentTarget','originalSourceClosureAllNineFullEOFHashSize')
LABELS={'cortex.operation':REVIEW_OP,'cortex.scope':'independent-attempt6-private-native-audit-only','cortex.parent-operation':OP}
NAMES={k:'cortex-task03-attempt6-review-'+k+'-'+REVIEW_OP[:8] for k in ('crypto','native')}
DOCKER='/usr/local/bin/docker'
ENV={'HOME':'/Users/SaintNick','PATH':'/usr/local/bin:/usr/bin:/bin','LANG':'C.UTF-8','CORTEX_COORDINATOR_CWD':str(R)}

def strict(raw):
 def pairs(items):
  value={}
  for k,v in items:
   assert k not in value,'duplicate_json';value[k]=v
  return value
 return json.loads(raw,object_pairs_hook=pairs,parse_constant=lambda x:(_ for _ in ()).throw(ValueError('nonfinite_json')))
def sha(raw):return hashlib.sha256(raw).hexdigest()
def utc():return datetime.datetime.now(datetime.timezone.utc)
def stamp(value):
 d=datetime.datetime.fromisoformat(value.replace('Z','+00:00'));assert d.tzinfo is not None;return d
def identity(s):return {f:str(getattr(s,'st_'+f))for f in FIELDS}
def named_nine(value):
 assert type(value)is dict
 v={ST_FIELDS.get(k,k):x for k,x in value.items()}
 assert set(v)==set(FIELDS)and all(type(x)is str and x.isdecimal() for x in v.values())
 return v
def durable(path,value):
 assert path.is_relative_to(A)and path.resolve()==path
 raw=(json.dumps(value,indent=2,ensure_ascii=False)+'\n').encode()
 fd=os.open(path,os.O_WRONLY|os.O_CREAT|os.O_EXCL|os.O_NOFOLLOW,0o600)
 try:
  with os.fdopen(fd,'wb')as f:f.write(raw);f.flush();os.fsync(f.fileno())
 finally:pass
 d=os.open(path.parent,os.O_RDONLY|os.O_DIRECTORY|os.O_NOFOLLOW)
 try:os.fsync(d)
 finally:os.close(d)
 return sha(raw)

class Cohort:
 def __init__(self):self.rows=[]
 def open(self,path,limit=16777216,private=False,directory=False):
  path=Path(path);assert path.is_absolute()and (path.is_relative_to(R)or private and path.is_relative_to(S))
  before=path.lstat();fd=os.open(path,os.O_RDONLY|os.O_NOFOLLOW|(os.O_DIRECTORY if directory else 0))
  row={'path':str(path),'originalNine':identity(before),'fd':fd,'limit':limit,'directory':directory,'private':private};self.rows.append(row)
  assert identity(os.fstat(fd))==row['originalNine'];return row
 def read(self,row):
  path=Path(row['path']);cursor=Path('/')
  for part in path.parts[1:]:
   cursor/=part;s=cursor.lstat();assert not stat.S_ISLNK(s.st_mode)and cursor.resolve()==cursor
   if cursor!=path:assert stat.S_ISDIR(s.st_mode)
  pin=row['originalNine'];s=path.lstat();assert identity(s)==identity(os.fstat(row['fd']))==pin
  assert s.st_uid==501 and s.st_gid==20
  assert stat.S_ISDIR(s.st_mode)if row['directory']else stat.S_ISREG(s.st_mode)and s.st_nlink==1
  if row['private']:assert stat.S_IMODE(s.st_mode)==(0o700 if row['directory']else 0o600)
  if row['directory']:return None
  assert 0<=s.st_size<=row['limit'];buf=bytearray();offset=0
  while data:=os.pread(row['fd'],65536,offset):
   buf.extend(data);offset+=len(data);assert len(buf)<=s.st_size and len(buf)<=row['limit']
  assert len(buf)==s.st_size and identity(path.lstat())==identity(os.fstat(row['fd']))==pin
  result=bytes(buf);h=sha(result)
  if 'sha256'in row:assert h==row['sha256']and len(result)==row['bytes']
  else:row.update(sha256=h,bytes=len(result),fullEOF=True)
  return result
 def closecheck(self):
  for row in self.rows:self.read(row)
  return {'status':'PASS_ALL_ORIGINAL_NINE_FULL_EOF_HASH_SIZE','files':[self.clean(r)for r in self.rows if not r['directory']],'directories':[self.clean(r)for r in self.rows if r['directory']]}
 def close(self):
  for row in self.rows:os.close(row['fd'])
  self.rows=[]
 @staticmethod
 def clean(row):return {k:v for k,v in row.items()if k in ('path','originalNine','sha256','bytes','fullEOF','directory')}

def compiled(row,raw,name):
 m=types.ModuleType(name);m.__file__=row['path'];m.__package__='';exec(compile(raw,row['path'],'exec',dont_inherit=True),m.__dict__);return m

def qualify_source(c,h):
 # All original source pins remain from SOURCE2. No refreshed historical or self-output PRE.
 mrow=c.open(F/'prospective-source-manifest-final.json');assert mrow['originalNine']==MF_NINE
 mraw=c.read(mrow);assert sha(mraw)==MF_SHA;mf=strict(mraw)
 assert mf['scope']=='TASK03_ATTEMPT6_REPAIR1_NEW_PROSPECTIVE_SOURCE_CLOSURE_ONLY'and mf['sourceWriters']=='STOPPED'
 assert mf['historicalD101OriginalCustody']=='FAILED_UNKNOWN_ONE_CTIME_NOT_REPAIRED'
 assert len(mf['files'])==2352 and len({r['path']for r in mf['files']})==2352
 assert sum(r['bytes']for r in mf['files'])==66622509<=67108864
 opened=[(expected,c.open(R/expected['path']))for expected in mf['files']]
 # No member content before all original-nine descriptors are captured.
 bodies={};source_rows={}
 for expected,row in opened:
  assert row['originalNine']==expected['PRE'];raw=c.read(row)
  assert row['sha256']==expected['sha256']and row['bytes']==expected['bytes'];bodies[expected['path']]=raw;source_rows[expected['path']]=row
 ar=c.open(F/'integrated-source-review.json',limit=1048576);araw=c.read(ar);assert sha(araw)==h['sourceApprovalSha256'];a=strict(araw)
 assert a['scope']=='TASK03_ATTEMPT6_INTEGRATED_REPAIR1_SOURCE_ONLY'and a['verdict']=='PASS'and a['independent']is True
 assert a['sourceManifestSha256']==MF_SHA and a['sourceManifestOriginalNine']==MF_NINE and a['candidateSha256']==FREEZE
 assert a['sources']=={r['path']:r['sha256']for r in mf['files']}
 def module(path,name):
  key=str(path.relative_to(R));m=compiled(source_rows[key],bodies[key],name);c.read(source_rows[key]);return m
 G=module(F/'source-gates-final.py','actual_current_source_gate');released=G.qualify_public_release()
 assert released['binding']['operation']==OP and released['binding']['volume']==V and released['binding']['freezeSha256']==FREEZE
 C=module(Q/'integrated/coordinate-common.py','actual_current_bounded_common')
 D=module(F/'official-dispatcher-final.py','actual_current_dispatcher_semantics')
 PC=module(F/'private-coordinate-final.py','actual_current_private_recipe_semantics')
 source_binding_consistency(bodies)
 c.closecheck();return C,D,PC,bodies

def source_binding_consistency(bodies):
 request=strict(bodies[str((Q/'project-request.json').relative_to(R))]);binding=strict(bodies[str((Q/'transport-prep/transport-binding.json').relative_to(R))])
 assert sha(json.dumps(request,ensure_ascii=False,separators=(',',':')).encode())==REQUEST_SHA==binding['requestSha256']
 for key in ('operation','projectSlug','projectName','teamId','privateEnvironmentFile'):
  assert binding[key]==request[key],'original_unchanged_T_binding_target_current_request_mismatch:'+key

def validate_handoff(h,stage):
 assert type(h)is dict and h['authorizedByRoot']is True and h['stage']==stage
 assert h['operation']==OP and h['volume']==V and h['immutableImage']==IMAGE and h['candidateSha256']==FREEZE
 assert h['sourceManifestSha256']==MF_SHA
 assert type(h['sourceApprovalSha256'])is str and len(h['sourceApprovalSha256'])==64 and all(x in '0123456789abcdef'for x in h['sourceApprovalSha256'])
 assert h['preparedReaderPlanSha256']==sha((A/'audit-plan.json').read_bytes())

def observe_window(c,h,out):
 if h['stage']=='PRIVATE':
  srow=c.open(F/'runtime/coordinator-status.json',limit=65536);raw=c.read(srow);assert sha(raw)==h['initialTransferStatusSha256'];s=strict(raw)
  assert s['operation']==OP and s['volume']==V and s['candidateSha256']==FREEZE and s['phase']=='ACTUAL_PRIVATE_TRANSFER_AWAITING_INDEPENDENT_REVIEW'and s['status']=='HELD'
  assert s['privateFilesTransferred']==3 and s['nativeSourceFiles']==4 and s['cliDispatched']is False and s['actualPrivateCryptographicAcceptance']is False
  start=stamp(s['observedAtUtc']);end=start+datetime.timedelta(seconds=2400)
  v={'scope':'ORIGINAL_FIRST_TRANSFER_2400_SECOND_WINDOW_NOT_REFRESHABLE','operation':OP,'initialTransferStatusSha256':sha(raw),'firstTransferStatus':s,'startUtc':start.isoformat(),'endUtc':end.isoformat(),'seconds':2400,'cryptoRootReleaseLatestUtc':(end-datetime.timedelta(seconds=2050)).isoformat()}
  digest=durable(out/'original-window.json',v)
  return end,time.monotonic()+(end-utc()).total_seconds(),digest
 row=c.open(A/'private/original-window.json',limit=65536);raw=c.read(row);assert sha(raw)==h['originalWindowSha256'];v=strict(raw)
 assert v['scope']=='ORIGINAL_FIRST_TRANSFER_2400_SECOND_WINDOW_NOT_REFRESHABLE'and v['operation']==OP and v['seconds']==2400
 start=stamp(v['startUtc']);end=stamp(v['endUtc']);assert end-start==datetime.timedelta(seconds=2400)
 return end,time.monotonic()+(end-utc()).total_seconds(),sha(raw)

def prepare_specs():
 mounts=[{'Type':'bind','Source':str(A),'Target':'/review','ReadOnly':True},{'Type':'volume','Source':V,'Target':'/owned','ReadOnly':True,'VolumeOptions':{'NoCopy':True}},{'Type':'volume','Source':V,'Target':'/prep','ReadOnly':True,'VolumeOptions':{'NoCopy':True,'Subpath':'candidate'}}]
 env=['/usr/bin/env','-i','PATH=/usr/local/bin:/usr/bin:/bin','HOME=/tmp','TMPDIR=/tmp','LANG=C.UTF-8','CI=1','NO_COLOR=1','/usr/local/bin/node']
 return {k:{'name':NAMES[k],'mounts':mounts,'cmd':[*env,'/review/'+('independent-private-observer.mjs'if k=='crypto'else'native-evidence-collector.mjs')]}for k in NAMES}

def exact_recipe(o,spec,cid=None,mapping=None,terminal=False):
 assert o['Name']=='/'+spec['name']and o['Config']['Labels']==LABELS and o['Image']==o['Config']['Image']==IMAGE
 assert type(o['Id'])is str and len(o['Id'])==64 and all(x in '0123456789abcdef'for x in o['Id'])
 if cid is not None:assert o['Id']==cid
 assert o['Platform']=='linux'and o['Config']['User']=='501:20'and o['Config']['WorkingDir']=='/tmp'
 assert o['Config']['Entrypoint']is None and type(o['Config']['Cmd'])is list and o['Config']['Cmd']==spec['cmd']and all(type(x)is str for x in o['Config']['Cmd'])
 for k,v in [('Tty',False),('OpenStdin',False),('StdinOnce',False)]:assert type(o['Config'][k])is bool and o['Config'][k]is v
 h=o['HostConfig']
 assert h['NetworkMode']=='none'and h['Binds']is None and h['PortBindings']=={}and h['VolumesFrom']is None
 assert h['CapAdd']in(None,[])and h['CapDrop']in(None,[])and h['Devices']==[]and h['SecurityOpt']is None
 for k,v in [('Memory',536870912),('MemorySwap',536870912),('PidsLimit',64),('NanoCpus',2000000000)]:assert type(h[k])is int and h[k]==v
 for k,v in [('ReadonlyRootfs',True),('Privileged',False),('AutoRemove',False),('PublishAllPorts',False)]:assert type(h[k])is bool and h[k]is v
 assert h['Tmpfs']=={'/tmp':'rw,noexec,nosuid,size=67108864,mode=0700,uid=501,gid=20'}
 choices=[]
 for prefix in ('','/host_mnt'):
  wanted=[{**m,'Source':prefix+m['Source']}if m['Type']=='bind'else m for m in spec['mounts']]
  if h['Mounts']==wanted:choices.append(prefix)
 assert len(choices)==1
 if mapping is not None:assert choices[0]==mapping
 for m in h['Mounts']:
  assert type(m['ReadOnly'])is bool and m['ReadOnly']is True
  if m['Type']=='volume':assert type(m['VolumeOptions']['NoCopy'])is bool and m['VolumeOptions']['NoCopy']is True
 actual={m['Destination']:m for m in o['Mounts']};assert len(actual)==len(o['Mounts'])==len(spec['mounts'])
 for m in spec['mounts']:
  a=actual[m['Target']];assert a['Type']==m['Type']and type(a['RW'])is bool and a['RW']is False
  if m['Type']=='bind':assert a['Source']==choices[0]+m['Source']
  else:assert a['Name']==m['Source']and a['Driver']=='local'and a['Source']=='/var/lib/docker/volumes/'+m['Source']+'/_data'
 s=o['State'];assert type(s['Running'])is bool and s['Running']is False and type(s['Pid'])is int and s['Pid']==0
 assert type(s['OOMKilled'])is bool and s['OOMKilled']is False and type(s['ExitCode'])is int and type(s['Error'])is str and s['Error']==''
 assert s['Status']==('exited'if terminal else'created')and s['ExitCode']==0
 return choices[0]

class Runner:
 def __init__(self,C,out,end):self.C=C;self.out=out;self.end=end;self.rows=[];self.owned={};self.cleanup_errors=[]
 def run(self,label,args,timeout=30,required=True):
  start=time.monotonic();assert start+timeout<=self.end,'entire_independent_command_window_not_admitted'
  row,out,err=self.C.run(label,args,self.out/'raw',timeout,ENV,required=False);self.rows.append(row)
  assert time.monotonic()<=start+timeout and time.monotonic()<=self.end
  assert row['terminal']is True and row['failureClass']is None and row['closeErrors']==[]and row['ownedGroup']['absenceObserved']is True
  assert type(row['exitCode'])is int
  if required:assert row['exitCode']==0
  return row,out,err
 def inspect(self,cid,label):
  _,raw,err=self.run(label,[DOCKER,'inspect',cid]);assert err==b'';v=strict(raw);assert type(v)is list and len(v)==1;return v[0]
 def absent(self,name,label):
  row,raw,err=self.run(label,[DOCKER,'inspect',name],required=False)
  assert row['exitCode']==1 and raw==b'[]\n'and err.strip().lower()==('error: no such object: '+name).encode()
 def create(self,key,spec):
  self.absent(spec['name'],key+'-initial-absence')
  args=[DOCKER,'create','--name',spec['name'],'--platform','linux/amd64','--network','none','--memory','536870912','--memory-swap','536870912','--cpus','2','--pids-limit','64','--read-only','--user','501:20','--workdir','/tmp','--tmpfs','/tmp:rw,noexec,nosuid,size=67108864,mode=0700,uid=501,gid=20']
  for k,v in LABELS.items():args+=['--label',k+'='+v]
  for m in spec['mounts']:
   mount='type='+m['Type']+',source='+m['Source']+',target='+m['Target']+',readonly'
   if m['Type']=='volume':
    mount+=',volume-nocopy'
    if 'Subpath'in m['VolumeOptions']:mount+=',volume-subpath='+m['VolumeOptions']['Subpath']
   args+=['--mount',mount]
  _,raw,err=self.run(key+'-create',args+[IMAGE,*spec['cmd']]);assert err==b'';cid=raw.decode().strip();assert len(cid)==64 and all(x in '0123456789abcdef'for x in cid)
  self.owned[key]={**spec,'containerId':cid};o=self.inspect(cid,key+'-prepared-inspect');mapping=exact_recipe(o,spec,cid)
  self.owned[key]['mapping']=mapping;return self.owned[key]
 def execute(self,key,spec):
  cid=spec['containerId'];self.owned[key]=spec;o=self.inspect(cid,key+'-pre-start');exact_recipe(o,spec,cid,spec['mapping'])
  started=time.monotonic();row,raw,err=self.run(key+'-run',[DOCKER,'start','--attach',cid],120)
  terminal=self.inspect(cid,key+'-terminal');exact_recipe(terminal,spec,cid,spec['mapping'],True);assert err==b''and row['exitCode']==0
  self.run(key+'-remove',[DOCKER,'rm',cid]);self.absent(cid,key+'-removed-absence');del self.owned[key]
  return raw,time.monotonic()-started
 def closecheck(self):
  assert self.owned=={}and self.cleanup_errors==[]
  return {'status':'PASS','commands':self.rows,'cleanupErrors':[],'ownedContainersRemaining':[],'network':'none','volumeWrites':0,'serviceCalls':0}
 def cleanup(self):
  # Never act on an unknown CID or a container whose exact owned recipe changed.
  for key,spec in list(self.owned.items()):
   try:
    cid=spec['containerId'];o=self.inspect(cid,'failure-'+key+'-inspect')
    running=o['State']['Running'];assert type(running)is bool
    if running:
     stopped=dict(o);stopped['State']={**o['State'],'Running':False,'Pid':0,'Status':'created','ExitCode':0,'Error':''};exact_recipe(stopped,spec,cid,spec.get('mapping'))
     self.run('failure-'+key+'-kill',[DOCKER,'kill',cid])
     o=self.inspect(cid,'failure-'+key+'-terminal')
    # Nonzero actual exits may be cleaned, but remain a failed audit.
    checked=dict(o);checked['State']={**o['State'],'Status':'exited','ExitCode':0};exact_recipe(checked,spec,cid,spec.get('mapping'),True)
    self.run('failure-'+key+'-remove',[DOCKER,'rm',cid]);self.absent(cid,'failure-'+key+'-absence');del self.owned[key]
   except BaseException as e:self.cleanup_errors.append({'key':key,'class':type(e).__name__})

def read_prepared(c,h):
 row=c.open(A/'prepare/prepared-observers.json',limit=65536);raw=c.read(row);assert sha(raw)==h['preparedObserversSha256'];v=strict(raw)
 assert v['operation']==OP and v['reviewOperation']==REVIEW_OP and v['status']=='PREPARED_NOT_STARTED'
 expected=prepare_specs()
 for k,spec in v['specs'].items():
  assert k in expected and {n:spec[n]for n in ('name','mounts','cmd')}==expected[k]
 assert set(v['specs'])==set(expected);return v['specs']

def raw_receipts(c,labels):
 handles=[(label,c.open(S/'coordination'/(label+'.receipt.json'),262144,True),c.open(S/'coordination'/(label+'.stdout'),262144,True),c.open(S/'coordination'/(label+'.stderr'),262144,True))for label in labels]
 result={}
 for label,receipt,out,err in handles:
  row=strict(c.read(receipt));stdout=c.read(out);stderr=c.read(err)
  assert row['label']==label and row['terminal']is True and row['failureClass']is None and row['closeErrors']==[]and row['ownedGroup']['absenceObserved']is True
  assert type(row['exitCode'])is int and row['pipeLimits']==262144 and row['stdinLimit']==327692 and row['stdinDeadlineSeconds']==12
  assert type(row['elapsedSeconds'])in(int,float)and 0<=row['elapsedSeconds']<=190
  if '-absence'not in label:assert row['exitCode']==0 and stderr==b''
  for kind,r in [('stdout',out),('stderr',err)]:assert row[kind+'Sha256']==r['sha256']and type(row['streamByteCounts'][kind])is int and row['streamByteCounts'][kind]==r['bytes']
  result[label]=(row,stdout,stderr)
 return result
def one_inspect(raw):
 v=strict(raw);assert type(v)is list and len(v)==1;return v[0]
def current_target(target,owned,attempt,request,binding):
 assert type(target)is dict and set(target)==set(request['targetFields'])
 assert sha(json.dumps(request,ensure_ascii=False,separators=(',',':')).encode())==REQUEST_SHA==binding['requestSha256']
 for v in (target,owned,attempt):assert v['operation']==OP and v['requestSha256']==REQUEST_SHA
 assert type(owned['id'])is int and owned['id']>0 and target['projectId']==owned['id']and target['deploymentName']==owned['deploymentName']
 assert target['projectSlug']==owned['slug']==request['projectSlug']and target['projectName']==owned['requestedName']==request['projectName']
 for k in ('operation','purpose','teamId','privateEnvironmentFile'):assert target[k]==request[k]
 for k in ('operation','requestSha256','projectSlug','projectName','teamId','privateEnvironmentFile'):assert target[k]==binding[k]
 for k in ('active','isolationVerified','freshManagedProject'):assert target[k]is True
 for k in ('retired','deleted','productionDeployment','sharedCiTarget'):assert target[k]is False
 assert target['kind']==request['requiredKind']=='cloud'and target['deploymentType']==request['requiredDeploymentType']=='dev'
 assert type(request['maximumPaidCalls'])is int and request['maximumPaidCalls']==0 and request['retirementRequired']is True
 assert request['productionDeployment']is False and request['sharedCiTarget']is False
 assert target['deploymentName']not in binding['forbiddenRetiredDeployments']and target['deploymentUrl']=='https://'+target['deploymentName']+'.convex.cloud'

def validate_crypto_observation(value,original,staged,target):
 assert value['scope']=='ACTUAL_PRIVATE_CUSTODY_CRYPTO_ENV_TARGET_ONLY'and value['status']=='PASS'and value['operation']==OP
 assert value['nativeSourceFiles']==4 and value['privateDestinationFiles']==3
 for k in ('sourceOriginalNineFullEOFHashSize','destinationOriginalNineFullEOFHashSize','currentDescriptorsHeldThroughFinal','allPrivateSourceDestinationFullBytes','nativeSourceDirectoryOriginalNine','destinationDirectoryCurrentNine','ownedMode600Nlink1NoAliases','rsa2048','privateKeyMatchesFrozenSingleJwk','rs256SignVerify','changedMessageRejected','kidIssuerAudienceAuthConfigMatch','envSelectorMatchesOwnedDevTarget','freshIsolatedCloudDev'):assert value[k]is True
 for k in ('productionSharedLocalTargets','privateBytesPrinted','officialCliDispatched','nativeFoundationAccepted','fullTask03'):assert value[k]is False
 for k in ('maximumPaidCalls','externalRequests','serviceDeployments','volumeWrites','jwtTokensCreated'):assert type(value[k])is int and value[k]==0
 assert type(value['exactEnvironmentEntries'])is int and value['exactEnvironmentEntries']==3
 for key,rows in [('sourceFiles',staged),('destinationFiles',original)]:
  observed=value[key];assert [r['name']for r in observed]==list(rows)
  for r in observed:assert r['sha256']==rows[r['name']]['sha256']and r['bytes']==rows[r['name']]['bytes']and r['fullEOF']is True and set(named_nine(r['identityDecimal']))==set(FIELDS)
 binding={k:target[k]for k in ('projectId','deploymentName','projectSlug','requestSha256')};assert value['targetBindingHash']==sha(json.dumps(binding,separators=(',',':')).encode())

def private_audit(c,h,out,end,end_mono,C,D,PC,bodies):
 assert end_mono-time.monotonic()>=2050+270,'independent_crypto_observer_and_publication_reserve_not_admitted'
 run=Runner(C,out,end_mono-2050);specs=read_prepared(c,h)
 hostrow=c.open(S/'coordination/host-source-custody.json',65536,True);host=strict(c.read(hostrow))
 assert host['operation']==OP and host['status']=='PASS'and host['hostDescriptorsHeldThroughTerminalAndDurableReceipt']is True and host['actualPrivateCryptographicAcceptance']is False
 assert [r['name']for r in host['originalFiles']]==PRIVATE_NAMES and [r['name']for r in host['stageFiles']]==PRIVATE_NAMES+['transport-stage.json']
 stage=S/('actual-private-export-'+OP)/'selected'
 root=c.open(S,private=True,directory=True);directory=c.open(stage,private=True,directory=True)
 orig={r['name']:c.open(S/r['name'],65536,True)for r in host['originalFiles']};staged={r['name']:c.open(stage/r['name'],65536,True)for r in host['stageFiles']}
 # Capture all original/stage descriptors before first private-source content qualification.
 c.read(root);c.read(directory);assert root['originalNine']==named_nine(host['originalDirectoryIdentityDecimal'])and directory['originalNine']==named_nine(host['stageDirectoryIdentityDecimal'])
 assert sorted(os.listdir(directory['fd']))==sorted(staged)
 data={}
 for rows,expected in ((orig,host['originalFiles']),(staged,host['stageFiles'])):
  for e in expected:
   row=rows[e['name']];data[row['path']]=c.read(row);assert row['originalNine']==named_nine(e['identityDecimal'])and row['sha256']==e['sha256']and row['bytes']==e['bytes']
 stage_row=c.open(S/'coordination/host-stage-custody.json',65536,True);stage_value=strict(c.read(stage_row))
 assert strict(data[staged['transport-stage.json']['path']])==stage_value and stage_value['operation']==OP and stage_value['sourceDescriptorHeld']is True and stage_value['actualServiceRequests']==0
 assert [r['path']for r in stage_value['files']]==PRIVATE_NAMES
 for e in stage_value['files']:
  before,after=orig[e['path']],staged[e['path']];assert before['originalNine']==named_nine(e['sourceIdentityDecimal'])and after['originalNine']==named_nine(e['destinationIdentityDecimal'])
  assert before['sha256']==after['sha256']==e['sha256']and before['bytes']==after['bytes']==e['bytes']and data[before['path']]==data[after['path']]
 target=strict(data[orig['target.json']['path']]);owned=strict(c.read(c.open(S/'created-project.json',65536,True)));attempt=strict(c.read(c.open(S/'provision-attempt.json',65536,True)))
 request=strict(bodies[str((Q/'project-request.json').relative_to(R))]);binding=strict(bodies[str((Q/'transport-prep/transport-binding.json').relative_to(R))]);current_target(target,owned,attempt,request,binding)
 provision=strict(c.read(c.open(F/'task03-attempt6-target-provision.json',65536)))
 assert provision['operation']==OP and provision['requestSha256']==REQUEST_SHA and provision['projectId']==target['projectId']and provision['deploymentName']==target['deploymentName']
 assert provision['kind']=='cloud'and provision['deploymentType']=='dev'and provision['isolationVerified']is True and provision['privateCredentialsPrinted']is False
 assert type(provision['managementCalls'])is int and 0<provision['managementCalls']<=7
 labels=['private-receiver-create','private-receiver-initial-inspect','linux-selector-create','linux-selector-pre-provision-inspect','provision','private-receiver-current-inspect','private-receiver','private-receiver-terminal-inspect',*['received-'+x+'-'+PC.NAME for x in ('inspect','terminal','remove','absence')],*['official-crypto-'+x for x in ('create','prepared-inspect','pre-start','run','terminal','remove','removed-absence')]]
 raw=raw_receipts(c,labels)
 receiver=PC.receiver_command();selector=['/usr/local/bin/python3.12','-B','-c',bodies[str((Q/'integrated/retire-selector.py').relative_to(R))].decode()]
 for name,create,inspect_label,command,issel in [(PC.NAME,'private-receiver-create','private-receiver-initial-inspect',receiver,False),(PC.SELECTOR_NAME,'linux-selector-create','linux-selector-pre-provision-inspect',selector,True)]:
  cid=raw[create][1].decode().strip();PC.OWNED_IDS[name]=cid;PC.OWNED_COMMANDS[name]=command;PC.assert_recipe(one_inspect(raw[inspect_label][1]),name,selector=issel)
 for label,initial in [('private-receiver-current-inspect',True),('private-receiver-terminal-inspect',False),('received-inspect-'+PC.NAME,False),('received-terminal-'+PC.NAME,False)]:PC.assert_recipe(one_inspect(raw[label][1]),PC.NAME,initial=initial)
 received=strict(raw['private-receiver'][1]);assert received['status']=='PASS'and received['sourceFiles']==4 and received['copiedFiles']==3 and received['nativeAllNineAndFullContents']is True
 ar,stdout,stderr=raw['received-absence-'+PC.NAME];assert ar['exitCode']==1 and stdout==b'[]\n'and stderr.strip().lower()==('error: no such object: '+PC.NAME).encode()
 p_spec=strict(c.read(c.open(S/'coordination/crypto-prepared-recipe.json',65536,True)));cid=raw['official-crypto-create'][1].decode().strip();assert p_spec['containerId']==cid
 assert p_spec['name']=='cortex-task03-attempt6-crypto-'+OP[:8]
 assert p_spec['cmd']==['/usr/bin/env','-i','PATH=/usr/local/bin:/usr/bin:/bin','HOME=/tmp','TMPDIR=/tmp','LANG=C.UTF-8','CI=1','NO_COLOR=1','/usr/local/bin/node','/control/linux-private-custody-crypto-observer.mjs']
 assert p_spec['mounts']==[{'Type':'volume','Source':V,'Target':'/owned','ReadOnly':True,'VolumeOptions':{'NoCopy':True}},{'Type':'volume','Source':V,'Target':'/prep','ReadOnly':True,'VolumeOptions':{'NoCopy':True,'Subpath':'candidate'}},{'Type':'bind','Source':str(Q/'integrated'),'Target':'/control','ReadOnly':True}]
 D.owned[p_spec['name']]=cid
 for label,terminal in [('official-crypto-prepared-inspect',False),('official-crypto-pre-start',False),('official-crypto-terminal',True)]:
  o=one_inspect(raw[label][1]);D.crypto_recipe(o,p_spec);assert o['State']['Status']==('exited'if terminal else'created')and o['State']['Running']is False and o['State']['Pid']==0 and type(o['State']['ExitCode'])is int and o['State']['ExitCode']==0 and o['State']['Error']==''
 producer=strict(raw['official-crypto-run'][1]);published=strict(c.read(c.open(F/'runtime/actual-private-crypto-observation.json',262144)));assert published==producer
 validate_crypto_observation(producer,orig,staged,target)
 ar,stdout,stderr=raw['official-crypto-removed-absence'];assert ar['exitCode']==1 and stdout==b'[]\n'and stderr.strip().lower()==('error: no such object: '+cid).encode()
 try:
  actual,elapsed=run.execute('crypto',specs['crypto']);observed=strict(actual);assert elapsed>=20;validate_crypto_observation(observed,orig,staged,target)
  assert observed==producer,'same_current_native_tuples_bytes_crypto_env_target_required'
  durable(out/'independent-current-private-observation.json',observed)
  closure=c.closecheck();assert utc()<end-datetime.timedelta(seconds=2050)and time.monotonic()<end_mono-2050
  commands=run.closecheck();durable(out/'commands.json',commands);durable(out/'held-closure.json',closure)
  decision={'verdict':'PASS','independent':True,'scope':'ACTUAL_PRIVATE_CUSTODY_CRYPTO_ENV_TARGET_ONLY','operation':OP,'volume':V,'immutableImage':IMAGE,'candidateSha256':FREEZE,'sourceManifestSha256':MF_SHA,'privateSourceApprovalSha256':h['sourceApprovalSha256'],'actualObserverSha256':OBSERVER_SHA,'actualPrivateCustodyCryptoEnvTargetAccepted':True,'maximumPaidCalls':0,'productionSharedOrLocalTarget':False,**{k:'PASS'for k in PASS_FIELDS},'firstTransferStatusSha256':h['initialTransferStatusSha256'],'originalDeadlineUtc':end.isoformat(),'latestRootReleaseUtc':(end-datetime.timedelta(seconds=2050)).isoformat(),'independentObservationHeldSeconds':20,'actualNativeOutcomeAccepted':False,'fullTask03':False,'goalAccepted':False,'historicalCustodyRepaired':False,'evaluatedAtUtc':utc().isoformat()}
  D.bind_crypto_gate(decision,h['sourceApprovalSha256'],MF_SHA,OBSERVER_SHA)
  c.closecheck();assert time.monotonic()<end_mono-2050
  digest=durable(out/'decision.json',decision);durable(out/'final-held-closure.json',c.closecheck());assert time.monotonic()<end_mono-2050,'crypto_decision_publication_late'
  return {'status':'PASS','decisionSha256':digest,'latestRootReleaseUtc':decision['latestRootReleaseUtc'],'fullTask03':False}
 except BaseException:
  run.cleanup();durable(out/'failed-commands.json',{'rows':run.rows,'cleanupErrors':run.cleanup_errors,'remaining':list(run.owned)});raise

def compressed(raw):
 assert len(raw)<=262144;e=strict(raw);assert e['encoding']=='gzip+base64'and type(e['decodedBytes'])is int and 0<e['decodedBytes']<=25165824
 zipped=base64.b64decode(e['body'],validate=True);z=zlib.decompressobj(16+zlib.MAX_WBITS);body=z.decompress(zipped,25165825)
 assert len(body)<=25165824 and z.eof and not z.unconsumed_tail and not z.unused_data and len(body)==e['decodedBytes']and sha(body)==e['decodedSha256'];return strict(body)

def validate_native(v,expected,end,start):
 assert v['status']=='PASS'and v['operation']==OP and v['scope']=='ACTUAL_CURRENT_NATIVE_READONLY_EVIDENCE_COLLECTION_ONLY'
 assert v['currentDescriptorsHeldThroughFinal']is True and v['secretFilesRead']==v['serviceCalls']==v['volumeWrites']==0
 rows=v['rows'];assert len(rows)==15 and len({r['path']for r in rows})==15;by={};generated={}
 for row in rows:
  body=base64.b64decode(row['bodyBase64'],validate=True);assert len(body)==row['bytes']and sha(body)==row['sha256']and row['fullEOF']is True;named_nine(row['originalNine'])
  if row['kind']=='generated':generated[row['path'].split('/convex/_generated/')[1]]=row
  else:assert row['kind']not in by;by[row['kind']]=(strict(body)if not row['kind'].endswith('Journal')else [strict(line)for line in body.splitlines()if line])
 assert set(by)=={'deploy','driver','qualify','codegen','caseJournal','caseOutcomes','owned','ownedJournal','pathLedger','lifecycleCoverage'}and set(generated)=={'api.d.ts','api.js','dataModel.d.ts','server.d.ts','server.js'}
 # Receipt elapsed includes mandatory reaping/incidental or native cleanup. The original
 # CLI120/context1200 limits remain in the unchanged reviewed programs, inside these phase ceilings.
 for key,phase,limit in [('deploy','deploy',190000),('driver','owned-current-foundation-driver',1260000),('qualify','current-foundation-native-live',1260000)]:
  item=by[key];assert item['status']=='PASS'and item['phase']==phase and type(item['elapsedMs'])is int and 0<=item['elapsedMs']<=limit
 for key in ('deploy','driver'):
  item=by[key];assert item['exitCode']==0 and item['failureClass']=='none'and start<=stamp(item['startedAt'])<=stamp(item['observedAt'])<end
 assert by['driver']['cleanupComplete']is True and by['qualify']['cleanupComplete']is True
 dc=by['driver']['counts'];assert dc['cleanupRecoveryVerified']==0 and dc['childExitCodeNonnegative']==0 and dc['processesSpawned']==dc['verifiedTerminalGroups']==1 and dc['remainingOwnedGroups']==0
 assert by['deploy']['counts']['ownedGroupsRemaining']==0 and by['deploy']['counts']['verifiedTerminalGroups']==1
 counts=by['qualify']['counts'];expected_counts={'discovered':275,'public':200,'internal':75,'deltaVisibilityCases':32,'deltaNativeControls':16,'deltaHealthyAuthorityControls':2,'deltaRevokedNoEffectControls':1,'negativeCases':1400,'visibilityCases':150,'closureCases':262,'domainClosureCases':10,'functionalCases':130,'blocked':0,'failed':0,'skipped':0,'observedPublicPaths':200,'observedInternalPaths':75}
 assert counts==expected_counts and all(type(x)is int for x in counts.values())
 codegen=by['codegen'];assert codegen['operation']==OP and codegen['officialCodegen']is True and codegen['typecheck']=='enable'and codegen['status']=='PASS'
 assert len(codegen['files'])==5 and {r['path'].split('/_generated/')[1]:r['sha256']for r in codegen['files']}=={name:row['sha256']for name,row in generated.items()}
 ledger=by['pathLedger'];assert ledger['cases']==expected['ledgerCases']and ledger['counts']['registered']==275 and ledger['counts']['public']==200 and ledger['counts']['internal']==75
 journal=by['caseJournal'];assert journal and len(journal)<=10000 and all(start<=stamp(r['observedAt'])<end for r in journal)
 assert all(r.get('status')not in ('FAIL','BLOCKED','SKIP','SKIPPED')for r in journal)
 phase=lambda name:[r for r in journal if r['phase']==name]
 def exact_cases(name,wanted,codes=None,noeffect=True):
  actual=phase(name);assert len(actual)==len(wanted)and len({r['id']for r in actual})==len(actual)and {r['id']:r['paths']for r in actual}==wanted
  for r in actual:
   assert r['status']=='PASS'
   if codes is not None:assert r['observedCode']in codes
   if noeffect:assert r['noEffect']is True
  return actual
 # Durable authorization rows precede snapshot completion; they correctly retain noEffect=false.
 negative=exact_cases('authorization',expected['negative'],{'FORBIDDEN','UNAUTHENTICATED','PLATFORM_UNAUTHENTICATED'},False)
 for r in negative:assert r['expectedCode']=='FORBIDDEN_OR_UNAUTHENTICATED'and r['noEffect']is False and r['identityAlias']==r['id'].split(':')[1]
 exact_cases('authorization-effect-snapshot',expected['negativeSnapshots'],{'NO_EFFECT'})
 exact_cases('internal-visibility',expected['visibility'],{'INTERNAL_ONLY'})
 exact_cases('uniform-unavailability',expected['closure'],{'CAPABILITY_NOT_READY','CAPABILITY_UNAVAILABLE'})
 actual=exact_cases('functional-family',expected['functional'],{'ASSERTED_OWNED_OUTCOME'},False)
 for r in actual:assert type(r['noEffect'])is bool
 exact_cases('current-policy-safe-control',expected['policy'],{'FORBIDDEN','CAPABILITY_UNAVAILABLE'})
 exact_cases('authority-boundaries',expected['authority'],None)
 exact_cases('lifecycle',expected['lifecycle'],None,False)
 current=phase('current-policy-authority');assert len(current)==1 and current[0]['id']=='policy-delta:current-authority-controls'and current[0]['status']=='PASS'and current[0]['noEffect']is True
 revoke=phase('current-policy-revocation');assert len(revoke)==1 and revoke[0]['id']=='policy-delta:revoked-current-grant'and revoke[0]['observedCode']=='FORBIDDEN'and revoke[0]['noEffect']is True and revoke[0]['status']=='PASS'
 rpc=phase('rpc-observation');assert rpc and all(r['status']=='OBSERVED'and r['expectedCode']=='ASSERTED_BY_ENCLOSING_CASE'for r in rpc)
 completed={r['id']for r in journal if r.get('status')=='PASS'}|{'current-policy-delta','authority-boundaries','current-sdk-lifecycle','healthy-owned-batch-fixtures','governance:healthy-scoped-GDPR-template'}
 for row in rpc:assert row['id'].endswith(':rpc')and row['id'][:-4]in completed
 # A platform/missing envelope may be UNRECOGNIZED in an observation. It is never
 # itself a denial PASS; the exact enclosing native assertion and snapshot are required.
 domain=[r for r in rpc if r['id']=='mwd-domain-policy-intermediate:rpc'and r['observedCode']=='CAPABILITY_UNAVAILABLE'];assert len(domain)==10 and all(sum(r['paths']==[path]for r in domain)==5 for path in ('runtimeMemory:remember','runtimeMemory:recall'))
 healthy=[r for r in rpc if r['id']=='current-policy-delta:rpc'and r['paths']==['runtimeAuth:recheck']and r['observedCode']=='SUCCESS'];assert len(healthy)==2
 terminal=phase('terminal');assert len(terminal)==1 and terminal[0]['id']=='qualification-final'and terminal[0]['status']=='PASS'and terminal[0]['cleanupComplete']is True and journal[-1]==terminal[0]
 outcomes=by['caseOutcomes'];assert outcomes['scope']=='CURRENT_NATIVE_LIVE'and outcomes['status']=='PASS'and len(outcomes['evidence'])==len(journal)
 for original,final in zip(journal,outcomes['evidence']):
  if original['phase']=='authorization':assert {**original,'noEffect':True}==final
  else:assert original==final
 owned=by['owned'];assert len(owned['refs'])<=320 and len(owned['files'])<=2 and sum(r['table']=='runtimeAuthPrincipals'for r in owned['refs'])<=16
 assert owned['run'].startswith('foundation-')and len(owned['run'])==43 and all(r['run']==owned['run']for r in by['ownedJournal'])and by['ownedJournal'][0]['stage']=='BEGIN'
 assert {r['id']for r in phase('lifecycle')}=={r['id']for r in by['lifecycleCoverage']['requiredFoundationCases']}
 return {'status':'PASS','counts':counts,'publishedCurrentPathsAssertedByActualReviewedNativeSource':275,'publishedFixtureHelpersAssertedByActualReviewedNativeSource':12,'publishedTotalAssertedByActualReviewedNativeSource':287,'nativeCleanupComplete':True,'cleanupAttemptLimit':2,'actualCleanupAttemptCount':'NOT_SEPARATELY_JOURNALED','unsafeUnavailableClaimedAsFunctionality':False,'fullTask03':False}

def native_audit(c,h,out,end,end_mono,C,D,PC,bodies):
 assert end_mono-time.monotonic()>=270,'complete_native_evidence_reader_and_finish_reserve_not_admitted'
 current=strict(c.read(c.open(F/'runtime/coordinator-status.json',65536)))
 assert current['operation']==OP and current['volume']==V and current['candidateSha256']==FREEZE and current['phase']=='NATIVE_OUTCOME_AWAITING_INDEPENDENT_REVIEW'and current['status']=='HELD'and current['cliDispatched']is True and current['nativeOutcomeObserved']is True and current['independentFoundationAcceptance']is False
 terminal_row=c.open(S/'coordination/official-execution-terminal.json',1048576,True);terminal=strict(c.read(terminal_row))
 assert terminal['scope']=='OFFICIAL_CLI_AND_CURRENT_FOUNDATION_NATIVE_OUTCOME_ONLY'and terminal['operation']==OP and terminal['volume']==V and terminal['candidateSha256']==FREEZE and terminal['status']=='PASS'
 assert terminal['failureClass']is None and terminal['cleanupErrors']==[]and terminal['ownedContainersRemaining']==[]and set(terminal['outcomes'])=={'deploy','driver'}
 labels=[r['label']for r in terminal['commands']];assert len(labels)==len(set(labels))and len(labels)<=10000;raw=raw_receipts(c,labels)
 for expected in terminal['commands']:assert raw[expected['label']][0]==expected
 for key in ('deploy','driver'):
  spec=terminal['recipes'][key];cid=spec['containerId'];D.owned[spec['name']]=cid
  assert spec['cmd']==D.command_for(key)
  assert spec['requestedMounts']==[{'Type':'bind','Source':str(R),'Target':str(R),'ReadOnly':True},{'Type':'volume','Source':'cortex-task03-deps-20261005-b681774e','Target':str(R/'node_modules'),'ReadOnly':True,'VolumeOptions':{'NoCopy':True,'Subpath':'node_modules'}},{'Type':'volume','Source':V,'Target':str(Q),'VolumeOptions':{'NoCopy':True,'Subpath':'candidate'}},{'Type':'volume','Source':V,'Target':str(S),'VolumeOptions':{'NoCopy':True,'Subpath':'private'}}]
  for label,initial in [('official-'+key+'-initial-inspect',True),('official-'+key+'-pre-start',True),('official-'+key+'-terminal',False)]:
   o=one_inspect(raw[label][1]);D.recipe(o,spec['name'],spec['cmd'],spec['requestedMounts'],spec['selectedLiteralMapping']);assert o['State']['Running']is False and o['State']['Pid']==0 and o['State']['Status']==('created'if initial else'exited')and o['State']['ExitCode']==0 and o['State']['Error']==''
  label='official-'+key+'-removed-absence';ar,stdout,stderr=raw[label];assert ar['exitCode']==1 and stdout==b'[]\n'and stderr.strip().lower()==('error: no such object: '+cid).encode()
 specs=read_prepared(c,h);runner=Runner(C,out,end_mono-30)
 try:
  raw_observation,_=runner.execute('native',specs['native']);value=compressed(raw_observation)
  expected=strict((A/'expected-native-cases.json').read_bytes());window=strict((A/'private/original-window.json').read_bytes());start=stamp(window['startUtc'])
  assessment=validate_native(value,expected,end,start)
  durable(out/'actual-native-evidence.json',value);durable(out/'actual-native-assessment.json',assessment)
  durable(out/'commands.json',runner.closecheck());durable(out/'held-source-and-raw-closure.json',c.closecheck())
  assert utc()<end and time.monotonic()<end_mono-30
  decision={'scope':'ACTUAL_CURRENT_FOUNDATION_NATIVE_OUTCOME_ONLY','verdict':'PASS','independent':True,'operation':OP,'volume':V,'immutableImage':IMAGE,'candidateSha256':FREEZE,'sourceManifestSha256':MF_SHA,'privateSourceApprovalSha256':h['sourceApprovalSha256'],'originalWindowSha256':h['originalWindowSha256'],'originalDeadlineUtc':end.isoformat(),'actualNativeOutcomeIndependentlyReviewed':True,'counts':assessment['counts'],'officialDeploymentAndCodegen':'PASS','allOriginalCaseCoverage':'PASS','originalSourceClosureAllNineFullEOFHashSize':'PASS','ownedProcessAndNativeCleanup':'PASS','targetRetirement':'PENDING_UNCONDITIONAL_COORDINATOR_FENCE','fullTask03':False,'goalAccepted':False,'evaluatedAtUtc':utc().isoformat()}
  c.closecheck();assert time.monotonic()<end_mono-30;digest=durable(out/'decision.json',decision);durable(out/'final-held-closure.json',c.closecheck());assert time.monotonic()<end_mono-30
  return {'status':'PASS','decisionSha256':digest,'originalDeadlineUtc':end.isoformat(),'RootFinishMustBeReadAndValidatedBeforeOriginalDeadline':True,'fullTask03':False}
 except BaseException:
  runner.cleanup();durable(out/'failed-commands.json',{'rows':runner.rows,'cleanupErrors':runner.cleanup_errors,'remaining':list(runner.owned)});raise

def retirement_audit(c,h,out,C,PC):
 receipt=strict(c.read(c.open(F/'task03-attempt6-target-retirement.json',65536)))
 assert receipt['operation']==OP and receipt['requestSha256']==REQUEST_SHA and receipt['deletionHttpStatus']==200 and receipt['verificationHttpStatus']==404 and receipt['retired']is True and receipt['deleted']is True and receipt['productionMutations']==0
 before=strict(c.read(c.open(S/'target-pre-retirement.json',65536,True)));after=strict(c.read(c.open(S/'target.json',65536,True)))
 assert before['operation']==after['operation']==OP and before['projectId']==after['projectId']==receipt['projectId']and before['deploymentName']==after['deploymentName']==receipt['deploymentName']
 assert after['active']is False and after['retired']is True and after['deleted']is True
 labels=['retire','linux-selector-initial-inspect','linux-selector-retirement','linux-selector-terminal-inspect',*['selector-final-'+x+'-'+PC.SELECTOR_NAME for x in ('inspect','terminal','remove','absence')]]
 raw=raw_receipts(c,labels);result=strict(raw['linux-selector-retirement'][1]);assert result['status']=='PASS'and result['historicalCustodyRepaired']is False and (result.get('targetAbsent')is True or result.get('retiredSelectorInvalidated')is True)
 created=strict(c.read(c.open(A/'private/held-closure.json',16777216)));assert created['status']=='PASS_ALL_ORIGINAL_NINE_FULL_EOF_HASH_SIZE'
 initial=one_inspect(raw['linux-selector-initial-inspect'][1]);PC.OWNED_IDS[PC.SELECTOR_NAME]=initial['Id'];PC.OWNED_COMMANDS[PC.SELECTOR_NAME]=['/usr/local/bin/python3.12','-B','-c',(Q/'integrated/retire-selector.py').read_text()]
 for label,first in [('linux-selector-initial-inspect',True),('linux-selector-terminal-inspect',False),('selector-final-inspect-'+PC.SELECTOR_NAME,False),('selector-final-terminal-'+PC.SELECTOR_NAME,False)]:PC.assert_recipe(one_inspect(raw[label][1]),PC.SELECTOR_NAME,selector=True,initial=first)
 row,stdout,stderr=raw['selector-final-absence-'+PC.SELECTOR_NAME];assert row['exitCode']==1 and stdout==b'[]\n'and stderr.strip().lower()==('error: no such object: '+PC.SELECTOR_NAME).encode()
 current=strict(c.read(c.open(F/'runtime/coordinator-status.json',65536)));assert current['phase']=='COORDINATOR_TERMINAL'and current['status']=='PASS'and current['operation']==OP
 durable(out/'held-retirement-closure.json',c.closecheck());decision={'scope':'ACTUAL_OWNED_TARGET_RETIREMENT_AND_LINUX_SELECTOR_CLEANUP_ONLY','verdict':'PASS','independent':True,'operation':OP,'volume':V,'candidateSha256':FREEZE,'managementOwnedDeletionHTTP200':True,'managementOwnedVerificationHTTP404':True,'linuxSelectorInvalidated':True,'linuxSelectorContainerRemoved':True,'historicalCustodyRepaired':False,'fullTask03':False,'goalAccepted':False};digest=durable(out/'decision.json',decision);return {'status':'PASS','decisionSha256':digest,'fullTask03':False}

def main():
 parser=argparse.ArgumentParser();parser.add_argument('--handoff',required=True);args=parser.parse_args();path=Path(args.handoff)
 assert path.is_absolute()and path.is_relative_to(A)and path.resolve()==path
 c=Cohort();out=None;result=None
 try:
  row=c.open(path,65536);h=strict(c.read(row));stage=h['stage'];assert stage in ('PREPARE_OBSERVERS','PRIVATE','NATIVE','RETIREMENT');validate_handoff(h,stage)
  # Independently pin all own stopped reader inputs at actual first use, before private paths/effects.
  stop=strict((A/'source-writers-stopped.json').read_bytes());assert stop['remainingSourceWrites']==[]
  plan=strict((A/'audit-plan.json').read_bytes());own=[(e,c.open(A/e['name'],e['limit']))for e in plan['readerInputs']]
  for e,r in own:
   raw=c.read(r);assert sha(raw)==e['sha256']and r['bytes']==e['bytes'];assert time.time_ns()-int(r['originalNine']['ctime_ns'])>=60000000000,'reader_first_use_maturity_required'
  out=A/({'PREPARE_OBSERVERS':'prepare','PRIVATE':'private','NATIVE':'native','RETIREMENT':'retirement'}[stage]);out.mkdir(mode=0o700);(out/'raw').mkdir(mode=0o700)
  C,D,PC,bodies=qualify_source(c,h)
  if stage=='PREPARE_OBSERVERS':
   runner=Runner(C,out,time.monotonic()+300)
   try:
    specs={k:runner.create(k,v)for k,v in prepare_specs().items()};durable(out/'held-source-closure.json',c.closecheck());digest=durable(out/'prepared-observers.json',{'operation':OP,'reviewOperation':REVIEW_OP,'status':'PREPARED_NOT_STARTED','specs':specs,'privateReads':0,'targetProvisioning':0});durable(out/'commands.json',{'commands':runner.rows,'remainingPreparedOwnedObservers':list(specs),'sourceOnlyReadiness':False,'notActualAcceptance':True});result={'status':'PREPARED_NOT_STARTED','preparedObserversSha256':digest,'notActualAcceptance':True}
   except BaseException:
    runner.cleanup();durable(out/'failed-commands.json',{'rows':runner.rows,'cleanupErrors':runner.cleanup_errors,'remaining':list(runner.owned)});raise
  elif stage in ('PRIVATE','NATIVE'):
   end,mono,window=observe_window(c,h,out)
   result=private_audit(c,h,out,end,mono,C,D,PC,bodies)if stage=='PRIVATE'else native_audit(c,h,out,end,mono,C,D,PC,bodies)
   result['originalWindowSha256']=window
  else:result=retirement_audit(c,h,out,C,PC)
 except BaseException as e:
  result={'status':'FAIL_PRESERVED','failureClass':type(e).__name__,'privateContentsWithheld':True,'noDeadlineReset':True,'noBlindRerun':True,'fullTask03':False}
  if out is not None:durable(out/'failure.json',result)
 finally:c.close()
 print(json.dumps(result));return 0 if result['status']in ('PASS','PREPARED_NOT_STARTED')else 1

if __name__=='__main__':raise SystemExit(main())
