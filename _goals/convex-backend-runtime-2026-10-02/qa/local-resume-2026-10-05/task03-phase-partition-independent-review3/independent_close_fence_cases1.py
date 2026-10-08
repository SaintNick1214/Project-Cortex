import copy,hashlib,stat,types
from contextlib import ExitStack
from unittest.mock import patch
M=mods['phase_candidate']
cases=[]
receipt={'counts':dict(M.COUNTS),'assertions':list(M.ASSERTIONS),'originalProgramsUnchanged':True,'allProgramsIndependentlyApprovedBefore1914':True}
class ClosureFS:
 def __init__(self, failures):
  self.root=D/'unknown-close-owned-mock'
  self.rows=[]
  for i in range(3):
   self.rows.append({'path':'p'+str(i),'bytes':0,'sha256':hashlib.sha256(b'').hexdigest(),'roles':['control'],'nine':{k:str({'dev':1,'ino':i+1,'mode':stat.S_IFREG|0o600,'uid':1,'gid':1,'nlink':1,'size':0,'mtime_ns':1,'ctime_ns':1}[k])for k in M.FIELDS}})
  self.by={str(self.root/r['path']):r for r in self.rows};self.live={};self.opened=[];self.closed=[];self.failures=set(failures)
 def ls(self,path):
  row=self.by.get(str(path))
  return types.SimpleNamespace(**{'st_'+k:int(v)for k,v in row['nine'].items()})if row else types.SimpleNamespace(st_mode=stat.S_IFDIR|0o700)
 def op(self,path,flags):
  fd=100+len(self.opened);self.opened.append(fd);self.live[fd]=str(path);return fd
 def fs(self,fd):return self.ls(self.live[fd])
 def cl(self,fd):
  self.closed.append(fd)
  if fd-100 in self.failures:raise OSError('independent_mock_close_unknown_before_release')
  self.live.pop(fd)
 def run(self, before_approval):
  L=M.Ledger();edges=[{'caller':'c','target':M.admission_id(r),'operation':'read'}for r in self.rows]
  B=M.HeldBroker(self.root,self.rows,L,edges,'c',1);P=M.PhaseMachine(L)
  with ExitStack()as stack:
   for ctx in (patch.object(M.os,'lstat',side_effect=self.ls),patch.object(M.os,'open',side_effect=self.op),patch.object(M.os,'fstat',side_effect=self.fs),patch.object(M.os,'pread',return_value=b''),patch.object(M.os,'close',side_effect=self.cl),patch.object(Path,'resolve',lambda p:p.absolute())):stack.enter_context(ctx)
   B.open_all();B.final_check()
   if not before_approval:P.advance('SOURCE_APPROVED',copy.deepcopy(receipt),lambda *_:True)
   close_denied=False
   try:B.close()
   except M.Denied:close_denied=True
   transitions=[];deny_reason=None
   for phase in M.PhaseMachine.ORDER[1 if before_approval else 2:]:
    try:P.advance(phase,copy.deepcopy(receipt),lambda *_:True);transitions.append(phase)
    except M.Denied as e:deny_reason=str(e);break
  return {'unknownClose':L.unknown_close,'closeDenied':close_denied,'onceAllCloseAttempts':self.closed==[100,101,102],'closeAttempts':B.close_attempts,'phase':P.phase,'readinessDenied':deny_reason is not None,'denyReason':deny_reason,'admittedTransitions':transitions,'remainingMockFDs':len(self.live)}
def check(name,action):
 try:
  detail,ok=action();cases.append({'name':name,'outcome':'PASS'if ok else'FAIL','detail':detail})
 except BaseException as e:cases.append({'name':name,'outcome':'FAIL','exception':type(e).__name__,'message':str(e)})
def transition_case(target,failures):
 F=ClosureFS(failures);L=M.Ledger();edges=[{'caller':'c','target':M.admission_id(r),'operation':'read'}for r in F.rows];B=M.HeldBroker(F.root,F.rows,L,edges,'c',1);P=M.PhaseMachine(L);called=[]
 with ExitStack()as stack:
  for ctx in (patch.object(M.os,'lstat',side_effect=F.ls),patch.object(M.os,'open',side_effect=F.op),patch.object(M.os,'fstat',side_effect=F.fs),patch.object(M.os,'pread',return_value=b''),patch.object(M.os,'close',side_effect=F.cl),patch.object(Path,'resolve',lambda p:p.absolute())):stack.enter_context(ctx)
  B.open_all();B.final_check()
  for stage in M.PhaseMachine.ORDER[1:M.PhaseMachine.ORDER.index(target)]:P.advance(stage,copy.deepcopy(receipt),lambda *_:True)
  before_phase=P.phase;before_evidence=copy.deepcopy(P.evidence);before_binding=P.approved_source_binding
  close_denied=False
  try:B.close()
  except M.Denied:close_denied=True
  error=None
  try:P.advance(target,copy.deepcopy(receipt),lambda phase,rcpt:called.append((phase,copy.deepcopy(rcpt)))or True)
  except M.Denied as e:error=str(e)
  if failures:
   ok=(L.unknown_close and close_denied and error is not None and 'sticky_unknown_SOURCE_close'in error and not called and P.phase==before_phase and P.evidence==before_evidence and P.approved_source_binding==before_binding and F.closed==[100,101,102]and len(F.live)==len(failures))
  else:
   ok=(not L.unknown_close and not close_denied and error is None and len(called)==1 and P.phase==target and F.closed==[100,101,102]and not F.live)
  detail={'target':target,'failureIndices':failures,'unknownClose':L.unknown_close,'denial':error,'callbackCalls':len(called),'phaseBefore':before_phase,'phaseAfter':P.phase,'evidenceUnchanged':P.evidence==before_evidence,'approvalBindingUnchanged':P.approved_source_binding==before_binding,'allClosesOnce':F.closed==[100,101,102],'closeAttempts':B.close_attempts,'remainingMockHandles':len(F.live)}
 return detail,ok
for target in M.PhaseMachine.ORDER[1:]:
 for label,failures in (('first',[0]),('last',[2]),('all',[0,1,2])):
  check('unknown_'+label+'_close_'+target+'_denies_before_callback_state_mutation',lambda target=target,failures=failures:transition_case(target,failures))
 check('normal_closed_Source_'+target+'_valid_transition',lambda target=target:transition_case(target,[]))
def direct_fence(method):
 L=M.Ledger();owner=object()
 for fd in (100,101,102):L.own_fd(fd,owner)
 for fd in (100,101,102):L.release_fd(fd,owner,fd!=100)
 error=None
 try:getattr(L,method)()
 except M.Denied as e:error=str(e)
 detail={'method':method,'unknownClose':L.unknown_close,'denial':error,'ownedAccountingRemaining':len(L.owned_fds)}
 return detail,L.unknown_close and not L.owned_fds and error is not None and 'sticky_unknown_SOURCE_close'in error
for method in ('preflight','approval_binding'):check('direct_sticky_unknown_'+method+'_fence',lambda method=method:direct_fence(method))
result={'scope':'FRESH_REPAIR6_INDEPENDENT_CLOSE_FENCE_SOURCE_MOCK_ONLY','discovered':len(cases),'executed':len(cases),'passed':sum(c['outcome']=='PASS'for c in cases),'failed':sum(c['outcome']=='FAIL'for c in cases),'skipped':0,'cases':cases,'allSixOriginalPhasesCovered':True,'assertionsOrCapsChanged':False,'mockHandlesOnly':True,'SourceEligibility':False,'actualClocksStarted':False,'effects':0}
with open(D/'independent-close-fence-controls-raw1.json','x')as f:json.dump(result,f,indent=2,sort_keys=True);f.write('\n')
print(json.dumps(result,indent=2),flush=True)
