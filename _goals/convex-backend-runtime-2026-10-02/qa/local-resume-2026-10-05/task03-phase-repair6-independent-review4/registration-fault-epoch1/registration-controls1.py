"""Independent reachable successful-open/owner-map insertion faults, virtual handles only."""
import hashlib,json,os,stat,sys,time,types
from pathlib import Path
from contextlib import ExitStack
from unittest.mock import patch
T=Path("/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion/_goals/convex-backend-runtime-2026-10-02/qa/local-resume-2026-10-05/task03-phase-repair6-independent-review4/registration-fault-epoch1");D=Path("/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion/_goals/convex-backend-runtime-2026-10-02/qa/local-resume-2026-10-05/task03-f2-close-fence-repair6")
FIELDS=('dev','ino','mode','uid','gid','nlink','size','mtime_ns','ctime_ns')
def nine(s):return {k:str(getattr(s,'st_'+k))for k in FIELDS}
owned=[];rows=[];closes=[];errors=[];cases=[]
def grab(pin):
 s=os.lstat(pin['path']);assert nine(s)==pin['PRE9'] and stat.S_ISREG(s.st_mode)and s.st_nlink==1
 assert time.time_ns()-max(s.st_mtime_ns,s.st_ctime_ns)>=240000000000
 fd=os.open(pin['path'],os.O_RDONLY|os.O_NOFOLLOW)
 try:owned.append((fd,pin['path']))
 except BaseException:
  os.close(fd);raise
 x=dict(pin,fd=fd,OPEN9=nine(os.fstat(fd)));rows.append(x);assert x['PRE9']==x['OPEN9'];return x
def read(x):
 b=bytearray();off=0
 while True:
  z=os.pread(x['fd'],65536,off)
  if not z:break
  b.extend(z);off+=len(z);assert len(b)<=16777216
 assert len(b)==x['bytes']and hashlib.sha256(b).hexdigest()==x['sha256'];x['fullEOF']=True
 x['POST9']=nine(os.fstat(x['fd']));assert x['PRE9']==x['POST9']==nine(os.lstat(x['path']));return bytes(b)
try:
 request=json.loads(sys.argv[1]);own_rows=[grab(x)for x in request['own']]
 own_body={x['path']:read(x)for x in own_rows}
 plan=json.loads(own_body[str(T/'source-input-plan1.json')]);stop=json.loads(own_body[str(T/'source-writers-stopped1.json')])
 assert stop['state']=='STOPPED'and not stop['remainingWrites']
 extra=[grab(x)for x in plan['members']];body={x['path']:read(x)for x in extra}
 assert len(rows)==4 and sum(x['bytes']for x in rows)+plan['cumulativePriorBytes']+7340032<=67108864
 M=types.ModuleType('review4_actual_R6_registration');M.__file__=str(D/'phase_partition4.py');sys.modules[M.__name__]=M
 exec(compile(body[M.__file__],M.__file__,'exec'),M.__dict__)
 class FS:
  def __init__(self):
   self.root=T/'virtual-only';self.live={};self.opened=[];self.closed=[]
   self.rows=[{'path':'p'+str(i),'bytes':0,'sha256':hashlib.sha256(b'').hexdigest(),'roles':['control'],'nine':{k:str({'dev':1,'ino':i+1,'mode':33188,'uid':1,'gid':1,'nlink':1,'size':0,'mtime_ns':1,'ctime_ns':1}[k])for k in FIELDS}}for i in range(3)]
  def ls(self,path):
   for row in self.rows:
    if str(path)==str(self.root/row['path']):return types.SimpleNamespace(**{'st_'+k:int(v)for k,v in row['nine'].items()})
   return types.SimpleNamespace(st_mode=stat.S_IFDIR|0o700)
  def op(self,path,*args):
   fd=100+len(self.opened);self.live[fd]=str(path);self.opened.append(fd);return fd
  def cl(self,fd):self.closed.append(fd);self.live.pop(fd)
  def fs(self,fd):return self.ls(self.live[fd])
 class FailingOwnerMap(dict):
  def __init__(self,index,fs):self.index=index;self.fs=fs
  def __setitem__(self,key,value):
   if len(self.fs.opened)-1==self.index:raise MemoryError('independent_immediate_owner_map_insertion_fault')
   return super().__setitem__(key,value)
 receipt={'counts':dict(M.COUNTS),'assertions':list(M.ASSERTIONS),'originalProgramsUnchanged':True,'allProgramsIndependentlyApprovedBefore1914':True}
 for index in (0,1,2):
  f=FS();L=M.Ledger();edges=[{'caller':'c','target':M.admission_id(r),'operation':'read'}for r in f.rows]
  B=M.HeldBroker(f.root,f.rows,L,edges,'c',1);B.held=FailingOwnerMap(index,f)
  with ExitStack()as stack:
   for ctx in (patch.object(M.os,'lstat',side_effect=f.ls),patch.object(M.os,'open',side_effect=f.op),patch.object(M.os,'fstat',side_effect=f.fs),patch.object(M.os,'pread',return_value=b''),patch.object(M.os,'close',side_effect=f.cl),patch.object(Path,'resolve',lambda p:p.absolute())):stack.enter_context(ctx)
   primary=None
   try:B.open_all()
   except BaseException as e:primary={'type':type(e).__name__,'message':str(e)}
   close_error=None
   try:B.close()
   except BaseException as e:close_error={'type':type(e).__name__,'message':str(e)}
   P=M.PhaseMachine(L);phase_error=None
   try:
    for stage in P.ORDER[1:]:P.advance(stage,dict(receipt),lambda *_:True)
   except M.Denied as e:phase_error=str(e)
  detail={'faultPosition':index,'primary':primary,'openedVirtualHandles':f.opened,'closeAttempts':f.closed,'remainingVirtualHandles':sorted(f.live),'closeError':close_error,'ledgerUnknownClose':L.unknown_close,'ledgerOwnedHandles':len(L.owned_fds),'phase':P.phase,'phaseError':phase_error}
  cleanup_ok=primary is not None and primary['type']=='MemoryError'and f.closed==f.opened and not f.live and len(f.closed)==len(set(f.closed))
  cases.append({'name':'successful_open_owner_registration_'+str(index)+'_complete_once_cleanup','outcome':'PASS'if cleanup_ok else'FAIL','expected':'new successful open is either registered or fallback closed once before primary propagation; no leaked virtual handle','detail':detail})
  cases.append({'name':'untracked_registration_'+str(index)+'_cannot_claim_ready','outcome':'PASS'if phase_error is not None else'FAIL','expected':'unknown owned descriptor state cannot reach ACTUAL_READY with the unchanged original receipt','detail':detail})
 result={'scope':'ADJACENT_UNCHANGED_R6_HELDBROKER_REGISTRATION_SOURCE_MOCK_ONLY','discovered':len(cases),'executed':len(cases),'passed':sum(x['outcome']=='PASS'for x in cases),'failed':sum(x['outcome']=='FAIL'for x in cases),'skipped':0,'cases':cases,'virtualHandlesOnly':True,'candidateBytesUnchanged':True,'SourceEligibility':False,'effects':0,'python':sys.version}
 for x in rows:
  read(x);x['FINAL9']=nine(os.fstat(x['fd']));x['pathFINAL9']=nine(os.lstat(x['path']));assert x['PRE9']==x['FINAL9']==x['pathFINAL9']
 (T/'independent-registration-controls1.json').write_text(json.dumps(result,indent=2)+'\n')
 print(json.dumps({k:v for k,v in result.items()if k!='cases'}),flush=True);print(json.dumps(cases),flush=True)
except BaseException as e:errors.append({'type':type(e).__name__,'message':str(e)})
finally:
 for fd,path in owned:
  x={'path':path,'attempt':1,'error':None}
  try:os.close(fd)
  except BaseException as e:x['error']=type(e).__name__;errors.append({'type':type(e).__name__,'message':str(e)})
  closes.append(x)
 (T/'held-source-FDclosure1.json').write_text(json.dumps({'rows':[{k:v for k,v in x.items()if k!='fd'}for x in rows],'FDCloses':closes,'errors':errors,'SourceEligibility':False},indent=2)+'\n')
 print(json.dumps({'held':len(rows),'closes':len(closes),'errors':errors}),flush=True)
 if errors:sys.exit(1)

