"""Independent bounded U2 SOURCE_ONLY review, distinct from Task04 authorship.
All source/receipt inputs remain held through verdict final; no Docker dispatch.
"""
import ast, base64, hashlib, json, math, os, resource, select, socket, stat, sys, time, types, zlib
from pathlib import Path
R=Path('/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion')
P=R/'_goals/convex-backend-runtime-2026-10-02/qa/local-resume-2026-10-05'
U=P/'task03-attempt6-actual-public-custody-readiness-repair2'
OLD=P/'task03-attempt6-actual-public-custody-readiness-review1'
Q=R/'_goals/convex-backend-runtime-2026-10-02/qa/task03-local-native-attempt6-2026-10-06'
J=P/'task03-attempt6-highfd-public-repair2-independent-source-review1'
ROOT=P/'root-task03-attempt6-highfd-public-repair2-closed-mature-readback1.json'
ROOT_SHA='0df4f88dc6e5e7de755d2dc6a0969e8626e0eb5178e8301fa60b15d1354ed31f'
FIELDS=('dev','ino','mode','nlink','uid','gid','size','mtime_ns','ctime_ns')
HELD=[];DATA={};ROWS={};total=0;CONTROLS=[];FINDINGS=[];host=[];padding=[]
def nine(s):return {k:str(getattr(s,'st_'+k))for k in FIELDS}
def sha(raw):return hashlib.sha256(raw).hexdigest()
def strict(raw):
 def pairs(xs):
  r={}
  for k,v in xs:
   assert k not in r,'review_duplicate_key';r[k]=v
  return r
 def finite(s):
  v=float(s);assert math.isfinite(v),'review_nonfinite_float';return v
 return json.loads(raw,object_pairs_hook=pairs,parse_float=finite,parse_constant=lambda _:(_ for _ in ()).throw(ValueError('review_nonfinite')))
def write(name,value):
 raw=value if isinstance(value,bytes)else (json.dumps(value,indent=2)+'\n').encode()
 path=J/name;fd=os.open(path,os.O_WRONLY|os.O_CREAT|os.O_EXCL|os.O_NOFOLLOW,0o600)
 try:
  view=memoryview(raw)
  while view:
   n=os.write(fd,view);assert n>0;view=view[n:]
  os.fsync(fd)
 finally:os.close(fd)
 return {'path':str(path),'bytes':len(raw),'sha256':sha(raw)}
def open_all(items):
 global total
 fresh=[]
 for path,expected in items:
  path=Path(path);key=str(path)
  if key in ROWS:continue
  assert path.is_absolute()and path.resolve()==path and path.is_relative_to(R)
  before=nine(path.lstat());age=time.time_ns()-max(int(before['mtime_ns']),int(before['ctime_ns']))
  assert age>=60000000000 and stat.S_ISREG(int(before['mode']))and before['nlink']=='1'
  size=int(before['size']);assert 0<=size<=16777216 and len(HELD)+1<=4096 and total+size<=67108864
  if expected and 'PRE9'in expected:assert before==expected['PRE9'],'original_Root_nine_not_refreshable'
  fd=os.open(path,os.O_RDONLY|os.O_NOFOLLOW)
  row={'path':key,'PRE9':before,'maturityAgeNs':str(age),'fd':fd,'expected':expected}
  HELD.append(row);ROWS[key]=row;total+=size;fresh.append(row)
  assert nine(os.fstat(fd))==before
 return fresh
def read(row):
 os.lseek(row['fd'],0,0);raw=bytearray();pre=row['PRE9']
 assert nine(os.fstat(row['fd']))==pre
 while block:=os.read(row['fd'],65536):raw.extend(block);assert len(raw)<=int(pre['size'])
 assert len(raw)==int(pre['size'])and nine(os.fstat(row['fd']))==nine(Path(row['path']).lstat())==pre
 data=bytes(raw);expected=row['expected']
 if expected:assert len(data)==expected['bytes']and sha(data)==expected['sha256']
 row.update(bytes=len(data),sha256=sha(data),fullEOF=True,finalDescriptorAndPathNineEqual=True)
 DATA[row['path']]=data;return data
def body(path):return DATA[str(path)]
def check(name,condition,detail=None):CONTROLS.append({'name':name,'pass':bool(condition),'detail':detail})
def functions(path,names,ns):
 tree=ast.parse(body(path));lookup={x.name:x for x in tree.body if isinstance(x,ast.FunctionDef)}
 exec(compile(ast.Module(body=[lookup[n]for n in names],type_ignores=[]),'<independent-held-U2-function-fixture>','exec'),ns)
 return tree,lookup
def finding(code,title,paths,detail):FINDINGS.append({'id':code,'severity':'P1','title':title,'paths':paths,'detail':detail})
failure=None;publication=[];closed=[];close_errors=[]
try:
 rr=open_all([(ROOT,{'bytes':47005,'sha256':ROOT_SHA})])[0];root=strict(read(rr));assert len(root['files'])==68
 cohort=open_all([(row['path'],row)for row in root['files']])
 for row in cohort:read(row)
 refs=strict(body(U/'reference-contracts.json'))['originalReferences']
 more=open_all([(row['path'],row)for row in refs]+[(J/n,None)for n in ['review-reader.py','reader-source-writer-stop.json','first-root68-source-readback.json','reader-loader-final-FDclosure.json','inspect-u2.py','inspect-source-writer-stop.json','manifest-shape.json','independent-source-controls.py','source-controls-writer-stop.json','reviewer-reader1-failure.json','runner2-source-writer-stop.json']])
 for row in more:read(row)
 write('reader2-first-original-pins-readback.json',{'scope':'DISTINCT_REPLACEMENT_REVIEW_INPUT_CUSTODY_NOT_REPAIR_OF_FAILED_INTERVAL','allTargetDescriptorsBeforeTargetContents':True,'originalRoot68PinsUnchanged':True,'files':[{k:v for k,v in x.items()if k not in ('fd','expected')}for x in HELD],'filesCount':len(HELD),'bytes':total,'firstReaderFailurePreserved':True,'currentAgentReuse':'Thread limit prevents fresh spawn; reviewer authored no U2 and does not review Task04 work.'})
 original=body(Q/'integrated/coordinate-common.py');adapted=body(U/'coordinate-common-highfd.py')
 text=original.decode();helper='def control_readable(control, wait):\n    with selectors.DefaultSelector() as readiness:\n        readiness.register(control, selectors.EVENT_READ)\n        return bool(readiness.select(wait))\n\n'
 check('one-helper-insertion-site',text.count('def anchor_main(fd, argv):\n')==1)
 text=text.replace('def anchor_main(fd, argv):\n',helper+'def anchor_main(fd, argv):\n')
 for i,(a,b)in enumerate([('select.select([control],[],[],0.02)[0]','control_readable(control,0.02)'),('select.select([control],[],[],wait)[0]','control_readable(control,wait)'),('select.select([control],[],[],max(0,ready_deadline-time.monotonic()))[0]','control_readable(control,max(0,ready_deadline-time.monotonic()))')]):
  check('exact-single-readiness-replacement-'+str(i),text.count(a)==1);text=text.replace(a,b)
 check('every-other-Common-byte-conserved',text.encode()==adapted)
 for n in ['linux-public-observer.py','linux-dependency-observer.mjs']:check('exact-original-observer-'+n,body(OLD/n)==body(U/n))
 ns={'Path':Path,'json':json,'hashlib':hashlib,'base64':base64,'zlib':zlib,'os':os,'stat':stat,'time':time,'R':R,'AGE':60000000000,'FIELDS':FIELDS,'MAX_EXPORT':4194304,'SOURCE_GRAPH_MAX_FILES':4096,'SOURCE_GRAPH_MAX_BYTES':67108864,'SOURCE_GRAPH_MAX_FILE':16777216,'source_graph_members':{},'source_graph_bytes':0,'unique_pins':{},'all_pins':[]}
 tree,funcs=functions(U/'run-actual-review.py',['reserve_source_graph','strict','sha','nine','capture','qualify','compressed','command','recipe'],ns)
 reserve=ns['reserve_source_graph']
 for i in range(4):reserve('/independent/source/'+str(i),16777216)
 check('64MiB-exact-positive',ns['source_graph_bytes']==67108864)
 reserve('/independent/source/0',16777216);check('dedup-does-not-reset-budget',len(ns['source_graph_members'])==4 and ns['source_graph_bytes']==67108864)
 for label,path,size in [('extra-control-byte','/control/extra',1),('perfile-plus-one','/source/big',16777217),('duplicate-size-drift','/independent/source/0',0),('bool-size','/source/bool',True),('float-size','/source/float',1.0),('negative-size','/source/negative',-1)]:
  before=(dict(ns['source_graph_members']),ns['source_graph_bytes']);error=None
  try:reserve(path,size)
  except AssertionError as e:error=str(e)
  check('ledger-deny-'+label,error is not None and before==(ns['source_graph_members'],ns['source_graph_bytes']),error)
 countns={**ns,'source_graph_members':{},'source_graph_bytes':0}
 functions(U/'run-actual-review.py',['reserve_source_graph'],countns)
 for i in range(4096):countns['reserve_source_graph']('/independent/count/'+str(i),0)
 error=None
 try:countns['reserve_source_graph']('/independent/count/4096',0)
 except AssertionError as e:error=str(e)
 check('4096-exact4097-denied',len(countns['source_graph_members'])==4096 and error=='source_graph_descriptor_ceiling',error)
 for raw in ['{"a":NaN}','{"a":Infinity}','{"a":-Infinity}','{"a":1,"a":2}']:
  error=None
  try:ns['strict'](raw)
  except (ValueError,AssertionError)as e:error=type(e).__name__
  check('strict-special-duplicate-denied-'+raw,error is not None,error)
 overflow=ns['strict']('{"sourceRows":1e309,"sourceBytes":-1e309}')
 check('overflow-parses-to-infinity-demonstrated',math.isinf(overflow['sourceRows'])and math.isinf(overflow['sourceBytes']))
 guard=next(x for x in ast.walk(tree)if isinstance(x,ast.Assert)and "type(H['sourceRows'])"in ast.unparse(x))
 for field in ['sourceRows','sourceBytes']:
  for value in [float('inf'),-float('inf'),True,1.0,[],{}]:
   error=None
   try:exec(compile(ast.Module(body=[guard],type_ignores=[]),'<actual-U2-handoff-numeric-contract>','exec'),{**ns,'H':{'sourceRows':1,'sourceBytes':1,field:value}})
   except (AssertionError,TypeError)as e:error=type(e).__name__
   check('typed-handoff-'+field+'-'+repr(value)+'-denied',error is not None,error)
 payload=b'{"status":"PASS","finite":1.25}'
 import gzip
 envelope={'encoding':'gzip+base64','decodedBytes':len(payload),'decodedSha256':sha(payload),'body':base64.b64encode(gzip.compress(payload,mtime=0)).decode()}
 check('valid-finite-compressed-envelope',ns['compressed'](json.dumps(envelope))=={'status':'PASS','finite':1.25})
 for value in [float('inf'),-float('inf'),True,1.0,-1,4194305]:
  bad={**envelope,'decodedBytes':value};error=None
  try:ns['compressed'](json.dumps(bad))
  except (AssertionError,ValueError)as e:error=type(e).__name__
  check('decodedBytes-'+repr(value)+'-denied',error is not None,error)
 # Full author host11 receipts are evaluated independently from held raw bytes.
 summary=strict(body(U/'highfd-controls1/controls-summary.json'))
 for command in summary['commands']:
  label=command['label'];row=strict(body(U/'highfd-controls1'/(label+'.receipt.json')));out=body(U/'highfd-controls1'/(label+'.stdout'));err=body(U/'highfd-controls1'/(label+'.stderr'))
  good=row==command and sha(out)==row['stdoutSha256']and sha(err)==row['stderrSha256']and len(out)<=262144 and len(err)<=262144 and row['closeErrors']==[]and row['ownedGroup']['absenceObserved']is True
  good=good and (row['terminal']is (False if 'missing'in label else True))
  check('retained-author-raw-'+label,good,{'exit':row['exitCode'],'failure':row['failureClass'],'out':len(out),'err':len(err)})
 check('retained-author-actual11',len(summary['commands'])==11)
 # Reproduce complete runner cleanup with virtual FDs only. No external actions.
 top=next(x for x in tree.body if isinstance(x,ast.Try));close_loop=top.finalbody[-1]
 class CloseFault:
  def __init__(self,fail):self.calls=[];self.fail=fail
  def close(self,fd):
   self.calls.append(fd)
   if fd==self.fail:raise OSError('injected-close-failure')
 fake=CloseFault(101);error=None
 try:exec(compile(ast.Module(body=[close_loop],type_ignores=[]),'<actual-runner-final-close-loop>','exec'),{'os':fake,'all_pins':[{'fd':101},{'fd':102},{'fd':103}]})
 except OSError as e:error=str(e)
 check('runner-all-owned-closes-attempted-after-close-failure',fake.calls==[101,102,103],{'calls':fake.calls,'error':error,'expected':[101,102,103]})
 if fake.calls!=[101,102,103]:finding('U2-F1','Runner final cleanup abandons later owned descriptors after one close error',[str(U/'run-actual-review.py')],{'calls':fake.calls,'expected':[101,102,103],'error':error,'note':'Inherited original loop, still operative in the newly reviewed runner. Requires all-attempt cleanup and sticky rejection, no unknown-FD retry.'})
 public_tree=ast.parse(body(U/'linux-public-observer.py'));public_try=next(x for x in public_tree.body if isinstance(x,ast.Try));fake=CloseFault(201);error=None
 try:exec(compile(ast.Module(body=public_try.finalbody,type_ignores=[]),'<actual-observer-final-close-loop>','exec'),{'os':fake,'held':[{'fd':201},{'fd':202},{'fd':203}]})
 except OSError as e:error=str(e)
 check('Python-observer-all-closes-attempted-after-close-failure',fake.calls==[201,202,203],{'calls':fake.calls,'error':error})
 if fake.calls!=[201,202,203]:finding('U2-F2','Python observer final cleanup stops after the first close error',[str(U/'linux-public-observer.py')],{'calls':fake.calls,'expected':[201,202,203],'error':error,'byteCopy':'unchanged original, not a new delta'})
 # JS capture ownership/maturity ordering is source-reachable before its try.
 js=body(U/'linux-dependency-observer.mjs').decode();start=js.index('function capture(');end=js.index('\nfunction qualify(',start);capture_js=js[start:end]
 ordering=capture_js.index('openSync(')<capture_js.index('immature_before_first_capture')<capture_js.index('pins.push(')
 check('JS-capture-registers-owner-before-maturity-rejection',not ordering,{'openBeforeMaturityAndOwnerRegistration':ordering,'actualFunction':capture_js})
 if ordering:finding('U2-F3','Dependency observer opens a descriptor before a throwing maturity assertion registers ownership',[str(U/'linux-dependency-observer.mjs')],{'actualFunction':capture_js,'reachability':'controlledJson and root/package/projection capture loops execute before the observer try/finally; premature input or fstat mismatch can escape without its FD being owned/closed. Exact original byte copy does not remove operative fault.'})
 # Publication failure in runner finalizer can skip its entire close loop.
 class MockCommon:
  def durable_json(self,*a,**k):raise OSError('injected-report-write-failure')
 class MockRaw:
  def is_dir(self):return True
 fake=CloseFault(None)
 mock={**ns,'C':MockCommon(),'RAW':MockRaw(),'NAMES':{},'owners':{},'recipes':{},'cleanup_errors':[],'results':{},'failure':'already-failed','all_pins':[{'fd':301},{'fd':302}], 'records':[],'OP':'mock','REVIEW_OP':'mock','VOLUME':'mock','DEPS':'mock','OUT':J,'MF_SHA':'mock','public_transfer_sha':None,'control_rows':{k:{'sha256':'mock'}for k in ['sourceApproval','publicRecipeBinding','publicSourceManifest']},'os':fake,'command':lambda *a,**k:({},b'',b''),'qualify':lambda *a,**k:None}
 error=None
 try:exec(compile(ast.Module(body=top.finalbody,type_ignores=[]),'<actual-entire-finalizer-no-effects>','exec'),mock)
 except OSError as e:error=str(e)
 check('runner-closes-owned-inputs-after-final-publication-failure',fake.calls==[301,302],{'calls':fake.calls,'error':error})
 if fake.calls!=[301,302]:finding('U2-F4','Runner final publication failure skips all held-input closes',[str(U/'run-actual-review.py')],{'calls':fake.calls,'expected':[301,302],'error':error,'required':'Outer lifetime guard independent of report publication, with all close attempts exactly once and sticky failure.'})
 # Exact own fixture: no execution of U2 entry or source file through imports.
 fixture=J/'review2-exact-common-host.py';write(fixture.name,adapted)
 write('review2-host-source-writer-stop.json',{'scope':'OWN_EXACT_COMMON_HOST_FIXTURE_STOPPED','bytes':len(adapted),'sha256':sha(adapted),'stoppedNs':str(time.time_ns()),'remainingWrites':[]})
 print(json.dumps({'phase':'source-controls-complete','pass':sum(x['pass']for x in CONTROLS),'fail':sum(not x['pass']for x in CONTROLS),'findings':FINDINGS,'hostFixtureMustMature60':True}),flush=True)
 # Actual elapsed wait while original source descriptors remain held.
 time.sleep(60.2)
 fresh=open_all([(fixture,{'bytes':21476,'sha256':'3b7d195b905465275b081b32f0a934af4c232f7dafb76281c044d50e8b03dc8f'}),(J/'review2-host-source-writer-stop.json',None)])
 for row in fresh:read(row)
 C=types.ModuleType('independent_U2_common_host');C.__file__=str(fixture);C.__package__='';exec(compile(body(fixture),str(fixture),'exec',dont_inherit=True),C.__dict__)
 soft,hard=resource.getrlimit(resource.RLIMIT_NOFILE)
 if soft<4096:resource.setrlimit(resource.RLIMIT_NOFILE,(min(8192,hard),hard))
 assert resource.getrlimit(resource.RLIMIT_NOFILE)[0]>=4096
 while not padding or padding[-1]<2400:
  assert len(HELD)+len(padding)+32<=4096
  padding.append(os.open('/dev/null',os.O_RDONLY))
 a,b=socket.socketpair()
 try:
  negative=None
  try:select.select([a],[],[],0)
  except ValueError as e:negative=str(e)
  check('original-select-highFD-negative',negative is not None,{'fd':a.fileno(),'error':negative})
  check('DefaultSelector-highFD-empty',C.control_readable(a,0)is False)
  t=time.monotonic();ready=C.control_readable(a,.035);elapsed=time.monotonic()-t
  check('DefaultSelector-highFD-finite-timeout',ready is False and .025<=elapsed<1,elapsed)
  b.sendall(b'R');check('DefaultSelector-highFD-ready',C.control_readable(a,0)is True and a.recv(1)==b'R')
  b.close();check('DefaultSelector-highFD-EOF',C.control_readable(a,0)is True and a.recv(1)==b'')
 finally:a.close();b.close()
 HOST=J/'host-controls2';HOST.mkdir(mode=0o700)
 env={'PATH':'/usr/bin:/bin','LANG':'C.UTF-8','CORTEX_COORDINATOR_CWD':str(R)}
 cases=[('success',"import os;os.write(1,b'pass');os.write(2,b'err')",8,None,None,0),('nonzero',"import sys;sys.exit(7)",8,None,None,7),('stdout-overflow',"import sys,time;sys.stdout.buffer.write(b'A'*262145);sys.stdout.buffer.flush();time.sleep(.1)",8,None,'ValueError',None),('stderr-overflow',"import sys,time;sys.stderr.buffer.write(b'B'*262145);sys.stderr.buffer.flush();time.sleep(.1)",8,None,'ValueError',None),('deadline',"import time;time.sleep(5)",.35,None,'TimeoutError',None),('residual',"import subprocess,sys;subprocess.Popen([sys.executable,'-B','-c','import time;time.sleep(4)'],stdin=subprocess.DEVNULL,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)",8,None,'OwnedGroupResidual',0),('stdin-max',"import sys;data=sys.stdin.buffer.read();print(len(data))",8,b'X'*327692,None,0),('pipes-max',"import sys;sys.stdout.buffer.write(b'A'*262144);sys.stdout.buffer.flush();sys.stderr.buffer.write(b'B'*262144);sys.stderr.buffer.flush()",8,None,None,0)]
 for label,code,timeout,stdin,expected,exitcode in cases:
  row,out,err=C.run('independent-highfd-'+label,[sys.executable,'-B','-c',code],HOST,timeout,env,input_bytes=stdin,required=False);host.append(row)
  good=row['failureClass']==expected and row['closeErrors']==[] and row['terminal']is True and row['ownedGroup']['absenceObserved']is True and row['pipeLimits']==262144 and row['stdinLimit']==327692 and row['stdinDeadlineSeconds']==12
  if exitcode is not None:good=good and row['exitCode']==exitcode
  if label=='success':good=good and out==b'pass'and err==b'err'
  if label=='stdout-overflow':good=good and len(out)==262144 and row['streamByteCounts']['stdout']==262145
  if label=='stderr-overflow':good=good and len(err)==262144 and row['streamByteCounts']['stderr']==262145
  if label=='deadline':good=good and row['elapsedSeconds']<4 and row['ownedGroup']['reconciliation']is not None
  if label=='residual':good=good and bool(row['ownedGroup']['reconciliation']['signals'])
  if label=='stdin-max':good=good and row['stdinBytes']==327692 and out==b'327692\n'
  if label=='pipes-max':good=good and len(out)==len(err)==262144
  check('independent-actual-highFD-'+label,good,{'highestPaddingFD':padding[-1],'failure':row['failureClass'],'terminal':row['terminal'],'elapsed':row['elapsedSeconds']})
 row,out,err=C.run('independent-highfd-missing',['/nonexistent-independent-U2-host-control'],HOST,8,env,required=False);host.append(row)
 check('independent-actual-highFD-missing',row['failureClass']=='FileNotFoundError'and row['terminal']is False and row['closeErrors']==[]and row['ownedGroup']['absenceObserved']is True)
 for timeout in [0,191]:
  error=None
  try:C.run('bad-timeout',[sys.executable],HOST,timeout,env)
  except ValueError as e:error=str(e)
  check('invalid-original-timeout-'+str(timeout),error=='finite_command_timeout_required')
 for stdin in [b'',b'X'*327693]:
  error=None
  try:C.run('bad-stdin',[sys.executable],HOST,1,env,input_bytes=stdin)
  except ValueError as e:error=str(e)
  check('invalid-original-stdin-'+str(len(stdin)),error=='finite_stdin_required')
 # Capacity remains one ledger: padding is owned zero-byte test data, no graph reset.
 check('single-ledger-host-peak-under4096',len(HELD)+len(padding)+32<=4096,{'heldInputs':len(HELD),'padding':len(padding),'reservedTransient':32})
 for fd in padding:os.close(fd)
 padding=[]
 write('independent-controls2.json',{'scope':'INDEPENDENT_SOURCE_MOCK_AND_LOCAL_HOST_ONLY_NOT_NATIVE_OR_DOCKER','controls':CONTROLS,'pass':sum(x['pass']for x in CONTROLS),'fail':sum(not x['pass']for x in CONTROLS),'findings':FINDINGS,'hostCommands':host,'actualHostCommands':len(host),'actualDockerCalls':0,'privateReads':0,'serviceCalls':0,'paidCalls':0,'sourceInputsHeld':len(HELD),'sourceBytes':total,'overflowAssessment':'Parser accepts overflow but sourceRows/sourceBytes exact-int guards and decodedBytes gate deny actual controlling fields; no demonstrated accepting path for infinity. Extra ignored fields are not authority. This alone is not a rejection finding.','sourceEligibility':False,'fullTask03':False,'fullGoal':False})
 print(json.dumps({'phase':'controls-and-host-complete','pass':sum(x['pass']for x in CONTROLS),'fail':sum(not x['pass']for x in CONTROLS),'hostCommands':len(host),'findings':FINDINGS}),flush=True)
 # Hold source graph while parent gets findings; report is emitted automatically.
 dimensions={'Requirement Fulfillment':2,'Correctness':2,'Maintainability':3,'Performance':4,'Security':3,'Test Coverage':4}
 verdict={'scope':'TASK03_ATTEMPT6_U2_INDEPENDENT_SOURCE_ONLY_REVIEW','verdict':'REJECT','score':3.0,'dimensions':dimensions,'findings':FINDINGS,'actualHostControls':len(host),'pass':sum(x['pass']for x in CONTROLS),'fail':sum(not x['pass']for x in CONTROLS),'independent':True,'currentAgentReuse':'Fresh native spawn blocked by thread limit. Same agent previously implemented Task04 only; authored no U2 and did not review Task04.','originalCommonByteConservation':True,'originalObserverByteCopies':True,'originalRootPinsNotRefreshed':True,'futureF2Epoch':'NOT_CLOSED_OR_REVIEWED; even repaired U2 source approval requires separate reviewed F2/live prerequisite graph and explicit Root handoff.','sourceEligibility':False,'enablingConsumerPublished':False,'nativePrivate':False,'fullTask03':False,'fullGoal':False,'reader1Failure':'Preserved separately; failed custody interval never claimed through final. Replacement final uses unchanged Root original PRE9/hash/bytes.'}
 report='''# Independent U2 source review\n\nREJECT, score 3.0/5. This is a bounded SOURCE_ONLY review of the separately authored Task03 U2 runner/Common/observer pair, not Task03 runtime acceptance or Task04 review. Current-agent reuse is explicit: native spawn was blocked by thread limit; this reviewer authored Task04 R3/C5, no U2, and left Task04 packets unchanged.\n\nThe exact original Common transform adds one scoped DefaultSelector helper and replaces exactly three control readiness expressions; every other byte is conserved. Both observer bodies equal their original source bytes. Independently exercised local host controls above descriptor1023 confirm readiness, finite timeout, stdout/stderr overflow, stdin/pipe ceilings, nonzero exit, missing executable, and residual owned-process cleanup. No Docker/private/network/service/credential/native target operation ran.\n\nThe complete operative cleanup contract is not acceptable: mocked execution of the actual runner finalizer and Python observer finalizer stops at the first close failure, leaving later owned FDs unattempted. An actual runner report-write failure also skips its entire held-input close loop. Dependency observer source opens a FD before a throwing maturity assertion registers ownership; capture/setup calls occur before its finally guard. These defects remain relevant even where copied unchanged from originals; no original resource assertion may be weakened to repair them.\n\nThe strict JSON helper accepts numeric overflow as infinity. This is demonstrated, but the actual controlling sourceRows/sourceBytes and decodedBytes contracts require exact int and reject infinity/float/bool aliases. No accepting infinity path was demonstrated; this is not independently scored as a source rejection finding. Future F2 strict typed source review remains mandatory.\n\nOne source/control/data ledger caps4096 owned input FDs,64MiB aggregate and16MiB perfile; source inputs remained held through this verdict publication and final requalification. HighFD dummy test descriptors were separately accounted within the same4096 ownership ceiling, with32 transient descriptors reserved. The original1914 source/destination custody contract,3828 descriptors,48 commands,190s command ceiling,2GiB memory and swap0 remain unchanged. No actual Linux custody, package readiness, or service behavior is inferred from host tests.\n\nFuture F2 epoch was not closed or reviewed. A repaired U2 source review must still explicitly require later independently reviewed F2/live prerequisites and a new Root explicit actual handoff. Source eligibility is false; no enabling consumer is published, native/private effects are unauthorized, full Task03 and full goal remain OPEN.\n\nReviewer reader1 prematurely queried a newly stopped own control before60s; it correctly denied before content and exited. The immutable failure receipt preserves the interrupted custody interval and absence of explicit closure evidence. This replacement reader uses the identical Root original68 PRE9/hash/size pins, not refreshed historical pins, and maintains a distinct completed held interval.\n\nDetailed dimensions, raw controls, findings and exact input rows are in verdict2.json, independent-controls2.json, reader2-first-original-pins-readback.json and reader2-held-through-verdict-FDclosure.json. Publication outputs self-exclude and require distinct later>=60s mature consumption.\n'''
 publication.append(write('report2.md',report.encode()));publication.append(write('verdict2.json',verdict))
 for row in HELD:
  data=read(row);assert sha(data)==row['sha256']
except BaseException as e:
 failure={'class':type(e).__name__,'reason':str(e)};print(json.dumps({'reviewerFailure':failure}),flush=True)
finally:
 for fd in padding:
  try:os.close(fd)
  except BaseException as e:close_errors.append({'paddingFD':fd,'error':type(e).__name__})
 for row in HELD:
  fd=row.pop('fd')
  try:os.close(fd);closed.append(row['path'])
  except BaseException as e:close_errors.append({'path':row['path'],'fd':fd,'error':type(e).__name__})
 closure={'scope':'REPLACEMENT_READER2_INPUTS_HELD_THROUGH_VERDICT_FULL_EOF_HASH_NINE_FINAL_EXPLICIT_CLOSE','failure':failure,'closeErrors':close_errors,'inputs':[{k:v for k,v in x.items()if k!='expected'}for x in HELD],'files':len(HELD),'bytes':total,'explicitCloses':len(closed),'closed':closed,'reportPublication':publication,'failedReader1IntervalNotAdopted':True,'sourceEligibility':False,'fullTask03':False,'fullGoal':False}
 write('reader2-held-through-verdict-FDclosure.json',closure)
 write('reader2-writer-stop.json',{'scope':'REVIEWER2_INPUTS_EXPLICITLY_CLOSED_REPORT_WRITERS_STOPPED','stoppedNs':str(time.time_ns()),'remainingWrites':[],'failure':failure,'closeErrors':close_errors,'laterFirstMatureReadbackRequired':True})
 print(json.dumps({'phase':'review-reader2-closed','failure':failure,'closeErrors':close_errors,'files':len(HELD),'explicitCloses':len(closed),'publication':publication}),flush=True)
if failure or close_errors:raise SystemExit(1)
