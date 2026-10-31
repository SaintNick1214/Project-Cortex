"""Own finite public fixtures only. Original A/T bytes; no private or service access."""
from pathlib import Path
import os,hashlib,json,types,copy,importlib.util,importlib._bootstrap_external,stat
R=Path('/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion');QA=R/'_goals/convex-backend-runtime-2026-10-02/qa';Q=QA/'task03-local-native-attempt6-2026-10-06';P=QA/'local-resume-2026-10-05/task03-attempt6-integrated-repair1';rows=[];raw=(P/'held-acquisition.py').read_bytes();H=types.ModuleType('effects_blocked_held_acquisition');exec(compile(raw,str(P/'held-acquisition.py'),'exec',dont_inherit=True),H.__dict__)
A=(Q/'attempt5/source-acquisition.py').read_bytes();T=(Q/'transport-prep/private-transport.py').read_bytes();assert hashlib.sha256(A).hexdigest()=='910be3364e6c185ccb44d3654e7755e82ce9744215512089f1a38efc6e186e15';assert hashlib.sha256(T).hexdigest()=='ecb1eff9a9edf025e2b7eb9108580857ff41da8bb54e8956251b219a5bebc23e'
ROOT=P/'own-finite-acquisition-fixtures2';ROOT.mkdir(mode=0o700);fixture_bytes=0;fixture_receipts=[]
def put(path,data):
 global fixture_bytes
 fixture_bytes+=len(data);assert fixture_bytes<=1048576
 fd=os.open(path,os.O_WRONLY|os.O_CREAT|os.O_EXCL|os.O_NOFOLLOW,0o600)
 with os.fdopen(fd,'wb')as f:f.write(data);f.flush();os.fsync(f.fileno())
 fixture_receipts.append({'path':str(path.relative_to(P)),'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest(),'ownPublicFixture':True})
def fixture(name):
 root=ROOT/name;root.mkdir(mode=0o700);(root/'attempt5').mkdir(mode=0o700);(root/'transport-prep').mkdir(mode=0o700)
 a=root/'attempt5/source-acquisition.py';t=root/'transport-prep/private-transport.py';put(a,A);put(t,T)
 return root,a,t,{'PRE':H.identity(os.lstat(a)),'bytes':len(A),'sha256':hashlib.sha256(A).hexdigest()},{'PRE':H.identity(os.lstat(t)),'bytes':len(T),'sha256':hashlib.sha256(T).hexdigest()}
def cache(t):
 value=os.lstat(t);code=compile("CACHED_UNREVIEWED_CODE_EXECUTED=True\nNAMES=('jwt-private.pem','target.json','deploy.env')\nMANIFEST='transport-stage.json'\n",str(t),'exec');data=importlib._bootstrap_external._code_to_timestamp_pyc(code,int(value.st_mtime),value.st_size)
 path=Path(importlib.util.cache_from_source(str(t)));path.parent.mkdir(mode=0o700);put(path,data)
def record(name,fn,denied=False):
 try:fn()
 except (AssertionError,ValueError,RuntimeError):
  assert denied,name;rows.append({'id':name,'status':'PASS_DENIAL_BEFORE_PRIVATE_OR_SERVICE','privateAccess':0});return
 assert not denied,name;rows.append({'id':name,'status':'PASS_NAMED_PUBLIC_SOURCE_OUTCOME_ONLY','privateAccess':0})
def run_case(name,mutate=None,late=None):
 root,a,t,ap,tp=fixture(name)
 if mutate:mutate(a,t,ap,tp)
 original=H.VerifiedDependencyLoader.exec_module
 if late:
  def actual_first_use(loader,module):late(a,t,ap,tp);return original(loader,module)
  H.VerifiedDependencyLoader.exec_module=actual_first_use
 tracked=[];original_os=H.os
 class Tracker:
  def __getattr__(self,name):return getattr(original_os,name)
  def open(self,path,*args,**kwargs):
   assert Path(path).is_relative_to(root);fd=original_os.open(path,*args,**kwargs);tracked.append(fd);return fd
  def close(self,fd):
   assert fd in tracked;tracked.remove(fd);return original_os.close(fd)
 H.os=Tracker()
 try:
  result=H.load_acquisition(a,t,ap,tp,root);assert result.T.NAMES==('jwt-private.pem','target.json','deploy.env') and not getattr(result.T,'CACHED_UNREVIEWED_CODE_EXECUTED',False)
  assert result.NAMES==(*result.T.NAMES,'transport-stage.json') and result.MAX_TOTAL==327692 and result.STREAM_SECONDS==12
 finally:
  H.VerifiedDependencyLoader.exec_module=original;H.os=original_os;assert tracked==[]
record('held-original-A-T-positive',lambda:run_case('positive'))
record('timestamp-valid-pyc-present-at-load-is-never-selected',lambda:run_case('cache-prior',lambda a,t,ap,tp:cache(t)))
record('timestamp-valid-pyc-created-at-actual-first-use-is-never-selected',lambda:run_case('cache-late',late=lambda a,t,ap,tp:cache(t)))
record('late-T-ctime-change-before-first-use-denied',lambda:run_case('ctime-late',late=lambda a,t,ap,tp:os.utime(t,ns=(int(tp['PRE']['mtime_ns']),int(tp['PRE']['mtime_ns'])+1))),True)
record('wrong-T-hash-denied',lambda:run_case('t-hash',lambda a,t,ap,tp:tp.update(sha256='0'*64)),True)
record('wrong-A-hash-denied',lambda:run_case('a-hash',lambda a,t,ap,tp:ap.update(sha256='0'*64)),True)
record('wrong-T-original-nine-denied',lambda:run_case('t-pin',lambda a,t,ap,tp:tp['PRE'].update(ctime_ns='1')),True)
record('wrong-A-original-nine-denied',lambda:run_case('a-pin',lambda a,t,ap,tp:ap['PRE'].update(ctime_ns='1')),True)
record('boolean-source-size-denied',lambda:run_case('typed-size',lambda a,t,ap,tp:tp.update(bytes=True)),True)
record('extra-original-pin-field-denied',lambda:run_case('pin-field',lambda a,t,ap,tp:tp['PRE'].update(extra='1')),True)
# Every native_main path is effects-substituted. No /owned or /prep path is statted.
original_os,original_held,original_load=H.os,H.HeldSource,H.load_acquisition
OP='c9fbaa34-8ca8-4153-b8bd-1cfe60a8241f';FREEZE='115e417419ab7b55e9fdbad97e51513f9f24a8e523c7b344168a63c92d8e968c'
sources={'attempt5/source-acquisition.py':{'bytes':len(A),'sha256':hashlib.sha256(A).hexdigest()},'transport-prep/private-transport.py':{'bytes':len(T),'sha256':hashlib.sha256(T).hexdigest()}}
base_pin={field:'1'for field in H.FIELDS};base_pin.update(uid='501',gid='20',mode=str(stat.S_IFREG|0o600),nlink='1')
receipt={'scope':'NEW_PROSPECTIVE_LINUX_PUBLIC_CANDIDATE_CUSTODY_ONLY','sourceFreezeSha256':FREEZE,'actualServiceRequests':0,'privateBytesCopied':False,'files':[{'path':name,**bound,'destinationIdentityDecimal':{'st_'+f:v for f,v in {**base_pin,'size':str(bound['bytes'])}.items()}}for name,bound in sources.items()]+[{'path':'own-public-count-'+str(i)}for i in range(1912)]}
config={'operation':OP,'candidateSha256':FREEZE,'publicTransferReceiptSha256':'','sources':sources,'argv':['/prep/attempt5/source-acquisition.py','receive-copy','/owned/native','source-'+OP,'/owned/private','/prep/transport-prep/transport-binding.json','/owned/receipts']}
def native_case(change_config=None,change_receipt=None):
 body=copy.deepcopy(receipt);data=copy.deepcopy(config)
 if change_receipt:change_receipt(body)
 raw=json.dumps(body).encode();data['publicTransferReceiptSha256']=hashlib.sha256(raw).hexdigest()
 if change_config:change_config(data)
 effects=[]
 def fake_lstat(path):assert str(path)=='/owned/public-transfer-receipt.json';return types.SimpleNamespace(**{**{'st_'+f:int(v)for f,v in base_pin.items()},'st_size':len(raw)})
 class Receipt:
  def __init__(self,path,expected,root):assert str(path)=='/owned/public-transfer-receipt.json' and str(root)=='/owned';assert expected['sha256']==hashlib.sha256(raw).hexdigest();effects.append('held-public-receipt')
  def content(self):return raw
  def verify(self):effects.append('original-public-receipt-verified')
  def close(self):effects.append('public-receipt-closed')
 def first_use(a,t,ap,tp,root,*,as_main=False,argv=None):
  assert as_main is True and str(a)=='/prep/attempt5/source-acquisition.py' and str(t)=='/prep/transport-prep/private-transport.py'and str(root)=='/prep'
  assert ap['PRE']=={**base_pin,'size':str(len(A))} and tp['PRE']=={**base_pin,'size':str(len(T))} and ap['sha256']==sources['attempt5/source-acquisition.py']['sha256'];effects.append('unchanged-source-cli-first-use-reached');return 'effect-substituted'
 H.os=types.SimpleNamespace(lstat=fake_lstat);H.HeldSource=Receipt;H.load_acquisition=first_use
 try:
  assert H.native_main(data)=='effect-substituted';assert effects[-1]=='public-receipt-closed'
 finally:H.os=original_os;H.HeldSource=original_held;H.load_acquisition=original_load
record('native-public-receipt-pinned-unchanged-CLI-first-use-positive-source-only',native_case)
for name,change in [('foreign-operation',lambda c:c.update(operation='foreign')),('foreign-freeze',lambda c:c.update(candidateSha256='foreign')),('foreign-argv',lambda c:c['argv'].__setitem__(4,'/foreign')),('wrong-receipt-hash',lambda c:c.update(publicTransferReceiptSha256='0'*64))]:record('native-deny-'+name,lambda change=change:native_case(change_config=change),True)
for name,change in [('duplicate-membership',lambda r:r['files'][-1].update(path=r['files'][0]['path'])),('incomplete-membership',lambda r:r['files'].pop()),('foreign-freeze',lambda r:r.update(sourceFreezeSha256='foreign')),('service-request',lambda r:r.update(actualServiceRequests=1)),('boolean-counter',lambda r:r.update(actualServiceRequests=False)),('private-copy',lambda r:r.update(privateBytesCopied=True)),('wrong-A-bytes',lambda r:r['files'][0].update(bytes=1)),('boolean-A-bytes',lambda r:r['files'][0].update(bytes=True)),('missing-native-nine',lambda r:r['files'][1]['destinationIdentityDecimal'].pop('st_ctime_ns'))]:record('native-deny-'+name,lambda change=change:native_case(change_receipt=change),True)
# Real public fixture acquisition handles close on all successes/failures; no private path can be reached in these host imports.
result={'scope':'IMPLEMENTER_OWN_FINITE_PUBLIC_A_T_AND_EFFECT_SUBSTITUTED_NATIVE_FIRST_USE_CONTROLS_ONLY','status':'PASS','count':len(rows),'rows':rows,'fixtures':fixture_receipts,'fixtureBytes':fixture_bytes,'fixtureByteCeiling':1048576,'heldAdapterSha256':hashlib.sha256(raw).hexdigest(),'originalABytesUnchanged':True,'originalTBytesUnchanged':True,'privateAccess':0,'DockerCalls':0,'serviceCalls':0,'CLIExecuted':False,'nativeQualificationExecuted':False,'runtimeAccepted':False}
fd=os.open(P/'acquisition-control-results.json',os.O_WRONLY|os.O_CREAT|os.O_EXCL|os.O_NOFOLLOW,0o600)
with os.fdopen(fd,'w')as f:json.dump(result,f,indent=2);f.write('\n');f.flush();os.fsync(f.fileno())
print(json.dumps({'count':len(rows),'status':'PASS_PUBLIC_FIXTURE_SOURCE_ONLY','fixtureBytes':fixture_bytes,'privateAccess':0,'serviceEffects':0}))
