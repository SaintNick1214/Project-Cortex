"""Fresh independent R8 close bookkeeping/physical-failure oracles; owned virtual IO."""
import ast,copy,hashlib,stat,types
from contextlib import ExitStack
from pathlib import Path
from unittest.mock import patch

def run(M,old_raw,new_raw):
 cases=[]
 class FS:
  def __init__(self):
   self.root=Path('/INDEPENDENT-R8-VIRTUAL-ONLY');self.opened=[];self.closed=[];self.live={};self.rows=[];self.close_fault=None
   for i in range(3):
    n={'dev':1,'ino':i+1,'mode':33188,'uid':1,'gid':1,'nlink':1,'size':0,'mtime_ns':1,'ctime_ns':1}
    self.rows.append({'path':'p'+str(i),'bytes':0,'sha256':hashlib.sha256(b'').hexdigest(),'roles':['control'],'nine':{k:str(n[k])for k in M.FIELDS}})
  def ls(self,p):
   for r in self.rows:
    if str(p)==str(self.root/r['path']):return types.SimpleNamespace(**{'st_'+k:int(v)for k,v in r['nine'].items()})
   return types.SimpleNamespace(st_mode=stat.S_IFDIR|0o700)
  def op(self,p,*_):
   fd=100+len(self.opened);self.opened.append(fd);self.live[fd]=str(p);return fd
  def cl(self,fd):
   self.closed.append(fd);assert fd in self.live,'unknown_or_repeated_close'
   if self.close_fault and self.close_fault[0]==fd:raise self.close_fault[1]()
   del self.live[fd]
  def fs(self,fd):return self.ls(self.live[fd])
 def isolated(fn):
  fs=FS();L=M.Ledger();edges=[{'caller':'independent','target':M.admission_id(r),'operation':'read'}for r in fs.rows]
  B=M.HeldBroker(fs.root,fs.rows,L,edges,'independent',1)
  with ExitStack()as stack:
   for x in (patch.object(M.os,'lstat',side_effect=fs.ls),patch.object(M.os,'open',side_effect=fs.op),
    patch.object(M.os,'fstat',side_effect=fs.fs),patch.object(M.os,'pread',return_value=b''),
    patch.object(M.os,'close',side_effect=fs.cl),patch.object(Path,'resolve',lambda p:p.absolute())):stack.enter_context(x)
   return fn(fs,L,B)
 receipt={'counts':dict(M.COUNTS),'assertions':list(M.ASSERTIONS),'originalProgramsUnchanged':True,'allProgramsIndependentlyApprovedBefore1914':True}
 def advance_rest(machine):
  callbacks=[];err=None
  try:
   for stage in machine.ORDER[machine.ORDER.index(machine.phase)+1:]:
    machine.advance(stage,copy.deepcopy(receipt),lambda *_:callbacks.append(stage)or True)
  except BaseException as e:err={'type':type(e).__name__,'message':str(e)}
  return {'phaseAfter':machine.phase,'stageError':err,'callbacks':callbacks}
 def record(name,fn):
  try:
   ok,detail=fn();cases.append({'name':name,'PASS':bool(ok),'evidence':detail})
  except BaseException as e:cases.append({'name':name,'PASS':False,'reviewerSetupException':{'type':type(e).__name__,'message':str(e)}})
 def conservation():
  old=ast.parse(old_raw);new=ast.parse(new_raw)
  a={n.name:n for n in old.body if isinstance(n,(ast.FunctionDef,ast.ClassDef))}
  b={n.name:n for n in new.body if isinstance(n,(ast.FunctionDef,ast.ClassDef))}
  assert set(a)==set(b)
  for key in a:
   if key!='HeldBroker':assert ast.dump(a[key],include_attributes=False)==ast.dump(b[key],include_attributes=False),key
  aa={n.name:n for n in a['HeldBroker'].body if isinstance(n,ast.FunctionDef)}
  bb={n.name:n for n in b['HeldBroker'].body if isinstance(n,ast.FunctionDef)}
  assert set(aa)==set(bb)
  for key in aa:
   if key!='close':assert ast.dump(aa[key],include_attributes=False)==ast.dump(bb[key],include_attributes=False),key
  select=lambda tree:[ast.dump(n,include_attributes=False)for n in tree.body if isinstance(n,(ast.Assign,ast.Import,ast.ImportFrom))]
  assert select(old)==select(new)
  return True,{'onlyChangedMethod':'HeldBroker.close','allOtherASTImportsConstantsCapsCountsAssertionsExact':True}
 record('R7_to_R8_only_close_AST_conservation',conservation)
 for pos in (0,1,2):
  def original_gap(fs,L,B,i=pos):
   class Fail(dict):
    def __setitem__(self,key,value):
     if value[0]==100+i:raise MemoryError('independent_original_registration_gap')
     return super().__setitem__(key,value)
   B.held=Fail();primary=None;cleanup=None
   try:B.open_all()
   except BaseException as e:primary={'type':type(e).__name__,'message':str(e)}
   try:B.close()
   except BaseException as e:cleanup={'type':type(e).__name__,'message':str(e)}
   machine=M.PhaseMachine(L);probe=advance_rest(machine)
   # Order is deliberately not an obligation: detached newest fallback may close first.
   all_once=sorted(fs.opened)==sorted(fs.closed)and len(fs.closed)==len(set(fs.closed))and not fs.live
   blocked=probe['stageError']is not None and probe['phaseAfter']=='SOURCE'and not probe['callbacks']
   return {'position':i,'primary':primary,'cleanup':cleanup,'opened':fs.opened,'closeAttempts':fs.closed,'remaining':sorted(fs.live),
    'ledgerUnknownClose':L.unknown_close,'probe':probe},bool(all_once and primary and primary['type']=='MemoryError'),bool(blocked and L.unknown_close)
  record('original_registration_gap_'+str(pos)+'_all_owned_once_unordered',lambda i=pos:isolated(lambda f,l,b:(lambda d,g,r:(g,d))(*original_gap(f,l,b,i))))
  record('original_registration_gap_'+str(pos)+'_no_readiness_callbacks',lambda i=pos:isolated(lambda f,l,b:(lambda d,g,r:(r,d))(*original_gap(f,l,b,i))))
 error_factories=[('MemoryError',lambda:MemoryError('independent_cleanup_allocation')),
  ('RuntimeError',lambda:RuntimeError('independent_cleanup_protocol')),
  ('SystemExit0',lambda:SystemExit(0)),('SystemExit7',lambda:SystemExit(7)),('KeyboardInterrupt',lambda:KeyboardInterrupt())]
 for seam in ('close_receipt_append','ledger_release_before','ledger_release_after','physical_close'):
  for pos in (0,1,2):
   for phase in ('SOURCE','SOURCE_APPROVED'):
    for label,factory in error_factories:
     def fault(fs,L,B,s=seam,i=pos,p=phase,kind=label,create=factory):
      B.open_all();machine=M.PhaseMachine(L)
      if p=='SOURCE_APPROVED':machine.advance(p,copy.deepcopy(receipt),lambda *_:True)
      target=100+i
      if s=='close_receipt_append':
       class FailureList(list):
        def append(self,row):
         if len(fs.closed)-1==i:raise create()
         return super().append(row)
       B.close_attempts=FailureList()
      elif s.startswith('ledger_release'):
       original=L.release_fd
       def release(fd,owner,successful):
        if fd==target:
         if s=='ledger_release_after':original(fd,owner,successful)
         raise create()
        return original(fd,owner,successful)
       L.release_fd=release
      else:fs.close_fault=(target,create)
      error=None
      try:B.close()
      except BaseException as e:error={'type':type(e).__name__,'message':str(e)}
      attempts=list(fs.closed);probe=advance_rest(machine);second=None
      try:B.close()
      except BaseException as e:second={'type':type(e).__name__,'message':str(e)}
      expected_remaining=[target]if s=='physical_close'else[]
      all_once=sorted(attempts)==sorted(fs.opened)and len(attempts)==len(set(attempts))
      no_retry=attempts==fs.closed and second is not None
      blocked=probe['stageError']is not None and probe['phaseAfter']==p and not probe['callbacks']
      retained=error is not None and type(create()).__name__ in error['message']
      detail={'seam':s,'position':i,'phaseBefore':p,'exception':kind,'cleanupError':error,'opened':fs.opened,
       'closeAttempts':attempts,'allOwnedAttemptedOnce':all_once,'remainingVirtualHandles':sorted(fs.live),
       'physicalCloseKnownSuccess':s!='physical_close','remainingLedgerOwners':sorted(L.owned_fds),
       'ledgerUnknownClose':L.unknown_close,'probe':probe,'secondCloseDenied':second,'noRetry':no_retry,
       'originalErrorTypeRetained':retained,'candidateBytesUnmodified':True,'virtualOnly':True}
      return bool(all_once and no_retry and blocked and L.unknown_close and error and retained and sorted(fs.live)==expected_remaining),detail
     record('cleanup_'+seam+'_'+str(pos)+'_'+phase+'_'+label,lambda:isolated(fault))
 for phase in ('SOURCE','SOURCE_APPROVED'):
  def positive(fs,L,B,p=phase):
   B.open_all();machine=M.PhaseMachine(L)
   if p=='SOURCE_APPROVED':machine.advance(p,copy.deepcopy(receipt),lambda *_:True)
   B.close();attempts=list(fs.closed);second=None
   try:B.close()
   except BaseException as e:second={'type':type(e).__name__,'message':str(e)}
   probe=advance_rest(machine);action=None
   try:machine.protected_action()
   except BaseException as e:action={'type':type(e).__name__,'message':str(e)}
   ok=sorted(fs.closed)==sorted(fs.opened)and len(fs.closed)==len(set(fs.closed))and not fs.live and not L.owned_fds and not L.unknown_close and second and attempts==fs.closed
   return bool(ok and probe['phaseAfter']=='ACTUAL_READY'and probe['stageError']is None and action),{
    'phaseBefore':p,'closeAttempts':attempts,'secondCloseDenied':second,'noRetries':attempts==fs.closed,'probe':probe,
    'protectedActionDenied':action,'noPhysicalHandleOrLedgerOwnerRemains':not fs.live and not L.owned_fds,'virtualOnly':True}
  record('positive_complete_once_and_protected_action_denied_'+phase,lambda:isolated(positive))
 return {'scope':'INDEPENDENT_R8_CODE_HOST_VIRTUAL_OWNERSHIP_ONLY','conditions':cases,'discovered':len(cases),'executed':len(cases),
  'passed':sum(c['PASS']for c in cases),'failed':sum(not c['PASS']for c in cases),'skipped':0,'SourceEligibility':False,'effects':0,
  'virtualHandlesOnly':True,'oldR7IncorrectOrderedCloseOracleReplacedOnlyInFreshReview':True}
