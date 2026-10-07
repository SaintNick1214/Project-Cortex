"""SOURCE-only tests of actual isolated functions using owned public host descriptors."""
import ast,base64,gzip,hashlib,json,os,re,stat,sys,time,types,zlib,subprocess
from pathlib import Path
N=Path(__file__).resolve().parent
R=Path('/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion')
FIELDS=('dev','ino','mode','nlink','uid','gid','size','mtime_ns','ctime_ns')
def nine(s):return {k:str(getattr(s,'st_'+k)) for k in FIELDS}
def sha(b):return hashlib.sha256(b).hexdigest()
def require(v,msg):
 if not v:raise AssertionError(msg)
class Injected(OSError):pass
receipts=[];source_owners=[]
def source_capture(paths):
 try:
  for p in paths:
   pre=p.lstat();require(stat.S_ISREG(pre.st_mode) and pre.st_nlink==1,'source_regular')
   require(time.time_ns()>=max(pre.st_mtime_ns,pre.st_ctime_ns)+60_000_000_000,'source_maturity:'+str(p))
   fd=os.open(p,os.O_RDONLY|os.O_NOFOLLOW);pin={'path':str(p),'fd':fd,'PRE9':nine(pre),'closeAttempted':False};source_owners.append(pin)
   require(nine(os.fstat(fd))==pin['PRE9'],'source_open_nine')
  bodies={}
  for pin in source_owners:
   raw=bytearray()
   while b:=os.read(pin['fd'],65536):raw.extend(b);require(len(raw)<=16*1024*1024,'source_size')
   require(len(raw)==int(pin['PRE9']['size']) and nine(os.fstat(pin['fd']))==nine(Path(pin['path']).lstat())==pin['PRE9'],'source_fullEOF_allNine')
   pin.update(sha256=sha(raw),bytes=len(raw),fullEOF=True);bodies[Path(pin['path']).name]=bytes(raw)
  return bodies
 except BaseException:
  close_sources();raise

def close_sources():
 failures=[]
 for pin in source_owners:
  if pin['closeAttempted']:continue
  pin['closeAttempted']=True
  try:os.close(pin['fd'])
  except BaseException as e:failures.append(str(e))
 require(not failures,'source_close_failures')

def selected(raw,functions,assignments):
 tree=ast.parse(raw)
 nodes=[n for n in tree.body if isinstance(n,(ast.FunctionDef,ast.AsyncFunctionDef)) and n.name in functions]
 for n in tree.body:
  if isinstance(n,ast.Assign) and any(isinstance(x,ast.Name) and x.id in assignments for x in n.targets):nodes.append(n)
 ns=dict(base64=base64,gzip=gzip,hashlib=hashlib,json=json,os=os,re=re,stat=stat,sys=sys,time=time,types=types,zlib=zlib,Path=Path)
 exec(compile(ast.fix_missing_locations(ast.Module(body=nodes,type_ignores=[])),'<held-isolated-source>','exec',dont_inherit=True),ns)
 return ns,tree

class FaultOS:
 """Explicit isolated namespace injection. A close fault is raised after real close, with no retry."""
 def __init__(self,stage=None,index=None):self.stage=stage;self.index=index;self.fds={};self.open_attempts=[];self.close_attempts=[];self.writes=0;self.error=None
 def __getattr__(self,k):return getattr(os,k)
 def fault(self,stage,index):
  if self.stage==stage and self.index==index:
   self.error=Injected(stage+':'+str(index));raise self.error
 def open(self,p,flags):
  i=int(Path(p).stem.rsplit('-',1)[1]);self.open_attempts.append(i);self.fault('open',i)
  fd=os.open(p,flags);self.fds[fd]=i;return fd
 def fstat(self,fd):self.fault('fstat',self.fds[fd]);return os.fstat(fd)
 def read(self,fd,n):self.fault('read',self.fds[fd]);return os.read(fd,n)
 def close(self,fd):
  require(fd not in self.close_attempts,'unknown_fd_retry');self.close_attempts.append(fd);os.close(fd);self.fault('close',self.fds[fd])
 def write(self,fd,b):
  require(fd==1,'foreign_output_fd');i=self.writes;self.writes+=1;self.fault('report',i);return len(b)

def build_module(raw,kind,fos):
 names={'nine','strict','capture','qualify','emit','close_owned_inputs','retain_error','reserve_source_graph'}
 ns,tree=selected(raw,names,{'AGE','MAX','FIELDS','SOURCE_GRAPH_MAX_FILES','SOURCE_GRAPH_MAX_BYTES','SOURCE_GRAPH_MAX_FILE'})
 ns.update(os=fos,R=R,all_pins=[],held=[],unique_pins={},source_graph_members={},source_graph_bytes=0,cleanup_errors=[],failure=None,failure_chain=[],close_errors=[],output_bytes=0)
 ns['canonical']=lambda *a,**k:None
 ns['time']=types.SimpleNamespace(time_ns=lambda:time.time_ns())
 if kind=='runner':ns['FIELDS']=FIELDS
 return ns,tree

def record(name,details):receipts.append({'name':name,'status':'PASS',**details})
def attempts(ns,kind,fos,primary):
 pins=ns['all_pins'] if kind=='runner' else ns['held'];ns['close_owned_inputs']()
 require(fos.close_attempts==[p['fd'] for p in pins],'all_owned_close_attempts_in_order')
 require(all(p['closeAttempted'] for p in pins),'every_owner_attempted')
 before=list(fos.close_attempts);ns['close_owned_inputs']();require(fos.close_attempts==before,'never_retry_unknown_state')
 if kind=='runner':
  if primary is not None:require(ns['failure']['class']==type(primary).__name__ and ns['failure']['reason']==str(primary)[:500],'sticky_primary')
 else:
  chain=([primary] if primary is not None else [])+ns['close_errors']
  if chain:
   try:raise BaseExceptionGroup('isolated actual observer final chain',chain)
   except BaseExceptionGroup as group:
    if primary is not None:require(group.exceptions[0] is primary,'primary_error_identity_retained')
 return {'opened':len(pins),'closeAttempts':len(fos.close_attempts),'allOwnedAttemptedExactlyOnce':True,'noForeignFDs':set(fos.close_attempts)<=set(fos.fds)}

def python_cases(raw,kind,fixtures):
 for stage in ('open','fstat','maturity','read','parse','report','close','assert'):
  for index in (0,1,2):
   fos=FaultOS(stage,index);ns,tree=build_module(raw,kind,fos);primary=None
   try:
    for i,p in enumerate(fixtures):
     if stage=='maturity':ns['time']=types.SimpleNamespace(time_ns=lambda i=i:0 if i==index else time.time_ns())
     pin=ns['capture'](p,'owned-public-source-control') if kind=='runner' else ns['capture'](p,N,'owned-public-source-control')
     if stage=='assert' and i==index:raise Injected('postopen-assert:'+str(i))
     if stage=='fstat':continue
    if stage not in ('open','fstat','maturity','assert'):
     for i,pin in enumerate(ns['all_pins'] if kind=='runner' else ns['held']):
      row,rawbody=ns['qualify'](pin,collect=True)
      ns['strict'](b'{' if stage=='parse' and i==index else rawbody)
      if stage=='report':
       if kind=='python':ns['emit']({'fixture':i})
       else:fos.write(1,json.dumps({'fixture':i}).encode())
    if stage=='close':primary=Injected('retained-primary-before-close');raise primary
   except BaseException as e:primary=e
   if kind=='runner' and primary is not None:ns['retain_error']('primary',primary,True)
   detail=attempts(ns,kind,fos,primary)
   if stage!='close':require(primary is not None,'fault_must_deny:'+stage)
   else:require(len(ns['cleanup_errors'] if kind=='runner' else ns['close_errors'])==1,'close_fault_sticky')
   if stage in ('fstat','assert'):require(detail['opened']==index+1,'postopen_fault_owner_registered')
   record(kind+':'+stage+':'+str(index),{**detail,'primaryClass':type(primary).__name__,'injectionPosition':index,'scope':'ISOLATED_ACTUAL_SOURCE_HOST_OWNED_FD'})
 # Positive path retains physical full EOF/hash/nine and runs original observer exporter.
 fos=FaultOS();ns,_=build_module(raw,kind,fos)
 pins=[ns['capture'](p,'positive') if kind=='runner' else ns['capture'](p,N,'positive') for p in fixtures]
 for pin in pins:
  row,body=ns['qualify'](pin,collect=True);require(row['fullEOF'] and row['sha256']==sha(body),'positive_fullEOF_hash');ns['strict'](body)
  if kind=='python':ns['emit'](row)
 record(kind+':positive-fullEOF-allNine',attempts(ns,kind,fos,None))

 def finalize(ns,tree):
  outer=next(n for n in tree.body if isinstance(n,ast.Try))
  exec(compile(ast.fix_missing_locations(ast.Module(body=outer.finalbody,type_ignores=[])),'<held-actual-finalizer>','exec',dont_inherit=True),ns)
 if kind=='runner':
  # Actual finalbody reproduces F4 with all held inputs and durable report faults.
  for point in (0,1):
   fos=FaultOS('close',point);ns,tree=build_module(raw,kind,fos)
   for p in fixtures:ns['capture'](p,'actual-finalizer-fixture')
   primary=Injected('original-primary-retained');ns['retain_error']('primary',primary,True)
   writes=[]
   def durable(p,data):
    i=len(writes);writes.append(str(p))
    if i==point:raise Injected('actual-report-write:'+str(i))
   ns.update(C=types.SimpleNamespace(durable_json=durable),RAW=N,OUT=N,NAMES={},results={},records=[],MF_SHA=None,OP='source-fixture',REVIEW_OP='source-fixture',VOLUME='none',DEPS='none',public_transfer_sha=None,control_rows={},source_graph_members={})
   ns['command']=lambda *a,**k:({'exitCode':0},b'',b'')
   finalize(ns,tree)
   require(fos.close_attempts==[p['fd'] for p in ns['all_pins']],'F4_report_fault_all_closes')
   require(ns['failure']['reason']==str(primary),'F4_sticky_primary')
   require(any(x['stage'] in ('final-reconciliation-or-report','input-close-report') for x in ns['failure_chain']),'report_fault_retained')
   require(any(x['stage']=='input-close' for x in ns['failure_chain']),'primary_report_close_all_sticky')
   record('runner:actual-finalbody-report:'+str(point),{'writes':writes,'closeAttempts':len(fos.close_attempts),'stickyPrimary':True,'reportAndCloseErrorsRetained':True,'allOwnedAttemptedExactlyOnce':True})
  # Actual runner body-independent finalizer reports all first/middle/last close failures.
  for i in (0,1,2):
   fos=FaultOS('close',i);ns,tree=build_module(raw,kind,fos)
   for p in fixtures:ns['capture'](p,'close-finalizer')
   ns.update(C=None,RAW=N,OUT=N)
   finalize(ns,tree)
   require(len(fos.close_attempts)==3 and len(ns['cleanup_errors'])==1,'F1_actual_finalbody_all_closes')
   record('runner:actual-finalbody-close:'+str(i),{'closeAttempts':3,'allOwnedAttemptedExactlyOnce':True,'unknownRetry':False})

 def original_invariants(oldraw):
  old=ast.parse(oldraw);new=ast.parse(raw)
  for n in ast.walk(old):
   if isinstance(n,ast.Constant) and isinstance(n.value,str):n.value=n.value.replace('TASK03_ATTEMPT6_REPAIR2_ACTUAL_PUBLIC_REVIEW_HANDOFF','TASK03_ATTEMPT6_REPAIR3_ACTUAL_PUBLIC_REVIEW_HANDOFF').replace('TASK03_ATTEMPT6_PUBLIC_REVIEW_REPAIR2_NAMED_SOURCE_ACCEPTANCE','TASK03_ATTEMPT6_PUBLIC_REVIEW_REPAIR3_NAMED_SOURCE_ACCEPTANCE')
  changed={'capture','close_owned_inputs','retain_error'}
  oldfunctions={n.name:ast.dump(n,include_attributes=False) for n in old.body if isinstance(n,ast.FunctionDef)}
  newfunctions={n.name:ast.dump(n,include_attributes=False) for n in new.body if isinstance(n,ast.FunctionDef)}
  for name,value in oldfunctions.items():
   if name not in changed:require(newfunctions[name]==value,'unchanged_original_function:'+name)
  oldasserts=[ast.dump(n,include_attributes=False) for n in ast.walk(old) if isinstance(n,ast.Assert)]
  newasserts=[ast.dump(n,include_attributes=False) for n in ast.walk(new) if isinstance(n,ast.Assert)]
  from collections import Counter
  require(not(Counter(oldasserts)-Counter(newasserts)),'every_original_assertion_retained')
  record(kind+':all-original-assertions-and-unaffected-functions',{'originalAssertions':len(oldasserts),'retained':True,'allUnaffectedFunctionsEqual':True})
 return original_invariants

def budget_cases(raw):
 ns,_=build_module(raw,'runner',FaultOS())
 for i in range(4096):ns['reserve_source_graph']('/owned-budget/'+str(i),0)
 try:ns['reserve_source_graph']('/owned-budget/4096',0)
 except AssertionError:pass
 else:raise AssertionError('4097_sources_not_denied')
 require(len(ns['source_graph_members'])==4096,'FDledger_not_reset')
 record('runner:one-source-ledger-4096-descriptor-boundary',{'limit':4096,'extraDenied':True})
 ns,_=build_module(raw,'runner',FaultOS())
 for i in range(4):ns['reserve_source_graph']('/owned-byte-budget/'+str(i),16777216)
 ns['reserve_source_graph']('/owned-byte-budget/0',16777216)
 require(ns['source_graph_bytes']==67108864,'duplicate_path_no_budget_reset')
 for label,size in (('aggregate',1),('perfile',16777217),('bool',True),('negative',-1)):
  try:ns['reserve_source_graph']('/owned-byte-budget/'+label,size)
  except AssertionError:pass
  else:raise AssertionError('source_budget_denial:'+label)
  require(ns['source_graph_bytes']==67108864,'nonresetting_after_denial')
  record('runner:one-source-ledger-denial:'+label,{'bytes':67108864,'nonresetting':True})
 try:ns['reserve_source_graph']('/owned-byte-budget/0',16777215)
 except AssertionError:pass
 else:raise AssertionError('duplicate_changed_size_denied')
 record('runner:duplicate-path-size-drift-denial',{'nonresetting':True})


def entry_cases(raw,entry_fixture):
 ns,tree=selected(raw,{'nine','main'},{'FIELDS'})
 expected_raw=b'raise SystemExit(0)\n';pre=entry_fixture.lstat();expected={'PRE9':nine(pre),'sha256':sha(expected_raw),'bytes':len(expected_raw)}
 for stage in ('positive','open','fstat','maturity','read','parse','close','final-nine'):
  fos=FaultOS(stage,3);scope,_=selected(raw,{'nine','main'},{'FIELDS'});scope['os']=fos
  scope['sys']=types.SimpleNamespace(dont_write_bytecode=True,argv=['held-entry',str(entry_fixture),json.dumps(expected),'/source-only-never-read-handoff'])
  scope['time']=types.SimpleNamespace(time_ns=lambda:0 if stage=='maturity' else time.time_ns())
  if stage=='parse':scope['sys'].argv[2]='{'
  if stage=='final-nine':
   original=fos.fstat;calls=[0]
   def last_fstat(fd):
    calls[0]+=1
    if calls[0]==3:raise Injected('entry-final-nine')
    return original(fd)
   fos.fstat=last_fstat
  primary=None
  try:status=scope['main']()
  except BaseException as e:primary=e
  require(len(fos.close_attempts)==len(fos.fds),'entry_all_owned_closes')
  if stage=='positive':require(primary is None and status==0,'entry_positive')
  else:require(primary is not None,'entry_fault_denial')
  record('entry:'+stage,{'opened':len(fos.fds),'closeAttempts':len(fos.close_attempts),'allOwnedAttemptedExactlyOnce':True,'unknownRetry':False,'stage':stage})

def main():
 files=[N/n for n in ('run-actual-review.py','linux-public-observer.py','linux-dependency-observer.mjs','actual-entry.py',Path(__file__).name,'source-fault-controls.mjs')]+list((N/'fixtures').glob('*'))
 U=N.parent/'task03-attempt6-actual-public-custody-readiness-repair2'
 # Old sources are finite historical comparison inputs, never runtime authority.
 files += [U/'run-actual-review.py',U/'linux-public-observer.py',U/'linux-dependency-observer.mjs']
 bodies=source_capture(files)
 # basename duplicates: collect exact source bodies again from held offsets by path, no fresh path read.
 bypath={}
 for p in source_owners:
  os.lseek(p['fd'],0,0);chunks=[]
  while b:=os.read(p['fd'],65536):chunks.append(b)
  raw=b''.join(chunks);require(sha(raw)==p['sha256'] and len(raw)==p['bytes'],'held_repeat_source');bypath[p['path']]=raw
 try:
  fixtures=sorted((N/'fixtures').glob('*.json'));require(len(fixtures)==3,'three_owned_fixtures')
  for name,kind in (('run-actual-review.py','runner'),('linux-public-observer.py','python')):
   check=python_cases(bypath[str(N/name)],kind,fixtures);check(bypath[str(U/name)])
  budget_cases(bypath[str(N/'run-actual-review.py')])
  entry_cases(bypath[str(N/'actual-entry.py')],N/'fixtures/owned-entry-3.py')
  node='/Users/SaintNick/.codex/tmp/cortex-runtime-toolchain-20261005/node_modules/.bin/node'
  payload={'newSource':bypath[str(N/'linux-dependency-observer.mjs')].decode(),'oldSource':bypath[str(U/'linux-dependency-observer.mjs')].decode(),'fixtures':[str(p) for p in fixtures]}
  js=bypath[str(N/'source-fault-controls.mjs')]
  proc=subprocess.run([node,'--input-type=module','-e',js.decode()],input=json.dumps(payload).encode(),stdout=subprocess.PIPE,stderr=subprocess.PIPE,timeout=30,env={'PATH':'/usr/bin:/bin','HOME':'/Users/SaintNick','LANG':'C.UTF-8'})
  require(proc.returncode==0,'JS_control_failure:'+proc.stderr.decode()[:1000]);j=json.loads(proc.stdout);require(j['status']=='PASS','JS_status');receipts.extend(j['controls'])
  for pin in source_owners:require(nine(os.fstat(pin['fd']))==nine(Path(pin['path']).lstat())==pin['PRE9'],'final_source_nine')
 finally:close_sources()
 result={'scope':'U3_SOURCE_ONLY_ISOLATED_FAULT_CONTROLS','status':'PASS','controls':receipts,'count':len(receipts),'nodeVersion':j['nodeVersion'],'sourceInputs':[{k:v for k,v in p.items() if k!='fd'} for p in source_owners],'allSourceFDsClosedExactlyOnce':True,'dockerCommands':0,'privateReads':0,'serviceCalls':0,'unknownForeignEffects':False,'nativeFoundationAccepted':False,'fullTask03':False,'fullGoal':False}
 print(json.dumps(result,separators=(',',':')))
if __name__=='__main__':main()
