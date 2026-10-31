from pathlib import Path
N=Path(__file__).resolve().parents[1];p=N/'controls/repair_controls2.py';t=p.read_text();pos=t.index("output={'scope'")
extra='''
# Exercise actual driver orchestration with all effects replaced; foreign targets get no mutation.
def driver_serial(failure=None):
 events=[]
 class FP:
  def __init__(self,text):self.text=text
  def __truediv__(self,c):return FP(self.text+'/'+str(c))
  def mkdir(self,**kw):events.append('mkdir-public-fixture')
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
  def read_text(self):return 'NSpid:\\t321\\t1\\n'
 def close(fd):
  closed.append(fd)
  if close_at is not None:c.now=close_at
 c.sleep=lambda sec:setattr(c,'now',c.now+sec)
 owner={'pid':321,'startTime':'100','ppid':'1','pgid':'321','sid':'321',
        'rawArgvHex':b'/usr/local/bin/python3.12\\0-B\\0/native-source/native-controller.py\\0'.hex(),'rawStatHex':'00'}
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

'''
p.write_text(t[:pos]+extra+t[pos:])
