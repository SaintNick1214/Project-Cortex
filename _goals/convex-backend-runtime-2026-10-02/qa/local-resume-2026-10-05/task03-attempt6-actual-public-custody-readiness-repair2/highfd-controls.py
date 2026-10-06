"""Finite host-only controls for separately adapted Common; no Docker/service/private effects."""
import ast,hashlib,json,os,resource,select,socket,stat,sys,time,types
from pathlib import Path
R=Path('/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion')
N=R/'_goals/convex-backend-runtime-2026-10-02/qa/local-resume-2026-10-05/task03-attempt6-actual-public-custody-readiness-repair2'
ORIGINAL=R/'_goals/convex-backend-runtime-2026-10-02/qa/task03-local-native-attempt6-2026-10-06/integrated/coordinate-common.py'
ADAPTED=N/'coordinate-common-highfd.py'
FIELDS=('dev','ino','mode','nlink','uid','gid','size','mtime_ns','ctime_ns')
ENV={'PATH':'/usr/bin:/bin','LANG':'C.UTF-8','CORTEX_COORDINATOR_CWD':str(R)}
pins=[]
def nine(s):return {k:str(getattr(s,'st_'+k))for k in FIELDS}
def hold(p,expected):
 s=p.lstat();now=time.time_ns();assert stat.S_ISREG(s.st_mode)and s.st_nlink==1 and s.st_uid==501 and s.st_gid==20
 assert max(s.st_mtime_ns,s.st_ctime_ns)+60000000000<=now
 fd=os.open(p,os.O_RDONLY|os.O_NOFOLLOW);row={'path':str(p),'PRE9':nine(s),'firstCapturedNs':str(now),'fd':fd};pins.append(row)
 raw=read(row);assert hashlib.sha256(raw).hexdigest()==expected
 return row,raw

def read(pin):
 fd=pin['fd'];pre=pin['PRE9'];assert nine(os.fstat(fd))==pre;os.lseek(fd,0,0);raw=bytearray()
 while block:=os.read(fd,65536):raw.extend(block);assert len(raw)<=int(pre['size'])<=16777216
 assert len(raw)==int(pre['size'])and nine(os.fstat(fd))==nine(Path(pin['path']).lstat())==pre
 return bytes(raw)
def module(path,raw):
 result=types.ModuleType('bounded_common_control_'+path.stem);result.__file__=str(path);result.__package__=''
 exec(compile(raw,str(path),'exec',dont_inherit=True),result.__dict__);return result
assert sys.dont_write_bytecode and Path.cwd()==R
soft,hard=resource.getrlimit(resource.RLIMIT_NOFILE)
if soft<8192:resource.setrlimit(resource.RLIMIT_NOFILE,(min(8192,hard),hard))
assert resource.getrlimit(resource.RLIMIT_NOFILE)[0]>=4096
op,original=hold(ORIGINAL,'1f8f6005c668401b63681e28002715d977abcc02312a199a468e32c2505fa0a2')
ap,adapted=hold(ADAPTED,'3b7d195b905465275b081b32f0a934af4c232f7dafb76281c044d50e8b03dc8f')
O=module(ORIGINAL,original);C=module(ADAPTED,adapted)
# Exact reference transform and remaining AST protect all original safeguards.
text=original.decode();helper='def control_readable(control, wait):\n    with selectors.DefaultSelector() as readiness:\n        readiness.register(control, selectors.EVENT_READ)\n        return bool(readiness.select(wait))\n\n'
text=text.replace('def anchor_main(fd, argv):\n',helper+'def anchor_main(fd, argv):\n')
for old,new in [('select.select([control],[],[],0.02)[0]','control_readable(control,0.02)'),('select.select([control],[],[],wait)[0]','control_readable(control,wait)'),('select.select([control],[],[],max(0,ready_deadline-time.monotonic()))[0]','control_readable(control,max(0,ready_deadline-time.monotonic()))')]:assert text.count(old)==1;text=text.replace(old,new)
assert text.encode()==adapted
assert C.PIPE_LIMIT==O.PIPE_LIMIT==262144 and C.INPUT_LIMIT==O.INPUT_LIMIT==327692 and C.CONTROL_LIMIT==O.CONTROL_LIMIT==8192
OUT=N/'highfd-controls1';OUT.mkdir(mode=0o700);rows=[];held=[]
def terminal(row):
 assert row['terminal']is True and row['closeErrors']==[] and row['ownedGroup']['absenceObserved']is True
 assert row['ownedGroup']['unknownOwnershipNeverSignaled']is True
 assert row['pipeLimits']==262144 and row['stdinLimit']==327692 and row['stdinDeadlineSeconds']==12

def run(common,label,code,timeout=8,input_bytes=None):
 row,out,err=common.run(label,[sys.executable,'-B','-c',code],OUT,timeout,ENV,input_bytes=input_bytes,required=False)
 rows.append(row);terminal(row);return row,out,err
try:
 row,out,err=run(O,'original-lowfd-success',"import os;os.write(1,b'low-ok');os.write(2,b'low-err')")
 assert row['exitCode']==0 and row['failureClass']is None and out==b'low-ok'and err==b'low-err'
 while not held or held[-1]<2400:held.append(os.open('/dev/null',os.O_RDONLY))
 assert len(held)>=2352 and held[-1]>=2400
 a,b=socket.socketpair();descriptor=a.fileno();assert descriptor>2400
 try:
  denied=None
  try:select.select([a],[],[],0)
  except ValueError as e:denied={'class':type(e).__name__,'reason':str(e),'descriptor':descriptor}
  assert denied is not None
  assert C.control_readable(a,0)is False
  before=time.monotonic();assert C.control_readable(a,0.035)is False;elapsed=time.monotonic()-before;assert 0.025<=elapsed<=1
  b.sendall(b'Q');assert C.control_readable(a,0)is True and a.recv(1)==b'Q'
  b.close();assert C.control_readable(a,0)is True and a.recv(1)==b''
 finally:a.close();b.close()
 row,out,err=run(C,'highfd2400-success',"import os;os.write(1,b'high-ok');os.write(2,b'high-err')")
 assert row['exitCode']==0 and row['failureClass']is None and out==b'high-ok'and err==b'high-err'
 row,out,err=run(C,'highfd2400-nonzero',"import os,sys;os.write(1,b'nonzero');sys.exit(7)")
 assert row['exitCode']==7 and row['failureClass']is None and out==b'nonzero'and err==b''
 payload=b'z'*327692
 row,out,err=run(C,'highfd2400-stdin-max',"import sys,hashlib;data=sys.stdin.buffer.read();print(str(len(data))+':'+hashlib.sha256(data).hexdigest())",input_bytes=payload)
 assert row['exitCode']==0 and row['failureClass']is None and row['stdinBytes']==327692 and out.decode().strip()=='327692:'+hashlib.sha256(payload).hexdigest()and err==b''
 row,out,err=run(C,'highfd2400-pipes-max',"import sys;sys.stdout.buffer.write(b'A'*262144);sys.stdout.buffer.flush();sys.stderr.buffer.write(b'B'*262144);sys.stderr.buffer.flush()")
 assert row['exitCode']==0 and row['failureClass']is None and out==b'A'*262144 and err==b'B'*262144
 row,out,err=run(C,'highfd2400-stdout-overflow',"import sys,time;sys.stdout.buffer.write(b'A'*262145);sys.stdout.buffer.flush();time.sleep(0.15)")
 assert row['failureClass']=='ValueError'and len(out)==262144 and row['streamByteCounts']['stdout']==262145
 row,out,err=run(C,'highfd2400-stderr-overflow',"import sys,time;sys.stderr.buffer.write(b'B'*262145);sys.stderr.buffer.flush();time.sleep(0.15)")
 assert row['failureClass']=='ValueError'and len(err)==262144 and row['streamByteCounts']['stderr']==262145
 row,out,err=run(C,'highfd2400-deadline',"import time;time.sleep(5)",timeout=0.35)
 assert row['failureClass']=='TimeoutError'and row['elapsedSeconds']<4 and row['ownedGroup']['reconciliation']is not None
 # Child closes inherited streams; residual owned child still needs reconciliation.
 row,out,err=run(C,'highfd2400-residual',"import subprocess,sys;subprocess.Popen([sys.executable,'-B','-c','import time;time.sleep(4)'],stdin=subprocess.DEVNULL,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)")
 assert row['failureClass']=='OwnedGroupResidual'and row['ownedGroup']['reconciliation']['signals']
 row,out,err=C.run('highfd2400-missing',['/nonexistent-task03-host-control'],OUT,8,ENV,required=False);rows.append(row)
 assert row['failureClass']=='FileNotFoundError'and row['closeErrors']==[]and row['ownedGroup']['absenceObserved']is True and row['terminal']is False
 for value,reason in [(0,'finite_command_timeout_required'),(191,'finite_command_timeout_required')]:
  try:C.run('denied-timeout',[sys.executable],OUT,value,ENV)
  except ValueError as e:assert str(e)==reason
  else:raise AssertionError('timeout accepted')
 for value in (b'',b'x'*327693):
  try:C.run('denied-stdin',[sys.executable],OUT,1,ENV,input_bytes=value)
  except ValueError as e:assert str(e)=='finite_stdin_required'
  else:raise AssertionError('stdin accepted')
 while held[-1]<4000:held.append(os.open('/dev/null',os.O_RDONLY))
 row,out,err=run(C,'highfd4000-success',"print('near-ceiling-ok')")
 assert row['exitCode']==0 and row['failureClass']is None and out==b'near-ceiling-ok\n'and err==b''
 final=[]
 for pin in pins:
  raw=read(pin);final.append({k:v for k,v in pin.items()if k!='fd'}|{'sha256':hashlib.sha256(raw).hexdigest(),'bytes':len(raw),'fullEOF':True,'finalPathAndDescriptorNineEqual':True})
 C.durable_json(OUT/'controls-summary.json',{'scope':'HOST_ONLY_SEPARATE_HIGHFD_COMMON_REGRESSION_CONTROLS','status':'PASS','actualDockerCalls':0,'privateReads':0,'serviceCalls':0,'paidCalls':0,'sourceMutation':False,'exactThreeReadinessSiteTransform':True,'originalSelectHighFdNegative':denied,'selectorEmptyTimeoutReadyEof':{'timeoutSeconds':elapsed,'readyDataAndEofObserved':True},'custodyDummyDescriptorsHeld':len(held),'highestCustodyDescriptor':held[-1],'custodyHeldUntilEveryControlFinal':True,'commands':rows,'sourcePins':final,'invalidTimeoutsAndStdinLimitsDenied':True,'originalAssertionsLimitsDeadlinesOwnershipCodeBytePreserved':True,'fullTask03':False,'fullGoal':False,'nativePrivate':False})
 C.durable_json(OUT/'writers-stopped.json',{'scope':'HIGHFD_CONTROLS_WRITERS_STOPPED','remainingWrites':[],'stoppedNs':str(time.time_ns()),'firstPhysicalQualification':'Root after max(mtime,ctime)>=60seconds','noPinsRefreshed':True})
 print(json.dumps({'status':'PASS','controls':len(rows),'highestHeldDescriptor':held[-1],'output':str(OUT)}))
finally:
 for fd in held:os.close(fd)
 for pin in pins:os.close(pin['fd'])
