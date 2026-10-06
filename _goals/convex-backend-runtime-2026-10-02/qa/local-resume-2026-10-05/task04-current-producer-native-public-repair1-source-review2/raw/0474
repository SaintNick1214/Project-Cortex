"""Bounded STATIC/MOCK outcomes. No real process, Docker, network or original body execution."""
import ast,copy,hashlib,json,re,types,uuid
from pathlib import Path
N=Path(__file__).resolve().parents[1];S=N/'source';OLD=N.parent/'task04-current-producer-native-public-preparation1/source'
rows=[]
def definitions(name,ns,selected=None,old=False):
 raw=(OLD/name if old else S/name).read_bytes();tree=ast.parse(raw)
 body=[x for x in tree.body if isinstance(x,(ast.FunctionDef,ast.ClassDef))and(selected is None or x.name in selected)]
 exec(compile(ast.Module(body=body,type_ignores=[]),name,'exec'),ns);return ns

def case(name,fn,kind='MOCK'):
 try:
  detail=fn();rows.append({'name':name,'status':'PASS','kind':kind,'detail':detail})
 except BaseException as error:rows.append({'name':name,'status':'FAIL','kind':kind,'error':repr(error)})

def deny(fn):
 try:fn()
 except (ValueError,RuntimeError,KeyError,TypeError)as e:return str(e)
 raise AssertionError('DEFECT_NOT_DENIED')
class Clock:
 def __init__(self):self.now=0
 def monotonic(self):return self.now
class Pipe:
 def __init__(self,clock,late_close=None):self.clock=clock;self.late_close=late_close;self.closed=False
 def close(self):
  self.closed=True
  if self.late_close is not None:self.clock.now=self.late_close
class Process:
 pid=321
 def __init__(self,clock,terminal,close=None):
  self.clock=clock;self.at=terminal;self.returncode=None;self.stdout=Pipe(clock,close);self.stderr=Pipe(clock);self.waits=[]
 def wait(self,timeout):self.waits.append(timeout);self.clock.now=self.at;self.returncode=0;return 0
 def poll(self):return self.returncode

def command(timeout,terminal,old=False,close=None,poll_late=None,close_error=False):
 c=Clock();p=Process(c,terminal,close);closed=[]
 class Poll:
  def register(self,fd,event):self.fd=fd
  def poll(self,wait):
   if self.fd==1321 and p.returncode is not None:
    if poll_late is not None:c.now=poll_late
    return[(self.fd,1)]
   return[]
 def osclose(fd):
  closed.append(fd)
  if close_error and fd==1321:raise OSError('MOCK_CLOSE_FAILURE')
 ns={'os':types.SimpleNamespace(getpid=lambda:99,pidfd_open=lambda p,f:p+1000,close=osclose,read=lambda *_:b''),
     'time':c,'select':types.SimpleNamespace(poll=Poll,POLLIN=1),
     'subprocess':types.SimpleNamespace(DEVNULL=-3,PIPE=-1,TimeoutExpired=TimeoutError,Popen=lambda *a,**k:p),
     'signal':types.SimpleNamespace(SIGTERM=15,SIGKILL=9,pidfd_send_signal=lambda *_:None),'selectors':types.SimpleNamespace()}
 definitions('bounded_process.py',ns,old=old);collect=ns['BoundedStreams'].collect
 class Collector:
  def __init__(self,process,a,b,deadline,read):self.process=process;self.deadline=deadline
  def pump(self,wait):return True
  def partial(self):return {'stdout':b'','stderr':b''}
  def collect(self,progress):return collect(self,progress)
  def close(self):self.process.stdout.close();self.process.stderr.close();return[]
 ns['BoundedStreams']=Collector
 try:receipt=ns['bounded_command'](['SUBSTITUTED'],timeout=timeout,native_pidfd=True);accepted=True
 except ns['CollectionFailure']as e:receipt=e.receipt;accepted=False
 return accepted,receipt,p,closed

def terminal_case(bound,offset,old=False,close=None,poll_late=None,should=True):
 accepted,r,p,closed=command(bound,bound+offset,old=old,close=close,poll_late=poll_late)
 assert accepted is should
 assert r['terminal'] and len(closed)==2 and p.stdout.closed and p.stderr.closed
 if not accepted:assert r['outcome']=='FAILED' and 'DEADLINE' in r['failure']
 return {'requestedSeconds':bound,'elapsed':r['elapsedSeconds'],'accepted':accepted,'cleanupTerminal':r['terminal'],'closeCount':len(closed),'allEffectsSubstituted':True}
for b in (20,30):
 case('old-late-'+str(b)+'-defect-reproduced',lambda b=b:terminal_case(b,.125,old=True))
 case('repair-late-'+str(b)+'-denied',lambda b=b:terminal_case(b,.125,should=False))
 case('repair-exact-'+str(b)+'-deadline-denied',lambda b=b:terminal_case(b,0,should=False))
 case('repair-in-window-'+str(b)+'-accepted',lambda b=b:terminal_case(b,-.125))
 case('repair-post-pipe-close-'+str(b)+'-late-denied',lambda b=b:terminal_case(b,-.125,close=b+.125,should=False))
 case('repair-post-terminal-poll-'+str(b)+'-late-denied',lambda b=b:terminal_case(b,-.125,poll_late=b+.125,should=False))
def close_failure():
 ok,r,p,cl=command(20,19,close_error=True)
 assert not ok and r['outcome']=='FAILED' and r['terminal'] and r['closeErrors'] and r['elapsedSeconds']==19
 return {'failedCloseSticky':True,'terminalCleanupCannotClearFailure':True}
case('repair-close-error-sticky',close_failure)

def stream_case(at,old=False,should=True):
 c=Clock();p=Process(c,at)
 ns={'time':c,'os':types.SimpleNamespace(read=lambda *_:b''),'subprocess':types.SimpleNamespace(TimeoutExpired=TimeoutError),'selectors':types.SimpleNamespace()}
 definitions('bounded_process.py',ns,{'CollectionFailure','BoundedFileStream'},old=old)
 fake=types.SimpleNamespace(read=lambda _:b'',deadline=60,process=p,partial=lambda:{})
 try:r=ns['BoundedFileStream'].finish(fake);ok=True
 except ns['CollectionFailure']as e:r={'failure':str(e)};ok=False
 assert ok is should
 return {'requestedSeconds':60,'accepted':ok,'at':at,'failure':r.get('failure')}
case('old-stream60-late-defect-reproduced',lambda:stream_case(60.125,old=True))
case('repair-stream60-late-denied',lambda:stream_case(60.125,should=False))
case('repair-stream60-exact-denied',lambda:stream_case(60,should=False))
case('repair-stream60-in-window-positive',lambda:stream_case(59.875))

# Exercise actual copy_file function with all pipe/tar/files/PID effects substituted.
def copy_case(close_at=None,poll_at=None,should=True):
 c=Clock();p=Process(c,59.875);closed=[];signals=[]
 class Target:
  def exists(self):return False
  def is_symlink(self):return False
 class Output:
  def __enter__(self):return self
  def __exit__(self,*_):return False
  def write(self,_):return 1
  def flush(self):pass
  def fileno(self):return 42
 class Archive:
  fileobj=object()
  def __enter__(self):return self
  def __exit__(self,*_):return False
  def __iter__(self):return iter([types.SimpleNamespace(name='one',isfile=lambda:True,linkname='',size=1)])
  def extractfile(self,m):
   class Reader(Output):
    data=[b'x',b'']
    def read(self,_):return self.data.pop(0)
   return Reader()
 class Stream:
  def __init__(self,*a,**k):assert k['timeout']<=60
  def finish(self):p.wait(60);return{'stdoutPrefix':b'','stderr':b'','exit':0,'terminal':True}
  def partial(self):return{}
  def close(self):
   if close_at is not None:c.now=close_at
   return[]
 class Poll:
  def register(self,*_):pass
  def poll(self,_):
   if poll_at is not None:c.now=poll_at
   return [(1321,1)]
 ns={'len':len,'Path':Path,'time':c,'hashlib':hashlib,'select':types.SimpleNamespace(poll=Poll,POLLIN=1),
  'os':types.SimpleNamespace(pidfd_open=lambda pid,f:pid+1000,getpid=lambda:99,close=lambda fd:closed.append(fd),chmod=lambda *_:None,fsync=lambda *_:None),
  'signal':types.SimpleNamespace(SIGTERM=15,SIGKILL=9,pidfd_send_signal=lambda *a:signals.append(a)),
  'subprocess':types.SimpleNamespace(DEVNULL=-3,PIPE=-1,TimeoutExpired=TimeoutError,Popen=lambda *a,**k:p),
  'tarfile':types.SimpleNamespace(open=lambda **k:Archive()),'TrackedTarReader':lambda f:f,'finish_tar_record':lambda *a:{'EOF':True},
  'BoundedFileStream':Stream,'open':lambda *a,**k:Output()}
 definitions('copy_file.py',ns)
 try:r=ns['copy_file']('a'*64,'/var/tmp/one',Target(),1,timeout=60);ok=True
 except ns['CopyFailure']as e:r=e.receipt;ok=False
 assert ok is should and len(closed)==2 and r['terminal']
 if not ok:assert r['outcome']=='FAILED' and 'DEADLINE' in r['failure']
 return {'accepted':ok,'elapsed':r['elapsedSeconds'],'closed':closed,'terminal':r['terminal'],'realCopy':False}
case('copy60-post-close-late-denied',lambda:copy_case(close_at=60.125,should=False))
case('copy60-post-poll-late-denied',lambda:copy_case(poll_at=60.125,should=False))
case('copy60-in-window-positive',copy_case)

# Construct complete actual inspection fixture, then mutate one field at a time.
def fixture(mode='native20'):
 labels={'cortex.goal':'convex-backend-runtime-2026-10-02','cortex.operation':'d7bb72a8-9bac-484f-b9cf-cd44ee57edb6','cortex.owner':'native-public-repair1','cortex.phase':mode,'cortex.scope':'PUBLIC_SOURCE_ONLY_NO_RELEASE','cortex.attempt':'1-1'}
 mounts=[{'type':'bind','source':'/host/'+str(i),'target':'/bind/'+str(i),'rw':False}for i in range(7)]
 mounts+=[{'type':'volume','source':'/var/lib/docker/volumes/v'+str(i)+'/_data','target':'/volume/'+str(i),'name':'v'+str(i),'rw':True}for i in range(2 if mode=='native20'else 1)]
 exp={'phase':mode,'id':'a'*64,'image':'sha256:'+'b'*64,'name':'fixture','labels':labels,'env':['PATH=/usr/local/bin:/usr/bin:/bin'],'mounts':mounts}
 actual=[];configured=[]
 for m in mounts:
  a={'Type':m['type'],'Source':m['source'],'Destination':m['target'],'RW':m['rw']}
  cf={'Type':m['type'],'Source':m.get('name',m['source']),'Target':m['target'],'ReadOnly':not m['rw']}
  if m['type']=='volume':a.update(Name=m['name'],Driver='local');cf['VolumeOptions']={'NoCopy':True}
  else:a['Propagation']='rprivate'
  actual.append(a);configured.append(cf)
 hc={'Memory':1073741824,'MemorySwap':1073741824,'ReadonlyRootfs':True,'NetworkMode':'none','PidsLimit':128,
     'Privileged':False,'AutoRemove':False,'CapDrop':['ALL'],'PidMode':'','IpcMode':'private','UTSMode':'','CgroupnsMode':'private','Init':False,'SecurityOpt':['no-new-privileges'],
     'Tmpfs':{'/tmp':'rw,noexec,nosuid,nodev,size=16777216,mode=0700'},'Ulimits':[{'Name':'nofile','Hard':8192,'Soft':8192}],'Mounts':configured}
 row={'Id':exp['id'],'Image':exp['image'],'Name':'/fixture','Platform':'linux',
  'Config':{'Labels':copy.deepcopy(labels),'User':'0:0','WorkingDir':'/native-source','Entrypoint':['/usr/local/bin/python3.12'],
   'Cmd':['-B','/native-source/native-controller.py'if mode=='native20'else '/reviewed-bootstrap.py'],'Env':exp['env']},
  'HostConfig':hc,'Mounts':actual,'State':{'OOMKilled':False,'Error':'','Pid':0,'Running':False,'Status':'created','ExitCode':0}}
 return row,exp
H=definitions('host_contract.py',{'MEMORY':1073741824,'re':re,'uuid':uuid})
def nominal(mode):
 row,exp=fixture(mode);r=H['validate'](row,exp);assert r['phase']==mode
 return {'literalBindingsAccepted':True,'phase':mode,'mounts':len(row['Mounts'])}
case('native20-full-literal-bindings-positive',lambda:nominal('native20'))
case('public48-full-literal-bindings-positive',lambda:nominal('public48'))
def mutate(path,value):
 row,exp=fixture();obj=row
 for key in path[:-1]:obj=obj[key]
 if value=='DELETE_KEY':del obj[path[-1]]
 else:obj[path[-1]]=value
 reason=deny(lambda:H['validate'](row,exp));return {'deniedBeforeSTART':True,'field':str(path),'reason':reason,'targetActions':0}
for path,v in [(['HostConfig','ReadonlyRootfs'],1),(['HostConfig','Privileged'],0),(['HostConfig','AutoRemove'],0),(['HostConfig','Init'],0),
 (['HostConfig','Memory'],1073741824.0),(['HostConfig','MemorySwap'],True),(['HostConfig','PidsLimit'],128.0),
 (['HostConfig','PidMode'],'host'),(['HostConfig','PidMode'],'DELETE_KEY'),(['HostConfig','IpcMode'],'host'),(['HostConfig','CgroupnsMode'],'host'),
 (['HostConfig','SecurityOpt'],[]),(['HostConfig','CapDrop'],[]),(['HostConfig','NetworkMode'],'bridge'),
 (['Mounts',0,'RW'],0),(['HostConfig','Mounts',0,'ReadOnly'],1),(['HostConfig','Mounts',7,'VolumeOptions','NoCopy'],1),
 (['Mounts',7,'Driver'],'foreign'),(['Mounts',0,'Source'],'/foreign'),(['Mounts',0,'Propagation'],'shared'),
 (['Config','Cmd'],['-B','/other.py']),(['Config','Entrypoint'],['/bin/sh']),(['Config','Labels','cortex.operation'],'foreign'),
 (['Config','Env'],['NODE_PATH=/foreign']),(['Platform'],'windows'),(['Image'],'sha256:'+'c'*64),(['Id'],'f'*64),
 (['State','Running'],0),(['State','OOMKilled'],0),(['State','ExitCode'],False),(['State','Pid'],0.0)]:
 case('preSTART-denial-'+str(path),lambda path=path,v=v:mutate(path,v))
def old_aliases():
 ns=definitions('host_contract.py',{'MEMORY':1073741824},old=True)
 row,exp=fixture();row['HostConfig'].update(ReadonlyRootfs=1,Privileged=0,AutoRemove=0,PidMode='host')
 row['Mounts'][0]['RW']=0;row['HostConfig']['Mounts'][0]['ReadOnly']=1
 assert ns['validate'](row,exp)['id']==exp['id']
 return {'oldAllReportedNumericAliasesAndHostPIDAccepted':True,'DockerEffects':0}
case('old-typed-aliases-and-host-PID-defect-reproduced',old_aliases)

# Original PID1 guard denies nested controller composition, but retains PID1 progress.
def bootstrap_guard(pid,desc,expect_spawn):
 calls=[];writes=[]
 class Out:
  def flush(self):pass
  def fileno(self):return 42
  def close(self):pass
 class FP:
  def __init__(self,s):self.s=s
  def __truediv__(self,s):return FP(self.s+'/'+str(s))
  def write_text(self,t):writes.append(json.loads(t))
  def __str__(self):return self.s
 def spawn(*a,**k):calls.append(True);raise RuntimeError('MOCK_SPAWN_BOUNDARY')
 ns={'ROOT':FP('ROOT'),'open':lambda *a,**k:Out(),'os':types.SimpleNamespace(getpid=lambda:pid,fsync=lambda *a:None),
     'json':json,'time':Clock(),'OWNED_PROCESS_EVENTS':[],'descendants':lambda:desc,
     'subprocess':types.SimpleNamespace(Popen=spawn,PIPE=-1),'selectors':types.SimpleNamespace(),'signal':types.SimpleNamespace()}
 definitions('bootstrap.py',ns,{'call'})
 error=deny(lambda:ns['call']('node-version',['MOCK'],{},30,1024))
 assert bool(calls)is expect_spawn
 if not expect_spawn:assert error=='EXCLUSIVE_OWNED_PID_NAMESPACE_REQUIRED'and writes[0]['spawned']is False
 else:assert error=='MOCK_SPAWN_BOUNDARY'
 return {'pid':pid,'spawnReached':bool(calls),'reason':error,'realChild':False}
case('unchanged-nested-PID2-composition-denied',lambda:bootstrap_guard(2,[],False))
case('unchanged-PID1-nonempty-namespace-denied',lambda:bootstrap_guard(1,[{'pid':2}],False))
case('unchanged-PID1-empty-namespace-positive-to-mock-spawn',lambda:bootstrap_guard(1,[],True))

def arithmetic():
 phases=[180,720,120,120,120,480,300,60]
 assert sum(phases)==2100 and 2100+60+60==2220 and 180+2220+240+60==2700
 return {'body':2100,'step':2220,'job':2700,'original120':120,'OWN20':20,'public300':300,'public480':480,'retireInsideBody':60,'finalCleanupOutsideBody':60}
case('conservative-two-phase45m-envelope',arithmetic,'STATIC')

def conserve():
 for name,h in [('run_controls.py','5d27d83c1c28dc4ce475703c366649610b41bb893138be3efd3f9ac5a6d8b885'),('c7/controls.mjs','93522ab6d59ee96a0fb8f24a4f1009bdaa8ad1ff25d4f0e6988dd9fc039b4a16')]:
  assert hashlib.sha256((S/name).read_bytes()).hexdigest()==h
 assert (S/'bootstrap.py').read_bytes()==(OLD/'bootstrap.py').read_bytes()
 t=(S/'native-controller.py').read_text();tree=ast.parse(t)
 calls=[n for n in ast.walk(tree)if isinstance(n,ast.Call)and isinstance(n.func,ast.Name)and n.func.id in ('command','bounded_command')]
 assert all('/reviewed-bootstrap.py'not in ast.unparse(c) for c in calls)
 driver=(S/'ci-run.py').read_text()
 assert driver.index("retire_successful_first_phase()",driver.index('def main():'))<driver.index("create_phase('public48'",driver.index('def main():'))
 return {'originalBootstrapByteExact':True,'original48ByteExact':True,'original20ByteExact':True,'nativeControllerNoBootstrapChild':True,'serializedRetirementBeforeNextOwner':True}
case('conserved-bodies-and-serialized-PID1-plan',conserve,'STATIC')

# Exercise actual driver orchestration with all effects replaced; foreign targets get no mutation.
def driver_serial(failure=None):
 events=[]
 class FP:
  def __init__(self,text):self.text=text
  def __truediv__(self,c):return FP(self.text+'/'+str(c))
  def mkdir(self,**kw):events.append('mkdir-public-fixture')
  def read_text(self):return 'ID=ubuntu\nVERSION_ID="24.04"\n'
  def __str__(self):return self.text
 def call(argv,*args,**kw):
  events.append('read-or-build-mock')
  if argv[:3]==['docker','ps','-q']:return b''
  if argv[:2]==['docker','info']:return json.dumps({'OSType':'linux','Architecture':'x86_64','DockerRootDir':'/mock'}).encode()
  if argv[:3]==['docker','image','inspect']:return json.dumps([{'Architecture':'amd64','Os':'linux','Id':'sha256:'+'b'*64,'Size':1}]).encode()
  return b''
 def create(mode,*_):events.append('create:'+mode)
 def run(mode,seconds):
  events.append('run:'+mode+':'+str(seconds))
  return 1 if failure==mode else 0
 def export(mode):events.append('export:'+mode)
 def retire():
  events.append('retire:native20')
  if failure=='retire':raise ValueError('MOCK_RETIREMENT_FAILED')
 ns={'Path':FP,'time':Clock(),'sys':types.SimpleNamespace(platform='linux'),
     'platform':types.SimpleNamespace(machine=lambda:'x86_64'),'uuid':types.SimpleNamespace(uuid4=lambda:uuid.UUID('d7bb72a8-9bac-484f-b9cf-cd44ee57edb6')),
     'os':types.SimpleNamespace(environ={'RUNNER_TEMP':'/mock'},stat=lambda _:types.SimpleNamespace(st_dev=1)),
     'save':lambda *a:events.append('save:'+a[0]),'host_resources':lambda **k:{},'verify_source':lambda:events.append('verify-source'),
     'startup_origins':lambda:[],'phase':lambda n,s:events.append('phase:'+n+':'+str(s)),
     'call':call,'strict':json.loads,'prepare_inputs':lambda:FP('/mock/parser'), 'create_phase':create,'run_phase':run,
     'export_phase':export,'retire_successful_first_phase':retire,'remaining':lambda:1,'S':FP('/source'),
     'COMBINED_EXPORT_BYTES':0,'COMBINED_EXPORT_PATHS':0}
 definitions('ci-run.py',ns,{'main'})
 try:ns['main']();accepted=True
 except ValueError:accepted=False
 order=[e for e in events if e.startswith(('create:','run:','export:','retire:'))]
 if failure:
  assert not accepted
  if failure in ('native20','retire'):assert 'create:public48'not in order
 else:
  assert accepted and order==['create:native20','run:native20:120','export:native20','retire:native20','create:public48','run:public48:480','export:public48']
 return {'accepted':accepted,'order':order,'effects':'ALL_SUBSTITUTED'}
case('actual-driver-two-PID1-serial-export-retirement-positive',driver_serial)
for f in ('native20','retire','public48'):
 case('actual-driver-failure-sticky-'+f,lambda f=f:driver_serial(f))

def retire(foreign=None):
 row,exp=fixture();row['State'].update(Status='exited')
 if foreign=='container':row['Config']['Labels']['cortex.operation']='foreign'
 vol={'Name':'v0','Driver':'local','Scope':'local','Labels':exp['labels'],'Options':None,'Mountpoint':'/var/lib/docker/volumes/v0/_data'}
 actual=copy.deepcopy(vol)
 if foreign=='volume':actual['Labels']={'foreign':'true'}
 actions=[];saved=[]
 def call(argv,*a,**kw):
  actions.append(argv)
  return json.dumps([actual]).encode()if argv[1:3]==['volume','inspect']else b''
 ns={'OWNED_ID':exp['id'],'EXPECTED':exp,'LABELS':exp['labels'],'VOLUMES':[vol],'OWNED_PHASES':[],
     'phase':lambda *a:None,'inspect':lambda:row,'validate':H['validate'],'volume':H['volume'],
     'call':call,'strict':json.loads,'absent':lambda *a:None,'remaining':lambda:1,'save':lambda n,v:saved.append(v)}
 definitions('ci-run.py',ns,{'retire_successful_first_phase'})
 if foreign:
  deny(ns['retire_successful_first_phase'])
  assert not any(a[2]=='rm'for a in actions)
 else:
  ns['retire_successful_first_phase']()
  assert actions[-2:]==[['docker','container','rm',exp['id']],['docker','volume','rm','v0']]
  assert ns['OWNED_ID']is None and ns['EXPECTED']is None and ns['VOLUMES']==[]
 return {'foreign':foreign,'mutations':[a for a in actions if a[2]=='rm'],'closedOwnerCleared':not foreign}
case('actual-retirement-known-only-positive',retire)
case('actual-retirement-foreign-container-denied-zero-mutations',lambda:retire('container'))
case('actual-retirement-foreign-volume-denied-zero-mutations',lambda:retire('volume'))

def final_cleanup_sticky():
 captured=[];exitcodes=[];c=Clock()
 ns={'__name__':'__main__','RUN':'MOCK','SOURCE_HELD':[],'SOURCE_DIRS':[],
     'main':lambda:(_ for _ in ()).throw(ValueError('ORIGINAL_BODY_FAILED')),
     'save':lambda n,v:captured.append((n,v)), 'time':c,'phase':lambda *a:None,
     'cleanup':lambda:None,'fence_directories':lambda *_:None,'remaining':lambda:1,
     'artifact_manifest':lambda:None,'sys':types.SimpleNamespace(exit=lambda code:exitcodes.append(code),stderr=None)}
 tree=ast.parse((S/'ci-run.py').read_bytes());node=next(n for n in tree.body if isinstance(n,ast.If))
 exec(compile(ast.Module(body=[node],type_ignores=[]),'actual-driver-finalizer','exec'),ns)
 writer=next(v for n,v in captured if n=='writer-stop.json')
 assert exitcodes==[1]and 'ORIGINAL_BODY_FAILED'in writer['primary']
 return {'successfulCleanupNeverClearsBodyFailure':True,'exit':exitcodes[0]}
case('actual-driver-finalcleanup-success-cannot-clear-failure',final_cleanup_sticky)

def post_start_owner(terminal_at,close_at=None,should=True):
 row,exp=fixture();row['State'].update(Running=True,Pid=321,Status='running')
 c=Clock();observations=[copy.deepcopy(row),copy.deepcopy(row)]
 observations[1]['State'].update(Running=False,Pid=0,Status='exited')
 current=[False];closed=[];saved=[]
 def inspect():
  r=observations.pop(0)
  if not r['State']['Running']:c.now=terminal_at;current[0]=True
  return r
 class Poll:
  def register(self,*a):pass
  def poll(self,_):return [(42,1)]if current[0]else []
 class FP:
  def __init__(self,*a):pass
  def read_text(self):return 'NSpid:\t321\t1\n'
 def close(fd):
  closed.append(fd)
  if close_at is not None:c.now=close_at
 c.sleep=lambda sec:setattr(c,'now',c.now+sec)
 owner={'pid':321,'startTime':'100','ppid':'1','pgid':'321','sid':'321',
        'rawArgvHex':b'/usr/local/bin/python3.12\0-B\0/native-source/native-controller.py\0'.hex(),'rawStatHex':'00'}
 ns={'time':c,'WHOLE_END':2100,'STAGE_END':None,'STAGE_NAME':None,'OWNED_ID':exp['id'],'EXPECTED':exp,'LABELS':exp['labels'],
     'call':lambda *a,**k:None,'inspect':inspect,'validate':H['validate'],'proc':lambda _:owner,
     'os':types.SimpleNamespace(pidfd_open=lambda *a:42,close=close),'Path':FP,
     'signal':types.SimpleNamespace(pidfd_send_signal=lambda *a:None),'select':types.SimpleNamespace(poll=Poll,POLLIN=1),
     'save':lambda n,v:saved.append((n,v))}
 definitions('ci-run.py',ns,{'phase','remaining','run_phase'})
 try:code=ns['run_phase']('native20',120);ok=True
 except ValueError:ok=False
 assert ok is should and closed==[42]
 result=next(v for n,v in saved if n=='native20-terminal.json')
 assert result['owner']['namespacePID']==1 and result['owner']['containerID']==exp['id']
 if not ok:assert result['outcome']=='FAILED'
 return {'accepted':ok,'observedOwner':True,'closed':closed,'elapsed':result['elapsedSeconds'],'outcome':result['outcome']}
case('actual-driver-native120-owner-terminal-close-positive',lambda:post_start_owner(119.5))
case('actual-driver-native120-late-terminal-denied',lambda:post_start_owner(120.125,should=False))
case('actual-driver-native120-late-owner-close-denied',lambda:post_start_owner(119.5,close_at=120.125,should=False))


PUBLIC=tuple(ast.literal_eval(next(n.value for n in ast.parse((S/'native_export.py').read_bytes()).body if isinstance(n,ast.Assign)and any(isinstance(v,ast.Name)and v.id=='PUBLIC'for v in n.targets))))
P=definitions('public_export_contract.py',{'re':re,'FIELDS':('dev','ino','mode','uid','gid','nlink','size','mtime_ns','ctime_ns'),'PUBLIC':PUBLIC,'ROOT':'/var/tmp/task04-c8-current-canonical-input-producers/'})
def public_fixture():
 fields={'dev':'1','ino':'2','mode':'33152','uid':'0','gid':'0','nlink':'1','size':'1','mtime_ns':'2','ctime_ns':'2'}
 pin={'schema':'FS_IDENTITY_DECIMAL_V1','fields':fields}
 current={'path':P['ROOT']+PUBLIC[0],'bytes':1,'sha256':'a'*64,'PRE':pin,'OPEN':copy.deepcopy(pin),'POST':copy.deepcopy(pin),'pathPOST':copy.deepcopy(pin),'EOF':True}
 files=[{'relativePath':name,'status':'ABSENT'}for name in PUBLIC]
 files[0]={'relativePath':PUBLIC[0],'status':'EXISTS','current':current}
 return {'scope':'FINITE_PUBLIC_SOURCE_CONTROL_EXPORT_ONLY','files':files,'fileCount':23,'existingBytes':1,'combinedExportBytesMaxIncludingThisManifest':1048576,
         'primaryFailure':None,'allDescendantsTerminal':True,'nativeClaims':False,'original122':'HELD','ROOT':'ABSENT'}
def public_positive():
 result=P['validate_public'](public_fixture());assert len(result)==23 and result[0]['current']['bytes']==1
 return {'strictPublic23':True,'unchangedSchema':True,'realExport':False}
case('public48-exact-unchanged-export-schema-positive',public_positive)
def public_mutation(path,value):
 data=public_fixture();obj=data
 for k in path[:-1]:obj=obj[k]
 obj[path[-1]]=value
 reason=deny(lambda:P['validate_public'](data))
 return {'deniedBeforeAnyExportMemberCopy':True,'field':str(path),'reason':reason}
for path,value in [(['nativeClaims'],0),(['allDescendantsTerminal'],1),(['fileCount'],23.0),(['existingBytes'],True),
 (['files',0,'current','bytes'],True),(['files',0,'current','EOF'],1),(['files',0,'current','POST','fields','ctime_ns'],'3'),
 (['files',0,'current','PRE','fields','ino'],2),(['files',0,'current','path'],'/foreign'),(['files',1,'relativePath'],PUBLIC[0])]:
 case('public48-export-denial-'+str(path),lambda path=path,value=value:public_mutation(path,value))

def capacity_conservation():
 ns={};tree=ast.parse((S/'native_contract.py').read_bytes())
 body=[n for n in tree.body if isinstance(n,(ast.FunctionDef,ast.Assign)) and not (isinstance(n,ast.Assign)and any(isinstance(v,ast.Name)and v.id in ('ROOT','C7ROOT')for v in n.targets))]
 exec(compile(ast.Module(body=body,type_ignores=[]),'unchanged-native-contract','exec'),ns)
 host=ns['host_demand'](4096);container=ns['demand'](4096)
 assert host['initialAvailableBytesRequired']==13298642944 and host['initialAvailableInodesRequired']==131338
 assert container['initialAvailableBytesRequired']==2604023808 and container['initialAvailableInodesRequired']==21120
 assert ns['PY_RESERVE']==134217728 and ns['NODE_RESERVE']==536870912
 return {'hostAt4096':host,'containerAt4096':container,'capacityObserved':False,'maxOneOwnedVolumeFootprintAtATime':True}
case('literal-capacity-assertions-conserved',capacity_conservation,'STATIC')

output={'scope':'BOUNDED_REPAIR_MOCK_STATIC_ONLY','results':rows,'PASS':sum(r['status']=='PASS'for r in rows),'FAIL':sum(r['status']=='FAIL'for r in rows),
        'nativeExecuted':False,'DockerExecuted':False,'originalBodiesExecuted':False,'sourceEligibility':'AWAIT_FRESH_INDEPENDENT_JUDGE','functionalTask04':False,'sixOriginalOutcomes':'OPEN',
        'SKIPPED':['nativeLinux','Docker','currentOWN20','currentPublic48','original122','eightCompiler20','whole120','FULL_RPC','ROOT','physicalCohorts','Task04Functional']}
with open(N/'controls/repair-control-results4.json','x')as f:json.dump(output,f,indent=2);f.write('\n')
print(json.dumps(output));raise SystemExit(bool(output['FAIL']))
