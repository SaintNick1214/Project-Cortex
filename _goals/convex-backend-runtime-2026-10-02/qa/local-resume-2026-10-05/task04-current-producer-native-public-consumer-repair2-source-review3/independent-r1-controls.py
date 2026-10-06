"""Independent SOURCE/MOCK R1 integration controls. No child, Docker or real I/O."""
import ast,copy,json,types
RESULTS=[]
def case(name,fn):
 try:detail=fn();RESULTS.append({"name":name,"status":"PASS","kind":"INDEPENDENT_SOURCE_MOCK","detail":detail})
 except BaseException as e:RESULTS.append({"name":name,"status":"FAIL","kind":"INDEPENDENT_SOURCE_MOCK","error":repr(e)})
def denied(fn):
 try:fn()
 except (ValueError,RuntimeError,KeyError)as e:return str(e)
 raise AssertionError("denial required")
def extract(name,fn):
 tree=ast.parse(SOURCES[name]);node=next(n for n in tree.body if isinstance(n,(ast.FunctionDef,ast.ClassDef))and n.name==fn)
 return compile(ast.Module(body=[node],type_ignores=[]),name,"exec")
def run_main(native_exit=0,public_exit=0,break_at=None):
 events=[];saved=[]
 class P:
  def __init__(self,*parts):self.path="/".join(map(str,parts))
  def __truediv__(self,p):return P(self.path,p)
  def mkdir(self,*a,**k):events.append("mkdir")
  def read_text(self):return 'ID=ubuntu\nVERSION_ID="24.04"\n'
  def __str__(self):return self.path
 def event(name,*args):
  events.append(name)
  if name==break_at:raise ValueError("INJECT_"+name)
 def call(argv,*a,**k):
  if argv[:3]==["docker","ps","-q"]:return b""
  if argv[:2]==["docker","info"]:return b'{"OSType":"linux","Architecture":"x86_64","DockerRootDir":"/mock"}'
  if argv[:3]==["docker","image","inspect"]:return json.dumps([{"Id":"sha256:"+"a"*64,"Architecture":"amd64","Os":"linux","Size":1}]).encode()
  if argv[:2]==["docker","build"]:event("build");return b""
  raise AssertionError(argv)
 def run(mode,seconds):event("run:"+mode+":"+str(seconds));return native_exit if mode=="native20"else public_exit
 G={"__name__":"mock_main","RUN":None,"WHOLE_END":None,"BUILD_BASELINE":None,
 "sys":types.SimpleNamespace(platform="linux"),"platform":types.SimpleNamespace(machine=lambda:"x86_64"),
 "uuid":types.SimpleNamespace(uuid4=lambda:"11111111-1111-4111-8111-111111111111"),"Path":P,
 "os":types.SimpleNamespace(environ={"RUNNER_TEMP":"/mock"},stat=lambda p:types.SimpleNamespace(st_dev=1)),
 "time":types.SimpleNamespace(monotonic=lambda:0),"phase":lambda n,s:event("phase:"+n+":"+str(s)),
 "save":lambda n,v:saved.append((n,v)),"startup_origins":lambda:[],"host_resources":lambda **k:{},
 "verify_source":lambda:event("verify"),"call":call,"strict":json.loads,"prepare_inputs":lambda:P("/parser"),
 "S":P("/source"),"create_phase":lambda m,*a:event("create:"+m),"run_phase":run,
 "export_phase":lambda m:event("export:"+m),"retire_successful_first_phase":lambda:event("retire"),
 "remaining":lambda:1,"COMBINED_EXPORT_BYTES":0,"COMBINED_EXPORT_PATHS":0}
 exec(extract("ci-run.py","main"),G)
 reason=None
 try:G["main"]()
 except ValueError as e:reason=str(e)
 return events,saved,reason
def serial_positive():
 events,saved,reason=run_main();assert reason is None
 seq=[e for e in events if e.startswith(("create:","run:","export:"))or e=="retire"]
 assert seq==["create:native20","run:native20:120","export:native20","retire","create:public48","run:public48:480","export:public48"]
 assert next(v for n,v in saved if n=="run-result.json")["crossPhaseNativeCustody"]=="ABSENT"
 return {"exactSequence":seq,"twoOwners":True}
case("serialized_two_owner_120_480_order",serial_positive)
for stage in ("native-exit","export:native20","retire"):
 def f(stage=stage):
  e,s,r=run_main(native_exit=1 if stage=="native-exit"else 0,break_at=None if stage=="native-exit"else stage)
  assert r and "create:public48"not in e and not any(n=="run-result.json"for n,v in s)
  if stage=="native-exit":assert "export:native20"in e and "retire"not in e
  return {"failure":r,"publicCreateCount":e.count("create:public48"),"events":e}
 case("phase2_blocked_after_"+stage,f)
def public_sticky():
 e,s,r=run_main(public_exit=1);assert r=="PUBLIC48_FAILED_STICKY"and "export:public48"in e and not any(n=="run-result.json"for n,v in s);return {"reason":r}
case("public_failure_exports_raw_but_never_success",public_sticky)
BP={"__name__":"mock_bounded","__file__":SOURCE_ROOT+"/bounded_process.py"}
exec(compile(SOURCES["bounded_process.py"],SOURCE_ROOT+"/bounded_process.py","exec"),BP)
def deadline(timeout,late_wait=False,late_close=False):
 clock=types.SimpleNamespace(now=0);clock.monotonic=lambda:clock.now
 close_calls=[]
 class Pipe:
  def close(self):close_calls.append("pipe")
 class Process:
  pid=999;returncode=0
  stdout=Pipe();stderr=Pipe()
  def poll(self):return 0
 class Streams:
  def __init__(self,*a,**k):pass
  def collect(self,progress):
   clock.now=timeout if late_wait else timeout-1
   return {"stdout":b"","stderr":b""}
  def partial(self):return {"stdout":b"","stderr":b""}
  def close(self):
   close_calls.extend(["selector","stdout","stderr"])
   if late_close:clock.now=timeout
   return []
 old={k:BP[k]for k in ("time","BoundedStreams")}
 try:
  BP.update(time=clock,BoundedStreams=Streams)
  try:r=BP["bounded_command"](["mock"],timeout=timeout,popen=lambda*a,**k:Process())
  except BP["CollectionFailure"]as e:r=e.receipt
 finally:BP.update(old)
 should_fail=late_wait or late_close
 assert (r["outcome"]=="FAILED")==should_fail and r["acceptanceCheckedAfterFDCloses"]is True
 assert close_calls==["selector","stdout","stderr"]
 if should_fail:assert r["failure"]=="COMMAND_DEADLINE_EXCEEDED"
 return {"outcome":r["outcome"],"elapsed":r["elapsedSeconds"],"closeCalls":close_calls}
for timeout in (20,30):
 for mode in ("healthy","late-wait","late-close"):
  case("call"+str(timeout)+"_"+mode,lambda timeout=timeout,mode=mode:deadline(timeout,mode=="late-wait",mode=="late-close"))
HC={"__name__":"mock_host"}
exec(compile(ast.Module(body=[n for n in ast.parse(SOURCES["host_contract.py"]).body if isinstance(n,ast.FunctionDef)],type_ignores=[]),"host_contract.py","exec"),{**HC})
HC={"__name__":"mock_host","re":__import__("re"),"uuid":__import__("uuid"),"MEMORY":1073741824}
exec(compile(ast.Module(body=[n for n in ast.parse(SOURCES["host_contract.py"]).body if isinstance(n,ast.FunctionDef)],type_ignores=[]),"host_contract.py","exec"),HC)
def container_vector():
 labels={"cortex.operation":"11111111-1111-4111-8111-111111111111","cortex.phase":"public48","cortex.owner":"native-public-repair1"}
 mounts=[{"type":"bind","source":"/source/"+str(i),"target":"/target/"+str(i),"rw":False}for i in range(7)]+[{"type":"volume","source":"/volume","target":"/var/tmp","name":"own-volume","rw":True}]
 expected={"id":"a"*64,"image":"sha256:"+"b"*64,"name":"owner","phase":"public48","labels":labels,"env":["HOME=/home","TMPDIR=/tmp"],"mounts":mounts}
 config={"Labels":copy.deepcopy(labels),"User":"0:0","WorkingDir":"/native-source","Entrypoint":["/usr/local/bin/python3.12"],"Cmd":["-B","/reviewed-bootstrap.py"],"Env":copy.deepcopy(expected["env"])}
 host={"Memory":1073741824,"MemorySwap":1073741824,"ReadonlyRootfs":True,"NetworkMode":"none","PidsLimit":128,"Privileged":False,"AutoRemove":False,"CapDrop":["ALL"],"PidMode":"","IpcMode":"private","UTSMode":"","CgroupnsMode":"private","Init":False,"SecurityOpt":["no-new-privileges"],"Tmpfs":{"/tmp":"rw,noexec,nosuid,nodev,size=16777216,mode=0700"},"Ulimits":[{"Name":"nofile","Hard":8192,"Soft":8192}],"Mounts":[]}
 actual=[]
 for owned in mounts:
  host["Mounts"].append({"Type":owned["type"],"Source":owned.get("name",owned["source"]),"Target":owned["target"],"ReadOnly":not owned["rw"],**({"VolumeOptions":{"NoCopy":True}}if owned["type"]=="volume"else{})})
  actual.append({"Type":owned["type"],"Source":owned["source"],"Destination":owned["target"],"RW":owned["rw"],**({"Name":owned["name"],"Driver":"local"}if owned["type"]=="volume"else{"Propagation":"rprivate"})})
 row={"Id":expected["id"],"Image":expected["image"],"Name":"/owner","Platform":"linux","Config":config,"HostConfig":host,"Mounts":actual,"State":{"OOMKilled":False,"Error":"","Pid":0,"Running":False,"ExitCode":0,"Status":"created"}}
 return row,expected
def strict_positive():
 r,e=container_vector();out=HC["validate"](r,e);assert out["id"]==e["id"];return {"fullLiteralVectorAccepted":True}
case("full_private_prestart_literal_bindings",strict_positive)
for kind in ("pid-alias","readonly-alias","memory-alias","cmd-alias","pidmode-host","pidmode-omitted","source-alias","driver-alias","cid-short","uuid-invalid"):
 def f(kind=kind):
  r,e=container_vector()
  if kind=="pid-alias":r["State"]["Pid"]=False
  elif kind=="readonly-alias":r["HostConfig"]["ReadonlyRootfs"]=1
  elif kind=="memory-alias":r["HostConfig"]["Memory"]=1073741824.0
  elif kind=="cmd-alias":r["Config"]["Cmd"]=("-B","/reviewed-bootstrap.py")
  elif kind=="pidmode-host":r["HostConfig"]["PidMode"]="host"
  elif kind=="pidmode-omitted":del r["HostConfig"]["PidMode"]
  elif kind=="source-alias":r["Mounts"][0]["Source"]="/foreign"
  elif kind=="driver-alias":r["Mounts"][-1]["Driver"]="other"
  elif kind=="cid-short":e["id"]="a"*12
  elif kind=="uuid-invalid":e["labels"]["cortex.operation"]="invalid"
  return {"denial":denied(lambda:HC["validate"](r,e)),"targetActions":0}
 case("prestart_"+kind+"_zero_target_actions",f)
PE={"__name__":"mock_public","re":__import__("re"),"FIELDS":("dev","ino","mode","uid","gid","nlink","size","mtime_ns","ctime_ns")}
NE={"__name__":"mock_export"}
exec(compile(ast.Module(body=[n for n in ast.parse(SOURCES["native_export.py"]).body if isinstance(n,ast.Assign)],type_ignores=[]),"native_export.py","exec"),NE)
PE["PUBLIC"]=NE["PUBLIC"];PE["ROOT"]="/var/tmp/task04-c8-current-canonical-input-producers/"
exec(extract("public_export_contract.py","validate_public"),PE)
def public_manifest(primary=None):
 return {"scope":"FINITE_PUBLIC_SOURCE_CONTROL_EXPORT_ONLY","files":[{"relativePath":n,"status":"ABSENT"}for n in PE["PUBLIC"]],"fileCount":23,"existingBytes":0,"combinedExportBytesMaxIncludingThisManifest":1048576,"primaryFailure":primary,"allDescendantsTerminal":True,"nativeClaims":False,"original122":"HELD","ROOT":"ABSENT"}
def public_positive():
 d=public_manifest("failed-body");assert len(PE["validate_public"](d))==23;return {"failureManifestComplete23":True}
case("finite23_failure_export_positive",public_positive)
for kind in ("partial","extra","duplicate","foreign","count-alias","native-alias"):
 def f(kind=kind):
  d=public_manifest()
  if kind=="partial":d["files"].pop()
  elif kind=="extra":d["files"].append({"relativePath":"extra","status":"ABSENT"})
  elif kind=="duplicate":d["files"][1]=copy.deepcopy(d["files"][0])
  elif kind=="foreign":d["files"][0]["relativePath"]="../private"
  elif kind=="count-alias":d["fileCount"]=23.0
  elif kind=="native-alias":d["nativeClaims"]=0
  return {"reason":denied(lambda:PE["validate_public"](d)),"memberCopies":0}
 case("public23_"+kind+"_denied_before_copy",f)
def public_bad_primary():
 d=public_manifest(False);denied(lambda:PE["validate_public"](d));return {"literalFailureAliasDenied":True}
case("public23_primary_failure_bool_alias_denied",public_bad_primary)
RESULT={"schema":"INDEPENDENT_R1_FINITE_SOURCE_MOCK_REVIEW3","results":RESULTS,"PASS":sum(r["status"]=="PASS"for r in RESULTS),"FAIL":sum(r["status"]=="FAIL"for r in RESULTS),"actualNative20Public48":False,"originalFullGates":"HELD","runtimeAuthority":False}

