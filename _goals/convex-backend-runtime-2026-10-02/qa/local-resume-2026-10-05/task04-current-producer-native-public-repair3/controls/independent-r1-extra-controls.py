"""Independent extra R1 SOURCE/MOCK controls: exact owner close, copy60, reserves."""
import ast,hashlib,io,json,types
RESULTS=[]
def case(name,fn):
 try:detail=fn();RESULTS.append({"name":name,"status":"PASS","kind":"EXECUTOR_SOURCE_MOCK_REPLAY","detail":detail})
 except BaseException as e:RESULTS.append({"name":name,"status":"FAIL","kind":"EXECUTOR_SOURCE_MOCK_REPLAY","error":repr(e)})
def extract(name,fn):
 node=next(n for n in ast.parse(SOURCES[name]).body if isinstance(n,(ast.FunctionDef,ast.ClassDef))and n.name==fn)
 return compile(ast.Module(body=[node],type_ignores=[]),name,"exec")
def phase_terminal(mode="native20",fault=None):
 clock=types.SimpleNamespace(now=0);clock.monotonic=lambda:clock.now;clock.sleep=lambda d:setattr(clock,"now",clock.now+d)
 states=[{"Running":True,"Pid":555},{"Running":False,"Pid":0,"Status":"exited","ExitCode":0}]
 if fault=="ownerless":states=states[1:]
 if fault=="replaced":states=[states[0],{"Running":True,"Pid":556}]
 closes=[];saved=[];inspections=[]
 def inspect():
  state=states[min(len(inspections),len(states)-1)];inspections.append(state)
  if fault=="late-terminal"and not state["Running"]:clock.now=120
  return {"State":state}
 def remaining():
  if clock.now>=120:raise ValueError("EXPIRED")
  return 120-clock.now
 def close(fd):
  closes.append(fd)
  if fault=="late-close":clock.now=120
  return None
 class P:
  def __init__(self,*a):pass
  def read_text(self):return "NSpid: 555 1\n"
 class Poll:
  def register(self,*a):pass
  def poll(self,*a):return []if inspections[-1]["Running"]else [(777,1)]
 script="/native-source/native-controller.py"if mode=="native20"else"/reviewed-bootstrap.py"
 owner={"pid":555,"startTime":"123","pgid":"555","sid":"555","rawArgvHex":("/usr/local/bin/python3.12\0-B\0"+script+"\0").encode().hex()}
 G={"time":clock,"phase":lambda*a:None,"remaining":remaining,"call":lambda*a,**k:b"","inspect":inspect,
 "validate":lambda r,e,**k:r,"EXPECTED":{},"OWNED_ID":"a"*64,"LABELS":{},"proc":lambda pid:{**owner,"pid":pid},
 "os":types.SimpleNamespace(pidfd_open=lambda*a:777,close=close),"signal":types.SimpleNamespace(pidfd_send_signal=lambda*a:None),
 "select":types.SimpleNamespace(poll=Poll,POLLIN=1),"Path":P,"save":lambda n,v:saved.append((n,v))}
 exec(extract("ci-run.py","run_phase"),G);reason=None
 try:exit=G["run_phase"](mode,120)
 except ValueError as e:reason=str(e)
 receipt=next(v for n,v in saved if n==mode+"-terminal.json")
 assert (receipt["outcome"]=="FAILED")==bool(fault)
 if fault=="ownerless":assert closes==[]and receipt["owner"]is None
 else:assert closes==[777]and receipt["closeCompleted"]is True
 if fault:assert reason
 else:assert receipt["nativeOwnerExpiredAtTerminal"]is True and receipt["noCrossPhaseLiveCustody"]is True
 return {"outcome":receipt["outcome"],"reason":reason,"closes":closes,"ownerObserved":receipt["owner"]is not None}
for mode in ("native20","public48"):
 for fault in (None,"ownerless","replaced","late-terminal","late-close"):
  case("owner_"+mode+"_"+str(fault),lambda mode=mode,fault=fault:phase_terminal(mode,fault))
def copy60(fault=None):
 clock=types.SimpleNamespace(now=0);clock.monotonic=lambda:clock.now
 closes=[]
 class Process:
  pid=555;returncode=0;stdout=None;stderr=None
  def poll(self):return 0
 class Stream:
  def __init__(self,*a,**k):pass
  def finish(self):
   clock.now=60 if fault=="late-wait"else 59
   return {"stderr":b"","stdoutPrefix":b"","exit":0,"terminal":True}
  def partial(self):return {}
  def close(self):
   closes.append("stream")
   if fault=="late-stream-close":clock.now=60
   return []
 class Poll:
  def register(self,*a):pass
  def poll(self,*a):return [(101,1)]
 class Target:
  def exists(self):return False
  def is_symlink(self):return False
 class Out(io.BytesIO):
  def fileno(self):return 99
 class Archive:
  fileobj=None
  def __enter__(self):return self
  def __exit__(self,*a):pass
  def __iter__(self):
   yield types.SimpleNamespace(name="file",linkname="",size=1,isfile=lambda:True)
  def extractfile(self,m):return io.BytesIO(b"x")
 calls=[]
 def pidfd(pid,*a):calls.append(pid);return 100 if len(calls)==1 else 101
 def close(fd):
  closes.append(fd)
  if fault=="late-pidfd-close"and fd==101:clock.now=60
 G={"time":clock,"Path":__import__("pathlib").Path,"hashlib":hashlib,
 "os":types.SimpleNamespace(pidfd_open=pidfd,getpid=lambda:999,close=close,chmod=lambda*a:None,fsync=lambda*a:None),
 "signal":types.SimpleNamespace(pidfd_send_signal=lambda*a:None),
 "subprocess":types.SimpleNamespace(Popen=lambda*a,**k:Process(),DEVNULL=0,PIPE=1,TimeoutExpired=TimeoutError),
 "select":types.SimpleNamespace(poll=Poll,POLLIN=1),"BoundedFileStream":Stream,
 "tarfile":types.SimpleNamespace(open=lambda*a,**k:Archive()),"TrackedTarReader":lambda x:object(),
 "finish_tar_record":lambda*a:{"complete":True},"open":lambda*a,**k:Out()}
 exec(extract("copy_file.py","CopyFailure"),G);exec(extract("copy_file.py","copy_file"),G)
 pin={"bytes":1,"sha256":hashlib.sha256(b"x").hexdigest()}
 if fault=="hash":pin["sha256"]="a"*64
 try:r=G["copy_file"]("a"*64,"/var/tmp/file",Target(),1,pin)
 except G["CopyFailure"]as e:r=e.receipt
 assert (r["outcome"]=="FAILED")==bool(fault)
 assert closes==[100,"stream",101]and r["acceptanceCheckedAfterFDCloses"]is True
 if fault and fault!="hash":assert r["elapsedSeconds"]==60 and "failure"in r
 return {"outcome":r["outcome"],"elapsed":r["elapsedSeconds"],"closes":closes}
for fault in (None,"late-wait","late-stream-close","late-pidfd-close","hash"):
 case("copy60_"+str(fault),lambda fault=fault:copy60(fault))
NC={"__name__":"review3_native_contract","__file__":SOURCE_ROOT+"/native_contract.py"}
exec(compile(SOURCES["native_contract.py"],SOURCE_ROOT+"/native_contract.py","exec"),NC)
def reserve():
 host=NC["host_demand"](4096);container=NC["demand"](4096)
 assert host["initialAvailableBytesRequired"]==13298642944 and host["initialAvailableInodesRequired"]==131338
 assert container["initialAvailableBytesRequired"]==2604023808 and container["initialAvailableInodesRequired"]==21120
 assert host["maintainedAvailableBytesRequired"]==8589934592 and host["maintainedAvailableInodesRequired"]==32768
 assert 180+720+120+120+60+120+480+300==2100 and 2100+60+60==2220 and 180+2220+240+60==2700
 return {"host":host,"container":container,"proposalJob":2700,"runtimeAuthority":False}
case("original_reserve_floors_and_2700_envelope",reserve)
for mode in ("python","node"):
 def f(mode=mode):
  fs=types.SimpleNamespace(f_bavail=1000000,f_frsize=4096,f_favail=100000)
  needed=134217728 if mode=="python"else 536870912
  NC["resource"](fs,1073741824,1073741824-needed,0,node=mode=="node")
  try:NC["resource"](fs,1073741824,1073741824-needed+1,0,node=mode=="node")
  except ValueError:return {"oneByteBelowReserveDenied":True,"required":needed}
  raise AssertionError("reserve bypass")
 case("literal_"+mode+"_memory_reserve_onebyte_boundary",f)
for raw in (b'{"x":1e309}',b'{"x":1,"x":2}'):
 def f(raw=raw):
  try:NC["strict"](raw)
  except ValueError:return {"denied":True}
  raise AssertionError("nonfinite/duplicate accepted")
 case("R1_strict_finite_"+raw.decode(),f)
RESULT={"schema":"EXECUTOR_R1_EXTRA_SOURCE_MOCK_REVIEW3","results":RESULTS,"PASS":sum(r["status"]=="PASS"for r in RESULTS),"FAIL":sum(r["status"]=="FAIL"for r in RESULTS),"actualNative20Public48":False,"originalFullGates":"HELD","runtimeAuthority":False}
