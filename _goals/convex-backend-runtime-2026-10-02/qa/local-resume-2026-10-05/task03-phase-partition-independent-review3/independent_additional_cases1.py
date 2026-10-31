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
def case(name,failures,before):
 try:
  detail=ClosureFS(failures).run(before)
  expectedPhase='SOURCE'if before else'SOURCE_APPROVED'
  ok=detail['onceAllCloseAttempts']and detail['unknownClose']and detail['closeDenied']and detail['readinessDenied']and detail['phase']==expectedPhase
  cases.append({'name':name,'outcome':'PASS'if ok else'FAIL','expected':'sticky unknown close denies before any Source approval/readiness transition','detail':detail})
 except BaseException as e:cases.append({'name':name,'outcome':'FAIL','exception':type(e).__name__,'message':str(e)})
for label,failures in (('first',[0]),('last',[2]),('all',[0,1,2])):
 case('sticky_'+label+'_close_blocks_initial_Source_approval',failures,True)
 case('sticky_'+label+'_close_invalidates_already_approved_readiness',failures,False)
try:
 detail=ClosureFS([]).run(False)
 ok=not detail['unknownClose']and not detail['closeDenied']and detail['onceAllCloseAttempts']and detail['phase']=='ACTUAL_READY'and detail['remainingMockFDs']==0
 cases.append({'name':'normal_all_close_conserves_valid_readiness','outcome':'PASS'if ok else'FAIL','detail':detail})
except BaseException as e:cases.append({'name':'normal_all_close_conserves_valid_readiness','outcome':'FAIL','exception':type(e).__name__,'message':str(e)})
result={'scope':'INDEPENDENT_ADDITIONAL_STICKY_CLOSE_PHASE_CONSERVATION_SOURCE_MOCK_ONLY','discovered':len(cases),'executed':len(cases),'passed':sum(c['outcome']=='PASS'for c in cases),'failed':sum(c['outcome']=='FAIL'for c in cases),'skipped':0,'cases':cases,'mockFDsOnly':True,'SourceEligibility':False,'actualClocksStarted':False,'effects':0}
with open(D/'independent-additional-controls-raw1.json','x')as f:json.dump(result,f,indent=2,sort_keys=True);f.write('\n')
print(json.dumps(result,indent=2),flush=True)
