"""Distinct independent correction of two reviewer oracles; candidate sources immutable."""
import ast,copy,hashlib,json,os,stat,sys,time,types
from pathlib import Path
CONFIG=json.loads("{\"J\":\"/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion/_goals/convex-backend-runtime-2026-10-02/qa/local-resume-2026-10-05/task04-r4-c6-independent-source-review1\",\"P\":\"/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion/_goals/convex-backend-runtime-2026-10-02/qa/local-resume-2026-10-05\",\"MF\":{\"path\":\"/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion/_goals/convex-backend-runtime-2026-10-02/qa/local-resume-2026-10-05/task04-current-producer-native-public-consumer-repair4/source-epoch3/closed-source-reference-manifest.json\",\"sha256\":\"13b40faf3aebbea6cef43d510c940b327d7750436ea39bdb7140e3adb488b8a3\",\"bytes\":413751,\"PRE9\":{\"dev\":\"16777234\",\"ino\":\"92937552\",\"mode\":\"33152\",\"nlink\":\"1\",\"uid\":\"501\",\"gid\":\"20\",\"size\":\"413751\",\"mtime_ns\":\"1791403900502228925\",\"ctime_ns\":\"1791403904575324401\"}},\"oldCI\":{\"path\":\"/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion/_goals/convex-backend-runtime-2026-10-02/qa/local-resume-2026-10-05/task04-current-producer-native-public-repair3/source/ci-run.py\",\"sha256\":\"c95d1b7e59ab9a47bb35b83a2bd74ae2cc6c57cbf8a2dd056836d30ae70ba0e5\",\"bytes\":28160,\"PRE9\":{\"dev\":\"16777234\",\"ino\":\"92495015\",\"mode\":\"33152\",\"uid\":\"501\",\"gid\":\"20\",\"nlink\":\"1\",\"size\":\"28160\",\"mtime_ns\":\"1791320364047804096\",\"ctime_ns\":\"1791320375718463407\"}},\"priorRaw\":{\"bytes\":71673,\"path\":\"/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion/_goals/convex-backend-runtime-2026-10-02/qa/local-resume-2026-10-05/task04-r4-c6-independent-source-review1/independent-candidate-controls8.json\",\"sha256\":\"09e514dddc05daff387a819898977502531d01e743e6868d7ca72eabb4de4cc9\"},\"priorClosure\":{\"bytes\":507572,\"path\":\"/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion/_goals/convex-backend-runtime-2026-10-02/qa/local-resume-2026-10-05/task04-r4-c6-independent-source-review1/source-holder8-final-closure.json\",\"sha256\":\"65cf02e52bec94a935a679e276cca13e810b1df12dd04b17be6213444495c6f4\"},\"priorAdmissions\":642,\"priorBytes\":14925572,\"memberPaths\":[\"/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion/_goals/convex-backend-runtime-2026-10-02/qa/local-resume-2026-10-05/task04-current-producer-native-public-repair4/source-successor2/ci-run.py\",\"/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion/_goals/convex-backend-runtime-2026-10-02/qa/local-resume-2026-10-05/task04-current-producer-native-public-repair4/source/native_export.py\",\"/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion/_goals/convex-backend-runtime-2026-10-02/qa/local-resume-2026-10-05/task04-current-producer-native-public-consumer-repair4/controls/repair4_fault_controls2.py\"],\"sourcePath\":\"/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion/_goals/convex-backend-runtime-2026-10-02/qa/local-resume-2026-10-05/task04-r4-c6-independent-source-review1/two-gap-review1.py\",\"stopPath\":\"/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion/_goals/convex-backend-runtime-2026-10-02/qa/local-resume-2026-10-05/task04-r4-c6-independent-source-review1/two-gap-review1-stop.json\",\"selfCheckPath\":\"/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion/_goals/convex-backend-runtime-2026-10-02/qa/local-resume-2026-10-05/task04-r4-c6-independent-source-review1/two-gap-prestop-selfchecks1.json\"}")
FIELDS=('dev','ino','mode','uid','gid','nlink','size','mtime_ns','ctime_ns')
def nine(s):return{k:str(getattr(s,'st_'+k))for k in FIELDS}
def digest(b):return hashlib.sha256(b).hexdigest()
def encode(x):return(json.dumps(x,sort_keys=True,separators=(',',':'))+'\n').encode()
def chain(e):
 out=[];seen=set()
 def visit(v):
  if not isinstance(v,BaseException)or id(v)in seen:return
  seen.add(id(v));out.append(v)
  for x in getattr(v,'exceptions',()):visit(x)
  visit(getattr(v,'primaryFailure',None))
  for x in getattr(v,'failures',()):
   if isinstance(x,(list,tuple)):
    for y in x:visit(y)
   else:visit(x)
  for x in getattr(v,'closeFailures',()):
   if isinstance(x,(list,tuple)):
    for y in x:visit(y)
   else:visit(x)
  visit(v.__cause__);visit(v.__context__)
 visit(e);return out
def top_guard(source):
 tree=ast.parse(source)
 nodes=[n for n in tree.body if isinstance(n,ast.If)and any(isinstance(k,ast.Name)and k.id=='__name__'for k in ast.walk(n.test))]
 assert len(nodes)==1,'EXACT_ACTUAL_TOP_LEVEL_MAIN_GUARD'
 return nodes[0]
def old_guard(source):
 node=top_guard(source)
 loops=[n for n in ast.walk(node)if isinstance(n,ast.For)and isinstance(n.iter,ast.Name)and n.iter.id=='SOURCE_HELD']
 assert len(loops)==1,'EXACT_OLD_FINALLY_SOURCE_CLOSE_LOOP'
 loop=loops[0]
 assert any(isinstance(n,ast.Expr)and isinstance(n.value,ast.Call)and isinstance(n.value.func,ast.Attribute)and n.value.func.attr=='close'for n in loop.body),'DIRECT_OLD_CLOSE_NOT_OUTER_GUARDED'
 assert any(isinstance(n,ast.Try)and loop in n.finalbody for n in ast.walk(node)),'OLD_CLOSE_ACTUAL_FINALLY_REACHABILITY'
 return node
def unique_closes(index):return tuple(dict.fromkeys((1,index)))
def ci_guard_case(source,old,stage,index,primary_kind=None):
 closed=[];fenced=[];events=[];owned=[]
 primary=SystemExit(0)if primary_kind=='exit0'else SystemExit(7)if primary_kind=='exit7'else MemoryError('original-primary')
 close_error=OSError('original-close-'+str(index));report_error=OSError('original-cleanup-report')
 class H:
  def __init__(self,n):self.n=n;self.detached=False;owned.append(self)
  def fence(self,full=False):assert full;fenced.append(self.n);return {'n':self.n}
  def close(self):
   assert not self.detached;self.detached=True;closed.append(self.n)
   if stage=='close'and self.n==index:raise close_error
 holders=[H(i)for i in (1,2,3)]
 def main():
  events.append('actual-main-stub-reached')
  if primary_kind is not None:raise primary
 def cleanup():
  events.append('actual-cleanup-stub-reached')
  if stage=='report':raise MemoryError('owned-cleanup')
 def save(name,value):
  events.append('save:'+name)
  if stage=='report'and name=='cleanup-failure.json':raise report_error
 g={'__name__':'__main__','main':main,'cleanup':cleanup,'save':save,'SOURCE_HELD':holders,'SOURCE_DIRS':[],'RUN':Path('/mock/owned'),
    'WHOLE_END':None,'time':types.SimpleNamespace(monotonic=lambda:1),'phase':lambda*a:None,'remaining':lambda:1,
    'fence_directories':lambda*a:None,'artifact_manifest':lambda:None,'sys':sys}
 if old:node=old_guard(source)
 else:
  defs=[n for n in ast.parse(source).body if isinstance(n,(ast.ClassDef,ast.FunctionDef))and n.name in ('EntryFailure','entry')]
  assert len(defs)==2;exec(compile(ast.Module(body=defs,type_ignores=[]),'actual-repaired-entry-definitions','exec'),g);node=top_guard(source)
 error=None
 try:exec(compile(ast.Module(body=[node],type_ignores=[]),'actual-original-or-current-top-level-main-guard','exec'),g)
 except BaseException as e:error=e
 assert 'actual-main-stub-reached'in events and 'actual-cleanup-stub-reached'in events
 if old:
  expected=list(range(1,index+1))if stage=='close'else[]
  assert closed==expected,'ACTUAL_OLD_FINALLY_ABANDONMENT_NOT_REACHED'
  assert error is close_error if stage=='close'else error is report_error
  assert len(closed)<3,'NEGATIVE_PROOF_REQUIRES_LATER_OWNERS_ABANDONED'
 else:
  assert closed==[1,2,3]and fenced==[1,2,3]and g['SOURCE_HELD']==[]
  assert error is not None
  originals=[close_error if stage=='close'else report_error]
  if primary_kind is not None:originals.append(primary)
  assert all(any(e is original for e in chain(error))for original in originals),'CURRENT_STICKY_ORIGINAL_ERROR_LOST'
 return {'topLevelMainGuardLine':node.lineno,'actualFinallyReached':True,'closeAttempts':closed,'unattemptedOldOwners':[h.n for h in owned if not h.detached]if old else[],'zeroRetries':True,'originalFailuresRetained':not old,'events':events,'effects':0}
def selfchecks():
 rows=[]
 def check(n,f):f();rows.append({'name':n,'status':'PASS_ORACLE_SETUP_ONLY'})
 for i,expected in ((1,(1,)),(12,(1,12)),(23,(1,23))):check('distinct-owned-close-tuple-'+str(i),lambda i=i,e=expected:unique_closes(i)==e or (_ for _ in()).throw(AssertionError('duplicate')))
 fixture="""if __name__=='__main__':
 primary=None
 try:main()
 except BaseException as error:
  primary=error
 finally:
  try:cleanup()
  except BaseException as error:save('cleanup-failure.json',{'error':repr(error)})
  for h in SOURCE_HELD:
   try:h.fence(full=True)
   except BaseException as error:primary=error
   h.close()
"""
 for i in (1,2):check('oracle-reaches-actual-finally-first-middle-'+str(i),lambda i=i:ci_guard_case(fixture,True,'close',i))
 check('oracle-reaches-cleanup-report-before-source-close',lambda:ci_guard_case(fixture,True,'report',1))
 wrong="def main():\n pass\n"
 try:old_guard(wrong)
 except AssertionError:rows.append({'name':'main-definition-only-denied','status':'PASS_ORACLE_SETUP_ONLY'})
 else:raise AssertionError('wrong seam accepted')
 return {'scope':'REVIEWER_ORACLE_SELF_CHECKS_NOT_CANDIDATE','PASS':len(rows),'FAIL':0,'rows':rows}
class Source:
 def __init__(self):self.owned=[];self.rows={};self.bodies={};self.count=CONFIG['priorAdmissions'];self.total=CONFIG['priorBytes'];self.closes=[];self.final=[]
 def opens(self,rows,charge=True):
  # Canonicalize complete requested map before any descriptor opens.
  expected={}
  for r in rows:
   p=r['path']
   if p in expected:assert all(expected[p].get(k)==r.get(k)for k in ('sha256','bytes','PRE9')),'CONFLICTING_DUPLICATE'
   else:expected[p]=r
  added=[]
  for p in sorted(expected):
   if p in self.rows:continue
   r=expected[p];path=Path(p);assert path.is_absolute()and path.resolve()==path
   pin=nine(path.lstat());assert stat.S_ISREG(int(pin['mode']))and pin['nlink']=='1'and pin['uid']=='501'and pin['gid']=='20'
   if 'PRE9'in r:assert pin==r['PRE9'],'ORIGINAL_SOURCE_NINE_NEVER_REFRESHED'
   minimum=240000000000 if str(path).startswith(CONFIG['J']+'/')else 60000000000
   assert time.time_ns()-max(int(pin['mtime_ns']),int(pin['ctime_ns']))>=minimum,'SOURCE_CURRENT_MATURITY'
   assert int(pin['size'])<=16777216
   if charge:self.count+=1;self.total+=int(pin['size'])
   assert self.count<=4096 and self.total<=67108864
   row={'path':p,'PRE9':pin,'fd':None,'expected':r,'fullEOF':False,'closeRecord':{'path':p,'attempt':1,'error':None}}
   fd=os.open(path,os.O_RDONLY|os.O_NOFOLLOW)
   try:row['fd']=fd;self.owned.append(row);self.rows[p]=row
   except BaseException as primary:
    if self.owned and self.owned[-1]is row:self.owned.pop()
    row.pop('fd',None)
    try:os.close(fd)
    except BaseException as cleanup:
     error=RuntimeError('UNREGISTERED_OWNED_SOURCE_CLOSE_FAILED');error.primaryFailure=primary;error.closeFailures=[cleanup];raise error from primary
    raise
   added.append(row)
  return added
 def read(self,added):
  for r in added:
   fd=r['fd'];assert nine(os.fstat(fd))==r['PRE9'];parts=[];size=0;h=hashlib.sha256()
   while True:
    b=os.read(fd,65536)
    if not b:break
    size+=len(b);assert size<=int(r['PRE9']['size'])<=16777216;h.update(b);parts.append(b)
   ex=r['expected'];assert size==int(r['PRE9']['size'])
   if 'bytes'in ex:assert(size,h.hexdigest())==(ex['bytes'],ex['sha256'])
   assert nine(os.fstat(fd))==r['PRE9']==nine(Path(r['path']).lstat())
   r.update(bytes=size,sha256=h.hexdigest(),fullEOF=True,OPEN9=r['PRE9'],POST9=r['PRE9'])
   self.bodies[r['path']]=b''.join(parts)
 def verify(self):
  checks=[]
  for r in self.owned:
   os.lseek(r['fd'],0,0);h=hashlib.sha256();size=0
   while True:
    b=os.read(r['fd'],65536)
    if not b:break
    size+=len(b);assert size<=16777216;h.update(b)
   q={'path':r['path'],'bytes':size,'sha256':h.hexdigest(),'FD9':nine(os.fstat(r['fd'])),'path9':nine(Path(r['path']).lstat())}
   q['exact']=q['FD9']==q['path9']==r['PRE9']and(size,h.hexdigest())==(r['bytes'],r['sha256']);checks.append(q)
  self.final=checks;return checks
 def close(self):
  for r in self.owned:
   fd=r.pop('fd',None)
   if fd is None:continue
   q=r['closeRecord']
   try:os.close(fd)
   except BaseException as e:
    try:q['error']=repr(e)
    except BaseException:q['error']='UNKNOWN_CLOSE_ERROR_REPR_FAILED'
   try:self.closes.append(q)
   except BaseException:pass
  self.closes=[r['closeRecord']for r in self.owned if 'fd'not in r]
 def snapshot(self):return{'rows':[{k:v for k,v in r.items()if k not in ('fd','expected')}for r in self.owned],'count':self.count,'bytes':self.total,'final':self.final,'closeAttempts':self.closes,'reset':False}
def owner_selfchecks():
 original_os=globals()['os'];original_path=globals()['Path'];original_time=globals()['time'];out=[]
 class P:
  def __init__(self,value):self.value=str(value)
  def is_absolute(self):return True
  def resolve(self):return self
  def __eq__(self,other):return type(other)is P and self.value==other.value
  def lstat(self):return types.SimpleNamespace(st_dev=7,st_ino=int(self.value.rsplit('/',1)[-1]),st_mode=33152,st_uid=501,st_gid=20,st_nlink=1,st_size=1,st_mtime_ns=1,st_ctime_ns=1)
 class Owner(list):
  def __init__(self,index):super().__init__();self.index=index;self.calls=0
  def append(self,row):
   self.calls+=1
   if self.calls==self.index:raise MemoryError('registered-owner-append')
   super().append(row)
 try:
  for index in (1,2,3):
   opened=[];closed=[];ledger=Source();ledger.owned=Owner(index)
   def opening(path,flags):fd=100+len(opened);opened.append(fd);return fd
   def closing(fd):closed.append(fd)
   globals()['Path']=P;globals()['time']=types.SimpleNamespace(time_ns=lambda:300000000001)
   globals()['os']=types.SimpleNamespace(open=opening,close=closing,O_RDONLY=0,O_NOFOLLOW=0)
   try:ledger.opens([{'path':'/mock/'+str(i)}for i in (1,2,3)])
   except MemoryError:pass
   else:raise AssertionError('registration fault not reached')
   ledger.close();ledger.close();assert sorted(closed)==sorted(opened)and len(set(closed))==len(closed)
   out.append({'name':'source-registration-first-middle-last-'+str(index),'status':'PASS_ORACLE_SETUP_ONLY','opened':opened,'closeAttempts':closed})
  globals()['Path']=original_path;globals()['time']=original_time
  for index in (1,2,3):
   calls=[];ledger=Source();ledger.owned=[{'path':'/mock/'+str(i),'fd':100+i,'closeRecord':{'path':'/mock/'+str(i),'attempt':1,'error':None}}for i in (1,2,3)]
   def closing(fd):
    calls.append(fd)
    if fd==100+index:raise OSError('unknown-close-state')
   globals()['os']=types.SimpleNamespace(close=closing)
   ledger.close();ledger.close();assert calls==[101,102,103]and sum(r['error']is not None for r in ledger.closes)==1
   out.append({'name':'source-close-first-middle-last-'+str(index),'status':'PASS_ORACLE_SETUP_ONLY','closeAttempts':calls})
 finally:globals()['os']=original_os;globals()['Path']=original_path;globals()['time']=original_time
 return out
def publish(name,data):
 path=Path(CONFIG['J'])/name;raw=encode(data);assert len(raw)<=16777216
 fd=os.open(path,os.O_WRONLY|os.O_CREAT|os.O_EXCL|os.O_NOFOLLOW,0o600)
 try:
  view=memoryview(raw)
  while view:
   n=os.write(fd,view);assert n>0;view=view[n:]
  os.fsync(fd)
 finally:os.close(fd)
 return{'path':str(path),'sha256':digest(raw),'bytes':len(raw),'selfExcluded':True}
def main():
 s=Source();primary=None;results=[];rawpin=None;closure=None;publication=[];begun=time.monotonic()
 try:
  headers=[{'path':CONFIG['sourcePath']},{'path':CONFIG['stopPath']},{'path':CONFIG['selfCheckPath']},CONFIG['MF'],CONFIG['priorRaw'],CONFIG['priorClosure']]
  added=s.opens(headers,charge=True);s.read(added)
  stop=json.loads(s.bodies[CONFIG['stopPath']]);assert stop['writerState']=='STOPPED'and stop['remainingWrites']==[]
  for ref in stop['sourcePins']:assert(s.rows[ref['path']]['bytes'],s.rows[ref['path']]['sha256'])==(ref['bytes'],ref['sha256'])
  assert s.bodies[CONFIG['sourcePath']]==EXECUTING_SOURCE_BYTES,'EXECUTION_SOURCE_EXACT_HELD_BYTES'
  mf=json.loads(s.bodies[CONFIG['MF']['path']]);idx={r['path']:r for r in mf['inputs']};assert len(idx)==len(mf['inputs'])
  original=json.loads(s.bodies[CONFIG['priorClosure']['path']]);prior=json.loads(s.bodies[CONFIG['priorRaw']['path']])
  assert original['finalAllExact']is True and original['primaryFailure']is None and original['publicationErrors']==[]
  assert len(original['closeAttempts'])==337 and all(r['error']is None and r['attempt']==1 for r in original['closeAttempts'])
  assert prior['replayTotal']==271 and prior['replayFAIL']==0 and prior['independentPASS']==80 and prior['independentFAIL']==2
  assert CONFIG['oldCI']=={k:idx[CONFIG['oldCI']['path']][k]for k in ('path','sha256','bytes','PRE9')}
  # Headers persist before any new candidate/comparison member body.
  header=publish('two-gap-qualified-header1.json',s.snapshot())
  members=[idx[p]for p in CONFIG['memberPaths']]+[CONFIG['oldCI']]
  # Conservative new admissions charge even physically unchanged references;
  # no exemption or global ledger reset.
  added=s.opens(members,charge=True);s.read(added)
  raw=s.bodies[CONFIG['memberPaths'][2]]
  defs=[n for n in ast.parse(raw).body if isinstance(n,(ast.ClassDef,ast.FunctionDef))and n.name in ('extract','ExportPath','export_case')]
  assert len(defs)==3
  native=s.bodies[CONFIG['memberPaths'][1]].decode()
  namespace={'SOURCES':{'native_export.py':native},'ast':ast,'sys':sys}
  exec(compile(ast.Module(body=defs,type_ignores=[]),'held-native-helper-definitions-only','exec'),namespace)
  def case(name,fn):
   try:d=fn();results.append({'name':name,'status':'PASS','detail':d})
   except BaseException as e:results.append({'name':name,'status':'FAIL','error':repr(e)})
  case('corrected-native-first-primary-plus-one-distinct-owned-close',lambda:namespace['export_case'](unique_closes(1),1))
  old=s.bodies[CONFIG['oldCI']['path']].decode();current=s.bodies[CONFIG['memberPaths'][0]].decode()
  assert old_guard(old).lineno==425,'ORIGINAL_ROOT197_TOP_LEVEL_SEAM_LINE'
  for i in (1,2):
   case('old-actual-top-level-finally-abandons-later-owners-'+str(i),lambda i=i:ci_guard_case(old,True,'close',i))
   for kind in (None,'exit0','exit7'):
    case('repaired-actual-top-level-allcloses-'+str(i)+'-'+str(kind),lambda i=i,k=kind:ci_guard_case(current,False,'close',i,k))
  case('old-actual-cleanup-report-skips-owned-source-closes',lambda:ci_guard_case(old,True,'report',1))
  for kind in (None,'exit0','exit7'):
   case('repaired-actual-cleanup-report-outer-allclose-'+str(kind),lambda k=kind:ci_guard_case(current,False,'report',1,k))
  # Rerun only the corrected oracle's setup and its two affected branches.
  setup=selfchecks();setup['ownerControls']=owner_selfchecks();assert setup['FAIL']==0
  assert time.monotonic()-begun<120,'ORIGINAL_SOURCE_CONTROL_TIME_BUDGET'
  final=s.verify();assert all(r['exact']for r in final)
  value={'scope':'DISTINCT_INDEPENDENT_TWO_REVIEWER_ORACLE_GAP_CORRECTION_ONLY','results':results,'PASS':sum(r['status']=='PASS'for r in results),'FAIL':sum(r['status']=='FAIL'for r in results),'prior271And80ReusedWithoutRerun':{'controls':CONFIG['priorRaw'],'closure':CONFIG['priorClosure'],'qualifiedCurrentFull337Preserved':True},'oldFailedTwoOraclesImmutable':True,'setup':setup,'allFDsBeforeMemberBodies':True,'originalSourcePinsNoRefresh':True,'heldThroughControlVerdict':True,'ledger':{'admissions':s.count,'bytes':s.total,'priorAdmissions':642,'priorBytes':14925572,'maxAdmissions':4096,'maxBytes':67108864,'perFileBytes':16777216,'reset':False},'header':header,'harnessAdaptations':['Exact original top-level __main__ If425 AST invoked with complete isolated owned-holder/main/cleanup/report stubs','Current exact top-level guard plus EntryFailure/entry definitions invoked with same stubs','Only extract/ExportPath/export_case AST helpers compiled; no author top-level49 replay','Native close tuple deduplicated by exact owned identity; no candidate assertion change'],'nativeEffects':0,'Docker':False,'privateAccess':0,'sourceEligibility':False,'runtimeAuthority':False,'functionalTask04':{'complete':0,'total':3}}
  rawpin=publish('two-gap-qualified-controls1.json',value)
 except BaseException as e:primary=repr(e)
 finally:
  try:s.verify()
  except BaseException as e:publication.append({'phase':'finalFence','error':repr(e)})
  s.close()
  try:closure=publish('two-gap-final-FDclosure1.json',{**s.snapshot(),'primaryFailure':primary,'publicationErrors':publication,'allFinalExact':bool(s.final)and len(s.final)==len(s.owned)and all(r['exact']for r in s.final),'closeRetries':0,'sourceEligibility':False})
  except BaseException as e:publication.append({'phase':'closurePublish','error':repr(e)})
 print(json.dumps({'controls':rawpin,'closure':closure,'PASS':sum(r['status']=='PASS'for r in results),'FAIL':sum(r['status']=='FAIL'for r in results),'primaryFailure':primary,'publicationErrors':publication,'allCloseAttempts':len(s.closes),'closeErrors':[r for r in s.closes if r['error']],'ledger':{'admissions':s.count,'bytes':s.total,'reset':False}}))
 return 0 if primary is None and not publication and all(r['status']=='PASS'for r in results)and not any(r['error']for r in s.closes)else 1
