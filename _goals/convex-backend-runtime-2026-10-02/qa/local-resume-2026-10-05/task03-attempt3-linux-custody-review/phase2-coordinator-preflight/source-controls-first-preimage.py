"""Public dummy diagnostics and mocked coordinator flow; no services/private reads."""
import ast
import contextlib
import hashlib
import io
import json
import os
from pathlib import Path
import stat
import sys
import time

SOURCE=Path('/source/task03-attempt3-private-coordinate.py')
OUT=Path('/review')
EXPECTED='03ab5f3689a3ca0c634991d4fcb32e84c3b3b8d89defe4e534804604cff977dc'
FIELDS=('st_dev','st_ino','st_mode','st_nlink','st_uid','st_gid','st_size','st_mtime_ns','st_ctime_ns')
def ident(s):return {k:str(getattr(s,k)) for k in FIELDS}
before=SOURCE.lstat();assert stat.S_ISREG(before.st_mode) and before.st_nlink==1
fd=os.open(SOURCE,os.O_RDONLY|os.O_NOFOLLOW)
try:
 assert ident(before)==ident(os.fstat(fd))
 data=os.read(fd,20000);assert not os.read(fd,1)
 assert len(data)==12333 and hashlib.sha256(data).hexdigest()==EXPECTED
 assert ident(before)==ident(os.fstat(fd))==ident(SOURCE.lstat())
 text=data.decode();tree=ast.parse(text,filename=str(SOURCE))
 assert os.getuid()==501 and os.getgid()==20
 assert Path('/sys/fs/cgroup/memory.max').read_text().strip()=='536870912'
 assert Path('/sys/fs/cgroup/memory.swap.max').read_text().strip()=='0'
 declarations=[n for n in tree.body if isinstance(n,(ast.Import,ast.ImportFrom,ast.FunctionDef,ast.Assign))]
 def fresh():
  ns={};exec(compile(ast.Module(body=declarations,type_ignores=[]),str(SOURCE),'exec'),ns);return ns
 ns=fresh();controls=[]
 diagnostic=OUT/'tmp/diagnostic-controls';diagnostic.mkdir(parents=True,mode=0o700)
 ns.update(R=OUT,LOG=diagnostic,TOOL=Path('/usr/local/bin'),RECORDS=[])
 def check(name,value):
  assert value,name;controls.append({'name':name,'status':'PASS'})
 run=ns['run']
 code,paths=run('success',[sys.executable,'-c',"print('public dummy diagnostic')"],5)
 check('Successful command preserves exact stdout and zero exit',code==0 and paths['stdout'].read_bytes()==b'public dummy diagnostic\n' and paths['stderr'].read_bytes()==b'')
 for name,program,expected in [('nonzero',"import sys; print('public dummy failure',file=sys.stderr);sys.exit(7)",'normal'),('stdout-overflow',"import sys;sys.stdout.write('x'*300000)",'ceiling'),('stderr-overflow',"import sys;sys.stderr.write('x'*300000)",'ceiling'),('timeout',"import time;time.sleep(5)",'timeout')]:
  started=time.monotonic()
  try:run(name,[sys.executable,'-c',program],0.15 if expected=='timeout' else 5);raise AssertionError('Expected command rejection')
  except RuntimeError as e:assert str(e)=='fixed_'+name+'_failed'
  row=ns['RECORDS'][-1]
  if expected=='ceiling':check(name+' rejects and retains capped diagnostic',row['failureClass']=='ValueError' and max(row['streamByteCounts'].values())>262144 and max((diagnostic/(name+'.'+s)).stat().st_size for s in ['stdout','stderr'])==262144)
  elif expected=='timeout':check('Timeout rejects terminally without success relabel',row['failureClass']=='TimeoutError' and row['exitCode'] not in [None,0] and time.monotonic()-started<12)
  else:check('Nonzero exit is rejected with exact error diagnostic',row['exitCode']==7 and row['failureClass'] is None and (diagnostic/'nonzero.stderr').read_bytes()==b'public dummy failure\n')
 code,_=run('allowed-nonzero',[sys.executable,'-c','raise SystemExit(9)'],5,required=False)
 check('Optional failure preserves nonzero exit for caller',code==9)
 try:run('missing-executable',['/review/does-not-exist'],5);raise AssertionError('Expected missing executable rejection')
 except RuntimeError:pass
 check('Spawn failure is a retained fixed failure',ns['RECORDS'][-1]['failureClass']=='FileNotFoundError' and ns['RECORDS'][-1]['exitCode'] is None)
 target=diagnostic/'exclusive.json';ns['exclusive_json'](target,{'publicDummy':True});old=target.read_bytes()
 try:ns['exclusive_json'](target,{'publicDummy':'replacement'});raise AssertionError('Expected exclusive write rejection')
 except FileExistsError:pass
 check('Exclusive diagnostic JSON preserves existing bytes',target.read_bytes()==old and stat.S_IMODE(target.stat().st_mode)==0o600)
 check('All public dummy diagnostics and receipts mode0600',all(stat.S_IMODE(p.stat().st_mode)==0o600 and p.stat().st_uid==501 and p.stat().st_gid==20 for p in diagnostic.iterdir()))
 # Execute the original flow only with mocked dispatch/status/retirement and new public dummy paths.
 # No source private directory, Docker/service/CLI command or management helper executes here.
 body=[n for n in tree.body if not isinstance(n,(ast.Expr,ast.Import,ast.ImportFrom,ast.FunctionDef,ast.Assign))]
 flows=[]
 for scenario in ['success','provision-failure-known','receiver-failure','cleanup-state-unknown','retire-failure','wait-timeout','bad-finish-operation']:
  env=fresh();base=OUT/'tmp'/('flow-'+scenario);base.mkdir(mode=0o700)
  s=base/'private-public-dummy';s.mkdir(mode=0o700)
  q=base/'q';q.mkdir(mode=0o700);(q/'tmp').mkdir(mode=0o700)
  log=s/'coordination';export=q/'tmp'/('actual-private-export-'+env['OP'])
  trace=[];statuses=[]
  env.update(S=s,Q=q,P=base/'p',LOG=log,EXPORT=export,PUBLIC=base/'dummy-status.json',RECORDS=[])
  original_pins={}
  for loop in [n for n in tree.body if isinstance(n,ast.For) and isinstance(n.target,ast.Tuple)]:
   if len(loop.target.elts)==2 and isinstance(loop.target.elts[0],ast.Name) and loop.target.elts[0].id=='path':
    for path,expected in eval(compile(ast.Expression(loop.iter),'<public-pins>','eval'),env):original_pins[path]=expected
  env['digest']=lambda path:original_pins[path]
  env['status']=lambda phase,result,**fields:statuses.append({'phase':phase,'status':result,**fields})
  env['signal'].signal=lambda *args:None
  env['retire_linux_selector']=lambda:trace.append('selector-retirement-mocked')
  real_time=env['time']
  class Clock:
   count=0
   def monotonic(self):
    self.count+=1
    return 5000 if scenario=='wait-timeout' and self.count>=2 else 0
   def sleep(self,n):raise AssertionError('Unexpected actual wait in public mocked flow')
  env['time']=Clock()
  def mock_run(label,argv,timeout,input_bytes=None,required=True):
   trace.append(label)
   out=log/(label+'.stdout');err=log/(label+'.stderr');out.touch(mode=0o600);err.touch(mode=0o600)
   if label=='provision':
    (s/'created-project.json').write_text('{"publicDummy":true}')
    if scenario=='provision-failure-known':raise RuntimeError('public_dummy_provision_failure')
   if label=='private-receiver' and scenario=='receiver-failure':raise RuntimeError('public_dummy_receiver_failure')
   if label=='private-receiver-terminal-inspect':
    out.write_text(json.dumps([{'Config':{'Labels':{'cortex.operation':env['OP']}},'State':{'Running':False,'ExitCode':0,'OOMKilled':False},'HostConfig':{'Memory':536870912,'MemorySwap':536870912}}]))
   if label=='private-receiver-remove' and scenario!='wait-timeout':
    (log/'coordinator-finish.json').write_text(json.dumps({'operation':'wrong-operation' if scenario=='bad-finish-operation' else env['OP'],'finish':True}))
   if label.startswith('final-inspect-'):
    err.write_bytes(b'unknown owned state' if scenario=='cleanup-state-unknown' else b'no such object');return 1,{'stdout':out,'stderr':err}
   if label=='retire' and scenario=='retire-failure':raise RuntimeError('public_dummy_retirement_failure')
   return 0,{'stdout':out,'stderr':err}
  env['run']=mock_run
  exit_code=0
  try:exec(compile(ast.Module(body=body,type_ignores=[]),str(SOURCE),'exec'),env)
  except SystemExit as e:exit_code=e.code
  terminal=json.loads((log/'coordinator-terminal.json').read_bytes())
  assert 'retire' in trace,scenario
  if scenario=='success':assert exit_code==0 and statuses[-1]['status']=='PASS' and terminal['completedSignal'] is True and terminal['retired'] is True
  else:assert exit_code==1 and statuses[-1]['status']=='FAIL' and (terminal['failureClass'] is not None or not terminal['completedSignal'])
  assert all(not any(x in str(a) for x in ['scripts/deploy.mjs','scripts/driver.mjs','scripts/qualify.mjs']) for a in trace)
  flows.append({'scenario':scenario,'status':'PASS','dispatchesMocked':True,'trace':trace,'observedExitCode':exit_code,'terminalStatus':statuses[-1]['status'],'knownProjectRetirementAttempted':True,'nativeFoundationAccepted':False,'fullTask03Accepted':False})
  env['time']=real_time
 # Static recipe assertions remain about the exact frozen source, not the mocked paths.
 function_names={n.name for n in tree.body if isinstance(n,ast.FunctionDef)}
 check('Only expected fixed coordinator functions',function_names=={'digest','exclusive_json','status','run','abort','retire_linux_selector'})
 for snippet in ["EXPORT.mkdir(mode=0o700); (EXPORT/'selected').mkdir(mode=0o700)","'--memory','512m','--memory-swap','512m'","'--user','501:20'",",target=/export,readonly",",target=/prep,readonly","'receive','/export/selected','/owned/private'","deadline = time.monotonic() + 2400","run('provision', [str(TOOL/'node'), str(MGMT), 'provision'], 190)","run('retire',[str(TOOL/'node'),str(MGMT),'retire'],190)"]:
  check('Fixed recipe '+snippet[:70],snippet in text)
 check('No root user invocation','\'--user\',\'0:0\'' not in text)
 check('No CLI dispatch source',not any(x in text for x in ['scripts/deploy.mjs','scripts/driver.mjs','scripts/qualify.mjs','--codegen','--typecheck']))
 retirement=ns['retire_linux_selector'].__code__.co_consts
 program=next(v for v in retirement if isinstance(v,str) and 'target-before-physical-retirement.json' in v)
 ast.parse(program)
 check('Selector invalidation program parses and retains original bytes',"os.write(fd,b)==len(b)" in program and "historicalCustodyRepaired\":false" in program)
 check('Private raw diagnostics bound and exclusive',"262144 - counts[n]" in text and "os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600" in text)
 assert ident(before)==ident(os.fstat(fd))==ident(SOURCE.lstat())
 result={'status':'PASS','scope':'EXACT_SOURCE_FIRST_USE_REVIEW_PUBLIC_DUMMY_ONLY','sourceSha256':EXPECTED,'sourceBytes':len(data),'sourceCurrentIdentityDecimal':ident(before),'sourceHeldPathAll9':'PASS','diagnosticAndRecipeControls':controls,'mockedFlowControls':flows,'diagnosticControlCount':len(controls),'flowControlCount':len(flows),'actualPrivateReads':0,'actualServiceRequests':0,'actualDockerManagementCalls':0,'actualCliDispatches':0,'actualRetirements':0,'actualNativeOrPaidCalls':0,'actualMemoryBytes':536870912,'actualSwapMaxBytes':0,'realTargetOrPrivateCustodyAccepted':False}
 print(json.dumps(result));sys.stdout.flush()
 assert ident(before)==ident(os.fstat(fd))==ident(SOURCE.lstat())
finally:os.close(fd)
