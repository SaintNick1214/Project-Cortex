"""Independent bounded U4 source-code/host review. No Docker/runtime authority."""
import ast, base64, datetime, gzip, hashlib, json, math, os, re, resource, stat, subprocess, sys, time, types, zlib
from pathlib import Path
R=Path('/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion')
J=Path(__file__).resolve().parent
N=R/'_goals/convex-backend-runtime-2026-10-02/qa/local-resume-2026-10-05/task03-attempt6-actual-public-entry-compatibility-repair4'
P=N.parent
U3=P/'task03-attempt6-actual-public-custody-readiness-repair3'
U2=P/'task03-attempt6-actual-public-custody-readiness-repair2'
FIELDS=('dev','ino','mode','nlink','uid','gid','size','mtime_ns','ctime_ns')
MAXPATH=4096; MAXTOTAL=67108864; MAXFILE=16777216; AGE=240000000000
PRIOR_RESERVED=3231794+10082+2097152
REAL_OS=os
owners=[]; cache={}; bypath={}; events=[]; errors=[]; outputs=[]; extra=[]; reserved=PRIOR_RESERVED
def nine(s):return {k:str(getattr(s,'st_'+k))for k in FIELDS}
def sha(b):return hashlib.sha256(b).hexdigest()
def strict(b):
 def pairs(xs):
  d={}
  for k,v in xs:
   if k in d:raise ValueError('duplicate')
   d[k]=v
  return d
 def finite(x):
  v=float(x)
  if not math.isfinite(v):raise ValueError('overflow')
  return v
 return json.loads(b,object_pairs_hook=pairs,parse_float=finite,parse_constant=lambda x:(_ for _ in()).throw(ValueError('nonfinite')))
def acquire(row):
 global reserved
 p=Path(row['path']);key=str(p)
 if key in bypath:
  old=bypath[key];assert old['expected']==row or old['expected']['sha256']==row['sha256'];return old
 assert p.is_absolute()and p.resolve()==p
 s=p.lstat();assert stat.S_ISREG(s.st_mode)and s.st_nlink==1 and s.st_uid==501 and s.st_gid==20
 age=time.time_ns()-max(s.st_mtime_ns,s.st_ctime_ns);assert age>=AGE
 assert type(row['bytes'])is int and 0<=row['bytes']<=MAXFILE and s.st_size==row['bytes']
 assert len(bypath)+1<=MAXPATH and reserved+row['bytes']<=MAXTOTAL
 fd=os.open(p,os.O_RDONLY|os.O_NOFOLLOW)
 pin={'path':key,'fd':fd,'PRE9':nine(s),'expected':row,'ageBeforeFirstCaptureNs':age,'closeAttempted':False,'fullEOF':False}
 owners.append(pin);bypath[key]=pin;reserved+=row['bytes']
 assert nine(os.fstat(fd))==pin['PRE9']
 if row.get('PRE9')is not None:assert pin['PRE9']==row['PRE9'],'original_pin_changed:'+key
 events.append({'phase':'acquire','path':key})
 return pin
def eof(pin):
 fd=pin['fd'];os.lseek(fd,0,0);h=hashlib.sha256();raw=bytearray()
 while True:
  b=os.read(fd,65536)
  if not b:break
  raw.extend(b);h.update(b);assert len(raw)<=pin['expected']['bytes']<=MAXFILE
 assert os.read(fd,1)==b'' and len(raw)==pin['expected']['bytes'] and h.hexdigest()==pin['expected']['sha256']
 assert nine(os.fstat(fd))==nine(Path(pin['path']).lstat())==pin['PRE9']
 pin.update(fullEOF=True,sha256=h.hexdigest(),bytes=len(raw))
 cache[pin['path']]=bytes(raw);events.append({'phase':'eof','path':pin['path']})
 return bytes(raw)
def fence():
 assert all(p['fullEOF'] for p in owners),'premature_check_expected_DENY'
 for pin in owners:eof(pin)
 events.append({'phase':'check','paths':len(owners)})
def close_all():
 for pin in owners:
  if pin['closeAttempted']:continue
  pin['closeAttempted']=True
  try:os.close(pin['fd']);pin['closed']=True
  except BaseException as e:errors.append({'stage':'source-close','path':pin['path'],'class':type(e).__name__,'reason':str(e)})
 for pin in extra:
  if pin['closeAttempted']:continue
  pin['closeAttempted']=True
  try:REAL_OS.close(pin['fd']);pin['closed']=True;errors.append({'stage':'unexpected-control-FD-residual','path':pin['path']})
  except BaseException as e:errors.append({'stage':'control-fallback-close','class':type(e).__name__,'reason':str(e)})
def durable(p,b):
 p=Path(p);assert p.is_relative_to(J)and p.parent.resolve().is_relative_to(J)
 fd=REAL_OS.open(p,os.O_WRONLY|os.O_CREAT|os.O_EXCL|os.O_NOFOLLOW,0o600)
 try:
  v=memoryview(b)
  while v:
   n=REAL_OS.write(fd,v);assert n>0;v=v[n:]
  REAL_OS.fsync(fd)
 finally:REAL_OS.close(fd)
 outputs.append({'path':str(p),'bytes':len(b),'sha256':sha(b)})
def report(p,v):durable(p,(json.dumps(v,indent=2)+'\n').encode())
def phase_assertions():
 global owners,eof
 saved_owners,saved_eof=owners,eof
 rows=[{'fullEOF':False},{'fullEOF':False}];denied=False;calls=[]
 try:
  owners=rows
  def fixture_free_eof(pin):assert pin['fullEOF'];calls.append(pin)
  eof=fixture_free_eof
  try:fence()
  except AssertionError as error:denied=str(error)=='premature_check_expected_DENY'
  assert denied and calls==[]
  order=['declare','acquire-all']
  for row in rows:row['fullEOF']=True
  order+=['eof-all'];fence();assert calls==rows
  order+=['check','compile-controls','final','close-all']
  assert order==['declare','acquire-all','eof-all','check','compile-controls','final','close-all']
  return {'prematureCheckDenied':True,'correctEOFBeforeCheckOrder':order,'scope':'FIXTURE_FREE_ACTUAL_REVIEWER_FENCE_ACTION_ORDER'}
 finally:owners,eof=saved_owners,saved_eof
class ControlOS:
 """All source/control opens use original pool pins; declared control writes only."""
 def __getattr__(self,k):return getattr(REAL_OS,k)
 def open(self,p,flags,*args):
  key=str(Path(p));source=key in bypath
  if source:
   assert flags==REAL_OS.O_RDONLY|REAL_OS.O_NOFOLLOW or flags==REAL_OS.O_RDONLY
   pin=bypath[key];assert nine(Path(key).lstat())==pin['PRE9']
   assert len(owners)+sum(not q['closeAttempted']for q in extra)<MAXPATH
  elif key!='/dev/null':raise AssertionError('undeclared_source_open:'+key)
  fd=REAL_OS.open(p,flags,*args)
  rec={'fd':fd,'path':key,'closeAttempted':False,'source':source};extra.append(rec)
  if source:assert nine(REAL_OS.fstat(fd))==bypath[key]['PRE9']
  return fd
 def close(self,fd):
  found=next((q for q in reversed(extra)if q['fd']==fd and not q['closeAttempted']),None)
  assert found is not None,'unknown_or_retried_control_close'
  found['closeAttempted']=True;REAL_OS.close(fd);found['closed']=True
def raw(path):return cache[str(path)]
def definitions(path):
 t=ast.parse(raw(path));nodes=[]
 for n in t.body:
  if isinstance(n,ast.Try):break
  nodes.append(n)
 ns={'__name__':'held_reachable_runner','__file__':str(path)}
 exec(compile(ast.fix_missing_locations(ast.Module(body=nodes,type_ignores=[])),str(path),'exec',dont_inherit=True),ns)
 return ns,t
def module(path):
 m=types.ModuleType('held_'+Path(path).stem);m.__file__=str(path);m.__package__=''
 exec(compile(raw(path),str(path),'exec',dont_inherit=True),m.__dict__)
 return m
C=None; command_rows=[]
ENV={'PATH':'/usr/bin:/bin','LANG':'C.UTF-8','CORTEX_COORDINATOR_CWD':str(R)}
def bounded(label,argv,timeout=30,input_bytes=None):
 assert len(command_rows)<48 and 0<timeout<=190
 row,out,err=C.run(label,argv,J/'raw',timeout,ENV,input_bytes=input_bytes,required=False)
 command_rows.append(row);assert row['terminal']is True and row['closeErrors']==[] and row['failureClass']is None and row['exitCode']==0
 return out
def original97():
 code=raw(N/'source-fault-controls4.py')
 ns={'__name__':'isolated_author_control','__file__':str(N/'source-fault-controls4.py')}
 exec(compile(code,str(N/'source-fault-controls4.py'),'exec',dont_inherit=True),ns)
 ns['os']=ControlOS()
 class NodeBound:
  def run(self,argv,**kw):
   assert argv[0]=='/Users/SaintNick/.codex/tmp/cortex-runtime-toolchain-20261005/node_modules/.bin/node'
   assert argv[1:3]==['--input-type=module','-e']
   assert argv[3].encode()==raw(U3/'source-fault-controls.mjs')
   out=bounded('original97-node',argv,30,kw['input'])
   return types.SimpleNamespace(returncode=0,stdout=out,stderr=b'')
 ns['subprocess']=NodeBound()
 saved_stdout=sys.stdout
 class Stdout:
  def write(self,v):captured.append(v);return len(v)
  def flush(self):pass
 captured=[]
 try:sys.stdout=Stdout();ns['main']()
 finally:sys.stdout=saved_stdout
 result=strict(''.join(captured));assert result['status']=='PASS'and result['count']==97
 assert all(p['closeAttempted']for p in extra)
 report(J/'original97-independent.json',result)
 return result
def entry_and_wiring():
 rows=[]
 fixture=U3/'fixtures/owned-entry-3.py';pin=bypath[str(fixture)]
 for interp,label,version in [('/usr/bin/python3','exact39','3.9.6'),('/opt/homebrew/bin/python3','supported314','3.14.8')]:
  out=bounded('entry-'+label,[interp,'-B','-c',raw(N/'entry-compatibility-controls.py').decode()],30,json.dumps({'entry':raw(N/'actual-entry.py').decode(),'fixture':str(fixture),'fixturePin':{'PRE9':pin['PRE9'],'bytes':pin['bytes'],'sha256':pin['sha256']},'entryPath':str(N/'actual-entry.py')}).encode())
  v=strict(out);assert v['count']==28 and v['status']=='PASS'and v['pythonVersion'].startswith(version);report(J/('entry-'+label+'.json'),v);rows.append(v)
  payload={'runner':raw(N/'run-actual-review.py').decode(),'oldRunner':raw(U3/'run-actual-review.py').decode(),'entry':raw(N/'actual-entry.py').decode(),'oldEntry':raw(U3/'actual-entry.py').decode()}
  out=bounded('wiring-'+label,[interp,'-B','-c',raw(N/'successor-wiring-controls.py').decode()],30,json.dumps(payload).encode())
  v=strict(out);assert v['count']==16 and v['status']=='PASS'and v['pythonVersion'].startswith(version);report(J/('wiring-'+label+'.json'),v);rows.append(v)
 return rows
RUN_FAULT_PROGRAM=r'''
import ast,base64,hashlib,json,os,re,resource,stat,sys,time,types,zlib
from pathlib import Path
P=json.loads(sys.stdin.buffer.read());tree=ast.parse(P['runner']);nodes=[]
for node in tree.body:
 if isinstance(node,ast.Try):break
 nodes.append(node)
code=compile(ast.fix_missing_locations(ast.Module(body=nodes,type_ignores=[])),P['path'],'exec',dont_inherit=True)
final=next(n for n in tree.body if isinstance(n,ast.Try)).finalbody
finalcode=compile(ast.fix_missing_locations(ast.Module(body=final,type_ignores=[])),P['path'],'exec',dont_inherit=True)
class Fault(BaseException):pass
class Close(OSError):pass
class Report(OSError):pass
class FakePath:
 def __init__(self,n):self.n=n
 def is_dir(self):return True
 def __truediv__(self,n):return FakePath(self.n+'/'+n)
 def __str__(self):return self.n
rows=[]
for primarykind in ('none','Exception','BaseException','SystemExit0','SystemExit7','KeyboardInterrupt'):
 for close_index in (None,0,1,2,'all'):
  ns={'__name__':'held_actual_runner','__file__':P['path']};exec(code,ns)
  primary={'none':None,'Exception':RuntimeError('primary'),'BaseException':Fault('base'),'SystemExit0':SystemExit(0),'SystemExit7':SystemExit(7),'KeyboardInterrupt':KeyboardInterrupt('interrupt')}[primarykind]
  attempts=[];children=[]
  class OS:
   def close(self,fd):
    assert fd not in attempts;attempts.append(fd)
    if close_index=='all'or fd==close_index:
     e=Close('close-'+str(fd));children.append(e);raise e
  ns.update(os=OS(),all_pins=[{'fd':i,'path':'owned-'+str(i),'closeAttempted':False}for i in range(3)],C=None,OUT=FakePath('/owned'),RAW=FakePath('/owned/raw'))
  if primary is not None:ns['retain_error']('primary',primary,True)
  exec(finalcode,ns)
  assert attempts==[0,1,2]and all(p['closeAttempted']for p in ns['all_pins'])
  ns['close_owned_inputs']();assert attempts==[0,1,2]
  assert len(ns['cleanup_errors'])==len(children)
  if primary is not None:assert ns['failure']=={'class':type(primary).__name__,'reason':str(primary)}
  assert [r['reason']for r in ns['failure_chain']if r['stage']=='input-close']==[str(e)for e in children]
  rows.append({'name':'actual-final:'+primarykind+':'+str(close_index),'status':'PASS','allOwnedCloses':3,'noRetry':True,'retainedChildren':len(children)+(primary is not None)})
for reportpoint in (0,1):
 ns={'__name__':'held_actual_runner','__file__':P['path']};exec(code,ns);attempts=[];written=[]
 primary=RuntimeError('original-primary')
 class OS:
  def close(self,fd):assert fd not in attempts;attempts.append(fd);raise Close('owned-close-'+str(fd))
 class C:
  def durable_json(self,p,v):
   i=len(written);written.append(str(p))
   if i==reportpoint:raise Report('report-'+str(i))
 ns.update(os=OS(),C=C(),OUT=FakePath('/owned'),RAW=FakePath('/owned/raw'),NAMES={},all_pins=[{'fd':i,'path':'owned-'+str(i),'closeAttempted':False}for i in range(3)])
 ns['retain_error']('primary',primary,True)
 ns['command']=lambda *a,**k:({'exitCode':0},b'',b'')
 ns['qualify']=lambda p:None
 exec(finalcode,ns)
 assert attempts==[0,1,2]and ns['failure']['reason']=='original-primary'
 assert len([r for r in ns['failure_chain']if r['stage']=='input-close'])==3
 assert any(r['stage']in('final-reconciliation-or-report','input-close-report')for r in ns['failure_chain'])
 rows.append({'name':'actual-final-report:'+str(reportpoint),'status':'PASS','allOwnedCloses':3,'allReportCloseChildrenRetained':True})
for fault in (RuntimeError('run'),Fault('run-base'),SystemExit(0),SystemExit(7)):
 ns={'__name__':'held_actual_runner','__file__':P['path']};exec(code,ns)
 class C:
  def run(self,*a,**k):raise fault
 ns.update(C=C(),source_graph_complete=True)
 try:ns['command']('fake-external-boundary',['/never-docker'],30)
 except BaseException as error:assert error is fault;ns['retain_error']('primary',error,True)
 else:raise AssertionError('reachable_command_fault_not_denied')
 assert ns['failure']=={'class':type(fault).__name__,'reason':str(fault)}
 rows.append({'name':'actual-command:'+type(fault).__name__+':'+str(fault),'status':'PASS','originalErrorRetainedAtBoundary':True,'externalEffects':0})
print(json.dumps({'scope':'ACTUAL_UNMODIFIED_RUNNER_FUNCTIONS_AND_FINALBODY_SOURCE_MOCK','status':'PASS','count':len(rows),'controls':rows,'pythonVersion':sys.version,'pythonExecutable':sys.executable,'actualDocker':0}))
'''
def run_faults():
 rows=[]
 for interp,label,version in [('/usr/bin/python3','exact39','3.9.6'),('/opt/homebrew/bin/python3','supported314','3.14.8')]:
  out=bounded('run-fault-'+label,[interp,'-B','-c',RUN_FAULT_PROGRAM],30,json.dumps({'runner':raw(N/'run-actual-review.py').decode(),'path':str(N/'run-actual-review.py')}).encode())
  v=strict(out);assert v['status']=='PASS'and v['count']==36 and v['pythonVersion'].startswith(version)
  report(J/('run-fault-'+label+'.json'),v);rows.append(v)
 return rows
def highfd():
 path=U2/'highfd-controls.py';tree=ast.parse(raw(path));changes=0
 for node in tree.body:
  if isinstance(node,ast.Assign)and any(isinstance(t,ast.Name)and t.id=='OUT'for t in node.targets):
   assert ast.dump(node.value,include_attributes=False)==ast.dump(ast.parse("N/'highfd-controls1'",mode='eval').body,include_attributes=False)
   node.value=ast.parse(repr(str(J/'host-raw')),mode='eval').body;changes+=1
 assert changes==1
 ns={'__name__':'held_original_highfd_controls','__file__':str(path)}
 split=next(i for i,n in enumerate(tree.body)if isinstance(n,ast.Assign)and any(isinstance(t,ast.Tuple)and [x.id for x in t.elts]==['soft','hard']for t in n.targets))
 exec(compile(ast.fix_missing_locations(ast.Module(body=tree.body[:split],type_ignores=[])),str(path),'exec',dont_inherit=True),ns)
 ns['os']=ControlOS()
 exec(compile(ast.fix_missing_locations(ast.Module(body=tree.body[split:],type_ignores=[])),str(path),'exec',dont_inherit=True),ns)
 summary=strict((J/'host-raw/controls-summary.json').read_bytes())
 assert summary['status']=='PASS'and len(summary['commands'])==11
 assert len(command_rows)+11<=48
 return {'scope':'ORIGINAL_HIGHFD_HOST_ASSERTIONS_ONLY_EXACT_OUT_ASSIGNMENT_INTERCEPTION','originalNineHostCommands':9,'additionalHostCommands':2,'totalCommands':11,'status':'PASS','originalSourceAssertionsUnmodified':True,'sourceEffects':0}
def main():
 global C,reserved
 assert Path.cwd()==R and sys.dont_write_bytecode and sys.version.startswith('3.14.8')
 J.mkdir(exist_ok=True);(J/'raw').mkdir(mode=0o700)
 # The exact-command bootstrap transfers the SAME already-owned own-source rows;
 # candidate member bytes never precede complete declared acquisition.
 transferred=globals().get('BOOTSTRAP_ROWS')
 if transferred:
  assert not owners and len(transferred)==4
  for pin in transferred:
   owners.append(pin);bypath[pin['path']]=pin;cache[pin['path']]=pin.pop('bootstrapBody')
   reserved+=pin['bytes'];assert reserved<=MAXTOTAL
  events.append({'phase':'bootstrap-owned-same-FD-transfer','paths':4})
  stop_path=J/'reviewer-writers-stopped1.json';plan_path=J/'reviewer-inputs-plan1.json'
  stop=strict(cache[str(stop_path)]);plan=strict(cache[str(plan_path)])
  assert stop['writers']=='STOPPED'and stop['remainingWrites']==[]
  assert sha(cache[str(plan_path)])==stop['planSha256']
  declare=plan['rows']
  events.append({'phase':'declare','paths':len(declare)+4})
  for row in declare:acquire(row)
  events.append({'phase':'acquire-all','paths':len(owners)})
  for pin in owners:eof(pin)
  events.append({'phase':'eof-all','paths':len(owners)});fence()
  return run_controls()
 raise AssertionError('exact_owned_bootstrap_required_no_direct_script_invocation')
def run_controls():
 global C
 action=phase_assertions()
 C=module(U2/'coordinate-common-highfd.py')
 assert C.PIPE_LIMIT==262144 and C.INPUT_LIMIT==327692
 events.append({'phase':'compile-controls'})
 original=original97();portable=entry_and_wiring();runner=run_faults();host=highfd()
 fence();events.append({'phase':'final'})
 result={'scope':'U4_ORIGINAL_SOURCE_CODE_BEHAVIOR_HOST_SCOPE_ONLY','status':'PASS','sourceEligibility':False,'runtimeAuthority':False,'fullTask03':False,'originalTask03FunctionalAcceptance':'0/3','dockerCalls':0,'privateReads':0,'serviceCalls':0,'networkCalls':0,'phaseOrder':action,'original97':original['count'],'entryAndWiringExecutions':sum(v['count']for v in portable),'runnerFaultExecutions':sum(v['count']for v in runner),'host':host,'sourcePaths':len(bypath),'sourceBytes':sum(p['bytes']for p in owners),'nonresettingReservedBytes':reserved,'priorReservedBytes':PRIOR_RESERVED,'events':events}
 report(J/'behavior-result1.json',result)
def execute_review():
 primary=None
 try:main()
 except BaseException as e:primary=e;errors.append({'stage':'primary','class':type(e).__name__,'reason':str(e)})
 finally:
  try:
   if owners and all(p.get('expected')and p.get('fullEOF')for p in owners):fence()
  except BaseException as e:errors.append({'stage':'final-source','class':type(e).__name__,'reason':str(e)})
  close_all()
  report(J/'final-source-close1.json',{'scope':'FINAL_ALL_OWNED_SOURCE_CLOSE_ONCE_NO_RUNTIME_ACCEPTANCE','sourceEligibility':False,'errors':errors,'closeAttempts':len(owners),'successfulCloses':sum(p.get('closed')is True for p in owners),'rows':[{k:v for k,v in p.items()if k!='fd'}for p in owners],'controlOwnedFDs':extra,'events':events,'commandRows':command_rows,'reservedBytes':reserved,'priorReservedBytes':PRIOR_RESERVED})
 if primary is not None or errors:raise SystemExit(1)
if __name__=='__main__':execute_review()
