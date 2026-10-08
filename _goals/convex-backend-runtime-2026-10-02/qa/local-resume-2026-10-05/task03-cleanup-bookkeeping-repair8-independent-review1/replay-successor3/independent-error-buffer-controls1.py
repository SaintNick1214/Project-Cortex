"""Independent local cleanup-error-buffer failure controls; actual close bytecode unchanged."""
import copy,hashlib,stat,sys,types
from contextlib import ExitStack
from pathlib import Path
from unittest.mock import patch

def verify_trace_fixture():
 class ErrorBuffer(list):
  def append(self,item):raise MemoryError('independent_error_buffer_allocation')
 class F:
  def close(self):
   errors=[]
   try:raise RuntimeError('fixture_primary_close')
   except BaseException as e:errors.append(type(e).__name__)
 state={'injected':False}
 code=F.close.__code__
 def trace(frame,event,arg):
  if frame.f_code is code and event=='line' and 'errors' in frame.f_locals and not state['injected']:
   frame.f_locals['errors']=ErrorBuffer();state['injected']=True
  return trace
 previous=sys.gettrace();error=None
 try:
  sys.settrace(trace)
  try:F().close()
  except BaseException as e:error={'type':type(e).__name__,'message':str(e),'context':type(e.__context__).__name__ if e.__context__ else None}
 finally:sys.settrace(previous)
 assert state['injected'] and error and error['type']=='MemoryError' and error['context']=='RuntimeError',(state,error)
 return {'injectionReachable':True,'functionBytecodeUnchanged':True,'error':error,'python':sys.version}

def run(M):
 verify_trace_fixture()
 cases=[]
 class FS:
  def __init__(self):
   self.root=Path('/INDEPENDENT-R8-ERROR-BUFFER-VIRTUAL-ONLY');self.rows=[];self.opened=[];self.closed=[];self.live={};self.close_fault=None
   for i in range(3):
    n={'dev':1,'ino':i+1,'mode':33188,'uid':1,'gid':1,'nlink':1,'size':0,'mtime_ns':1,'ctime_ns':1}
    self.rows.append({'path':'p'+str(i),'bytes':0,'sha256':hashlib.sha256(b'').hexdigest(),'roles':['control'],'nine':{k:str(n[k])for k in M.FIELDS}})
  def ls(self,p):
   for r in self.rows:
    if str(p)==str(self.root/r['path']):return types.SimpleNamespace(**{'st_'+k:int(v)for k,v in r['nine'].items()})
   return types.SimpleNamespace(st_mode=stat.S_IFDIR|0o700)
  def op(self,p,*args):
   fd=100+len(self.opened);self.opened.append(fd);self.live[fd]=str(p);return fd
  def fs(self,fd):return self.ls(self.live[fd])
  def cl(self,fd):
   self.closed.append(fd);assert fd in self.live,'unknown_or_repeated_close'
   if fd==self.close_fault:raise RuntimeError('independent_primary_physical_close')
   del self.live[fd]
 def isolated(fn):
  fs=FS();L=M.Ledger();edges=[{'caller':'independent','target':M.admission_id(r),'operation':'read'}for r in fs.rows]
  B=M.HeldBroker(fs.root,fs.rows,L,edges,'independent',1)
  with ExitStack()as stack:
   for x in (patch.object(M.os,'lstat',side_effect=fs.ls),patch.object(M.os,'open',side_effect=fs.op),
    patch.object(M.os,'fstat',side_effect=fs.fs),patch.object(M.os,'pread',return_value=b''),
    patch.object(M.os,'close',side_effect=fs.cl),patch.object(Path,'resolve',lambda p:p.absolute())):stack.enter_context(x)
   return fn(fs,L,B)
 receipt={'counts':dict(M.COUNTS),'assertions':list(M.ASSERTIONS),'originalProgramsUnchanged':True,'allProgramsIndependentlyApprovedBefore1914':True}
 class ErrorBuffer(list):
  def append(self,item):raise MemoryError('independent_error_buffer_allocation')
 for seam in ('physical_close','ledger_release','close_receipt'):
  for pos in (0,1,2):
   for phase in ('SOURCE','SOURCE_APPROVED'):
    def fault(fs,L,B,s=seam,i=pos,p=phase):
     B.open_all();machine=M.PhaseMachine(L)
     if p=='SOURCE_APPROVED':machine.advance(p,copy.deepcopy(receipt),lambda *_:True)
     target=100+i
     if s=='physical_close':fs.close_fault=target
     elif s=='ledger_release':
      original=L.release_fd
      def release(fd,owner,successful):
       if fd==target:raise RuntimeError('independent_primary_ledger_release')
       return original(fd,owner,successful)
      L.release_fd=release
     else:
      class ReceiptList(list):
       def append(self,row):
        if len(fs.closed)-1==i:raise RuntimeError('independent_primary_receipt_append')
        return super().append(row)
      B.close_attempts=ReceiptList()
     state={'injected':False};code=B.close.__func__.__code__;before=code.co_code
     def trace(frame,event,arg):
      if frame.f_code is code and event=='line' and 'errors' in frame.f_locals and not state['injected']:
       frame.f_locals['errors']=ErrorBuffer();state['injected']=True
      return trace
     previous=sys.gettrace();error=None
     try:
      sys.settrace(trace)
      try:B.close()
      except BaseException as e:
       chain=[];seen=set();cur=e
       while cur is not None and id(cur)not in seen:
        seen.add(id(cur));chain.append({'type':type(cur).__name__,'message':str(cur)});cur=cur.__cause__ or cur.__context__
       error={'type':type(e).__name__,'message':str(e),'chain':chain}
     finally:sys.settrace(previous)
     attempts=list(fs.closed);callbacks=[];stage_error=None
     try:
      for stage in machine.ORDER[machine.ORDER.index(machine.phase)+1:]:
       machine.advance(stage,copy.deepcopy(receipt),lambda *_:callbacks.append(stage)or True)
     except BaseException as e:stage_error={'type':type(e).__name__,'message':str(e)}
     second=None
     try:B.close()
     except BaseException as e:second={'type':type(e).__name__,'message':str(e)}
     all_once=sorted(attempts)==sorted(fs.opened)and len(attempts)==len(set(attempts))
     no_retry=attempts==fs.closed and second is not None
     blocked=stage_error is not None and machine.phase==p and not callbacks
     retained=error is not None and any(e['type']=='RuntimeError'for e in error['chain'])
     detail={'seam':s,'position':i,'phaseBefore':p,'traceInjectedOnlyLocalErrorBuffer':state['injected'],
      'candidateFunctionBytecodeUnchanged':before==code.co_code,'error':error,'originalPrimaryErrorRetained':retained,
      'opened':fs.opened,'closeAttempts':attempts,'remainingVirtualHandles':sorted(fs.live),'remainingLedgerOwners':sorted(L.owned_fds),
      'allOwnedAttemptedOnce':all_once,'ledgerUnknownClose':L.unknown_close,'phaseAfter':machine.phase,
      'stageError':stage_error,'callbacks':callbacks,'secondCloseDenied':second,'noRetry':no_retry,'virtualOnly':True}
     assert state['injected'] and before==code.co_code,'reviewer_trace_injection_unreachable_or_bytecode_changed'
     return bool(all_once and no_retry and blocked and L.unknown_close and retained),detail
    try:
     ok,detail=isolated(fault);cases.append({'name':'error_buffer_'+seam+'_'+str(pos)+'_'+phase,'PASS':ok,'evidence':detail})
    except BaseException as e:cases.append({'name':'error_buffer_'+seam+'_'+str(pos)+'_'+phase,'PASS':False,'reviewerSetupException':{'type':type(e).__name__,'message':str(e)}})
 return {'scope':'INDEPENDENT_R8_ACTUAL_CLOSE_ERROR_BUFFER_FAULTS_CODE_HOST_ONLY','conditions':cases,'discovered':len(cases),
  'executed':len(cases),'passed':sum(c['PASS']for c in cases),'failed':sum(not c['PASS']for c in cases),'skipped':0,
  'candidateBytecodeUnchanged':True,'traceReplacesOnlyLocalMutableErrorBuffer':True,'SourceEligibility':False,'effects':0}
